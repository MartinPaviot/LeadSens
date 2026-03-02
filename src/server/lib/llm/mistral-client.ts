import { Mistral } from "@mistralai/mistralai";
import type {
  Tool,
  ToolCall,
} from "@mistralai/mistralai/models/components";
import { z } from "zod/v4";
import { logAIEvent } from "@/lib/ai-events";
import type {
  StreamEvent,
  ChatStreamOptions,
  CompleteOptions,
  CompleteResult,
  JsonOptions,
  JsonRawOptions,
  DraftEmailOptions,
  DraftEmailResult,
  ToolDefinition,
} from "./types";

// ─── Client Singleton ─────────────────────────────────────

let _client: Mistral | null = null;

function getClient(): Mistral {
  if (!_client) {
    _client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY! });
  }
  return _client;
}

// ─── Zod → Mistral Tool Format ────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function zodToJsonSchema(schema: z.ZodType<any>): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  // Zod v4 adds "$schema" which confuses Mistral's function calling parser
  delete jsonSchema.$schema;
  return jsonSchema;
}

function toolDefsToMistralTools(
  tools: Record<string, ToolDefinition>,
): Tool[] {
  return Object.entries(tools).map(([name, def]) => ({
    type: "function" as const,
    function: {
      name,
      description: def.description,
      parameters: zodToJsonSchema(def.parameters),
    },
  }));
}

// ─── Phantom tool-call helpers ───────────────────────────
// Mistral sometimes emits tool-call syntax as plain text instead of proper
// tool_calls (e.g. "parse_icp{...}" or '{"parse_icp": ...}'). We detect
// these, extract the tool name + args, and re-execute the tool as if
// Mistral had called it properly. This makes the flow resilient to
// Mistral's function-calling flakiness.

interface PhantomToolCall {
  toolName: string;
  args: unknown;
}

/**
 * Extract brace-balanced JSON starting at `start` in `text`.
 * Returns the parsed object + end index, or null on failure.
 */
function extractBalancedJSON(
  text: string,
  start: number,
): { parsed: unknown; end: number } | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  let pos = start;
  let inString = false;
  let escape = false;

  while (pos < text.length) {
    const ch = text[pos];
    if (escape) {
      escape = false;
    } else if (ch === "\\") {
      escape = true;
    } else if (ch === '"') {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(text.slice(start, pos + 1));
            return { parsed, end: pos };
          } catch {
            return null;
          }
        }
      }
    }
    pos++;
  }
  return null;
}

/**
 * Try to find a phantom tool call in text. Handles formats:
 *   1. toolName{...json...}           — e.g. parse_icp{"description":"..."}
 *   2. {"toolName": {...args...}}      — e.g. {"parse_icp":{"description":"..."}}
 *   3. ```json\n{"toolName":...}\n```  — code-fenced JSON
 */
function tryExtractPhantomToolCall(
  text: string,
  toolNames: string[],
): PhantomToolCall | null {
  // Format 1: toolName{...}
  for (const name of toolNames) {
    const idx = text.indexOf(name);
    if (idx === -1) continue;

    let braceStart = idx + name.length;
    while (braceStart < text.length && /\s/.test(text[braceStart])) braceStart++;

    if (braceStart < text.length && text[braceStart] === "{") {
      const result = extractBalancedJSON(text, braceStart);
      if (result) {
        return { toolName: name, args: result.parsed };
      }
    }
  }

  // Format 2 & 3: JSON object with tool name as key (possibly in a code block)
  // Find any JSON object in the text
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "{") continue;
    const result = extractBalancedJSON(text, i);
    if (!result || typeof result.parsed !== "object" || result.parsed === null) continue;

    const obj = result.parsed as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Check if any key is a tool name
    for (const key of keys) {
      if (toolNames.includes(key)) {
        const args = obj[key];
        if (typeof args === "object" && args !== null) {
          return { toolName: key, args };
        }
        // Model generated {"toolName": "rawStringValue"} — the string
        // is the primary argument. Mark it for the caller to wrap.
        return { toolName: key, args: { __phantomRawArg: args } };
      }
    }

    // Check if the JSON itself looks like tool args (has known arg keys)
    // e.g. {"description": "VP Sales..."} is args for parse_icp
    if (keys.includes("description") && keys.length <= 2) {
      // Likely parse_icp args — look for the tool name nearby in the text
      for (const name of toolNames) {
        if (text.includes(name)) {
          return { toolName: name, args: result.parsed };
        }
      }
    }
    break; // Only check the first JSON object
  }

  return null;
}

