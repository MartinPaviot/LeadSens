import { z } from 'zod';

// ─── Shared profile schema ──────────────────────────────

const wpCredsSchema = z.object({
  siteUrl: z.string(),
  username: z.string(),
  applicationPassword: z.string(),
}).optional();

const hubCredsSchema = z.object({
  portalId: z.string(),
  accessToken: z.string(),
}).optional();

const shopifyCredsSchema = z.object({
  storeDomain: z.string(),
  accessToken: z.string(),
}).optional();

const webflowCredsSchema = z.object({
  accessToken: z.string(),
  siteId: z.string().optional(),
}).optional();

export const seoProfileSchema = z.object({
  siteUrl: z.string().url(),
  cmsType: z.enum(['wordpress', 'hubspot', 'shopify', 'webflow', 'other']),
  automationLevel: z.enum(['audit', 'semi-auto', 'full-auto']),
  geoLevel: z.enum(['national', 'regional', 'city', 'multi-geo']),
  targetGeos: z.array(z.string()),
  priorityPages: z.array(z.string()),
  alertChannels: z.array(z.enum(['slack', 'email', 'report'])),
  connectedTools: z.object({
    gsc: z.boolean(),
    ga: z.boolean(),
    ahrefs: z.boolean(),
    semrush: z.boolean(),
  }),
  wordpressCredentials: wpCredsSchema,
  hubspotCredentials: hubCredsSchema,
  shopifyCredentials: shopifyCredsSchema,
  webflowCredentials: webflowCredsSchema,
});

// ─── Standard agent route body ──────────────────────────

export const agentRouteSchema = z.object({
  conversationId: z.string().min(1),
  siteUrl: z.string().url(),
  profile: seoProfileSchema,
});

// ─── KGA-08 extends with seedKeywords ───────────────────

export const kga08RouteSchema = agentRouteSchema.extend({
  seedKeywords: z.array(z.string()).optional(),
});

// ─── WPW-09 content creation ────────────────────────────

export const wpw09RouteSchema = z.object({
  conversationId: z.string().min(1),
  profile: seoProfileSchema,
  pageType: z.enum(['about', 'service', 'landing', 'pillar', 'contact', 'category']),
  brief: z.string().min(1),
  targetKeywords: z.array(z.string()).optional(),
  brandTone: z.string().default('professionnel'),
  targetAudience: z.string().default('décideurs B2B'),
  internalLinksAvailable: z.array(z.string()).optional(),
  exportFormat: z.enum(['html', 'markdown', 'wordpress', 'hubspot', 'shopify', 'sheets']).default('html'),
});

// ─── BSW-10 blog content ────────────────────────────────

export const bsw10RouteSchema = z.object({
  conversationId: z.string().min(1),
  profile: seoProfileSchema,
  topic: z.string().min(1),
  mode: z.enum(['single', 'cluster', 'calendar']).default('single'),
  articleFormat: z.enum(['guide', 'list', 'case-study', 'comparison', 'opinion', 'tutorial', 'glossary']).default('guide'),
  targetAudience: z.string().default('marketeurs'),
  expertiseLevel: z.enum(['beginner', 'intermediate', 'expert']).default('intermediate'),
  objective: z.enum(['traffic', 'lead-gen', 'conversion', 'brand-authority']).default('traffic'),
  brandTone: z.string().default('professionnel'),
  targetKeywords: z.array(z.string()).optional(),
  internalLinksAvailable: z.array(z.string()).optional(),
  cta: z.string().default('Découvrir notre solution'),
  calendarDuration: z.union([z.literal(30), z.literal(60), z.literal(90)]).optional(),
});

// ─── Schedule routes ────────────────────────────────────

const agentIdEnum = z.enum(['pio05', 'opt06', 'tsi07', 'kga08', 'mdg11', 'alt12']);
const frequencyEnum = z.enum(['daily', 'weekly', 'monthly']);

export const schedulePostSchema = z.object({
  agentId: agentIdEnum,
  frequency: z.union([frequencyEnum, z.literal('on_demand'), z.literal('on-demand')]),
});

export const schedulePatchSchema = z.object({
  agentId: agentIdEnum,
  action: z.enum(['pause', 'resume', 'cancel']),
  frequency: frequencyEnum.optional(),
});

export const pio05SchedulePostSchema = z.object({
  frequency: z.union([frequencyEnum, z.literal('on-demand')]),
});

export const pio05SchedulePatchSchema = z.object({
  action: z.enum(['pause', 'resume']),
});
