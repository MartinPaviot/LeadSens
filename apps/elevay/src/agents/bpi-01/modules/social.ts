import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { SocialData, PlatformData } from "../types";
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
 * Falls back to merging all results if nothing found.
 */
async function searchWithVariants(
  variants: string[],
  platform: string,
): Promise<SocialPostItem[]> {
  // Try first 3 variants with early-exit
  for (const variant of variants.slice(0, 3)) {
    console.log("[social-variants] trying variant:", variant, "on platform:", platform);
    try {
      const result = await socialSearch(variant, platform);
      console.log("[social-variants] results count:", result.items.length, "raw keys:", Object.keys(result));
      if (result.items.length > 0) return result.items;
    } catch (err) {
      console.log("[social-variants] ERROR:", err instanceof Error ? err.message : String(err));
      // continue to next variant
    }
  }
  return [];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = ["instagram", "twitter", "tiktok"] as const;
type SocialPlatform = (typeof PLATFORMS)[number];

// Mapping interne → canonique (utilisé par shouldRunSocialPlatform)
const PLATFORM_CANONICAL: Record<SocialPlatform, "Instagram" | "X" | "TikTok"> = {
  instagram: "Instagram",
  twitter:   "X",
  tiktok:    "TikTok",
};

const STOP_WORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "à", "au",
  "aux", "the", "a", "an", "and", "in", "of", "for", "on", "with", "is",
  "are", "was", "that", "this", "it", "to", "be", "has", "have", "not", "but",
]);

const NEGATIVE_MARKERS = [
  "problème", "arnaque", "nul", "mauvais", "déçu", "terrible", "bad", "scam", "worst",
];
const POSITIVE_MARKERS = [
  "super", "top", "excellent", "parfait", "recommande", "great", "best", "amazing",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractNum(item: SocialPostItem, keys: string[]): number {
  for (const key of keys) {
    const val = item[key];
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseInt(val, 10);
      if (!isNaN(n)) return n;
    }
  }
  return 0;
}

function analyzeSentiment(texts: string[]): PlatformData["sentiment"] {
  const combined = texts.join(" ").toLowerCase();
  const negCount = NEGATIVE_MARKERS.filter((m) => combined.includes(m)).length;
  const posCount = POSITIVE_MARKERS.filter((m) => combined.includes(m)).length;
  if (negCount > 0 && posCount > 0) return "mixed";
  if (negCount > 0) return "negative";
  if (posCount > 0) return "positive";
  return "neutral";
}