/**
 * Strip phantom tool call text before showing to user (final fallback).
 */
function stripPhantomToolCalls(text: string, toolNames: string[]): string {
  if (!text || toolNames.length === 0) return text;

  let result = text;

  // 1. Strip "toolName{...}" with brace-balanced matching
  for (const name of toolNames) {
    let idx = 0;
    while (idx < result.length) {
      const nameIdx = result.indexOf(name, idx);
      if (nameIdx === -1) break;

      let braceStart = nameIdx + name.length;
      while (braceStart < result.length && /\s/.test(result[braceStart])) braceStart++;

      if (braceStart < result.length && result[braceStart] === "{") {
        const extracted = extractBalancedJSON(result, braceStart);
        if (extracted) {
          result = result.slice(0, nameIdx) + result.slice(extracted.end + 1);
          continue; // re-check same position
        }
        idx = nameIdx + name.length;
      } else {
        idx = nameIdx + name.length;
      }
    }
  }

  // 2. Strip markdown-link style phantom calls: [toolName]({...})
  for (const name of toolNames) {
    const linkPattern = new RegExp(
      `\\[${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]\\([^)]*\\)`,
      "g",
    );
    result = result.replace(linkPattern, "");
  }

  // 3. Strip JSON objects containing tool name keys: {"parse_icp": {...}}
  for (let i = 0; i < result.length; i++) {
    if (result[i] !== "{") continue;
    const extracted = extractBalancedJSON(result, i);
    if (!extracted || typeof extracted.parsed !== "object" || extracted.parsed === null) continue;
    const keys = Object.keys(extracted.parsed as Record<string, unknown>);
    if (keys.some((k) => toolNames.includes(k))) {
      result = result.slice(0, i) + result.slice(extracted.end + 1);
      continue; // re-check same position
    }
    break;
  }

  // 4. Strip code blocks containing tool calls
  result = result.replace(/```(?:json|javascript|js|python)?\s*\n?[\s\S]*?```/g, "");

  // 5. Strip degenerate repetitive output (e.g. "))))..." or "}}}}...")
  result = result.replace(/(.)\1{20,}/g, "");

  // 6. Clean up residual whitespace
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}

// ─── 1. chatStream — Streaming with tool loop ─────────────

