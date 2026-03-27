import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import { socialSearch } from "../../_shared/composio";
import type { SocialListeningData, SocialSignal } from "../types";
import { shouldRunSocialPlatform } from "@/lib/channel-filter";

// ─── Dedup helper ─────────────────────────────────────────────────────────────

function getItemKey(item: Record<string, unknown>): string | null {
  const val = item["id"] ?? item["url"] ?? item["shortCode"]
    ?? item["webVideoUrl"] ?? item["conversationId"] ?? item["link"];
  return val != null ? String(val) : null;
}

function mergeUnique(results: PromiseSettledResult<{ items: Record<string, unknown>[] }>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const merged: Record<string, unknown>[] = [];
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

function extractEngagement(item: Record<string, unknown>): number {
  return (
    ((item["likes"] as number) ?? (item["likesCount"] as number) ?? 0) +
    ((item["comments"] as number) ?? (item["commentsCount"] as number) ?? 0) +
    ((item["shares"] as number) ?? (item["sharesCount"] as number) ?? 0) +
    ((item["views"] as number) ?? 0) / 100  // views pondérées
  );
}

function extractText(item: Record<string, unknown>): string {
  return String(
    item["text"] ?? item["content"] ?? item["description"] ?? item["caption"] ?? "",
  ).slice(0, 300);
}

const FORMAT_PATTERNS: { pattern: RegExp; format: string }[] = [
  { pattern: /\b(carrousel|carousel|slides?)\b/i, format: "carrousel" },
  { pattern: /\b(thread|fil)\b/i, format: "thread" },
  { pattern: /\b(vidéo|video|reel|short)\b/i, format: "vidéo courte" },
  { pattern: /\b(live|direct)\b/i, format: "live" },
  { pattern: /\b(sondage|poll|vote)\b/i, format: "sondage" },
  { pattern: /\b(article|blog|lire|read)\b/i, format: "article" },
];

const TONE_PATTERNS: { pattern: RegExp; tone: string }[] = [
  { pattern: /\b(pourquoi|why|raison|reason)\b/i, tone: "didactique" },
  { pattern: /\b(unpopular|hot take|controversial|polémique)\b/i, tone: "polémique" },
  { pattern: /\b(j'ai|mon|ma|my|i |histoire|story)\b/i, tone: "storytelling" },
  { pattern: /\b(\d{2,}%|multiplié|croissance|x\d)\b/i, tone: "stat choc" },
];

function inferFormat(texts: string[]): string {
  const counts: Record<string, number> = {};
  for (const text of texts) {
    for (const { pattern, format } of FORMAT_PATTERNS) {
      if (pattern.test(text)) counts[format] = (counts[format] ?? 0) + 1;
    }
  }
  if (Object.keys(counts).length === 0) return "post";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function inferTone(texts: string[]): string {
  const counts: Record<string, number> = {};
  for (const text of texts) {
    for (const { pattern, tone } of TONE_PATTERNS) {
      if (pattern.test(text)) counts[tone] = (counts[tone] ?? 0) + 1;
    }
  }
  if (Object.keys(counts).length === 0) return "informatif";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function extractHooks(texts: string[]): string[] {
  return texts
    .slice(0, 10)
    .map((t) => t.split(/\s+/).slice(0, 6).join(" ").trim())
    .filter(Boolean)
    .slice(0, 5);
}

function buildSignal(
  platform: string,
  items: Record<string, unknown>[],
): SocialSignal {
  const texts = items.map(extractText).filter(Boolean);
  const engagements = items.map(extractEngagement);
  return {
    platform,
    dominant_format: inferFormat(texts),
    dominant_tone: inferTone(texts),
    trending_hooks: extractHooks(texts),
    engagement_benchmark: Math.round(median(engagements)),
    available: true,
  };
}

function unavailableSignal(platform: string): SocialSignal {
  return {
    platform,
    dominant_format: "inconnu",
    dominant_tone: "inconnu",
    trending_hooks: [],
    engagement_benchmark: 0,
    available: false,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function fetchSocialListening(
  profile: ElevayAgentProfile,
  sector: string,
  priority_channels?: string[],
): Promise<ModuleResult<SocialListeningData>> {
  try {
    const baseQuery = `${sector} ${profile.primary_keyword}`.slice(0, 100);
    const brandQuery = `${profile.brand_name} ${sector}`.slice(0, 100);
    const queries = [baseQuery, brandQuery];

    const runLinkedIn = shouldRunSocialPlatform("LinkedIn", priority_channels);
    const runTikTok   = shouldRunSocialPlatform("TikTok",   priority_channels);
    const runX        = shouldRunSocialPlatform("X",        priority_channels);

    const fanOut = (platform: string) =>
      Promise.allSettled(queries.map((q) => socialSearch(q, platform))).then((rs) => ({
        items: mergeUnique(rs),
      }));

    const [liResult, ttResult, xResult] = await Promise.allSettled([
      runLinkedIn ? fanOut("linkedin") : Promise.reject(new Error("skipped")),
      runTikTok   ? fanOut("tiktok")   : Promise.reject(new Error("skipped")),
      runX        ? fanOut("twitter")  : Promise.reject(new Error("skipped")),
    ]);

    const linkedinSignal: SocialSignal =
      liResult.status === "fulfilled" && liResult.value.items.length > 0
        ? buildSignal("LinkedIn", liResult.value.items.slice(0, 20))
        : unavailableSignal("LinkedIn");

    const tiktokSignal: SocialSignal =
      ttResult.status === "fulfilled" && ttResult.value.items.length > 0
        ? buildSignal("TikTok", ttResult.value.items.slice(0, 20))
        : unavailableSignal("TikTok");

    const xSignal: SocialSignal =
      xResult.status === "fulfilled" && xResult.value.items.length > 0
        ? buildSignal("X", xResult.value.items.slice(0, 20))
        : unavailableSignal("X");

    const isDegraded =
      !linkedinSignal.available && !tiktokSignal.available && !xSignal.available;

    return {
      success: true,
      data: {
        linkedin_signals: [linkedinSignal],
        tiktok_signals: [tiktokSignal],
        x_signals: [xSignal],
      },
      source: "apify-social",
      degraded: isDegraded,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "social-listening",
      error: {
        code: "MODULE_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Social listening failed",
      },
      degraded: true,
    };
  }
}
