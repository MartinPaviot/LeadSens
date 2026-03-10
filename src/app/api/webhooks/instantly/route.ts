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
 * Security: If INSTANTLY_WEBHOOK_SECRET is set, verifies HMAC-SHA256
 * signature in the x-instantly-signature header. Without it, all events
 * are accepted (graceful degradation for dev/testing).
 */

import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { z } from "zod/v4";
import { createHmac, timingSafeEqual } from "crypto";
import { checkAndPauseCampaign } from "@/server/lib/analytics/bounce-guard";

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

// ─── Event Schemas ──────────────────────────────────────

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
});

const bounceEventSchema = z.object({
  event_type: z.literal("email_bounced"),
  campaign_id: z.string(),
  email: z.string(),
  bounce_type: z.string().optional(),
  timestamp: z.string().optional(),
});

const unsubEventSchema = z.object({
  event_type: z.literal("lead_unsubscribed"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
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
        },
        update: {
          replyCount: { increment: 1 },
          repliedAt: event.timestamp ? new Date(event.timestamp) : new Date(),
          replyIsAutoReply: event.is_auto_reply ?? false,
          replyAiInterest: event.ai_interest_value ?? null,
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
      break;
    }

    case "email_bounced": {
      const match = await findLeadByCampaignEmail(event.campaign_id, event.email);
      if (!match) break;

      const { lead, campaign } = match;

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          bounced: true,
        },
        update: {
          bounced: true,
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

      await prisma.emailPerformance.upsert({
        where: { leadId_campaignId: { leadId: lead.id, campaignId: campaign.id } },
        create: {
          leadId: lead.id,
          campaignId: campaign.id,
          email: lead.email,
          unsubscribed: true,
        },
        update: {
          unsubscribed: true,
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
