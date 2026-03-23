import { searchSerp, searchNews } from "@/agents/_shared/composio";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DetectedBrandContext {
  suggested_brand_name: string
  suggested_sector: string
  suggested_competitors: { name: string; url: string }[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  "le", "la", "les", "de", "du", "des", "un", "une", "et", "en", "à", "au", "aux",
  "the", "a", "an", "and", "in", "of", "for", "on", "with", "is", "are", "was",
  "that", "this", "it", "to", "be", "has", "have", "not", "but", "or", "by",
  "you", "we", "our", "your", "their", "how", "what", "why", "when", "where",
  "plus", "dans", "qui", "que", "par", "sur", "avec", "son", "ses", "pour",
  "mais", "ou", "donc", "ni", "car", "ce", "se",
]);

function topWords(texts: string[], topN = 3): string[] {
  const freq = new Map<string, number>();
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .split(/\W+/)
      .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
    for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([word]) => word);
}

const DOMAIN_RE = /(?:https?:\/\/)?(?:www\.)?([a-z0-9-]+\.[a-z]{2,})(?:\/|$)/gi;

function extractDomains(text: string): string[] {
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  DOMAIN_RE.lastIndex = 0;
  while ((match = DOMAIN_RE.exec(text)) !== null) {
    if (match[1]) matches.push(match[1]);
  }
  return matches;
}

function domainToName(domain: string): string {
  const base = domain.split(".")[0] ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Détecte le secteur et les concurrents potentiels d'une marque à partir de son URL.
 * Ne throw jamais — retourne des suggestions vides en cas d'échec.
 */
function brandNameFromDomain(domain: string): string {
  const base = domain.split(".")[0] ?? domain;
  return base
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function brandNameFromPage(brand_url: string, fallback: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${brand_url}`, {
      headers: { Accept: "text/plain" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return fallback;
    const text = await res.text();
    // Premier token avant un séparateur courant dans les <title> : " | ", " - ", " – "
    const match = text.match(/^(?:Title:\s*)(.+?)(?:\s+[|\-–]\s+|$)/m);
    const candidate = match?.[1]?.trim() ?? "";
    return candidate.length > 0 && candidate.length <= 30 ? candidate : fallback;
  } catch {
    return fallback;
  }
}

export async function detectBrandContext(
  brand_url: string,
  country: string,
  language: string,
): Promise<DetectedBrandContext> {
  let domain = brand_url;
  try {
    domain = new URL(brand_url).hostname.replace(/^www\./, "");
  } catch {
    // URL invalide — on utilise brand_url tel quel
  }

  const siteTexts: string[] = [];
  const competitorTexts: string[] = [];
  const newsTexts: string[] = [];

  // brand_name : hostname → affiné depuis le <title> Jina (best-effort)
  const domainFallback = brandNameFromDomain(domain);

  // 4 appels en parallèle — chacun est best-effort
  const [siteRes, compRes, newsRes, brandNameRes] = await Promise.allSettled([
    searchSerp(`site:${brand_url}`, country),
    searchSerp(`${domain} competitors`, country),
    searchNews(domain, language),
    brandNameFromPage(brand_url, domainFallback),
  ]);

  if (siteRes.status === "fulfilled") {
    for (const r of siteRes.value.organic_results ?? []) {
      siteTexts.push(`${r.title} ${r.snippet}`);
    }
  }

  if (compRes.status === "fulfilled") {
    for (const r of compRes.value.organic_results ?? []) {
      competitorTexts.push(`${r.title} ${r.snippet} ${r.link}`);
    }
  }

  if (newsRes.status === "fulfilled") {
    const articles = newsRes.value.articles ?? newsRes.value.news_results ?? [];
    for (const a of articles) {
      newsTexts.push(`${a.title} ${a.description ?? a.snippet ?? ""}`);
    }
  }

  // ── Sector suggestion ──────────────────────────────────────────────────────
  const sectorWords = topWords([...siteTexts, ...newsTexts], 3);
  const suggested_sector = sectorWords.join(" ");

  // ── Competitors suggestion ─────────────────────────────────────────────────
  const competitorDomains = new Set<string>();
  for (const text of competitorTexts) {
    for (const d of extractDomains(text)) {
      if (!d.includes(domain) && competitorDomains.size < 3) {
        competitorDomains.add(d);
      }
    }
  }

  const suggested_competitors = [...competitorDomains].map(d => ({
    name: domainToName(d),
    url:  `https://${d}`,
  }));

  const suggested_brand_name = brandNameRes.status === "fulfilled"
    ? brandNameRes.value
    : domainFallback;

  return { suggested_brand_name, suggested_sector, suggested_competitors };
}
