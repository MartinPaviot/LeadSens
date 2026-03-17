import { z } from "zod/v4";
import { getNotificationProvider } from "@/server/lib/providers";
import type { ToolDefinition, ToolContext } from "./types";

export function createNotificationTools(ctx: ToolContext): Record<string, ToolDefinition> {
  return {
    send_notification: {
      name: "send_notification",
      description:
        "Send a notification to the connected notification channel (e.g. Slack).\n" +
        "Use this to alert the user about campaign events: positive replies, campaign activation, milestones.\n" +
        "Optionally specify a channel name.",
      parameters: z.object({
        text: z.string().describe("Notification message text"),
        channel: z.string().optional().describe("Channel name (e.g. #leadsens); defaults to auto-detected channel"),
      }),
      isSideEffect: true,
      async execute(args) {
        const provider = await getNotificationProvider(ctx.workspaceId);
        if (!provider) {
          return { error: "No notification tool connected. Connect Slack in Settings > Integrations." };
        }

        ctx.onStatus?.("Sending notification...");

        const result = await provider.send({
          text: args.text,
          channel: args.channel,
        });

        if (!result.ok) {
          return { error: result.error ?? "Failed to send notification" };
        }

        return { sent: true, message: `Notification sent via ${provider.name}.` };
      },
    },
  };
}
