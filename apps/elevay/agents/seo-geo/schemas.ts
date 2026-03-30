import { z } from 'zod';

export const tsi07InputSchema = z.object({
  siteUrl: z.string().url(),
  cmsType: z.string(),
  automationLevel: z.enum(['audit', 'semi-auto', 'full-auto']),
  priorityPages: z.array(z.string()),
  alertChannel: z.enum(['slack', 'email', 'report']),
  gscConnected: z.boolean(),
  gaConnected: z.boolean(),
});

export const kga08InputSchema = z.object({
  siteUrl: z.string().url(),
  targetPages: z.array(z.string()),
  businessObjective: z.enum(['traffic', 'lead-gen', 'sales', 'local-awareness']),
  geoLevel: z.enum(['national', 'regional', 'city', 'multi-geo']),
  targetGeos: z.array(z.string()).min(1),
  competitors: z.array(z.string()),
  monthlyContentCapacity: z.number().min(0),
  seoMaturity: z.enum(['beginner', 'intermediate', 'advanced']),
  prioritization: z.enum(['volume', 'conversion']),
  gscConnected: z.boolean(),
  gbpId: z.string().optional(),
  multiCountry: z.boolean(),
});

export const wpw09InputSchema = z.object({
  pageType: z.enum(['about', 'service', 'landing', 'pillar', 'contact', 'category']),
  pageUrl: z.string().optional(),
  brief: z.string().min(1),
  targetKeywords: z.array(z.string()).optional(),
  brandTone: z.string(),
  targetAudience: z.string(),
  internalLinksAvailable: z.array(z.string()),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'other']),
  exportFormat: z.enum(['html', 'markdown', 'wordpress', 'hubspot', 'shopify', 'sheets']),
  kga08Context: z.unknown().optional(),
});

export const bsw10InputSchema = z.object({
  topic: z.string().min(1),
  mode: z.enum(['single', 'cluster', 'calendar']),
  articleFormat: z.enum(['guide', 'list', 'case-study', 'comparison', 'opinion', 'tutorial', 'glossary']),
  targetAudience: z.string(),
  expertiseLevel: z.enum(['beginner', 'intermediate', 'expert']),
  objective: z.enum(['traffic', 'lead-gen', 'conversion', 'brand-authority']),
  brandTone: z.string(),
  targetKeywords: z.array(z.string()).optional(),
  internalLinksAvailable: z.array(z.string()),
  cta: z.string(),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'other']),
  calendarDuration: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
  kga08Context: z.unknown().optional(),
});

export const pio05InputSchema = z.object({
  siteUrl: z.string().url(),
  targetKeywords: z.array(z.string()),
  geoTargets: z.array(z.string()),
  competitorUrls: z.array(z.string()),
  reportFrequency: z.enum(['monthly', 'weekly', 'on-demand']),
  gscConnected: z.boolean(),
  gaConnected: z.boolean(),
});

export const opt06InputSchema = z.object({
  siteUrl: z.string().url(),
  targetPages: z.array(z.string()),
  targetKeywords: z.record(z.string(), z.array(z.string())),
  competitors: z.array(z.string()),
  automationLevel: z.enum(['audit', 'semi-auto', 'full-auto']),
  geoTargets: z.array(z.string()).optional(),
  googleBusinessProfileId: z.string().optional(),
  gscConnected: z.boolean(),
  gaConnected: z.boolean(),
});

export const mdg11InputSchema = z.object({
  siteUrl: z.string().url(),
  scope: z.union([z.enum(['all', 'blog', 'products']), z.array(z.string())]),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'other']),
  brandTone: z.string(),
  targetKeywords: z.record(z.string(), z.array(z.string())).optional(),
  variationsCount: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  language: z.string(),
  inject: z.boolean(),
});

export const alt12InputSchema = z.object({
  siteUrl: z.string().url(),
  scope: z.union([z.enum(['all', 'blog', 'products']), z.array(z.string())]),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'other']),
  targetKeywords: z.record(z.string(), z.array(z.string())).optional(),
  brandTone: z.enum(['descriptive', 'informative', 'marketing']),
  language: z.string(),
  specialRules: z.array(z.string()).optional(),
  variationsCount: z.union([z.literal(1), z.literal(2)]),
  inject: z.boolean(),
});
