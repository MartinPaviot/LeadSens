import type { AgentProfile } from "@/agents/_shared/types"
import { sanitize } from "@/agents/_shared/utils"
import type {
  BpiScores,
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
  GoogleMapsData,
  TrustpilotData,
} from "./types"

export function getSystemPrompt(language: string): string {
  return `CRITICAL: You MUST respond ENTIRELY in ${language}. Every single field value must be in ${language}. Never use French if language is English.

You are an expert Brand Presence Intelligence analyst.
Analyse the provided data and return a JSON object with exactly this structure:

{
  "axis_diagnostics": [
    {"axis": "serp", "diagnostic": "One sentence analysis of SERP visibility"},
    {"axis": "press", "diagnostic": "One sentence analysis of press coverage"},
    {"axis": "youtube", "diagnostic": "One sentence analysis of YouTube presence"},
    {"axis": "social", "diagnostic": "One sentence analysis of social media"},
    {"axis": "seo", "diagnostic": "One sentence analysis of SEO performance"},
    {"axis": "benchmark", "diagnostic": "One sentence analysis vs competitors"}
  ],
  "priorities_90d": [
    {"action": "Specific actionable recommendation based on data", "tag": "Urgent", "source_problem": "What data point triggered this"},
    {"action": "Specific actionable recommendation based on data", "tag": "Mid-term", "source_problem": "What data point triggered this"},
    {"action": "Specific actionable recommendation based on data", "tag": "Quick win", "source_problem": "What data point triggered this"}
  ]
}

MANDATORY RULES:
- Return ONLY the JSON object. No markdown fences. No text before or after.
- axis_diagnostics MUST have exactly 6 items with exactly these axis keys: serp, press, youtube, social, seo, benchmark
- priorities_90d MUST have exactly 3 items. NEVER return an empty array.
- tag MUST be one of: "Urgent", "Mid-term", "Quick win"
- Every string value must be specific and based on actual data provided, not generic.
- ALL text in ${language}.`
}

interface SocialEnrichment {
  facebook: {
    source: string
    followers: number | null
    avgEngagement: number | null
  } | null
  instagram: {
    source: string
    followers: number | null
    postsCount: number | null
    avgLikes: number | null
  } | null
  dataSources: Record<string, string>
}

export function buildConsolidatedPrompt(
  profile: AgentProfile,
  scores: BpiScores,
  modules: {
    serp: SerpData | null
    press: PressData | null
    youtube: YoutubeData | null
    social: SocialData | null
    seo: SeoData | null
    benchmark: BenchmarkData | null
    googleMaps: GoogleMapsData | null
    trustpilot: TrustpilotData | null
  },
  socialEnrichment?: SocialEnrichment,
): string {
  const lang =
    profile.language === "fr"
      ? "French"
      : profile.language === "en"
        ? "English"
        : profile.language

  return `## Brand Presence Audit — ${sanitize(profile.brand_name)}

**Language for your response: ${lang}**

### Brand Profile
- Name: ${sanitize(profile.brand_name)}
- URL: ${sanitize(profile.brand_url)}
- Sector: ${sanitize(profile.sector ?? "Not specified")}
- Country: ${sanitize(profile.country)}
- Primary keyword: ${sanitize(profile.primary_keyword)}
- Secondary keyword: ${sanitize(profile.secondary_keyword)}
- Competitors: ${profile.competitors.map((c) => sanitize(c.name)).join(", ")}

### Global Score: ${scores.global}/100 (completeness: ${scores.completeness}%)

### Axis Scores
- SERP visibility: ${scores.serp}/100
- Press coverage: ${scores.press}/100
- YouTube presence: ${scores.youtube}/100
- Social media: ${scores.social}/100
- SEO performance: ${scores.seo}/100
- Competitive benchmark: ${scores.benchmark}/100

### Raw Data Summary

**SERP:**
${
  modules.serp
    ? `- Official site position: ${modules.serp.official_site_position ?? "Not found"}
- Negative snippets: ${modules.serp.negative_snippets.length}
- Competitor positions: ${JSON.stringify(modules.serp.competitor_positions)}`
    : "- Data unavailable"
}

**Press:**
${
  modules.press
    ? `- Article count: ${modules.press.article_count}
- Sentiment: ${modules.press.sentiment}
- Editorial angle: ${modules.press.editorial_angle}
- Top domains: ${modules.press.top_domains.join(", ")}`
    : "- Data unavailable"
}

**YouTube:**
${
  modules.youtube
    ? `- Video count: ${modules.youtube.video_count}
- Sentiment: ${modules.youtube.sentiment}
- Top videos: ${modules.youtube.top_videos
        .slice(0, 3)
        .map((v) => v.title)
        .join(", ")}`
    : "- Data unavailable"
}

**Social:**
${
  modules.social
    ? `- Scored platforms: ${modules.social.scored_platforms.join(", ")}
- Social score: ${modules.social.social_score}
- Brand coherence: ${modules.social.brand_coherence_score}`
    : "- Data unavailable"
}
${
  socialEnrichment?.facebook
    ? `
**Facebook (${socialEnrichment.facebook.source === "composio_oauth" ? "Connected account" : "Public data"}):**
- Followers: ${socialEnrichment.facebook.followers ?? "Unknown"}
- Avg engagement: ${socialEnrichment.facebook.avgEngagement ?? "Unknown"}`
    : ""
}
${
  socialEnrichment?.instagram
    ? `
**Instagram (${socialEnrichment.instagram.source === "composio_oauth" ? "Connected account" : "Public data"}):**
- Followers: ${socialEnrichment.instagram.followers ?? "Unknown"}
- Posts: ${socialEnrichment.instagram.postsCount ?? "Unknown"}
- Avg likes: ${socialEnrichment.instagram.avgLikes ?? "Unknown"}`
    : ""
}

**SEO:**
${
  modules.seo
    ? `- Domain authority: ${modules.seo.domain_authority}
- Keyword positions: ${JSON.stringify(modules.seo.keyword_positions)}
- Keyword gaps: ${modules.seo.keyword_gaps.join(", ")}`
    : "- Data unavailable"
}

**Benchmark:**
${
  modules.benchmark
    ? `- Brand rank: ${modules.benchmark.brand_rank}/${modules.benchmark.competitors.length + 1}
- Benchmark score: ${modules.benchmark.benchmark_score}
- Competitors: ${modules.benchmark.competitors.map((c) => `${c.name} (${c.overall_score})`).join(", ")}`
    : "- Data unavailable"
}

**Google Maps:** ${modules.googleMaps ? `Rating ${modules.googleMaps.rating ?? "N/A"} (${modules.googleMaps.review_count} reviews, ${modules.googleMaps.recent_sentiment})` : "Unavailable"}

**Trustpilot:** ${modules.trustpilot ? `Rating ${modules.trustpilot.rating ?? "N/A"} (${modules.trustpilot.review_count} reviews, trust score: ${modules.trustpilot.trust_score})` : "Unavailable"}

---
Produce your diagnosis and 90-day priorities in ${lang}. Be specific, actionable, and data-driven.`
}
