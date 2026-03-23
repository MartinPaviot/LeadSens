import type { ElevayAgentProfile, ModuleResult } from "../../_shared/types";
import type { MessagingAnalysis, ProductMessagingData } from "../types";
import { searchSerp } from "../../_shared/composio";

// ── Types internes ────────────────────────────────────────────────────────────

type DominantAngle = "ROI" | "simplicité" | "sécurité" | "émotion" | "authority";
type PricingPosture = MessagingAnalysis["pricing_posture"];

// ── Helpers extraction HTML ───────────────────────────────────────────────────

function extractMeta(html: string): {
  title: string
  description: string
  h1: string
} {
  const titleMatch = html.match(/<title[^>]*>([^<]{0,300})<\/title>/i);
  const descMatch =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{0,500})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{0,500})["'][^>]+name=["']description["']/i) ??
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{0,500})["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']{0,500})["'][^>]+property=["']og:description["']/i);
  const h1Match = html.match(/<h1[^>]*>([^<]{0,200})<\/h1>/i);

  return {
    title:       titleMatch?.[1]?.trim() ?? "",
    description: descMatch?.[1]?.trim() ?? "",
    h1:          h1Match?.[1]?.trim().replace(/<[^>]+>/g, "") ?? "",
  };
}

function extractCtaText(html: string): string {
  // Cherche le premier bouton CTA prominent
  const btnMatch =
    html.match(/<a[^>]+(?:class|id)=["'][^"']*(?:cta|btn|button|hero)[^"']*["'][^>]*>([^<]{0,80})<\/a>/i) ??
    html.match(/<button[^>]*>([^<]{0,80})<\/button>/i) ??
    html.match(/<a[^>]+href=["'][^"']*(?:signup|register|start|demo|trial)[^"']*["'][^>]*>([^<]{0,80})<\/a>/i);
  return btnMatch?.[1]?.trim().replace(/<[^>]+>/g, "") ?? "";
}

function inferDominantAngle(text: string): DominantAngle {
  const lower = text.toLowerCase();
  const scores: Record<DominantAngle, number> = {
    ROI:        0,
    simplicité: 0,
    sécurité:   0,
    émotion:    0,
    authority:  0,
  };

  // ROI
  if (/\b(?:roi|revenue|profit|save|économis|gain|croissance|growth|performance|résultat)\b/.test(lower)) scores.ROI += 2;
  if (/\d+[%x]\b/.test(lower)) scores.ROI += 1;

  // Simplicité
  if (/\b(?:simple|easy|facile|rapide|quick|instant|minute|effortless|sans effort|plug.and.play|no.code)\b/.test(lower)) scores.simplicité += 2;

  // Sécurité
  if (/\b(?:secure|sécuris|privacy|gdpr|rgpd|trust|confiance|protect|reliable|certif|complian)\b/.test(lower)) scores.sécurité += 2;

  // Émotion
  if (/\b(?:love|amour|feel|ressent|happy|heureux|dream|rêve|passion|inspiration|beautiful|beau)\b/.test(lower)) scores.émotion += 2;

  // Authority
  if (/\b(?:#1|leader|best|meilleur|award|prix|certif|expert|since|depuis|trusted by|used by|customers|clients)\b/.test(lower)) scores.authority += 2;
  if (/\d{3,}[\s+](?:customers|clients|users|entreprises)/.test(lower)) scores.authority += 1;

  const winner = (Object.entries(scores) as [DominantAngle, number][])
    .sort((a, b) => b[1] - a[1])[0];
  return winner[1] > 0 ? winner[0] : "ROI";
}

function inferPricingPosture(snippets: string[]): PricingPosture {
  const text = snippets.join(" ").toLowerCase();
  if (/\bfree\b|\bgratuit\b|\bfreemium\b/.test(text)) return "freemium";
  if (/\benterprise\b|\bcustom\b|\bcontact.us\b|\bsur devis\b|\bpremium\b/.test(text)) return "premium";
  if (/\b(?:cheap|affordable|abordable|low.cost|économique)\b/.test(text)) return "low-cost";
  if (/\$\d+|\€\d+|\d+\/mo/.test(text)) return "mid-market";
  return "unknown";
}

function calcMessagingClarity(title: string, description: string, h1: string, cta: string): number {
  let score = 0;
  // Présence des éléments clés
  if (title.length > 10) score += 20;
  if (description.length > 30) score += 25;
  if (h1.length > 5) score += 25;
  if (cta.length > 2) score += 20;
  // Longueur raisonnable (ni trop courte ni trop longue)
  const valuePropLen = (description || h1).length;
  if (valuePropLen > 50 && valuePropLen < 200) score += 10;
  return Math.min(100, score);
}

// ── Différenciation cross-concurrent ─────────────────────────────────────────

function calcDifferentiationScores(analyses: Omit<MessagingAnalysis, "differentiation_score">[]): number[] {
  if (analyses.length <= 1) return analyses.map(() => 50);

  // Pour chaque analyse, compter les mots uniques vs les autres
  const tokenize = (s: string) => s.toLowerCase().split(/\W+/).filter(w => w.length > 3);
  const allTokenSets = analyses.map(a =>
    new Set(tokenize(`${a.hero_message} ${a.value_prop}`))
  );

  return allTokenSets.map((tokens, i) => {
    const others = allTokenSets.filter((_, j) => j !== i);
    const allOtherTokens = new Set(others.flatMap(s => [...s]));
    const unique = [...tokens].filter(t => !allOtherTokens.has(t)).length;
    const total  = tokens.size;
    if (total === 0) return 30;
    return Math.min(100, Math.round(30 + (unique / total) * 70));
  });
}

// ── Fetch avec retry ──────────────────────────────────────────────────────────

async function fetchWithRetry(url: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ElevayBot/1.0)",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000));
    }
  }
  return null;
}

// ── Module principal ──────────────────────────────────────────────────────────

export async function fetchProductMessaging(
  profile: ElevayAgentProfile,
): Promise<ModuleResult<ProductMessagingData>> {
  try {
    const partials: Omit<MessagingAnalysis, "differentiation_score">[] = [];

    for (const competitor of profile.competitors) {
      // 1. Scrape homepage
      const html = await fetchWithRetry(competitor.url);
      const scraping_success = html !== null;

      const { title, description, h1 } = html
        ? extractMeta(html)
        : { title: "", description: "", h1: "" };
      const cta = html ? extractCtaText(html) : "";
      const valuePropText = description || h1 || title;
      const dominantAngle = inferDominantAngle(`${title} ${valuePropText}`);

      // 2. Pricing posture via SERP
      let pricing_posture: PricingPosture = "unknown";
      try {
        const serpRes = await searchSerp(`${competitor.name} pricing`, profile.country);
        const snippets = (serpRes.organic_results ?? []).slice(0, 5).map(r => `${r.title} ${r.snippet}`);
        pricing_posture = inferPricingPosture(snippets);
      } catch {
        // non-bloquant
      }

      partials.push({
        competitor_url:         competitor.url,
        hero_message:           title || competitor.name,
        value_prop:             valuePropText,
        primary_cta:            cta,
        pricing_posture,
        dominant_angle:         dominantAngle,
        messaging_clarity_score: calcMessagingClarity(title, description, h1, cta),
        scraping_success,
      });
    }

    // Calcul différenciation cross-concurrent
    const diffScores = calcDifferentiationScores(partials);
    const competitors: MessagingAnalysis[] = partials.map((p, i) => ({
      ...p,
      differentiation_score: diffScores[i] ?? 50,
    }));

    const allFailed = competitors.every(c => !c.scraping_success);
    return {
      success: !allFailed,
      data: { competitors },
      source: "product-messaging",
      degraded: competitors.some(c => !c.scraping_success),
    };
  } catch (err) {
    return {
      success: false,
      data: null,
      source: "product-messaging",
      error: {
        code:    "PRODUCT_MESSAGING_ERROR",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
