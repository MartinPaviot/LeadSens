import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod/v4";

// ─── Webhook Signature Verification ────────────────────

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

const emailSentSchema = z.object({
  event_type: z.literal("email_sent"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
  is_first: z.boolean().optional(), // true if first email (Step 0)
  ...variantFields,
});

const emailOpenedSchema = z.object({
  event_type: z.literal("email_opened"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
  ...variantFields,
});

const linkClickedSchema = z.object({
  event_type: z.literal("link_clicked"),
  campaign_id: z.string(),
  email: z.string(),
  url: z.string().optional(),
  timestamp: z.string().optional(),
  ...variantFields,
});

const meetingBookedSchema = z.object({
  event_type: z.literal("lead_meeting_booked"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
});

const leadInterestedSchema = z.object({
  event_type: z.literal("lead_interested"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
});

const leadNotInterestedSchema = z.object({
  event_type: z.literal("lead_not_interested"),
  campaign_id: z.string(),
  email: z.string(),
  timestamp: z.string().optional(),
});

const campaignCompleteSchema = z.object({
  event_type: z.literal("campaign_completed"),
  campaign_id: z.string(),
  timestamp: z.string().optional(),
});

const accountErrorSchema = z.object({
  event_type: z.literal("account_error"),
  campaign_id: z.string().optional(),
  account_email: z.string().optional(),
  error_message: z.string().optional(),
  timestamp: z.string().optional(),
});

export const webhookEventSchema = z.discriminatedUnion("event_type", [
  replyEventSchema,
  bounceEventSchema,
  unsubEventSchema,
  emailSentSchema,
  emailOpenedSchema,
  linkClickedSchema,
  meetingBookedSchema,
  leadInterestedSchema,
  leadNotInterestedSchema,
  campaignCompleteSchema,
  accountErrorSchema,
]);
