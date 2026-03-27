import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { PlatformData, SocialProfile, SocialMediaData } from "../types";
import { socialSearch } from "../../_shared/composio";
import type { SocialPostItem } from "../../_shared/composio";
import { shouldRunSocialPlatform } from "@/lib/channel-filter";

// ─── Dedup helper ─────────────────────────────────────────────────────────────

function getItemKey(item: SocialPostItem): string | null {
  const val = item["id"] ?? item["url"] ?? item["shortCode"]
    ?? item["webVideoUrl"] ?? item["conversationId"] ?? item["link"];
  return val != null ? String(val) : null;
}

function mergeUnique(results: PromiseSettledResult<{ items: SocialPostItem[] }>[]): SocialPostItem[] {
  const seen = new Set<string>();
  const merged: SocialPostItem[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const item of r.value.items) {
      const key = getItemKey(item);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

// ─── Brand variant helper ─────────────────────────────────────────────────────

function getBrandVariants(brandName: string): string[] {
  const base = brandName.toLowerCase();
  const noSpace = base.replace(/\s+/g, "");
  const hyphen = base.replace(/\s+/g, "-");
  const underscore = base.replace(/\s+/g, "_");
  return [
    brandName,
    noSpace,
    hyphen,
    underscore,
    `${noSpace}official`,
    `${noSpace}fr`,
  ].filter((v, i, a) => a.indexOf(v) === i);
}

/**
 * Early-exit search: try each variant in order, stop on first one with results.
 */
async function searchWithVariants(
  variants: string[],
  platform: string,
): Promise<SocialPostItem[]> {
  for (const variant of variants.slice(0, 3)) {
    try {
      const result = await socialSearch(variant, platform);
      if (result.items.length > 0) return result.items;
    } catch {
      // continue to next variant
    }
  }
  return [];
}

// ── Platforms analysées ───────────────────────────────────────────────────────

const PLATFORMS = ["twitter", "tiktok", "instagram"] as const;
type Platform = typeof PLATFORMS[number];

// Mapping interne → canonique (utilisé par shouldRunSocialPlatform)
const PLATFORM_CANONICAL: Record<Platform, "X" | "TikTok" | "Instagram"> = {
  twitter:   "X",
  tiktok:    "TikTok",
  instagram: "Instagram",
};

// ── Helpers extraction ────────────────────────────────────────────────────────

function getString(item: SocialPostItem, ...keys: string[]): string {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return "";
}

function getNumber(item: SocialPostItem, ...keys: string[]): number {
  for (const k of keys) {
    const v = item[k];
    if (typeof v === "number") return v;
    if (typeof v === "string" && /^\d+$/.test(v)) return parseInt(v, 10);
  }
  return 0;
}

function inferFormat(text: string): string {
  const lower = text.toLowerCase();
  if (/\bvideo\b|\bvidéo\b|\breels?\b|\bshorts?\b/.test(lower)) return "vidéo";
  if (/\bcarrousel\b|\bcarousel\b|\bslide\b/.test(lower)) return "carrousel";
  if (/\bthread\b|\bfil\b/.test(lower)) return "thread";
  if (/\barticle\b|\blog\b|\bpost long\b/.test(lower)) return "article";
  if (/\bimage\b|\bphoto\b|\binfographi/.test(lower)) return "image";
  return "post";
}

function inferTone(texts: string[]): string {
  const combined = texts.join(" ").toLowerCase();
  if (/\b(?:comment|how to|comment faire|tuto|step|étape|guide)\b/.test(combined)) return "éducatif";
  if (/\b(?:pourquoi|why|because|parce que|insight|leçon)\b/.test(combined)) return "didactique";
  if (/\b(?:sale|promo|discount|offre|deal|achetez|buy)\b/.test(combined)) return "promotionnel";
  if (/\b(?:story|histoire|j'ai|i have|we|nous)\b/.test(combined)) return "storytelling";
  if (/\b(?:breaking|urgent|alerte|news|annonce)\b/.test(combined)) return "informatif";
  return "conversationnel";
}

function extractHooks(items: SocialPostItem[]): string[] {
  const patterns: RegExp[] = [
    /^[^.!?]{0,60}[.!?]/,           // première phrase
    /(?:^|\n)(\d+\s*[\.\)][^\n]{0,80})/m, // listes numérotées
    /(?:^|\n)[•\-\*]\s*([^\n]{0,80})/m,  // listes à puce
  ];
  const hooks = new Set<string>();
  for (const item of items.slice(0, 10)) {
    const text = getString(item, "text", "content", "description", "caption");
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[0] && match[0].length > 10) {
        hooks.add(match[0].trim().slice(0, 100));
        break;
      }
    }
  }
  return [...hooks].slice(0, 5);
}

function calcSocialScore(activePlatforms: number, avgEngagement: number): number {
  return Math.min(100, activePlatforms * 20 + Math.min(40, Math.round(avgEngagement * 4)));
}

// ── Analyse par platform ──────────────────────────────────────────────────────

async function analyzePlatform(
  competitorName: string,
  platform: Platform,
): Promise<PlatformData> {
  try {
    const variants = getBrandVariants(competitorName);
    const items = await searchWithVariants(variants, platform);

    if (items.length === 0) {
      return {
        platform,
        publication_frequency: "unknown",
        avg_engagement:        0,
        dominant_formats:      [],
        dominant_tone:         "unknown",
        recurring_hooks:       [],
        available:             false,
      };
    }

    // Fréquence de publication (approximée depuis les dates si disponibles)
    const dates = items
      .map(i => getString(i, "createdAt", "created_at", "publishedAt", "date", "timestamp"))
      .filter(d => d.length > 0)
      .map(d => new Date(d).getTime())
      .filter(n => !isNaN(n))
      .sort((a, b) => b - a);

    let publication_frequency = "unknown";
    if (dates.length >= 2) {
      const spanDays = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
      const postsPerDay = dates.length / Math.max(spanDays, 1);
      if (postsPerDay >= 1)      publication_frequency = "quotidien";
      else if (postsPerDay >= 0.5) publication_frequency = "3-5×/semaine";
      else if (postsPerDay >= 0.14) publication_frequency = "hebdomadaire";
      else                          publication_frequency = "mensuel";
    }

    // Engagement médian
    const engagements = items.map(i =>
      getNumber(i, "likeCount", "likes", "like_count", "reactionCount", "reactions", "engagements")
      + getNumber(i, "commentCount", "comments", "comment_count", "replyCount", "replies")
      + getNumber(i, "shareCount", "shares", "share_count", "retweetCount", "retweets")
    );
    const sorted = [...engagements].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;

    // Formats
    const texts = items.map(i => getString(i, "text", "content", "description", "caption", "title"));
    const formatCounts = new Map<string, number>();
    for (const t of texts) {
      const f = inferFormat(t);
      formatCounts.set(f, (formatCounts.get(f) ?? 0) + 1);
    }
    const dominant_formats = [...formatCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([f]) => f);

    return {
      platform,
      publication_frequency,
      avg_engagement:  median,
      dominant_formats,
      dominant_tone:   inferTone(texts),
      recurring_hooks: extractHooks(items),
      available:       true,
    };
  } catch {
    return {
      platform,
      publication_frequency: "unknown",
      avg_engagement:        0,
      dominant_formats:      [],
      dominant_tone:         "unknown",
      recurring_hooks:       [],
      available:             false,
    };
  }
}

// ── Module principal ──────────────────────────────────────────────────────────

export async function fetchSocialMedia(
  profile: ElevayAgentProfile,
  priority_channels?: string[],
): Promise<ModuleResult<SocialMediaData>> {
  try {
    const activePlatformKeys = PLATFORMS.filter(p =>
      shouldRunSocialPlatform(PLATFORM_CANONICAL[p], priority_channels),
    );

    const competitorProfiles: SocialProfile[] = await Promise.all(
      profile.competitors.map(async competitor => {
        const platforms = await Promise.all(
          activePlatformKeys.map(p => analyzePlatform(competitor.name, p))
        );

        const activePlatforms = platforms.filter(p => p.available);
        const avgEngagement = activePlatforms.length > 0
          ? activePlatforms.reduce((sum, p) => sum + p.avg_engagement, 0) / activePlatforms.length
          : 0;

        return {
          competitor_url: competitor.url,
          platforms,
          social_score: calcSocialScore(activePlatforms.length, avgEngagement),
        };
      })
    );

    const degraded = competitorProfiles.some(cp =>
      cp.platforms.every(p => !p.available)
    );

    return {
      success: true,
      data: { competitors: competitorProfiles },
      source: "social-media:apify",
      degraded,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "social-media:apify",
      error: {
        code:    "SOCIAL_MEDIA_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      degraded: true,
    };
  }
}
