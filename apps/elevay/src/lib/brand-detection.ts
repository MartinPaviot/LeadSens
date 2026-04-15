import { callLLM } from "@/agents/_shared/llm";
import { validateUrl } from "@/lib/url-validator";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DetectedBrandContext {
  suggested_brand_name: string
  suggested_sector: string
  suggested_competitors: { name: string; url: string }[]
}

// ── Main ──────────────────────────────────────────────────────────────────────

function brandNameFromDomain(domain: string): string {
  if (!domain || domain.trim() === '') return '';
  const base = domain.split(".")[0] ?? domain;
  return base
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function brandNameFromPage(
  brand_url: string,
  fallback: string,
): Promise<{ name: string; pageText: string }> {
  try {
    const urlCheck = validateUrl(brand_url);
    if (!urlCheck.valid) return { name: fallback, pageText: "" };

    const res = await fetch(`https://r.jina.ai/${brand_url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { name: fallback, pageText: "" };
    const text = await res.text();
    const match = text.match(/^(?:Title:\s*)(.+?)(?:\s+[|\-–]\s+|$)/m);
    const candidate = match?.[1]?.trim() ?? "";
    const name = candidate.length > 0 && candidate.length <= 30 ? candidate : fallback;
    return { name, pageText: text };
  } catch {
    return { name: fallback, pageText: "" };
  }
}

/**
 * Détecte le secteur et les concurrents potentiels d'une marque à partir de son URL.
 * Ne throw jamais — retourne des suggestions vides en cas d'échec.
 */
export async function detectBrandContext(
  brand_url: string,
  country: string,
  language: string,
  brandName?: string,
): Promise<DetectedBrandContext> {
  let domain = brand_url;
  try {
    domain = new URL(brand_url).hostname.replace(/^www\./, "");
  } catch {
    // URL invalide — on utilise brand_url tel quel
  }

  const domainFallback = brandNameFromDomain(domain);

  // Fetch brand name + page text via Jina
  // TODO: add searchSerp/searchNews calls here when sector enrichment is implemented
  const brandNameRes = await brandNameFromPage(brand_url, domainFallback)
    .catch(() => ({ name: domainFallback, pageText: "" }));

  const jinaText = brandNameRes.pageText;

  // ── Sector — LLM detection ────────────────────────────────────────────────
  let suggested_sector = "";
  if (jinaText) {
    try {
      const res = await callLLM({
        system: "You are a business analyst. Answer with only the requested information, no explanation.",
        user: `Based on this website content, identify the business sector/industry in 2-4 words maximum (e.g. "luxury fashion", "B2B SaaS HR", "e-commerce beauty", "digital marketing"). Only return the sector name, nothing else.\n\nWebsite content (first 2000 chars):\n${jinaText.slice(0, 2000)}`,
        maxTokens: 50,
      });
      suggested_sector = res.content.trim().slice(0, 100);
    } catch {
      // best-effort — leave empty
    }
  }

  const suggested_brand_name = brandNameRes.name || domainFallback;

  return { suggested_brand_name, suggested_sector, suggested_competitors: [] };
}
