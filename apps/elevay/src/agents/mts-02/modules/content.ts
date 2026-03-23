import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import { searchSerp, searchYoutube, socialSearch } from "../../_shared/composio";
import type {
  ContentPerformanceData,
  KeywordTrend,
  SerpContent,
  SocialSample,
  YoutubeContent,
} from "../types";

// ── Infer dominant format / tone from titles ──────────────────────────────────

const FORMAT_PATTERNS: { pattern: RegExp; format: string }[] = [
  { pattern: /\b(guide|tutorial|how to|comment)\b/i, format: "guide long-form" },
  { pattern: /\b(checklist|template|liste|list)\b/i, format: "checklist" },
  { pattern: /\b(étude de cas|case study|résultat|result)\b/i, format: "étude de cas" },
  { pattern: /\b(vs|comparatif|versus|compare)\b/i, format: "comparatif" },
  { pattern: /\b(top \d+|best \d+|\d+ façons|\d+ ways)\b/i, format: "liste classée" },
  { pattern: /\b(statistiques|stats|chiffres|numbers)\b/i, format: "post statistiques" },
];

const TONE_PATTERNS: { pattern: RegExp; tone: string }[] = [
  { pattern: /\b(pourquoi|why|raison|reason)\b/i, tone: "didactique" },
  { pattern: /\b(vrai|vraiment|réalité|truth|myth|mythe)\b/i, tone: "polémique" },
  { pattern: /\b(j'ai|ma|mon|my|i |histoire|story)\b/i, tone: "storytelling" },
  { pattern: /\b(\d{2,}%|multiplié|croissance|growth|augment)\b/i, tone: "stat choc" },
];

function inferFormat(titles: string[]): string {
  const counts: Record<string, number> = {};
  for (const title of titles) {
    for (const { pattern, format } of FORMAT_PATTERNS) {
      if (pattern.test(title)) {
        counts[format] = (counts[format] ?? 0) + 1;
      }
    }
  }
  if (Object.keys(counts).length === 0) return "article";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function inferTone(titles: string[]): string {
  const counts: Record<string, number> = {};
  for (const title of titles) {
    for (const { pattern, tone } of TONE_PATTERNS) {
      if (pattern.test(title)) {
        counts[tone] = (counts[tone] ?? 0) + 1;
      }
    }
  }
  if (Object.keys(counts).length === 0) return "informatif";
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function fetchContent(
  profile: ElevayAgentProfile,
  risingKeywords: KeywordTrend[],
): Promise<ModuleResult<ContentPerformanceData>> {
  try {
    // Limiter à 3 keywords en croissance max (coûts API)
    const keywords = risingKeywords.slice(0, 3).map((k) => k.keyword);
    if (keywords.length === 0) {
      // Fallback sur primary keyword si aucun rising
      keywords.push(profile.primary_keyword);
    }

    // SERP — top contenus par keyword
    const serpResults = await Promise.allSettled(
      keywords.map((kw) => searchSerp(kw, profile.country)),
    );

    const serp_top_content: SerpContent[] = [];
    for (const result of serpResults) {
      if (result.status === "fulfilled") {
        const items = (result.value.organic_results ?? []).slice(0, 5);
        for (const item of items) {
          serp_top_content.push({
            title: item.title,
            url: item.link,
            snippet: item.snippet,
            position: item.position,
          });
        }
      }
    }

    // YouTube — max 2 queries
    const ytQueries = keywords.slice(0, 2);
    const ytResults = await Promise.allSettled(
      ytQueries.map((kw) => searchYoutube(kw)),
    );

    const youtube_trending: YoutubeContent[] = [];
    const seenVideoIds = new Set<string>();
    for (const result of ytResults) {
      if (result.status === "fulfilled") {
        for (const item of result.value.items ?? []) {
          const id = item.id.videoId;
          if (!seenVideoIds.has(id)) {
            seenVideoIds.add(id);
            youtube_trending.push({
              title: item.snippet.title,
              channel: item.snippet.channelTitle,
              videoId: id,
              publishedAt: item.snippet.publishedAt,
            });
          }
        }
      }
    }

    // Social — LinkedIn, TikTok, X (best-effort, 10-20 posts max par plateforme)
    const platforms = ["twitter", "tiktok", "linkedin"] as const;
    const socialResults = await Promise.allSettled(
      platforms.map((p) => socialSearch(keywords[0] ?? profile.primary_keyword, p)),
    );

    const social_samples: SocialSample[] = [];
    for (let i = 0; i < platforms.length; i++) {
      const result = socialResults[i];
      if (result.status === "fulfilled") {
        const items = result.value.items.slice(0, 20);
        for (const item of items) {
          const text = (item["text"] ?? item["description"] ?? item["content"] ?? "") as string;
          const engagement = ((item["likes"] as number ?? 0) +
            (item["comments"] as number ?? 0) +
            (item["shares"] as number ?? 0));
          if (text) {
            social_samples.push({ platform: platforms[i], text: String(text).slice(0, 200), engagement });
          }
        }
      }
    }

    // Inférer formats et tons dominants par canal
    const serpTitles = serp_top_content.map((s) => s.title);
    const ytTitles = youtube_trending.map((v) => v.title);
    const liTitles = social_samples.filter((s) => s.platform === "linkedin").map((s) => s.text);
    const ttTitles = social_samples.filter((s) => s.platform === "tiktok").map((s) => s.text);
    const xTitles = social_samples.filter((s) => s.platform === "twitter").map((s) => s.text);

    const dominant_formats: Record<string, string> = {
      SEO: inferFormat(serpTitles),
      YouTube: inferFormat(ytTitles),
      LinkedIn: inferFormat(liTitles),
      TikTok: inferFormat(ttTitles),
      X: inferFormat(xTitles),
    };

    const dominant_tones: Record<string, string> = {
      SEO: inferTone(serpTitles),
      YouTube: inferTone(ytTitles),
      LinkedIn: inferTone(liTitles),
      TikTok: inferTone(ttTitles),
      X: inferTone(xTitles),
    };

    return {
      success: true,
      data: { serp_top_content, youtube_trending, social_samples, dominant_formats, dominant_tones },
      source: "serpapi+youtube+apify",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "content",
      error: {
        code: "MODULE_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Content fetch failed",
      },
      degraded: true,
    };
  }
}