export async function* chatStream(
  options: ChatStreamOptions,
): AsyncGenerator<StreamEvent> {
  const client = getClient();
  const model = options.model ?? "mistral-large-latest";
  const maxSteps = options.maxSteps ?? 5;
  const mistralTools = options.tools
    ? toolDefsToMistralTools(options.tools)
    : undefined;

  // Build message history in Mistral format
  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: options.system },
    ...options.messages.map((m) => {
      if (m.role === "tool") {
        return {
          role: "tool",
          content: m.content,
          toolCallId: m.toolCallId,
          name: m.toolName,
        };
      }
      return { role: m.role, content: m.content };
    }),
  ];

  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let step = 0;
  let phantomRecoveries = 0;
  const MAX_PHANTOM_RECOVERIES = 3;

  while (step < maxSteps) {
    step++;
    const startMs = Date.now();

    // Wrap API call in try-catch — phantom recovery can produce message
    // formats that Mistral rejects, so we need graceful fallback.
    let stream;
    try {
      stream = await client.chat.stream({
        model,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messages: messages as any,
        tools: mistralTools,
        toolChoice: mistralTools ? "auto" : undefined,
        temperature: options.temperature ?? 0.7,
      });
    } catch (err) {
      console.error("[chatStream] Mistral API error at step", step, err);
      // If this was after a phantom recovery, try one final call without
      // the phantom messages (strip last 2 messages: assistant + tool)
      if (phantomRecoveries > 0 && messages.length >= 3) {
        console.log("[chatStream] Retrying without phantom messages");
        messages.splice(-2); // Remove the phantom assistant + tool messages
        try {
          stream = await client.chat.stream({
            model,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            messages: messages as any,
            tools: mistralTools,
            toolChoice: mistralTools ? "auto" : undefined,
            temperature: options.temperature ?? 0.7,
          });
        } catch (retryErr) {
          console.error("[chatStream] Retry also failed:", retryErr);
          yield { type: "text-delta" as const, delta: "Sorry, a technical error occurred. Please try your message again." };
          yield { type: "finish", usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, totalSteps: step }, finishReason: "stop" };
          return;
        }
      } else {
        yield { type: "text-delta" as const, delta: "Sorry, a technical error occurred. Please try your message again." };
        yield { type: "finish", usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, totalSteps: step }, finishReason: "stop" };
        return;
      }
    }

    let assistantContent = "";
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let stepTokensIn = 0;
    let stepTokensOut = 0;
    let finishReason = "stop";
    const stepTextChunks: string[] = [];

    for await (const event of stream) {
      const choice = event.data?.choices?.[0];
      if (!choice) continue;

      // Text delta — buffer instead of yielding immediately.
      // We only emit text from the FINAL step (no tool calls).
      // Intermediate text (between tool-call rounds) is suppressed
      // so the user never sees "je relance la recherche..." etc.
      const delta = choice.delta;
      if (delta?.content && typeof delta.content === "string") {
        assistantContent += delta.content;
        stepTextChunks.push(delta.content);
      }

      // Tool calls — accumulate across streaming chunks.
      // Mistral sends partial tool calls: first chunk has id/name,
      // subsequent chunks append to the arguments string.
      if (delta?.toolCalls) {
        for (const tc of delta.toolCalls as ToolCall[]) {
          const idx = tc.index ?? 0;
          const existing = toolCallMap.get(idx);
          if (!existing) {
            const argStr = tc.function?.arguments != null
              ? (typeof tc.function.arguments === "string"
                  ? tc.function.arguments
                  : JSON.stringify(tc.function.arguments))
              : "";
            toolCallMap.set(idx, {
              id: tc.id ?? "",
              name: tc.function?.name ?? "",
              arguments: argStr,
            });
          } else {
            if (tc.id) existing.id = tc.id;
            if (tc.function?.name) existing.name = tc.function.name;
            if (tc.function?.arguments != null) {
              const argStr = typeof tc.function.arguments === "string"
                ? tc.function.arguments
                : JSON.stringify(tc.function.arguments);
              existing.arguments += argStr;
            }
          }
        }
      }

      // Finish reason
      if (choice.finishReason) {
        finishReason = choice.finishReason;
      }

      // Usage (available on last chunk)
      if (event.data?.usage) {
        stepTokensIn = event.data.usage.promptTokens ?? 0;
        stepTokensOut = event.data.usage.completionTokens ?? 0;
      }
    }

    // Rebuild toolCalls from accumulated map
    const toolCalls: ToolCall[] = Array.from(toolCallMap.entries()).map(
      ([idx, tc]) => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.arguments },
        index: idx,
      }),
    );

    totalTokensIn += stepTokensIn;
    totalTokensOut += stepTokensOut;

    const latencyMs = Date.now() - startMs;

    yield {
      type: "step-complete",
      usage: { tokensIn: stepTokensIn, tokensOut: stepTokensOut },
    };

    // Log this step
    logAIEvent({
      workspaceId: options.workspaceId,
      model,
      action: "chat-stream",
      tokensIn: stepTokensIn,
      tokensOut: stepTokensOut,
      latencyMs,
    }).catch(() => {}); // Fire and forget

    // If no tool calls, check for phantom tool calls before finishing
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      const rawText = stepTextChunks.join("");
      const toolNames = options.tools ? Object.keys(options.tools) : [];

      // ── Phantom tool call recovery ──
      // Mistral sometimes outputs tool calls as text instead of using
      // the function calling API. Detect this, execute the tool, and
      // inject the result as a plain assistant message (NOT tool_calls
      // format which Mistral can reject with fabricated IDs).
      if (
        phantomRecoveries < MAX_PHANTOM_RECOVERIES &&
        toolNames.length > 0
      ) {
        const phantom = tryExtractPhantomToolCall(rawText, toolNames);

        if (phantom && options.tools && phantom.toolName in options.tools) {
          phantomRecoveries++;
          const toolDef = options.tools[phantom.toolName];

          // Fix phantom args: when Mistral generates {"toolName": "rawString"},
          // wrap the raw value into the tool's expected parameter format.
          let fixedArgs = phantom.args;
          if (
            typeof fixedArgs === "object" &&
            fixedArgs !== null &&
            "__phantomRawArg" in (fixedArgs as Record<string, unknown>)
          ) {
            const rawValue = (fixedArgs as Record<string, unknown>).__phantomRawArg;
            // Introspect the tool's parameter schema to find the right param name
            const paramSchema = zodToJsonSchema(toolDef.parameters);
            const props = paramSchema.properties as Record<string, unknown> | undefined;
            const requiredParams = Array.isArray(paramSchema.required)
              ? (paramSchema.required as string[])
              : [];
            const firstParam = requiredParams[0]
              ?? (props ? Object.keys(props)[0] : "description");
            fixedArgs = { [firstParam]: rawValue };
          }

          console.log(`[chatStream] Phantom recovery #${phantomRecoveries}: ${phantom.toolName}`, JSON.stringify(fixedArgs).slice(0, 200));

          const phantomId = `phantom-${Date.now()}`;

          yield { type: "tool-input-start", toolCallId: phantomId, toolName: phantom.toolName };
          yield { type: "tool-input-available", toolCallId: phantomId, input: fixedArgs };

          // Execute the phantom tool
          let output: unknown;
          try {
            output = await toolDef.execute(fixedArgs, {
              workspaceId: options.workspaceId,
              userId: options.userId ?? "",
              onStatus: options.onStatus,
            });
          } catch (err) {
            output = { error: err instanceof Error ? err.message : "Tool execution failed" };
          }

          yield { type: "tool-output-available", toolCallId: phantomId, output };

          // Inject tool result as plain messages (avoid tool_calls format
          // which requires matching IDs that Mistral can reject).
          // The assistant "acknowledges" calling the tool, and the result
          // is injected as a user context message so Mistral continues.
          messages.push({
            role: "assistant",
            content: `I called ${phantom.toolName}.`,
          });
          messages.push({
            role: "user",
            content: `[Tool result from ${phantom.toolName}]:\n${JSON.stringify(output).slice(0, 4000)}`,
          });

          // Continue the loop — Mistral will see the tool result and
          // should call the next tool (e.g. instantly_count_leads)
          continue;
        }
      }

      // ── Normal finish: strip any remaining phantom text and emit ──
      const fullText = stripPhantomToolCalls(rawText, toolNames);
      if (fullText) {
        yield { type: "text-delta" as const, delta: fullText };
      }
      yield {
        type: "finish",
        usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, totalSteps: step },
        finishReason,
      };
      return;
    }
    // Tool-calling step: text is suppressed (not yielded to user)
    // but stays in assistantContent for the LLM's context

    // Tool calling loop
    // Add assistant message with tool calls
    messages.push({
      role: "assistant",
      content: assistantContent || "",
      toolCalls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.function.name, arguments: tc.function.arguments },
      })),
    });

    // Execute each tool
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const toolDef = options.tools?.[toolName];

      yield {
        type: "tool-input-start",
        toolCallId: toolCall.id ?? "",
        toolName,
      };

      // Parse arguments
      let args: unknown;
      try {
        args =
          typeof toolCall.function.arguments === "string"
            ? JSON.parse(toolCall.function.arguments)
            : toolCall.function.arguments;
      } catch {
        args = {};
      }

      yield {
        type: "tool-input-available",
        toolCallId: toolCall.id ?? "",
        input: args,
      };

      // Execute tool
      let output: unknown;
      try {
        if (!toolDef) {
          output = { error: `Unknown tool: ${toolName}` };
        } else {
          output = await toolDef.execute(args, {
            workspaceId: options.workspaceId,
            userId: options.userId ?? "",
            onStatus: options.onStatus,
          });
        }
      } catch (err) {
        output = {
          error: err instanceof Error ? err.message : "Tool execution failed",
        };
      }

      yield {
        type: "tool-output-available",
        toolCallId: toolCall.id ?? "",
        output,
      };

      // Add tool result to messages
      messages.push({
        role: "tool",
        content: JSON.stringify(output),
        toolCallId: toolCall.id,
        name: toolName,
      });
    }
  }

  // Max steps reached — force one final call WITHOUT tools so the LLM
  // generates a text response instead of leaving the user with nothing.
  {
    const finalStream = await client.chat.stream({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      tools: undefined,
      toolChoice: undefined,
      temperature: options.temperature ?? 0.7,
    });

    let finalTokensIn = 0;
    let finalTokensOut = 0;

    for await (const event of finalStream) {
      const choice = event.data?.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;
      if (delta?.content && typeof delta.content === "string") {
        yield { type: "text-delta", delta: delta.content };
      }

      if (event.data?.usage) {
        finalTokensIn = event.data.usage.promptTokens ?? 0;
        finalTokensOut = event.data.usage.completionTokens ?? 0;
      }
    }

    totalTokensIn += finalTokensIn;
    totalTokensOut += finalTokensOut;

    logAIEvent({
      workspaceId: options.workspaceId,
      model,
      action: "chat-stream-final",
      tokensIn: finalTokensIn,
      tokensOut: finalTokensOut,
      latencyMs: 0,
    }).catch(() => {});
  }

  yield {
    type: "finish",
    usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, totalSteps: step },
    finishReason: "max_steps",
  };
}

