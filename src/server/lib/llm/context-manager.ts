import type { ChatMessage } from "./types";

// ─── Token Estimation ───────────────────────────────────

/** Rough token estimate. With 24K target vs 128K model limit, errors are absorbed. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.7);
}

// ─── Strip @@INLINE@@ Markers ────────────────────────────

const INLINE_MARKER_RE = /\n*@@INLINE@@[\s\S]*?@@END@@\n*/g;

/** Remove all @@INLINE@@...@@END@@ rendering markers from content. */
export function stripInlineMarkers(content: string): string {
  return content.replace(INLINE_MARKER_RE, "");
}

// ─── Deep Compress (Level 2) ─────────────────────────────
//
// Tool outputs fall into known categories. Each one gets tailored
// compression that keeps what the LLM actually needs for the next
// tool call, and drops what it doesn't.
//
// Key insight: the LLM needs IDs and counts to chain tools.
// It does NOT need full lead objects, enrichment payloads, or
// rendering data to decide what to do next.

const MAX_STRING_LENGTH = 300;
const MAX_ARRAY_DISPLAY = 5;

/** Truncate a string value, preserving start for context. */
function truncateString(val: string, max = MAX_STRING_LENGTH): string {
  if (val.length <= max) return val;
  return val.slice(0, max) + "…";
}

/**
 * Compress an array: if it's IDs (strings), keep all.
 * If it's objects (leads, emails), summarize to count + first N samples.
 */
function compressArray(arr: unknown[], key: string): unknown {
  if (arr.length === 0) return arr;

  // ID arrays: keep intact (critical for tool chaining)
  if (key === "lead_ids" || key === "lead_id" || key.endsWith("_ids")) {
    return arr;
  }

  // Small arrays: keep as-is
  if (arr.length <= MAX_ARRAY_DISPLAY) {
    return arr.map((item) => compressValue(item, ""));
  }

  // Large arrays of objects (leads, emails, accounts): summarize
  const first = arr[0];
  if (typeof first === "object" && first !== null) {
    const samples = arr.slice(0, MAX_ARRAY_DISPLAY).map((item) => compressValue(item, ""));
    return {
      _count: arr.length,
      _samples: samples,
    };
  }

  // Large arrays of primitives: truncate
  return arr.slice(0, MAX_ARRAY_DISPLAY);
}

/**
 * Recursively compress a value: truncate strings, summarize arrays,
 * strip deep objects that the LLM doesn't need.
 */
function compressValue(val: unknown, key: string): unknown {
  if (val === null || val === undefined) return val;

  if (typeof val === "string") return truncateString(val);
  if (typeof val === "number" || typeof val === "boolean") return val;

  if (Array.isArray(val)) return compressArray(val, key);

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Skip nested rendering keys at any depth
      if (k === "__component" || k === "__components" || k === "props") continue;
      // Skip heavy enrichment blobs the LLM doesn't need in context
      if (k === "enrichmentData" || k === "enrichment" || k === "icpBreakdown") continue;
      result[k] = compressValue(v, k);
    }
    return result;
  }

  return val;
}

// ─── Compress Tool Output (called from mistral-client) ───

/**
 * Compress tool output before injecting into the LLM's message context.
 *
 * Level 1: Strip rendering keys (__component, __components, props)
 * Level 2: Deep compress — truncate strings, summarize large arrays,
 *          strip enrichment blobs, keep IDs and counts intact.
 */
export function compressToolOutput(output: unknown): string {
  if (output === null || output === undefined) {
    return "null";
  }

  if (typeof output !== "object") {
    return JSON.stringify(output);
  }

  if (Array.isArray(output)) {
    return JSON.stringify(compressArray(output, ""));
  }

  const obj = output as Record<string, unknown>;
  const cleaned: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Level 1: strip rendering keys
    if (key === "__component" || key === "__components" || key === "props") {
      continue;
    }
    // Level 2: deep compress each value
    cleaned[key] = compressValue(value, key);
  }

  return JSON.stringify(cleaned);
}

// ─── Message Classification ──────────────────────────────
//
// Not all messages are equal. A message containing lead_ids is
// critical for tool chaining. A "ok go ahead" is disposable.
// Classification drives smart windowing.

type MessagePriority = "critical" | "semantic" | "filler";

