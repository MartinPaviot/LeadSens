/**
 * Instantly Webhook Endpoint
 *
 * Receives real-time events from Instantly:
 * - reply_received: A lead replied to a campaign email
 * - email_bounced: Email bounced
 * - lead_unsubscribed: Lead unsubscribed
 * - campaign_completed: Campaign finished sending
 *
 * Events update lead status, EmailPerformance, and ReplyThread records.
 *
 * A/B attribution: Instantly webhooks include `variant` (1-indexed) and
 * `step` fields. These are used for native variant attribution on
 * EmailPerformance.variantIndex, replacing the need for syncVariantAttribution()
 * polling for new events.
 *
 * Security: If INSTANTLY_WEBHOOK_SECRET is set, verifies HMAC-SHA256
 * signature in the x-instantly-signature header. Without it, all events
 * are accepted (graceful degradation for dev/testing).
 */

import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { z } from "zod/v4";
import { createHmac, timingSafeEqual } from "crypto";
import { checkAndPauseCampaign } from "@/server/lib/analytics/bounce-guard";
import { checkAndPauseOnNegativeReplies, NEGATIVE_REPLY_AI_INTEREST_MAX } from "@/server/lib/analytics/reply-guard";

// ─── Webhook Signature Verification ────────────────────

const SIGNATURE_HEADER = "x-instantly-signature";

/**
 * Verify HMAC-SHA256 signature of the webhook payload.
 * Pure function — no side effects.
 *
 * @param rawBody - The raw request body as a string
 * @param signature - The signature from the request header
 * @param secret - The shared webhook secret
 * @returns true if signature is valid
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");

  // Timing-safe comparison to prevent timing attacks
  // Both must be the same length for timingSafeEqual
  const sigBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (sigBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(sigBuffer, expectedBuffer);
}

// ─── A/B Variant Helper ─────────────────────────────────

/**
 * Convert Instantly webhook variant (1-indexed) to our variantIndex (0-indexed).
 * Returns null if variant is absent or invalid.
 *
 * Instantly sends: variant=1 (primary), variant=2 (v2), variant=3 (v3)
 * We store: variantIndex=0 (primary), variantIndex=1 (v2), variantIndex=2 (v3)
 */
export function webhookVariantToIndex(variant?: number | null): number | null {
  if (variant == null || !Number.isInteger(variant) || variant < 1) return null;
  return variant - 1;
}

// ─── Event Schemas ──────────────────────────────────────

// Common fields for A/B attribution (Instantly Mar 2026)
const variantFields = {
  variant: z.number().int().optional(), // 1-indexed variant number
  step: z.number().int().optional(),    // step number (0-indexed)
};

const replyEventSchema = z.object({
  event_type: z.literal("reply_received"),
  campaign_id: z.string(),
  email: z.string(),
  from_email: z.string(),
  subject: z.string().optional(),
  body_preview: z.string().optional(),
  thread_id: z.string().optional(),
  is_auto_reply: z.boolean().optional(),
  ai_interest_value: z.number().optional(),
  timestamp: z.string().optional(),
  ...variantFields,
});

const bounceEventSchema = z.object({
  event_type: z.literal("email_bounced"),
  campaign_id: z.string(),
  email: z.string(),
  bounce_type: z.string().optional(),
  timestamp: z.string().optional(),
  ...variantFields,
});

const unsubEventSchema = z.object({
  event_type: z.literal("lead_unsubscribed"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
  ...variantFields,
});

const campaignCompleteSchema = z.object({
  event_type: z.literal("campaign_completed"),
  campaign_id: z.string(),
  timestamp: z.string().optional(),
});

const webhookEventSchema = z.discriminatedUnion("event_type", [
  replyEventSchema,
  bounceEventSchema,
  unsubEventSchema,
  campaignCompleteSchema,
]);

// ─── Helpers ────────────────────────────────────────────

async function findLeadByCampaignEmail(instantlyCampaignId: string, email: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { instantlyCampaignId },
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
  } else {
    console.warn("[webhook/instantly] INSTANTLY_WEBHOOK_SECRET not set — accepting all events without verification");
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
    console.warn("[webhook/instantly] Unknown event:", JSON.stringify(body).slice(0, 500));
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
          // Only set variantIndex if not already attributed (don't overwrite)
          ...(replyVariantIndex != null ? { variantIndex: replyVariantIndex } : {}),
        },
      });

      // Create/update ReplyThread
      const thread = await prisma.replyThread.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          workspaceId: campaign.workspaceId,
          leadId: lead.id,
          campaignId: campaign.id,
          instantlyThreadId: event.thread_id ?? null,
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

    case "campaign_completed": {
      const campaign = await prisma.campaign.findFirst({
        where: { instantlyCampaignId: event.campaign_id },
      });
      if (campaign) {
        await prisma.campaign.update({
          where: { id: campaign.id },
          data: { status: "ACTIVE" },
        });
      }
      break;
    }
  }

  return new Response(JSON.stringify({ received: true, event_type: event.event_type }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