// ─── 2. complete — Simple non-streaming call ──────────────

export async function complete(options: CompleteOptions): Promise<CompleteResult> {
  const client = getClient();
  const model = options.model ?? "mistral-large-latest";
  const startMs = Date.now();

  const response = await client.chat.complete({
    model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ],
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens,
  });

  const latencyMs = Date.now() - startMs;
  const tokensIn = response.usage?.promptTokens ?? 0;
  const tokensOut = response.usage?.completionTokens ?? 0;

  logAIEvent({
    workspaceId: options.workspaceId,
    model,
    action: options.action,
    tokensIn,
    tokensOut,
    latencyMs,
  }).catch(() => {});

  const text =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

  return { text, usage: { tokensIn, tokensOut } };
}

// ─── 3. json<T> — JSON output with Zod validation ────────

export async function json<T>(options: JsonOptions<T>): Promise<T> {
  const client = getClient();
  const model = options.model ?? "mistral-small-latest";
  const startMs = Date.now();

  const response = await client.chat.complete({
    model,
    messages: [
      {
        role: "system",
        content: `${options.system}\n\nJSON only, no markdown, no comments.`,
      },
      { role: "user", content: options.prompt },
    ],
    responseFormat: { type: "json_object" },
    temperature: options.temperature ?? 0.3,
  });

  const latencyMs = Date.now() - startMs;
  const tokensIn = response.usage?.promptTokens ?? 0;
  const tokensOut = response.usage?.completionTokens ?? 0;

  logAIEvent({
    workspaceId: options.workspaceId,
    model,
    action: options.action,
    tokensIn,
    tokensOut,
    latencyMs,
  }).catch(() => {});

  const raw =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `LLM returned invalid JSON for action "${options.action}": ${raw.slice(0, 200)}`,
    );
  }
  return options.schema.parse(parsed);
}

