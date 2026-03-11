/**
 * Instantly Webhook Endpoint
 *
 * Receives real-time events from Instantly (14+ event types):
 *
 * Lead engagement:
 * - email_sent: Email was sent to a lead → PUSHED→SENT transition
 * - email_opened: Lead opened the email → update openCount/timestamps
 * - link_clicked: Lead clicked a link → update clickCount
 * - reply_received: Lead replied → SENT→REPLIED transition
 * - email_bounced: Email bounced → BOUNCED transition + bounce guard
 * - lead_unsubscribed: Lead unsubscribed → UNSUBSCRIBED transition
 *
 * Lead status:
 * - lead_interested: Marked interested in Instantly → INTERESTED transition
 * - lead_not_interested: Marked not interested → NOT_INTERESTED transition
 * - lead_meeting_booked: Meeting booked → MEETING_BOOKED transition
 *
 * Campaign lifecycle:
 * - campaign_completed: Campaign finished sending
 * - account_error: Sending account health issue → log warning
 *
 * A/B attribution: Instantly webhooks include `variant` (1-indexed) and
 * `step` fields. These are used for native variant attribution on
 * EmailPerformance.variantIndex.
 *
 * Security: If INSTANTLY_WEBHOOK_SECRET is set, verifies HMAC-SHA256
 * signature in the x-instantly-signature header. Without it, all events
 * are accepted (graceful degradation for dev/testing).
 */

import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { checkAndPauseCampaign } from "@/server/lib/analytics/bounce-guard";
import { checkAndPauseOnNegativeReplies, NEGATIVE_REPLY_AI_INTEREST_MAX } from "@/server/lib/analytics/reply-guard";
import { logger } from "@/lib/logger";
import {
  verifyWebhookSignature,
  webhookVariantToIndex,
  webhookEventSchema,
} from "@/server/lib/webhooks/instantly-utils";

const SIGNATURE_HEADER = "x-instantly-signature";

// ─── Helpers ────────────────────────────────────────────

async function findLeadByCampaignEmail(espCampaignId: string, email: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { espCampaignId },
    select: { id: true, workspaceId: true },
  });
  if (!campaign) return null;

  const lead = await prisma.lead.findFirst({
    where: { email: email.toLowerCase(), campaignId: campaign.id },
  });

  return lead ? { lead, campaign } : null;
}

async function safeTransition(leadId: string, to: LeadStatus) {
  try {
    // Import dynamically to avoid circular deps
    const { transitionLeadStatus } = await import("@/server/lib/lead-status");
    await transitionLeadStatus(leadId, to);
  } catch {
    // Transition may not be valid (e.g. already in that state) — non-blocking
  }
}

// ─── Handler ────────────────────────────────────────────

