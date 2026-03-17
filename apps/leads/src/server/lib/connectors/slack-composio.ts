/**
 * Slack Composio Connector — NotificationProvider backed by Composio actions.
 *
 * Replaces direct Slack HTTP API calls with Composio SDK execution.
 * Uses SLACK_SEND_MESSAGE and SLACK_FIND_CHANNELS actions.
 *
 * Channel resolution: lazy-initialized on first send() call.
 * Prefers #leadsens > #general > first available channel.
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  NotificationProvider,
  NotificationMessage,
} from "@/server/lib/providers/notification-provider";

// ─── Composio Response Types ────────────────────────────

interface SlackChannel {
  id: string;
  name: string;
  is_archived?: boolean;
}

interface SlackFindChannelsResponse {
  channels?: SlackChannel[];
  ok?: boolean;
}

interface SlackSendMessageResponse {
  ok?: boolean;
  ts?: string;
  error?: string;
}

// ─── Channel Resolution ─────────────────────────────────

/**
 * Find a default channel by searching for #leadsens, then #general,
 * then falling back to the first non-archived channel.
 */
async function findDefaultChannel(
  workspaceId: string,
): Promise<string | undefined> {
  try {
    const result = await executeAction<SlackFindChannelsResponse>(
      "SLACK_FIND_CHANNELS",
      workspaceId,
      {},
    );

    const channels = result.channels;
    if (!channels || channels.length === 0) return undefined;

    const active = channels.filter((c) => !c.is_archived);

    // Prefer #leadsens, then #general
    const leadsens = active.find((c) => c.name === "leadsens");
    if (leadsens) return leadsens.id;

    const general = active.find((c) => c.name === "general");
    if (general) return general.id;

    // Fall back to first non-archived channel
    return active[0]?.id;
  } catch (err) {
    logger.warn("[slack-composio] findDefaultChannel failed", {
      workspaceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ─── NotificationProvider Factory ───────────────────────

/**
 * Create a Slack NotificationProvider backed by Composio actions.
 *
 * The default channel is resolved lazily on the first send() call
 * when no explicit channel is provided. The resolved channel ID
 * is cached for the lifetime of the provider instance.
 */
export function createSlackComposioNotification(
  workspaceId: string,
): NotificationProvider {
  // Lazy-init cache for default channel.
  // undefined = not yet resolved, "" = resolved but none found.
  let cachedDefaultChannel: string | undefined;

  return {
    name: "slack",

    async send(
      message: NotificationMessage,
    ): Promise<{ ok: boolean; error?: string }> {
      try {
        let channel = message.channel;

        // Lazy-resolve default channel if none specified
        if (!channel) {
          if (cachedDefaultChannel === undefined) {
            const resolved = await findDefaultChannel(workspaceId);
            cachedDefaultChannel = resolved ?? "";
          }
          channel = cachedDefaultChannel || undefined;
        }

        if (!channel) {
          return {
            ok: false,
            error:
              "No channel specified and no #leadsens or #general channel found",
          };
        }

        const result = await executeAction<SlackSendMessageResponse>(
          "SLACK_SEND_MESSAGE",
          workspaceId,
          {
            channel,
            text: message.text,
          },
        );

        if (result.ok === false) {
          logger.warn("[slack-composio] send failed", {
            error: result.error,
            channel,
          });
          return { ok: false, error: result.error ?? "unknown error" };
        }

        return { ok: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error("[slack-composio] notification send failed", {
          error: errorMsg,
          workspaceId,
          channel: message.channel,
        });
        return { ok: false, error: errorMsg };
      }
    },
  };
}
