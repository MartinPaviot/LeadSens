import type { IncomingMessage, SMIPlatform, MessageType } from "../core/types"

/**
 * Normalize a webhook payload into a unified IncomingMessage format.
 * Each platform sends different payload structures — this normalizes them.
 */
export function normalizeMessage(
  platform: SMIPlatform,
  payload: Record<string, unknown>,
): IncomingMessage {
  return {
    id: String(payload["id"] ?? payload["message_id"] ?? `msg_${Date.now()}`),
    platform,
    type: detectMessageType(payload),
    author: {
      id: String(payload["author_id"] ?? payload["user_id"] ?? "unknown"),
      name: String(payload["author_name"] ?? payload["user_name"] ?? "Unknown"),
      handle: String(payload["author_handle"] ?? payload["username"] ?? "unknown"),
      followers: typeof payload["followers_count"] === "number"
        ? payload["followers_count"]
        : undefined,
      verified: typeof payload["verified"] === "boolean"
        ? payload["verified"]
        : undefined,
    },
    content: String(payload["content"] ?? payload["text"] ?? payload["message"] ?? ""),
    timestamp: String(payload["timestamp"] ?? payload["created_at"] ?? new Date().toISOString()),
    parentPostId: typeof payload["parent_post_id"] === "string"
      ? payload["parent_post_id"]
      : undefined,
    parentPostContent: typeof payload["parent_content"] === "string"
      ? payload["parent_content"]
      : undefined,
  }
}

function detectMessageType(payload: Record<string, unknown>): MessageType {
  const type = String(payload["type"] ?? payload["message_type"] ?? "")
  if (type.includes("dm") || type.includes("direct")) return "dm"
  if (type.includes("mention")) return "mention"
  if (type.includes("reply")) return "reply"
  return "comment"
}