/** IDs and pipeline data the LLM needs to chain tools. */
const CRITICAL_PATTERNS = [
  /lead_ids/,
  /campaign_id/,
  /search_filters/,
  /\bsourced\b.*\blead/i,
  /\bscored\b.*\blead/i,
  /\benriched\b.*\blead/i,
];

/** Short confirmations that carry no information. */
const FILLER_PATTERNS = [
  /^(ok|oui|yes|go|sure|let'?s do it|parfait|go ahead|d'accord|c'est bon|allez|lance|vas-?y|fais-?le|envoie)[\s!.]*$/i,
];

function classifyMessage(msg: ChatMessage): MessagePriority {
  const content = msg.content.trim();

  // User confirmations are filler
  if (msg.role === "user" && FILLER_PATTERNS.some((p) => p.test(content))) {
    return "filler";
  }

  // Messages with IDs or pipeline data are critical
  if (CRITICAL_PATTERNS.some((p) => p.test(content))) {
    return "critical";
  }

  // First user message is always critical (contains ICP/intent)
  // (handled separately in windowing, not here)

  return "semantic";
}

// ─── Summarize Dropped Messages (Level 3) ────────────────
//
// Instead of a static "[trimmed]" message, we rule-based summarize
// what was dropped so the LLM keeps conversational coherence.

function summarizeDroppedMessages(messages: ChatMessage[]): string {
  if (messages.length === 0) return "";

  const toolCalls: string[] = [];
  const userActions: string[] = [];

  for (const msg of messages) {
    if (msg.role === "assistant") {
      // Extract tool call references from assistant messages
      const toolMentions = msg.content.match(/\b(parse_icp|instantly_\w+|score_leads|enrich_leads|draft_emails|render_\w+|search_leads|generate_campaign_angle)\b/g);
      if (toolMentions) {
        for (const t of new Set(toolMentions)) {
          if (!toolCalls.includes(t)) toolCalls.push(t);
        }
      }
    }

    if (msg.role === "user") {
      const content = msg.content.trim();
      // Skip filler
      if (FILLER_PATTERNS.some((p) => p.test(content))) continue;
      // Summarize user intent to first 80 chars
      userActions.push(truncateString(content, 80));
    }
  }

  const parts: string[] = [];
  if (toolCalls.length > 0) {
    parts.push(`Tools executed: ${toolCalls.join(", ")}`);
  }
  if (userActions.length > 0) {
    parts.push(`User actions: ${userActions.join(" → ")}`);
  }

  if (parts.length === 0) {
    return "[Earlier conversation trimmed. See pipeline state above for current progress.]";
  }

  return `[Earlier conversation trimmed]\n${parts.join("\n")}\n[See pipeline state above for current progress.]`;
}

// ─── Compress Historical Messages (Level 2) ──────────────
//
// Messages from previous turns may contain raw tool results
// embedded as text (via phantom recovery or [Tool result from X]).
// We compress those too.

const TOOL_RESULT_RE = /\[Tool result from \w+\]:\n({[\s\S]*})/;

function compressHistoricalMessage(msg: ChatMessage): ChatMessage {
  // Only compress user messages that contain phantom tool results
  if (msg.role === "user") {
    const match = msg.content.match(TOOL_RESULT_RE);
    if (match) {
      try {
        const parsed = JSON.parse(match[1]);
        const compressed = compressToolOutput(parsed);
        return {
          ...msg,
          content: msg.content.replace(match[1], compressed),
        };
      } catch {
        // Not valid JSON, leave as-is
      }
    }
  }

  return msg;
}

// ─── Prepare Messages for LLM ────────────────────────────

const TOKEN_BUDGET = 24_000;

export interface PrepareResult {
  messages: ChatMessage[];
  rawTokens: number;
  cleanTokens: number;
  markersStripped: number;
  toolResultsCompressed: number;
  windowed: boolean;
}

/**
 * 4-level progressive compression:
 *
 * Level 0: Raw messages (input)
 * Level 1: Strip @@INLINE@@ markers from assistant messages
 * Level 2: Compress historical tool results embedded in messages
 * Level 3: Smart windowing — classify messages, keep critical + recent,
 *          summarize dropped middle section
 */
export function prepareMessagesForLLM(
  messages: ChatMessage[],
  systemTokens: number,
  toolSchemaTokens: number,
): PrepareResult {
  // ── Level 0: Measure raw ──
  const rawMessageTokens = messages.reduce(
    (sum, m) => sum + estimateTokens(m.content),
    0,
  );
  const rawTokens = systemTokens + toolSchemaTokens + rawMessageTokens;

  // ── Level 1: Strip inline markers ──
  let markersStripped = 0;
  let level1 = messages.map((m) => {
    if (m.role !== "assistant" || !m.content.includes("@@INLINE@@")) {
      return m;
    }
    const count = (m.content.match(/@@INLINE@@/g) || []).length;
    markersStripped += count;
    return { ...m, content: stripInlineMarkers(m.content) };
  });

  // ── Level 2: Compress historical tool results ──
  let toolResultsCompressed = 0;
  level1 = level1.map((m) => {
    const compressed = compressHistoricalMessage(m);
    if (compressed !== m) toolResultsCompressed++;
    return compressed;
  });

  // Measure after Level 1+2
  const level2Tokens =
    systemTokens +
    toolSchemaTokens +
    level1.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // If under budget or too few messages to window, stop here
  if (level2Tokens <= TOKEN_BUDGET || level1.length <= 7) {
    return {
      messages: level1,
      rawTokens,
      cleanTokens: level2Tokens,
      markersStripped,
      toolResultsCompressed,
      windowed: false,
    };
  }

  // ── Level 3: Smart windowing ──

  // Always keep first user message (ICP/intent)
  const firstUserIdx = level1.findIndex((m) => m.role === "user");
  const firstUser = firstUserIdx >= 0 ? [level1[firstUserIdx]] : [];

  // Always keep last 6 messages (3 turn pairs) — recent context
  const recentMessages = level1.slice(-6);
  const middleStart = firstUserIdx >= 0 ? firstUserIdx + 1 : 0;
  const middleEnd = level1.length - 6;

  // The "middle" is everything between first user message and recent
  const middleMessages = middleEnd > middleStart
    ? level1.slice(middleStart, middleEnd)
    : [];

  // From the middle, rescue critical messages (contain IDs the LLM needs)
  const rescuedCritical: ChatMessage[] = [];
  const droppedMessages: ChatMessage[] = [];

  for (const msg of middleMessages) {
    const priority = classifyMessage(msg);
    if (priority === "critical") {
      rescuedCritical.push(msg);
    } else {
      droppedMessages.push(msg);
    }
  }

  // Build the summary of what was dropped
  const summary = summarizeDroppedMessages(droppedMessages);
  const trimNotice: ChatMessage = {
    role: "system",
    content: summary,
  };

  const windowed = [
    ...firstUser,
    ...rescuedCritical,
    trimNotice,
    ...recentMessages,
  ];

  const windowedTokens =
    systemTokens +
    toolSchemaTokens +
    windowed.reduce((sum, m) => sum + estimateTokens(m.content), 0);

  // If rescued critical messages put us back over budget,
  // compress them aggressively (keep only IDs)
  if (windowedTokens > TOKEN_BUDGET && rescuedCritical.length > 0) {
    const compressedCritical = rescuedCritical.map((m) => {
      // Extract just the IDs and counts from critical messages
      const idMatches = m.content.match(/"lead_ids"\s*:\s*\[[^\]]*\]/g);
      const campaignMatch = m.content.match(/"campaign_id"\s*:\s*"[^"]*"/);
      const parts: string[] = [];
      if (idMatches) parts.push(...idMatches);
      if (campaignMatch) parts.push(campaignMatch[0]);
      if (parts.length > 0) {
        return { ...m, content: `{${parts.join(", ")}}` };
      }
      // Can't extract IDs — truncate to 200 chars
      return { ...m, content: truncateString(m.content, 200) };
    });

    const fallback = [
      ...firstUser,
      ...compressedCritical,
      trimNotice,
      ...recentMessages,
    ];

    const fallbackTokens =
      systemTokens +
      toolSchemaTokens +
      fallback.reduce((sum, m) => sum + estimateTokens(m.content), 0);

    return {
      messages: fallback,
      rawTokens,
      cleanTokens: fallbackTokens,
      markersStripped,
      toolResultsCompressed,
      windowed: true,
    };
  }

  return {
    messages: windowed,
    rawTokens,
    cleanTokens: windowedTokens,
    markersStripped,
    toolResultsCompressed,
    windowed: true,
  };
}