function buildPlatformData(
  platform: SocialPlatform,
  items: SocialPostItem[],
): PlatformData {
  if (items.length === 0) {
    return {
      platform,
      followers: 0,
      engagement_rate: 0,
      post_frequency: "inactif",
      sentiment: "neutral",
      status: "missing",
    };
  }

  const followers = extractNum(items[0], [
    "followersCount",
    "ownerFollowerCount",
    "authorFollowerCount",
  ]);

  const totalLikes = items.reduce(
    (sum, item) =>
      sum + extractNum(item, ["likesCount", "likes", "diggCount"]),
    0,
  );
  const totalComments = items.reduce(
    (sum, item) =>
      sum + extractNum(item, ["commentsCount", "comments", "commentCount"]),
    0,
  );

  const avgLikes = totalLikes / items.length;
  const avgComments = totalComments / items.length;
  const engagement_rate =
    followers > 0
      ? Math.round(((avgLikes + avgComments) / followers) * 10000) / 100
      : 0;

  const post_frequency =
    items.length > 5 ? "régulier" : items.length > 0 ? "occasionnel" : "inactif";

  const texts = items.map((item) =>
    String(item["text"] ?? item["caption"] ?? item["content"] ?? ""),
  );

  return {
    platform,
    followers,
    engagement_rate,
    post_frequency,
    sentiment: analyzeSentiment(texts),
    status: "active",
  };
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 5 — Analyse réseaux sociaux
 * Sources : Apify via Composio (instagram, twitter, tiktok)
 * LinkedIn — toujours status: 'missing' (pas de tâche Apify)
 * Mode dégradé : par plateforme, une erreur n'arrête pas les autres
 */
export async function fetchSocial(
  profile: ElevayAgentProfile,
  priority_channels?: string[],
): Promise<ModuleResult<SocialData>> {
  try {
    const { brand_name, primary_keyword } = profile;

    // Filter platforms based on priority_channels
    const activePlatformKeys = PLATFORMS.filter(p =>
      shouldRunSocialPlatform(PLATFORM_CANONICAL[p], priority_channels),
    );

    // Brand variants for slug-based handle detection (e.g. "Louis Pion" → @louispion)
    // Early-exit per platform: stop at first variant that returns results
    const variants = getBrandVariants(brand_name);
    // Append sector keyword as a fallback query after slug variants
    const variantsWithKeyword = [...variants, `${brand_name} ${primary_keyword}`]
      .filter((v, i, a) => a.indexOf(v) === i);

    const platformResults = await Promise.allSettled(
      activePlatformKeys.map(async (p) => ({
        items: await searchWithVariants(variantsWithKeyword, p),
      })),
    );

    const platformDataList: PlatformData[] = [];
    const allTexts: string[] = [];

    for (let i = 0; i < activePlatformKeys.length; i++) {
      const platform = activePlatformKeys[i];
      const result = platformResults[i];

      if (result.status === "rejected") {
        platformDataList.push({
          platform,
          followers: 0,
          engagement_rate: 0,
          post_frequency: "inactif",
          sentiment: "neutral",
          status: "missing",
        });
        continue;
      }

      const items = result.value.items;
      console.log("[social] platform:", platform, "final results:", items.length, "first result:", (items[0] as SocialPostItem | undefined)?.["url"] ?? "none");
      const pd = buildPlatformData(platform, items);
      platformDataList.push(pd);

      // Collect texts for dominant_topics
      if (items.length > 0) {
        allTexts.push(
          ...items.map((item) =>
            String(item["text"] ?? item["caption"] ?? item["content"] ?? ""),
          ),
        );
      }
    }

    // LinkedIn — always missing (no Apify task)
    platformDataList.push({
      platform: "linkedin",
      followers: 0,
      engagement_rate: 0,
      post_frequency: "inactif",
      sentiment: "neutral",
      status: "missing",
    });

    // social_score — only count platforms that were actually attempted (exclude LinkedIn)
    const attemptedPlatforms = platformDataList.filter(
      (p) => p.status !== "missing",
    );
    const activePlatforms = attemptedPlatforms.filter(
      (p) => p.status === "active",
    );
    const avgEngagement =
      activePlatforms.length > 0
        ? activePlatforms.reduce((sum, p) => sum + p.engagement_rate, 0) /
          activePlatforms.length
        : 0;
    const social_score = Math.round(
      activePlatforms.length * 20 + Math.min(40, avgEngagement * 4),
    );
    const scored_platforms = attemptedPlatforms.map((p) => p.platform);

    // brand_coherence_score — heuristic based on active platform count
    const activeCount = activePlatforms.length;
    const brand_coherence_score =
      activeCount >= 3 ? 100 : activeCount === 2 ? 60 : activeCount === 1 ? 30 : 0;

    // dominant_topics — top 3 words from all post texts
    const wordFreq = new Map<string, number>();
    for (const text of allTexts) {
      const words = text
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
      }
    }
    const dominant_topics = [...wordFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => word);

    return {
      success: true,
      data: {
        platforms: platformDataList,
        social_score,
        brand_coherence_score,
        dominant_topics,
        scored_platforms,
      },
      source: "social:apify",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "social:apify",
      error: {
        code: "SOCIAL_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Unknown error",
      },
      degraded: true,
    };
  }
}
