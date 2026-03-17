/**
 * Static B2B industry taxonomy for smart social proof matching.
 *
 * Each vertical has an optional parent industry and a list of adjacent verticals.
 * Used to score how relevant a social proof entry is to a given prospect's industry.
 */

interface TaxonomyEntry {
  parent?: string;
  adjacent: string[];
}

const TAXONOMY: Record<string, TaxonomyEntry> = {
  // ── SaaS verticals ──
  "SaaS": { adjacent: ["Cloud", "Technology"] },
  "HR Tech": { parent: "SaaS", adjacent: ["Recruiting", "Workforce Management", "EdTech"] },
  "MarTech": { parent: "SaaS", adjacent: ["AdTech", "E-commerce", "Media"] },
  "AdTech": { parent: "SaaS", adjacent: ["MarTech", "Media", "E-commerce"] },
  "Sales Tech": { parent: "SaaS", adjacent: ["MarTech", "CRM", "RevOps"] },
  "RevOps": { parent: "SaaS", adjacent: ["Sales Tech", "MarTech", "CRM"] },
  "CRM": { parent: "SaaS", adjacent: ["Sales Tech", "RevOps", "Customer Success"] },
  "Customer Success": { parent: "SaaS", adjacent: ["CRM", "SaaS"] },
  "DevTools": { parent: "SaaS", adjacent: ["Cloud", "Cybersecurity", "AI/ML"] },
  "Cloud": { parent: "Technology", adjacent: ["SaaS", "DevTools", "Cybersecurity"] },
  "Cybersecurity": { parent: "Technology", adjacent: ["Cloud", "DevTools", "FinTech"] },
  "AI/ML": { parent: "Technology", adjacent: ["Data & Analytics", "DevTools", "Cloud"] },
  "Data & Analytics": { parent: "Technology", adjacent: ["AI/ML", "BI", "Cloud"] },
  "BI": { parent: "Technology", adjacent: ["Data & Analytics", "AI/ML"] },

  // ── FinTech verticals ──
  "FinTech": { adjacent: ["Banking", "Insurance", "Payments"] },
  "Banking": { parent: "FinTech", adjacent: ["Insurance", "Payments", "Wealth Management"] },
  "Insurance": { parent: "FinTech", adjacent: ["InsurTech", "Banking"] },
  "InsurTech": { parent: "FinTech", adjacent: ["Insurance", "Banking"] },
  "Payments": { parent: "FinTech", adjacent: ["Banking", "E-commerce"] },
  "Wealth Management": { parent: "FinTech", adjacent: ["Banking", "Financial Services"] },
  "Financial Services": { adjacent: ["FinTech", "Banking", "Insurance", "Consulting"] },

  // ── Healthcare verticals ──
  "Healthcare": { adjacent: ["HealthTech", "Pharma", "Biotech"] },
  "HealthTech": { parent: "Healthcare", adjacent: ["MedTech", "Pharma"] },
  "MedTech": { parent: "Healthcare", adjacent: ["HealthTech", "Biotech"] },
  "Pharma": { parent: "Healthcare", adjacent: ["Biotech", "HealthTech"] },
  "Biotech": { parent: "Healthcare", adjacent: ["Pharma", "MedTech"] },

  // ── Commerce verticals ──
  "E-commerce": { adjacent: ["Retail", "MarTech", "Logistics"] },
  "Retail": { adjacent: ["E-commerce", "Consumer Goods", "Logistics"] },
  "Consumer Goods": { adjacent: ["Retail", "E-commerce", "Manufacturing"] },
  "D2C": { parent: "E-commerce", adjacent: ["Retail", "MarTech"] },

  // ── Industry verticals ──
  "Manufacturing": { adjacent: ["Logistics", "Supply Chain", "Industrial"] },
  "Industrial": { adjacent: ["Manufacturing", "Construction", "Energy"] },
  "Logistics": { adjacent: ["Supply Chain", "Manufacturing", "E-commerce"] },
  "Supply Chain": { adjacent: ["Logistics", "Manufacturing"] },
  "Construction": { adjacent: ["Real Estate", "Industrial"] },
  "Energy": { adjacent: ["CleanTech", "Industrial", "Utilities"] },
  "CleanTech": { parent: "Energy", adjacent: ["Energy", "Sustainability"] },
  "Sustainability": { adjacent: ["CleanTech", "Energy", "Consulting"] },

  // ── Real Estate ──
  "Real Estate": { adjacent: ["PropTech", "Construction"] },
  "PropTech": { parent: "Real Estate", adjacent: ["Real Estate", "FinTech"] },

  // ── Education ──
  "EdTech": { adjacent: ["Education", "HR Tech", "SaaS"] },
  "Education": { adjacent: ["EdTech", "Government"] },

  // ── Media & Entertainment ──
  "Media": { adjacent: ["AdTech", "Entertainment", "MarTech"] },
  "Entertainment": { adjacent: ["Media", "Gaming"] },
  "Gaming": { adjacent: ["Entertainment", "Media"] },

  // ── Professional Services ──
  "Consulting": { adjacent: ["Professional Services", "Financial Services"] },
  "Professional Services": { adjacent: ["Consulting", "Legal", "Accounting"] },
  "Legal": { parent: "Professional Services", adjacent: ["LegalTech", "Consulting"] },
  "LegalTech": { parent: "Professional Services", adjacent: ["Legal", "SaaS"] },
  "Accounting": { parent: "Professional Services", adjacent: ["FinTech", "Consulting"] },

  // ── Other ──
  "Government": { adjacent: ["GovTech", "Education"] },
  "GovTech": { parent: "Government", adjacent: ["Government", "SaaS"] },
  "Recruiting": { adjacent: ["HR Tech", "Staffing"] },
  "Staffing": { adjacent: ["Recruiting", "HR Tech"] },
  "Telecom": { adjacent: ["Technology", "Media"] },
  "Travel": { adjacent: ["Hospitality", "Logistics"] },
  "Hospitality": { adjacent: ["Travel", "Retail"] },
  "Food & Beverage": { adjacent: ["Consumer Goods", "Retail", "Hospitality"] },
  "Automotive": { adjacent: ["Manufacturing", "Logistics"] },
  "Aerospace": { adjacent: ["Manufacturing", "Defense"] },
  "Defense": { adjacent: ["Aerospace", "Government"] },
  "Agriculture": { adjacent: ["AgTech", "Food & Beverage"] },
  "AgTech": { parent: "Agriculture", adjacent: ["Agriculture", "SaaS"] },
  "Technology": { adjacent: ["SaaS", "Cloud", "AI/ML"] },
  "Nonprofit": { adjacent: ["Government", "Education"] },
};

