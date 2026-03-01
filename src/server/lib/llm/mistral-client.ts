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
  return z.toJSONSchema(schema) as Record<string, unknown>;
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

  while (step < maxSteps) {
    step++;
    const startMs = Date.now();

    const stream = await client.chat.stream({
      model,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: messages as any,
      tools: mistralTools,
      toolChoice: mistralTools ? "auto" : undefined,
      temperature: options.temperature ?? 0.7,
    });

    let assistantContent = "";
    let toolCalls: ToolCall[] = [];
    let stepTokensIn = 0;
    let stepTokensOut = 0;
    let finishReason = "stop";

    for await (const event of stream) {
      const choice = event.data?.choices?.[0];
      if (!choice) continue;

      // Text delta
      const delta = choice.delta;
      if (delta?.content && typeof delta.content === "string") {
        assistantContent += delta.content;
        yield { type: "text-delta", delta: delta.content };
      }

      // Tool calls (accumulated across chunks)
      if (delta?.toolCalls) {
        toolCalls = delta.toolCalls as ToolCall[];
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

    // If no tool calls, we're done
    if (finishReason !== "tool_calls" || toolCalls.length === 0) {
      yield {
        type: "finish",
        usage: { tokensIn: totalTokensIn, tokensOut: totalTokensOut, totalSteps: step },
        finishReason,
      };
      return;
    }

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

  // Max steps reached
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
