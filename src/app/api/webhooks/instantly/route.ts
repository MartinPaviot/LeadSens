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
 */

import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";
import { z } from "zod/v4";

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
  let body: unknown;
  try {
    body = await req.json();
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
