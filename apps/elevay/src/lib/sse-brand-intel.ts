/**
 * Brand-intel SSE stream helper.
 *
 * Lightweight wrapper around ReadableStream for agent SSE events.
 * Uses the same SSE wire format but with brand-intel event types
 * (status, result, finish) instead of chat events.
 */

const SSE_HEADERS: HeadersInit = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
}

type Emit = (event: string, data: Record<string, unknown>) => void

/**
 * Create an SSE Response that runs an async callback.
 * The callback receives an `emit(event, data)` function to send events.
 *
 * Compatible with brand-intello's dashboard SSE consumer.
 */
export function createSSEStream(
  callback: (emit: Emit) => Promise<void>,
): Response {
  const encoder = new TextEncoder()
  let id = 0

  const stream = new ReadableStream({
    async start(controller) {
      const emit: Emit = (event, data) => {
        const lines = [
          `id: ${id++}`,
          `event: ${event}`,
          `data: ${JSON.stringify(data)}`,
          "",
          "",
        ]
        controller.enqueue(encoder.encode(lines.join("\n")))
      }

      try {
        await callback(emit)
      } catch (err) {
        emit("error", { message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, { headers: SSE_HEADERS })
}
