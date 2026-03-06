/**
 * Golden set: deterministic assertions on parseICPv2 output.
 * Tests the full pipeline (LLM + mapping + safety nets).
 * Run: npx vitest run tests/icp-parser/golden-set.test.ts --config tests/vitest.config.ts
 */
import { describe, it, expect } from "vitest";
import { parseICPv2 } from "@/server/lib/tools/icp-parser";

interface GoldenCase {
  id: number;
  description: string;
  language: "en" | "fr";
  expected: {
    job_titles?: { mustInclude?: string[]; mustNotInclude?: string[] };
    industries?: { exact?: string[]; mustInclude?: string[] };
    sub_industries?: { mustInclude?: string[] };
    employee_count?: { exact?: string[] };
    revenue?: { exact?: string[] };
    locations?: { mustInclude?: string[] };
    department?: { exact?: string[] };
    technologies?: { mustInclude?: string[] };
    mustNotHave?: string[];
    clarificationNeeded?: boolean;
  };
}

const GOLDEN_CASES: GoldenCase[] = [
  // ── Employee count mapping (10 cases) ──
  {
    id: 1,
    description: "CTO at SaaS companies with 10-50 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["0 - 25", "25 - 100"] },
    },
  },
  {
    id: 2,
    description: "VP Sales dans des startups SaaS",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["VP Sales"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["0 - 25"] },
    },
  },
  {
    id: 3,
    description: "CFO at enterprise companies, 500+ employees, in manufacturing",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CFO"] },
      industries: { mustInclude: ["Manufacturing"] },
      employee_count: { exact: ["250 - 1000", "1K - 10K", "10K - 50K", "50K - 100K", "> 100K"] },
    },
  },
  {
    id: 4,
    description: "Head of Sales dans des PME du retail en France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Head of Sales"] },
      industries: { mustInclude: ["Retail"] },
      employee_count: { exact: ["25 - 100", "100 - 250"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 5,
    description: "CEO de TPE dans le consulting",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CEO"] },
      industries: { mustInclude: ["Business Services"] },
      employee_count: { exact: ["0 - 25"] },
    },
  },
  {
    id: 6,
    description: "CTO at mid-market SaaS companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["250 - 1000", "1K - 10K"] },
    },
  },
  {
    id: 7,
    description: "Marketing Director at scaleups in fintech, 100-500 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Marketing Director"] },
      industries: { mustInclude: ["Financial Services"] },
      employee_count: { exact: ["25 - 100", "100 - 250", "250 - 1000"] },
    },
  },
  {
    id: 8,
    description: "VP Engineering in companies with more than 5000 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Engineering"] },
      employee_count: { exact: ["1K - 10K", "10K - 50K", "50K - 100K", "> 100K"] },
    },
  },
  {
    id: 9,
    description: "Sales Manager dans des ETI industrielles",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Sales Manager"] },
      industries: { mustInclude: ["Manufacturing"] },
      employee_count: { exact: ["250 - 1000", "1K - 10K"] },
    },
  },
  {
    id: 10,
    description: "Account Executive at SMB SaaS companies in the US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Account Executive"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["0 - 25", "25 - 100", "100 - 250"] },
      locations: { mustInclude: ["United States"] },
    },
  },

  // ── Industry mapping (10 cases) ──
  {
    id: 11,
    description: "CTO fintech companies in London",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Financial Services", "Software & Internet"] },
      locations: { mustInclude: ["London"] },
    },
  },
  {
    id: 12,
    description: "Directeur Commercial dans la gestion des déchets",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Sales Director"] },
      industries: { mustInclude: ["Energy & Utilities"] },
    },
  },
  {
    id: 13,
    description: "VP Sales in aerospace companies in the US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Sales"] },
      industries: { mustInclude: ["Manufacturing"] },
      sub_industries: { mustInclude: ["Aviation & Aerospace"] },
      locations: { mustInclude: ["United States"] },
    },
  },
  {
    id: 14,
    description: "Head of Product dans le SaaS B2B, France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Head of Product"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 15,
    description: "CEO at e-commerce companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CEO"] },
      industries: { mustInclude: ["Retail"] },
    },
  },
  {
    id: 16,
    description: "DRH dans l'immobilier en France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CHRO"] },
      industries: { mustInclude: ["Real Estate & Construction"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 17,
    description: "VP Marketing at cybersecurity companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Marketing"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },
  {
    id: 18,
    description: "Sales Director dans le transport routier",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Sales Director"] },
      industries: { mustInclude: ["Transportation & Storage"] },
    },
  },
  {
    id: 19,
    description: "CFO at healthcare companies with $10M-50M revenue",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CFO"] },
      industries: { mustInclude: ["Healthcare, Pharmaceuticals, & Biotech"] },
      revenue: { exact: ["$10M - 50M"] },
    },
  },
  {
    id: 20,
    description: "CTO dans l'EdTech en Europe",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Education"] },
      locations: { mustInclude: ["Europe"] },
    },
  },

  // ── Role extraction (10 cases) ──
  {
    id: 21,
    description: "RSSI dans le secteur bancaire",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CISO"] },
      industries: { mustInclude: ["Financial Services"] },
    },
  },
  {
    id: 22,
    description: "Gestionnaire de Flotte dans le transport routier",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Flotte"] }, // "Gestionnaire de Flotte" or "Fleet Manager"
      industries: { mustInclude: ["Transportation & Storage"] },
    },
  },
  {
    id: 23,
    description: "RevOps Manager at B2B SaaS companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["RevOps Manager"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },
  {
    id: 24,
    description: "SDR at fast-growing SaaS companies in the US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["SDR"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["United States"] },
    },
  },
  {
    id: 25,
    description: "Data Scientist at AI companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Data Scientist"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },
  {
    id: 26,
    description: "Responsable Achat dans l'aéronautique",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Procurement"] },
      industries: { mustInclude: ["Manufacturing"] },
    },
  },
  {
    id: 27,
    description: "Customer Success Manager at SaaS companies, 50-200 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Customer Success Manager"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["25 - 100", "100 - 250"] },
    },
  },
  {
    id: 28,
    description: "Growth Hacker at startups in Paris",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Growth"] },
      locations: { mustInclude: ["Paris"] },
    },
  },
  {
    id: 29,
    description: "Fondateur de startups SaaS en France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Founder"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 30,
    description: "Head of Legal at FinTech companies in London",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Head of Legal"] },
      industries: { mustInclude: ["Financial Services"] },
      locations: { mustInclude: ["London"] },
    },
  },

  // ── Location (8 cases) ──
  {
    id: 31,
    description: "CTO at SaaS companies in Scandinavia",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      locations: { mustInclude: ["Sweden", "Norway", "Denmark"] },
    },
  },
  {
    id: 32,
    description: "VP Sales in DACH region, enterprise SaaS",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Sales"] },
      locations: { mustInclude: ["Germany", "Austria", "Switzerland"] },
    },
  },
  {
    id: 33,
    description: "Marketing Director dans des entreprises SaaS, Bay Area",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Marketing Director"] },
      locations: { mustInclude: ["San Francisco"] },
    },
  },
  {
    id: 34,
    description: "CFO at global manufacturing companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CFO"] },
      industries: { mustInclude: ["Manufacturing"] },
      mustNotHave: ["locations"],
    },
  },
  {
    id: 35,
    description: "Head of Sales en Île-de-France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["Head of Sales"] },
      locations: { mustInclude: ["Paris"] },
    },
  },
  {
    id: 36,
    description: "CTO au Benelux, dans le SaaS",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      locations: { mustInclude: ["Belgium", "Netherlands", "Luxembourg"] },
    },
  },
  {
    id: 37,
    description: "VP Engineering at SaaS companies in LATAM",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Engineering"] },
      locations: { mustInclude: ["Brazil", "Mexico"] },
    },
  },
  {
    id: 38,
    description: "Sales Director SaaS worldwide",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Sales Director"] },
      mustNotHave: ["locations"],
    },
  },

  // ── Multi-role (5 cases) ──
  {
    id: 39,
    description: "CTO ou VP Engineering dans le SaaS, France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CTO", "VP Engineering"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 40,
    description: "DAF / DRH dans l'industrie en France",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CFO", "CHRO"] },
      industries: { mustInclude: ["Manufacturing"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 41,
    description: "Head of Sales or VP Sales at SaaS companies in the UK",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Head of Sales", "VP Sales"] },
      locations: { mustInclude: ["United Kingdom"] },
    },
  },
  {
    id: 42,
    description: "CEO or Founder at early-stage SaaS companies",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CEO", "Founder"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },
  {
    id: 43,
    description: "CTO and VP Engineering at AI companies, 100-500 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CTO", "VP Engineering"] },
      employee_count: { exact: ["25 - 100", "100 - 250", "250 - 1000"] },
    },
  },

  // ── Vague / clarification needed (5 cases) ──
  {
    id: 44,
    description: "des gens dans la tech",
    language: "fr",
    expected: {
      clarificationNeeded: true,
    },
  },
  {
    id: 45,
    description: "go",
    language: "en",
    expected: {
      clarificationNeeded: true,
    },
  },
  {
    id: 46,
    description: "test",
    language: "en",
    expected: {
      clarificationNeeded: true,
    },
  },
  {
    id: 47,
    description: "find me leads",
    language: "en",
    expected: {
      clarificationNeeded: true,
    },
  },
  {
    id: 48,
    description: "entreprises",
    language: "fr",
    expected: {
      clarificationNeeded: true,
    },
  },

  // ── Niche specific (5 cases) ──
  {
    id: 49,
    description: "Head of Claims at P&C insurance companies in the US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Head of Claims"] },
      industries: { mustInclude: ["Financial Services"] },
      locations: { mustInclude: ["United States"] },
    },
  },
  {
    id: 50,
    description: "Fleet Manager at trucking companies in the Midwest, 50-500 employees",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Fleet Manager"] },
      industries: { mustInclude: ["Transportation & Storage"] },
      employee_count: { exact: ["25 - 100", "100 - 250", "250 - 1000"] },
    },
  },
  {
    id: 51,
    description: "RSSI dans la pharma en France, 1000+ employés",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CISO"] },
      industries: { mustInclude: ["Healthcare, Pharmaceuticals, & Biotech"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 52,
    description: "Head of Procurement in automotive manufacturing, DACH region",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Procurement"] },
      industries: { mustInclude: ["Manufacturing"] },
      locations: { mustInclude: ["Germany"] },
    },
  },
  {
    id: 53,
    description: "VP Customer Success at B2B SaaS, $10M-100M ARR, US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Customer Success"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["United States"] },
    },
  },

  // ── Exclusions (4 cases) ──
  {
    id: 54,
    description: "CTO at SaaS companies in France, pas d'ESN",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["France"] },
    },
  },
  {
    id: 55,
    description: "CFO at consulting firms excluding Big 4, in the UK",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CFO"] },
      industries: { mustInclude: ["Business Services"] },
      locations: { mustInclude: ["United Kingdom"] },
    },
  },
  {
    id: 56,
    description: "VP Sales in SaaS, not non-profit, US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["VP Sales"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["United States"] },
      mustNotHave: ["level"],
    },
  },
  {
    id: 57,
    description: "Head of Engineering at SaaS companies, excluding startups",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Head of Engineering"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },

  // ── Typos / abbreviations (3 cases) ──
  {
    id: 58,
    description: "mktg dir SaaS US",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["Marketing Director"] },
      industries: { mustInclude: ["Software & Internet"] },
      locations: { mustInclude: ["United States"] },
    },
  },
  {
    id: 59,
    description: "CHIEF FINANCIAL OFFICER ADTECH",
    language: "en",
    expected: {
      job_titles: { mustInclude: ["CFO"] },
      industries: { mustInclude: ["Software & Internet"] },
    },
  },
  {
    id: 60,
    description: "Directeur technique SaaS B2B France 50-200 salariés",
    language: "fr",
    expected: {
      job_titles: { mustInclude: ["CTO"] },
      industries: { mustInclude: ["Software & Internet"] },
      employee_count: { exact: ["25 - 100", "100 - 250"] },
      locations: { mustInclude: ["France"] },
    },
  },
];