export async function POST(req: Request) {
  // Read raw body first (needed for HMAC verification before JSON parsing)
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read body" }), { status: 400 });
  }

  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get(SIGNATURE_HEADER) ?? "";
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    logger.error("[webhook/instantly] INSTANTLY_WEBHOOK_SECRET not set in production — rejecting");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 500 });
  } else {
    logger.warn("[webhook/instantly] INSTANTLY_WEBHOOK_SECRET not set — accepting without verification");
  }

  // Parse JSON from raw body
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const parsed = webhookEventSchema.safeParse(body);
  if (!parsed.success) {
    // Accept unknown events gracefully (Instantly may add new event types)
    logger.warn("[webhook/instantly] Unknown event:", { body: JSON.stringify(body).slice(0, 500) });
    return new Response(JSON.stringify({ received: true, unknown_event: true }), { status: 200 });
  }

  const event = parsed.data;

  switch (event.event_type) {
    case "reply_received": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      // Native A/B attribution from webhook variant field (WEBHOOK-VAR-01)
      const replyVariantIndex = webhookVariantToIndex(event.variant);

      // Update EmailPerformance
      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          replyCount: 1,
          repliedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
          replyIsAutoReply: event.is_auto_reply ?? false,
          replyAiInterest: event.ai_interest_value ?? null,
          ...(replyVariantIndex != null ? { variantIndex: replyVariantIndex } : {}),
        },
        update: {
          replyCount: { increment: 1 },
          repliedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
          replyIsAutoReply: event.is_auto_reply ?? false,
          replyAiInterest: event.ai_interest_value ?? null,
        },
      });

      // Set variantIndex only if not already attributed (avoid overwriting on repeated replies)
      if (replyVariantIndex != null) {
        await prisma.emailPerformance.updateMany({
          where: { leadId: lead.id, campaignId: campaign.id, variantIndex: null },
          data: { variantIndex: replyVariantIndex },
        });
      }

      // Create/update ReplyThread
      const thread = await prisma.replyThread.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          workspaceId: campaign.workspaceId,
          leadId: lead.id,
          campaignId: campaign.id,
          espThreadId: event.thread_id ?? null,
          subject: event.subject ?? null,
          status: "OPEN",
        },
        update: {
          updatedAt: new Date(),
        },
      });

      // Store reply
      await prisma.reply.create({
        data: {
          threadId: thread.id,
          direction: "INBOUND",
          fromEmail: event.from_email,
          toEmail: lead.email,
          subject: event.subject ?? null,
          body: event.body_preview ?? "",
          preview: event.body_preview?.slice(0, 200) ?? "",
          isAutoReply: event.is_auto_reply ?? false,
          aiInterest: event.ai_interest_value ?? null,
          sentAt: event.timestamp ? new Date(event.timestamp) : new Date(),
        },
      });

      // Transition lead: PUSHED/SENT → REPLIED
      await safeTransition(lead.id, "REPLIED");

      // Check for negative reply spike — auto-pause if too many complaints
      if (event.ai_interest_value != null && event.ai_interest_value < NEGATIVE_REPLY_AI_INTEREST_MAX) {
        await checkAndPauseOnNegativeReplies(campaign.id);
      }
      break;
    }

    case "email_bounced": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      // Native A/B attribution from webhook variant field (WEBHOOK-VAR-01)
      const bounceVariantIndex = webhookVariantToIndex(event.variant);

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          bounced: true,
          ...(bounceVariantIndex != null ? { variantIndex: bounceVariantIndex } : {}),
        },
        update: {
          bounced: true,
          ...(bounceVariantIndex != null ? { variantIndex: bounceVariantIndex } : {}),
        },
      });

      await safeTransition(lead.id, "BOUNCED");

      // Check bounce rate and auto-pause if threshold exceeded (Research D4)
      await checkAndPauseCampaign(campaign.id);
      break;
    }

    case "lead_unsubscribed": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      // Native A/B attribution from webhook variant field (WEBHOOK-VAR-01)
      const unsubVariantIndex = webhookVariantToIndex(event.variant);

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          unsubscribed: true,
          ...(unsubVariantIndex != null ? { variantIndex: unsubVariantIndex } : {}),
        },
        update: {
          unsubscribed: true,
          ...(unsubVariantIndex != null ? { variantIndex: unsubVariantIndex } : {}),
        },
      });

      await safeTransition(lead.id, "UNSUBSCRIBED");
      break;
    }

    case "email_sent": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;
      const sentVariantIndex = webhookVariantToIndex(event.variant);
      const sentAt = event.timestamp ? new Date(event.timestamp) : new Date();

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          sentAt,
          ...(event.step != null ? { sentStep: event.step } : {}),
          ...(sentVariantIndex != null ? { variantIndex: sentVariantIndex } : {}),
        },
        update: {
          sentAt,
          ...(event.step != null ? { sentStep: event.step } : {}),
          // Only set variantIndex if not already attributed
          ...(sentVariantIndex != null ? { variantIndex: sentVariantIndex } : {}),
        },
      });

      // Transition PUSHED → SENT (resolves phantom SENT status — PIPE-SENT-01)
      await safeTransition(lead.id, "SENT");
      break;
    }

    case "email_opened": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;
      const openVariantIndex = webhookVariantToIndex(event.variant);
      const openedAt = event.timestamp ? new Date(event.timestamp) : new Date();

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          openCount: 1,
          firstOpenAt: openedAt,
          lastOpenAt: openedAt,
          ...(openVariantIndex != null ? { variantIndex: openVariantIndex } : {}),
        },
        update: {
          openCount: { increment: 1 },
          // firstOpenAt only set on create, never overwritten
          lastOpenAt: openedAt,
          ...(openVariantIndex != null ? { variantIndex: openVariantIndex } : {}),
        },
      });
      break;
    }

    case "link_clicked": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;
      const clickVariantIndex = webhookVariantToIndex(event.variant);

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          clickCount: 1,
          ...(clickVariantIndex != null ? { variantIndex: clickVariantIndex } : {}),
        },
        update: {
          clickCount: { increment: 1 },
          ...(clickVariantIndex != null ? { variantIndex: clickVariantIndex } : {}),
        },
      });
      break;
    }

    case "lead_meeting_booked": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          interestStatus: 2, // Meeting booked
        },
        update: {
          interestStatus: 2,
        },
      });

      // Transition to MEETING_BOOKED (works from REPLIED or INTERESTED)
      await safeTransition(lead.id, "MEETING_BOOKED");
      break;
    }

    case "lead_interested": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          interestStatus: 1,
        },
        update: {
          interestStatus: 1,
        },
      });

      await safeTransition(lead.id, "INTERESTED");
      break;
    }

    case "lead_not_interested": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          interestStatus: -1,
        },
        update: {
          interestStatus: -1,
        },
      });

      await safeTransition(lead.id, "NOT_INTERESTED");
      break;
    }

    case "campaign_completed": {
      const campaign = await prisma.campaign.findFirst({
        where: { espCampaignId: event.campaign_id },
      });
      if (campaign) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "ACTIVE" },
        });
      }
      break;
    }

    case "account_error": {
      // Log warning for account health issues — proactive monitoring
      logger.warn("[webhook/instantly] Account error", {
        account: event.account_email ?? "unknown account",
        message: event.error_message ?? "no message",
        campaignId: event.campaign_id ?? undefined,
      });
      break;
    }
  }

  return new Response(JSON.stringify({ received: true, event_type: event.event_type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
