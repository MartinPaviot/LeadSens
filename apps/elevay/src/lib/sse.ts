// ─── SSE Production-Grade Encoder ─────────────────────────
//
// W3C-compliant Server-Sent Events with:
// - Named events (event:)
// - Auto-increment IDs (id:)
// - Keepalive pings (: comment lines)
// - Retry directive for client reconnection
// - Type-safe event payloads

// ─── Event Types ──────────────────────────────────────────

export type SSEEventName =
  | "stream-start"
  | "text-delta"
  | "tool-input-start"
  | "tool-input-available"
  | "tool-output-available"
  | "status"
  | "step-complete"
  | "finish"
  | "error"
  | "stream-end"
  | "result";

export type SSEEventPayload = {
  "stream-start": {
    streamId: string;
    conversationId: string;
    ts: number;
  };
  "text-delta": { delta: string };
  "tool-input-start": { toolCallId: string; toolName: string };
  "tool-input-available": { toolCallId: string; input: unknown };
  "tool-output-available": { toolCallId: string; output: unknown };
  status: { label: string; step?: number; total?: number };
  "step-complete": { tokensIn: number; tokensOut: number };
  finish: {
    tokensIn: number;
    tokensOut: number;
    totalSteps: number;
    finishReason: string;
  };
  error: { message: string };
  "stream-end": Record<string, never>;
  result: { bpiOutput?: unknown; mtsOutput?: unknown; brandName: string };
};

export interface TypedSSEEvent<E extends SSEEventName = SSEEventName> {
  event: E;
  data: SSEEventPayload[E];
  id: number;
}

// ─── SSEEncoder Class ─────────────────────────────────────

export class SSEEncoder {
  private _id = 0;
  private _encoder = new TextEncoder();

  /** Encode a named event with auto-increment ID */
  encode<E extends SSEEventName>(
    event: E,
    data: SSEEventPayload[E],
  ): Uint8Array {
    const id = this._id++;
    const jsonStr = JSON.stringify(data);
    // SSE spec: newlines in data must be split across separate data: lines
    const dataLines = jsonStr.split("\n").map((line) => `data: ${line}`);
    const lines = [
      `id: ${id}`,
      `event: ${event}`,
      ...dataLines,
      "",
      "",
    ];
    return this._encoder.encode(lines.join("\n"));
  }

  /** Send a keepalive comment (ignored by SSE parsers, keeps connection alive) */
  ping(): Uint8Array {
    return this._encoder.encode(`:ping ${Date.now()}\n\n`);
  }

  /** Send retry directive (instructs client reconnection delay in ms) */
  retryDirective(ms = 3000): Uint8Array {
    return this._encoder.encode(`retry: ${ms}\n\n`);
  }

  /** Current event ID counter */
  get currentId(): number {
    return this._id;
  }
}

// ─── Standard SSE Headers ─────────────────────────────────

export const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

// ─── Helper ───────────────────────────────────────────────

export function generateStreamId(): string {
  return `stream_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Callback-Style SSE Stream ───────────────────────────
//
// Simpler API for agent routes that don't need the full SSEEncoder.
// Wraps an async callback with an emit() function.

type Emit = (event: string, data: Record<string, unknown>) => void;

/**
 * Create an SSE Response that runs an async callback.
 * The callback receives an `emit(event, data)` function to send events.
 */
export function createSSEStream(
  callback: (emit: Emit) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  let id = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (event, data) => {
        const lines = [
          `id: ${id++}`,
          `event: ${event}`,
          `data: ${JSON.stringify(data)}`,
          "",
          "",
        ];
        controller.enqueue(encoder.encode(lines.join("\n")));
      };

      try {
        await callback(emit);
      } catch (err) {
        emit("error", { message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