// ─── 3b. jsonRaw — JSON output without Zod (for manual validation) ──

export async function jsonRaw(options: JsonRawOptions): Promise<unknown> {
  const client = getClient();
  const model = options.model ?? "mistral-small-latest";
  const startMs = Date.now();

  const response = await client.chat.complete({
    model,
    messages: [
      {
        role: "system",
        content: `${options.system}\n\nJSON only, no markdown, no comments.`,
      },
      { role: "user", content: options.prompt },
    ],
    responseFormat: { type: "json_object" },
    temperature: options.temperature ?? 0.3,
  });

  const latencyMs = Date.now() - startMs;
  const tokensIn = response.usage?.promptTokens ?? 0;
  const tokensOut = response.usage?.completionTokens ?? 0;

  logAIEvent({
    workspaceId: options.workspaceId,
    model,
    action: options.action,
    tokensIn,
    tokensOut,
    latencyMs,
  }).catch(() => {});

  const raw =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(
      `LLM returned invalid JSON for action "${options.action}": ${raw.slice(0, 200)}`,
    );
  }
}

// ─── 4. draftEmail — Specialized for email drafting ───────

const emailResultSchema = z.object({
  subject: z.string(),
  body: z.string(),
});

export async function draftEmail(
  options: DraftEmailOptions,
): Promise<DraftEmailResult> {
  const client = getClient();
  const model = "mistral-large-latest";
  const startMs = Date.now();

  const response = await client.chat.complete({
    model,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: options.prompt },
    ],
    responseFormat: { type: "json_object" },
    temperature: 0.8,
    maxTokens: 1024,
  });

  const latencyMs = Date.now() - startMs;
  const tokensIn = response.usage?.promptTokens ?? 0;
  const tokensOut = response.usage?.completionTokens ?? 0;

  logAIEvent({
    workspaceId: options.workspaceId,
    model,
    action: "draft-email",
    tokensIn,
    tokensOut,
    latencyMs,
  }).catch(() => {});

  const raw =
    typeof response.choices?.[0]?.message?.content === "string"
      ? response.choices[0].message.content
      : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `LLM returned invalid JSON for draft-email: ${raw.slice(0, 200)}`,
    );
  }
  return emailResultSchema.parse(parsed);
}

// ─── Exported as namespace-like object ────────────────────

export const mistralClient = {
  chatStream,
  complete,
  json,
  jsonRaw,
  draftEmail,
};
