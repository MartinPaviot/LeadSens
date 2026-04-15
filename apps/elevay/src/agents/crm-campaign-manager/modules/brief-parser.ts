import { z } from "zod"

export const CRMCampaignBriefSchema = z.object({
  objective: z.enum(["sale", "retention", "reactivation", "activation", "event"]),
  segment: z.string().min(1),
  channel: z.enum(["email", "sms", "both"]),
  platform: z.enum(["hubspot", "klaviyo", "brevo"]),
  preferredDate: z.string().optional(),
  preferredTime: z.string().optional(),
  tone: z.enum(["promotional", "informational", "urgency", "storytelling", "minimal"]),
  offerUrl: z.string().url().optional(),
  promoCode: z.string().optional(),
  smsBudget: z.number().int().positive().optional(),
  abConfig: z
    .object({
      enabled: z.boolean(),
      variable: z.enum(["subject", "cta", "content", "image", "timing", "segment"]),
      sampleSize: z.number().min(5).max(50).default(20),
      winCriteria: z.enum(["open_rate", "click_rate", "conversion"]),
      decisionDelay: z.number().min(1).max(72).default(4),
    })
    .optional(),
  resendConfig: z
    .object({
      enabled: z.boolean(),
      delay: z.number().min(12).max(96).default(48),
      segment: z.enum(["non-openers", "non-openers-and-non-clickers"]),
      maxResends: z.number().min(1).max(3).default(1),
      autoApprove: z.boolean().default(false),
    })
    .optional(),
})

export type ParsedCRMBrief = z.infer<typeof CRMCampaignBriefSchema>
