import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import { searchSerp, searchNews, getKeywordData } from "../../_shared/composio";
import type { CompetitiveContentData, CompetitorContent, ContentGap } from "../types";

// ── Infer publication frequency ───────────────────────────────────────────────

function inferFrequency(
  articleCount: number,
): CompetitorContent["publication_frequency"] {
  if (articleCount >= 15) return "high";
  if (articleCount >= 6) return "medium";
  if (articleCount >= 1) return "low";
  return "unknown";
}

// ── Extract topics from SERP snippets ────────────────────────────────────────

function extractTopics(snippets: string[]): string[] {
  // Extraire des n-grammes significatifs (simpliste mais efficace sans NLP)
  const stopWords = new Set([
    "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "à",
    "the", "a", "an", "of", "in", "for", "with", "is", "are", "and", "or",
    "how", "to", "your", "you", "our", "we", "their", "this", "that", "it",
  ]);

  const wordCounts: Record<string, number> = {};
  for (const snippet of snippets) {
    const words = snippet
      .toLowerCase()
      .replace(/[^a-zA-ZÀ-ÿ\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !stopWords.has(w));

    for (const word of words) {
      wordCounts[word] = (wordCounts[word] ?? 0) + 1;
    }
  }

  return Object.entries(wordCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word);
}

// ── Main ──────────────────────────────────────────────────────────────────────

export async function fetchCompetitive(
  profile: ElevayAgentProfile,
  sector: string,
): Promise<ModuleResult<CompetitiveContentData>> {
  try {
    const competitors = profile.competitors.slice(0, 3);

    if (competitors.length === 0) {
      return {
        success: true,
        data: {
          competitor_content: [],
          saturated_angles: [],
          missing_angles: [],
          content_gaps: [],
        },
        source: "competitive",
        degraded: true,
      };
    }

    // Pour chaque concurrent : blog scraping via SERP + news
    const competitorResults = await Promise.allSettled(
      competitors.map(async (c) => {
        const [blogSerp, newsResult] = await Promise.allSettled([
          searchSerp(`site:${c.url}`, profile.country),
          searchNews(`${c.name} ${sector}`, profile.language),
        ]);

        const blogItems = blogSerp.status === "fulfilled"
          ? blogSerp.value.organic_results ?? []
          : [];

        const newsItems = newsResult.status === "fulfilled"
          ? (newsResult.value.articles ?? newsResult.value.news_results ?? [])
          : [];

        const allSnippets = [
          ...blogItems.map((i) => `${i.title} ${i.snippet}`),
          ...newsItems.slice(0, 10).map((a) => a.title),
        ];

        return {
          name: c.name,
          url: c.url,
          topics: extractTopics(allSnippets),
          formats: inferFormatsFromSnippets(allSnippets),
          publication_frequency: inferFrequency(blogItems.length + newsItems.length),
        } satisfies CompetitorContent;
      }),
    );

    const competitor_content: CompetitorContent[] = [];
    const degraded_competitors: string[] = [];

    for (let i = 0; i < competitors.length; i++) {
      const result = competitorResults[i];
      if (result.status === "fulfilled") {
        competitor_content.push(result.value);
      } else {
        degraded_competitors.push(competitors[i].name);
        competitor_content.push({
          name: competitors[i].name,
          url: competitors[i].url,
          topics: [],
          formats: [],
          publication_frequency: "unknown",
        });
      }
    }

    // Angles saturés = topics présents chez TOUS les concurrents
    // Angles manquants = topics présents chez AUCUN concurrent
    const allTopicSets = competitor_content
      .filter((c) => c.topics.length > 0)
      .map((c) => new Set(c.topics));

    const saturated_angles = allTopicSets.length > 0
      ? [...allTopicSets[0]].filter((topic) =>
          allTopicSets.every((set) => set.has(topic)),
        )
      : [];

    // Angles manquants : topics du primary keyword non couverts par concurrents
    const brandTopicsResult = await searchSerp(
      profile.primary_keyword,
      profile.country,
    ).catch(() => null);

    const brandSnippets = (brandTopicsResult?.organic_results ?? []).map(
      (i) => `${i.title} ${i.snippet}`,
    );
    const brandTopics = extractTopics(brandSnippets);
    const allCompetitorTopics = new Set(
      competitor_content.flatMap((c) => c.topics),
    );
    const missing_angles = brandTopics.filter((t) => !allCompetitorTopics.has(t));

    // Content gaps — volumes DataForSEO pour les missing angles
    const gapResults = await Promise.allSettled(
      missing_angles.slice(0, 5).map((topic) =>
        getKeywordData(topic, profile.country),
      ),
    );

    const content_gaps: ContentGap[] = missing_angles.slice(0, 5).map((topic, i) => {
      const result = gapResults[i];
      const volume = result.status === "fulfilled" ? result.value.rank ?? 0 : 0;

      // Coverage score basé sur le nombre de concurrents couvrant ce topic
      const coveringCount = competitor_content.filter((c) =>
        c.topics.includes(topic),
      ).length;
      const coverage: ContentGap["competitor_coverage"] =
        coveringCount === 0 ? "none" :
        coveringCount === 1 ? "low" :
        coveringCount <= 2 ? "medium" : "high";

      // Score opportunité : volume élevé + faible couverture
      const volScore = Math.min(25, Math.round(volume / 100));
      const covScore = coverage === "none" ? 25 : coverage === "low" ? 15 : coverage === "medium" ? 10 : 5;
      const opportunity_score = Math.min(100, volScore + covScore + 25);  // base 25

      return { topic, estimated_volume: volume, competitor_coverage: coverage, opportunity_score };
    });

    const isDegraded = degraded_competitors.length > 0;

    return {
      success: true,
      data: { competitor_content, saturated_angles, missing_angles, content_gaps },
      source: "serpapi+gnews",
      degraded: isDegraded,
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "competitive",
      error: {
        code: "MODULE_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Competitive fetch failed",
      },
      degraded: true,
    };
  }
}

// ── Infer formats from snippets ───────────────────────────────────────────────

function inferFormatsFromSnippets(snippets: string[]): string[] {
  const formats = new Set<string>();
  const combined = snippets.join(" ").toLowerCase();

  if (/\b(guide|tutorial|how to|comment)\b/.test(combined)) formats.add("guide");
  if (/\b(ebook|livre blanc|whitepaper)\b/.test(combined)) formats.add("ebook");
  if (/\b(webinar|webinaire)\b/.test(combined)) formats.add("webinar");
  if (/\b(étude de cas|case study)\b/.test(combined)) formats.add("étude de cas");
  if (/\b(vidéo|video|youtube)\b/.test(combined)) formats.add("vidéo");
  if (/\b(checklist|template|modèle)\b/.test(combined)) formats.add("checklist");
  if (/\b(rapport|report|étude|study)\b/.test(combined)) formats.add("rapport");

  return formats.size > 0 ? [...formats] : ["article"];
}