// ── Test runner ──

describe("Golden set — parseICPv2", () => {
  for (const tc of GOLDEN_CASES) {
    it(`#${tc.id}: ${tc.description}`, async () => {
      const result = await parseICPv2(tc.description, "test-workspace");
      const { expected } = tc;
      const filters = result.filters as Record<string, unknown>;

      // Clarification needed
      if (expected.clarificationNeeded) {
        expect(result.clarificationNeeded).toBeTruthy();
        return;
      }

      // No clarification expected
      expect(result.clarificationNeeded).toBeFalsy();

      // job_titles
      if (expected.job_titles?.mustInclude) {
        const titles = (filters.job_titles as string[]) ?? [];
        const titlesLower = titles.map(t => t.toLowerCase());
        for (const req of expected.job_titles.mustInclude) {
          const found = titlesLower.some(t => t.includes(req.toLowerCase()));
          expect(found, `job_titles should include "${req}" but got: ${JSON.stringify(titles)}`).toBe(true);
        }
      }
      if (expected.job_titles?.mustNotInclude) {
        const titles = (filters.job_titles as string[]) ?? [];
        const titlesLower = titles.map(t => t.toLowerCase());
        for (const req of expected.job_titles.mustNotInclude) {
          const found = titlesLower.some(t => t.includes(req.toLowerCase()));
          expect(found, `job_titles should NOT include "${req}" but got: ${JSON.stringify(titles)}`).toBe(false);
        }
      }

      // industries
      if (expected.industries?.exact) {
        expect((filters.industries as string[])?.sort()).toEqual(expected.industries.exact.sort());
      }
      if (expected.industries?.mustInclude) {
        const inds = (filters.industries as string[]) ?? [];
        for (const req of expected.industries.mustInclude) {
          expect(inds, `industries should include "${req}" but got: ${JSON.stringify(inds)}`).toContain(req);
        }
      }

      // sub_industries
      if (expected.sub_industries?.mustInclude) {
        const subs = (filters.sub_industries as string[]) ?? [];
        for (const req of expected.sub_industries.mustInclude) {
          expect(subs, `sub_industries should include "${req}"`).toContain(req);
        }
      }

      // employee_count
      if (expected.employee_count?.exact) {
        expect((filters.employee_count as string[])?.sort()).toEqual(expected.employee_count.exact.sort());
      }

      // revenue
      if (expected.revenue?.exact) {
        expect((filters.revenue as string[])?.sort()).toEqual(expected.revenue.exact.sort());
      }

      // locations
      if (expected.locations?.mustInclude) {
        const locs = (filters.locations as string[]) ?? [];
        for (const req of expected.locations.mustInclude) {
          const found = locs.some(l => l.toLowerCase().includes(req.toLowerCase()));
          expect(found, `locations should include "${req}" but got: ${JSON.stringify(locs)}`).toBe(true);
        }
      }

      // department
      if (expected.department?.exact) {
        expect((filters.department as string[])?.sort()).toEqual(expected.department.exact.sort());
      }

      // technologies
      if (expected.technologies?.mustInclude) {
        const techs = (filters.technologies as string[]) ?? [];
        for (const req of expected.technologies.mustInclude) {
          expect(techs).toContain(req);
        }
      }

      // mustNotHave
      if (expected.mustNotHave) {
        for (const field of expected.mustNotHave) {
          expect(filters[field], `Field "${field}" should NOT be present but is: ${JSON.stringify(filters[field])}`).toBeFalsy();
        }
      }
    }, 30_000);
  }
});