// ─── Normalization ──────────────────────────────────────

/** Normalize an industry string for lookup. Case-insensitive, trim. */
function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Build a lowercase → canonical key map for fast lookup. */
const LOOKUP: Map<string, string> = new Map();
for (const key of Object.keys(TAXONOMY)) {
  LOOKUP.set(normalize(key), key);
}

/** Find the canonical taxonomy key for a given industry string. */
function resolve(industry: string): string | null {
  const n = normalize(industry);
  // Direct match
  if (LOOKUP.has(n)) return LOOKUP.get(n)!;
  // Partial match (e.g. "HR Technology" → "HR Tech")
  for (const [lower, canonical] of LOOKUP) {
    if (n.includes(lower) || lower.includes(n)) return canonical;
  }
  return null;
}

// ─── Matching ───────────────────────────────────────────

export interface MatchResult<T> {
  item: T;
  score: number;
  matchType: "exact" | "vertical" | "parent" | "adjacent" | "fallback";
}

/**
 * Find the best matches for a prospect's industry among a list of items,
 * each of which has an `industry` and optionally a `vertical` and `companySize`.
 *
 * Scoring:
 *  - Exact match on industry+vertical: 100
 *  - Same vertical: 80
 *  - Same parent industry: 60
 *  - Adjacent industry: 40
 *  - Fallback (no match): 10
 *  - Company size tiebreaker: +10 if same size
 */
export function findBestMatches<
  T extends { industry: string; vertical?: string | null; companySize?: string | null },
>(
  items: T[],
  prospectIndustry: string | null | undefined,
  prospectVertical?: string | null,
  prospectCompanySize?: string | null,
): MatchResult<T>[] {
  if (!items.length) return [];

  const results: MatchResult<T>[] = [];

  const pIndustry = prospectIndustry ? resolve(prospectIndustry) : null;
  const pVertical = prospectVertical ? resolve(prospectVertical) : null;

  for (const item of items) {
    const iIndustry = resolve(item.industry);
    const iVertical = item.vertical ? resolve(item.vertical) : null;

    let score = 10;
    let matchType: MatchResult<T>["matchType"] = "fallback";

    if (pIndustry && iIndustry) {
      // Exact: same industry AND same vertical (if both specified)
      if (
        iIndustry === pIndustry &&
        (!pVertical || !iVertical || iVertical === pVertical)
      ) {
        score = pVertical && iVertical && iVertical === pVertical ? 100 : 80;
        matchType = score === 100 ? "exact" : "vertical";
      }
      // Parent match: item's industry is the parent of prospect's, or vice versa
      else if (
        TAXONOMY[pIndustry]?.parent === iIndustry ||
        TAXONOMY[iIndustry]?.parent === pIndustry ||
        (TAXONOMY[pIndustry]?.parent && TAXONOMY[pIndustry]?.parent === TAXONOMY[iIndustry]?.parent)
      ) {
        score = 60;
        matchType = "parent";
      }
      // Adjacent match
      else if (
        TAXONOMY[pIndustry]?.adjacent.includes(iIndustry) ||
        TAXONOMY[iIndustry]?.adjacent.includes(pIndustry)
      ) {
        score = 40;
        matchType = "adjacent";
      }
    }

    // Company size tiebreaker
    if (
      prospectCompanySize &&
      item.companySize &&
      normalize(prospectCompanySize) === normalize(item.companySize)
    ) {
      score += 10;
    }

    results.push({ item, score, matchType });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Find matching client names from the portfolio for a given prospect industry.
 * Returns client names sorted by relevance.
 */
export function findPortfolioMatches(
  portfolio: Array<{ name: string; industry?: string | null; vertical?: string | null }>,
  prospectIndustry: string | null | undefined,
): string[] {
  if (!portfolio.length || !prospectIndustry) return [];

  const matches = findBestMatches(
    portfolio.map((p) => ({ ...p, industry: p.industry ?? "General", companySize: null })),
    prospectIndustry,
  );

  return matches
    .filter((m) => m.score >= 40) // At least adjacent
    .map((m) => m.item.name);
}
