import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { YoutubeData, VideoEntry } from "../types";
import { searchYoutube, getYoutubeComments } from "../../_shared/composio";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NEGATIVE_MARKERS = [
  "bad",
  "scam",
  "arnaque",
  "nul",
  "worst",
  "terrible",
  "problème",
  "déçu",
];
const POSITIVE_MARKERS = [
  "great",
  "excellent",
  "super",
  "parfait",
  "recommande",
  "top",
  "best",
];

function analyzeTextSentiment(
  texts: string[],
): "positive" | "neutral" | "negative" {
  const combined = texts.join(" ").toLowerCase();
  const negCount = NEGATIVE_MARKERS.filter((m) => combined.includes(m)).length;
  const posCount = POSITIVE_MARKERS.filter((m) => combined.includes(m)).length;
  if (negCount > posCount) return "negative";
  if (posCount > negCount) return "positive";
  return "neutral";
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 4 — Audit YouTube
 * Source : YouTube Data API v3 via Composio
 * Requêtes : [brand review], [brand test], [brand avis]
 * Commentaires : max 10/vidéo, échantillon 5 vidéos (réduit à 2 si quota 403/429)
 */
export async function fetchYoutube(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<YoutubeData>> {
  try {
    const { brand_name, competitors } = profile;

    const queries = [
      `${brand_name} review`,
      `${brand_name} test`,
      `${brand_name} avis`,
    ];

    const searchResults = await Promise.allSettled(
      queries.map((q) => searchYoutube(q)),
    );

    // Deduplicate by videoId across all search results
    const seenIds = new Set<string>();
    const uniqueVideos: Array<{
      videoId: string;
      title: string;
      channelTitle: string;
      publishedAt: string;
    }> = [];

    for (const res of searchResults) {
      if (res.status !== "fulfilled") continue;
      for (const item of res.value.items ?? []) {
        const videoId = item.id?.videoId;
        if (videoId && !seenIds.has(videoId)) {
          seenIds.add(videoId);
          uniqueVideos.push({
            videoId,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            publishedAt: item.snippet.publishedAt,
          });
        }
      }
    }

    if (uniqueVideos.length === 0) {
      return {
        success: true,
        data: {
          video_count: 0,
          top_videos: [],
          sentiment: "neutral",
          influencer_opportunities: [],
          reputation_score: 50,
        },
        source: "youtube:data-api-v3",
      };
    }

    // Analyze sentiment for top 5 videos (quota-aware)
    const topVideos = uniqueVideos.slice(0, 5);
    const videoEntries: VideoEntry[] = [];
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    let quotaExceeded = false;

    for (let idx = 0; idx < topVideos.length; idx++) {
      // Reduce sample to 2 videos if quota exceeded
      if (quotaExceeded && idx >= 2) break;

      const v = topVideos[idx];
      let videoSentiment: "positive" | "neutral" | "negative" = "neutral";

      try {
        const commentsRes = await getYoutubeComments(v.videoId, 10);
        const commentTexts = (commentsRes.items ?? []).map(
          (item) => item.snippet.topLevelComment.snippet.textDisplay,
        );
        videoSentiment = analyzeTextSentiment([v.title, ...commentTexts]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("403") || msg.includes("429")) {
          quotaExceeded = true;
        }
        // Best effort: use title only
        videoSentiment = analyzeTextSentiment([v.title]);
      }

      sentimentCounts[videoSentiment]++;
      videoEntries.push({
        title: v.title,
        channel: v.channelTitle,
        views: 0, // YouTube search API doesn't return view counts
        date: v.publishedAt,
        url: `https://www.youtube.com/watch?v=${v.videoId}`,
        sentiment: videoSentiment,
      });
    }

    // Global sentiment
    const total = videoEntries.length;
    let sentiment: YoutubeData["sentiment"] = "neutral";
    if (sentimentCounts.positive / total > 0.6) sentiment = "positive";
    else if (sentimentCounts.negative / total > 0.6) sentiment = "negative";
    else if (sentimentCounts.positive > 0 && sentimentCounts.negative > 0)
      sentiment = "mixed";

    // reputation_score
    const positiveRatio = sentimentCounts.positive / total;
    const reputation_score = Math.round(40 + positiveRatio * 60);

    // influencer_opportunities — channels with > 1 video
    const channelCounts = new Map<string, number>();
    for (const v of uniqueVideos) {
      channelCounts.set(
        v.channelTitle,
        (channelCounts.get(v.channelTitle) ?? 0) + 1,
      );
    }

    const influencer_opportunities: string[] = [];
    for (const [channel, count] of channelCounts.entries()) {
      if (count > 1) {
        influencer_opportunities.push(
          `${channel} — ${count} vidéos sur la marque, potentiel partenariat`,
        );
      }
    }

    // Channels covering competitors
    const competitorNames = competitors.map((c) => c.name.toLowerCase());
    for (const v of uniqueVideos) {
      const titleLower = v.title.toLowerCase();
      if (competitorNames.some((cn) => titleLower.includes(cn))) {
        if (!influencer_opportunities.some((o) => o.startsWith(v.channelTitle))) {
          influencer_opportunities.push(
            `${v.channelTitle} — couvre des concurrents, opportunité de partenariat`,
          );
        }
      }
    }

    return {
      success: true,
      data: {
        video_count: uniqueVideos.length,
        top_videos: videoEntries,
        sentiment,
        influencer_opportunities,
        reputation_score,
      },
      source: "youtube:data-api-v3",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "youtube:data-api-v3",
      error: {
        code: "YOUTUBE_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      },
      degraded: true,
    };
  }
}
