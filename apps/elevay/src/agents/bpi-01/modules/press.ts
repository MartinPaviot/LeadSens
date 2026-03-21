import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { PressData } from "../types";
import { searchNews } from "../../_shared/composio";
import type { NewsArticle } from "../../_shared/composio";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NEGATIVE_WORDS = [
  "problème",
  "arnaque",
  "fraude",
  "crise",
  "polémique",
  "faillite",
  "scandale",
];
const POSITIVE_WORDS = [
  "innov",
  "lève",
  "croissance",
  "récompense",
  "award",
  "lancement",
  "succès",
];

const ANGLE_PATTERNS: Record<string, string[]> = {
  crise: ["crise", "polémique", "arnaque", "fraude"],
  leadership: ["ceo", "fondateur", "dirigeant", "pdg", "interview"],
  produit: ["fonctionnalité", "version", "lancement", "produit"],
  innovation: ["ia ", "intelligence artificielle", "technologie", "innov"],
};

function getSourceDomain(article: NewsArticle): string {
  if (typeof article.source === "string" && article.source.length > 0) {
    // Could be a name or URL — extract domain if URL-like
    if (article.source.startsWith("http")) {
      try {
        return new URL(article.source).hostname.replace(/^www\./, "");
      } catch {
        return article.source;
      }
    }
    return article.source;
  }
  if (typeof article.source === "object" && article.source?.name) {
    return article.source.name;
  }
  // Fallback: extract from article URL
  try {
    return new URL(article.url).hostname.replace(/^www\./, "");
  } catch {
    return article.url.split("/")[0];
  }
}

// ─── Module ───────────────────────────────────────────────────────────────────

/**
 * Module 2 — Analyse presse & mentions web
 * Source : Composio Search News (retry ×1, 500ms)
 * Limite : 3 requêtes par audit
 */
export async function fetchPress(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<PressData>> {
  try {
    const { brand_name, primary_keyword, country, language } = profile;

    const queries = [
      brand_name,
      `${brand_name} ${primary_keyword}`,
      `${brand_name} actualité`,
    ];

    const settled = await Promise.allSettled(
      queries.map((q) => searchNews(q, language)),
    );

    if (settled.every((r) => r.status === "rejected")) {
      return {
        success: false,
        data: null,
        source: "press:composio-news",
        error: {
          code: "PRESS_FETCH_FAILED",
          message: "All news queries failed",
        },
        degraded: true,
      };
    }

    // Collect + deduplicate by URL
    const seenUrls = new Set<string>();
    const articles: NewsArticle[] = [];
    for (const res of settled) {
      if (res.status !== "fulfilled") continue;
      const raw = res.value.articles ?? res.value.news_results ?? [];
      for (const a of raw) {
        if (!seenUrls.has(a.url)) {
          seenUrls.add(a.url);
          articles.push(a);
        }
      }
    }

    // top_domains — top 5 by frequency
    const domainCounts = new Map<string, number>();
    for (const a of articles) {
      const domain = getSourceDomain(a);
      domainCounts.set(domain, (domainCounts.get(domain) ?? 0) + 1);
    }
    const top_domains = [...domainCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    // Sentiment — keyword analysis on titles
    let negCount = 0;
    let posCount = 0;
    for (const a of articles) {
      const title = a.title.toLowerCase();
      if (NEGATIVE_WORDS.some((w) => title.includes(w))) negCount++;
      if (POSITIVE_WORDS.some((w) => title.includes(w))) posCount++;
    }
    const sentiment: PressData["sentiment"] =
      negCount > 0 && posCount > 0
        ? "mixed"
        : negCount > 0
          ? "negative"
          : posCount > 0
            ? "positive"
            : "neutral";

    // Editorial angle — dominant category
    const angleCounts: Record<string, number> = {
      crise: 0,
      leadership: 0,
      produit: 0,
      innovation: 0,
    };
    for (const a of articles) {
      const text =
        `${a.title} ${a.description ?? a.snippet ?? ""}`.toLowerCase();
      for (const [angle, patterns] of Object.entries(ANGLE_PATTERNS)) {
        if (patterns.some((p) => text.includes(p))) {
          angleCounts[angle]++;
        }
      }
    }
    const editorial_angle =
      Object.entries(angleCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      "autre";

    // PR opportunities
    const pr_opportunities: string[] = [];
    if (articles.length < 5) {
      pr_opportunities.push(
        `Couverture presse faible (${articles.length} article${articles.length !== 1 ? "s" : ""} trouvés) — opportunité de relations presse`,
      );
    }
    if (top_domains.length < 3) {
      pr_opportunities.push(
        `Présence limitée dans les grands médias — cibler les publications tech ${country}`,
      );
    }
    if (editorial_angle !== "innovation") {
      pr_opportunities.push(
        `Angle innovation sous-exploité dans la couverture actuelle — opportunité de contenu IA/tech`,
      );
    }
    if (pr_opportunities.length === 0) {
      pr_opportunities.push(
        `Diversifier les angles éditoriaux au-delà de "${editorial_angle}"`,
      );
    }

    return {
      success: true,
      data: {
        article_count: articles.length,
        sentiment,
        editorial_angle,
        top_domains,
        pr_opportunities,
      },
      source: "press:composio-news",
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "press:composio-news",
      error: {
        code: "PRESS_FETCH_FAILED",
        message: err instanceof Error ? err.message : "Erreur inconnue",
      },
      degraded: true,
    };
  }
}
