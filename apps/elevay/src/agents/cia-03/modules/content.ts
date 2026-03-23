import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { CompetitorContent, ContentGap, ContentAnalysisData } from "../types";
import { searchSerp, searchYoutube, searchNews } from "../../_shared/composio";
import { shouldRunSocialPlatform } from "@/lib/channel-filter";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "the","and","for","that","with","this","from","are","was","were","has","have",
  "not","but","one","all","you","can","will","more","about","its","our","your",
  "les","des","une","est","qui","que","dans","sur","par","pour","avec","aux",
  "son","ses","leur","leurs","mais","ou","et","donc","or","ni","car","ce","se",
]);

function extractTopics(snippets: string[], maxTopics = 8): string[] {
  const freq = new Map<string, number>();
  for (const snippet of snippets) {
    const words = snippet.toLowerCase().split(/\W+/).filter(w =>
      w.length > 4 && !STOP_WORDS.has(w) && !/^\d+$/.test(w)
    );
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTopics)
    .map(([word]) => word);
}

function inferLeadMagnetTypes(snippets: string[]): string[] {
  const text = snippets.join(" ").toLowerCase();
  const types: string[] = [];
  if (/\bebook\b|\bguide\b|\bwhitepaper\b/.test(text)) types.push("ebook");
  if (/\bwebinar\b|\bwebinaire\b/.test(text)) types.push("webinar");
  if (/\btemplate\b|\bmodèle\b|\bchecklist\b/.test(text)) types.push("template");
  if (/\btrial\b|\bessai\b|\bfree\b|\bgratuit\b/.test(text)) types.push("free trial");
  if (/\bdemo\b|\bdémonstration\b/.test(text)) types.push("demo");
  if (/\bcalculat\b|\boutil\b|\btool\b/.test(text)) types.push("calculateur");
  return types;
}

// ── Module principal ──────────────────────────────────────────────────────────

export async function fetchContentAnalysis(
  profile: ElevayAgentProfile,
  priority_channels?: string[],
): Promise<ModuleResult<ContentAnalysisData>> {
  try {
    const competitorContents: CompetitorContent[] = await Promise.all(
      profile.competitors.map(async competitor => {
        const allSnippets: string[] = [];
        let youtubeVideoCount = 0;
        let youtubeDominantAngle: string | null = null;
        let blogFrequency = "unknown";

        // 1. Blog content via site: SERP
        try {
          const serpRes = await searchSerp(`site:${competitor.url}`, profile.country);
          const results = serpRes.organic_results ?? [];
          allSnippets.push(...results.map(r => `${r.title} ${r.snippet}`));

          // Fréquence blog approximée par le nombre de résultats
          const total = serpRes.search_information?.total_results ?? results.length;
          if (total > 100)      blogFrequency = "quotidien";
          else if (total > 30)  blogFrequency = "hebdomadaire";
          else if (total > 10)  blogFrequency = "mensuel";
          else if (total > 0)   blogFrequency = "occasionnel";
        } catch {
          // non-bloquant
        }

        // 2. YouTube (uniquement si YouTube actif dans les canaux)
        if (shouldRunSocialPlatform("YouTube", priority_channels)) try {
          const ytRes = await searchYoutube(`${competitor.name} ${profile.primary_keyword}`);
          const items = ytRes.items ?? [];
          youtubeVideoCount = ytRes.pageInfo?.totalResults ?? items.length;
          if (items.length > 0) {
            const titles = items.slice(0, 5).map(v => v.snippet.title);
            allSnippets.push(...titles);
            // Dominant angle depuis les titres YouTube
            const combined = titles.join(" ").toLowerCase();
            if (/\bhow to\b|\bcomment\b|\btutoriel\b|\bguide\b/.test(combined)) youtubeDominantAngle = "tutoriel";
            else if (/\breview\b|\bavis\b|\btest\b/.test(combined)) youtubeDominantAngle = "review";
            else if (/\bcase study\b|\bcas client\b|\btémoignage\b/.test(combined)) youtubeDominantAngle = "social proof";
            else if (/\bnews\b|\bactualité\b|\bbreaking\b/.test(combined)) youtubeDominantAngle = "actualité";
            else youtubeDominantAngle = "démonstration";
          }
        } catch {
          // non-bloquant
        }

        // 3. News pour fréquence
        try {
          const newsRes = await searchNews(competitor.name, profile.language);
          const articles = newsRes.articles ?? newsRes.news_results ?? [];
          allSnippets.push(...articles.slice(0, 5).map(a => `${a.title} ${a.description ?? a.snippet ?? ""}`));
        } catch {
          // non-bloquant
        }

        const dominant_themes = extractTopics(allSnippets);
        const lead_magnet_types = inferLeadMagnetTypes(allSnippets);

        const serpCount = allSnippets.length;
        const content_score = Math.min(100, serpCount * 5 + youtubeVideoCount * 10);

        return {
          competitor_url:          competitor.url,
          blog_frequency:          blogFrequency,
          dominant_themes,
          lead_magnet_types,
          youtube_video_count:     youtubeVideoCount,
          youtube_dominant_angle:  youtubeDominantAngle,
          content_score,
        };
      })
    );

    // Gap map : angles couverts vs angles non couverts
    const allThemeSets = competitorContents.map(c => new Set(c.dominant_themes));
    const allThemes = new Set(competitorContents.flatMap(c => c.dominant_themes));

    const editorial_gap_map: ContentGap[] = [...allThemes].map(angle => {
      const coveringCount = allThemeSets.filter(s => s.has(angle)).length;
      const total = allThemeSets.length;
      let coverage: ContentGap["competitor_coverage"];
      if (coveringCount === 0)               coverage = "none";
      else if (coveringCount / total < 0.34) coverage = "low";
      else if (coveringCount / total < 0.67) coverage = "medium";
      else                                   coverage = "high";

      const opportunity = coverage === "none"
        ? `Angle inexploité par tous les concurrents — opportunité de différenciation forte`
        : coverage === "low"
          ? `Peu exploité — potentiel de prise de position rapide`
          : `Angle saturé — différenciation difficile`;

      return { angle, competitor_coverage: coverage, opportunity };
    });

    return {
      success: true,
      data: { competitors: competitorContents, editorial_gap_map },
      source: "content:serp+youtube+news",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "content:serp+youtube+news",
      error: {
        code:    "CONTENT_ANALYSIS_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
      degraded: true,
    };
  }
}
