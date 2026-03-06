/**
 * Unit tests for deterministic mapping functions.
 * 0 LLM calls — tests only pure functions.
 * Run: npx vitest run tests/icp-parser/mapping.test.ts --config tests/vitest.config.ts
 */
import { describe, it, expect } from "vitest";
import {
  mapEmployeeRange,
  mapIndustry,
  mapSubIndustry,
  mapDepartment,
  mapRevenue,
  mapNews,
  mapLocations,
  buildFilterSummary,
} from "@/server/lib/tools/icp-parser";

// ─── mapEmployeeRange ────────────────────────────────────

describe("mapEmployeeRange", () => {
  // Exact numeric ranges
  it("10-50 → covers 0-25 and 25-100", () => {
    expect(mapEmployeeRange(10, 50)).toEqual(["0 - 25", "25 - 100"]);
  });

  it("50-200 → covers 25-100 and 100-250", () => {
    expect(mapEmployeeRange(50, 200)).toEqual(["25 - 100", "100 - 250"]);
  });

  it("100-500 → covers 25-100, 100-250, 250-1000", () => {
    expect(mapEmployeeRange(100, 500)).toEqual(["25 - 100", "100 - 250", "250 - 1000"]);
  });

  it("500-5000 → covers 250-1000 and 1K-10K", () => {
    expect(mapEmployeeRange(500, 5000)).toEqual(["250 - 1000", "1K - 10K"]);
  });

  it("1-25 → covers 0-25", () => {
    expect(mapEmployeeRange(1, 25)).toEqual(["0 - 25"]);
  });

  it("0-25 exact bucket → just 0-25", () => {
    expect(mapEmployeeRange(0, 25)).toEqual(["0 - 25"]);
  });

  it("250-1000 → includes 100-250 (250 is at boundary) + 250-1000", () => {
    expect(mapEmployeeRange(250, 1000)).toEqual(["100 - 250", "250 - 1000"]);
  });

  // Open-ended ranges (min only)
  it("500+ → covers 250-1000 through > 100K", () => {
    const result = mapEmployeeRange(500);
    expect(result).toContain("250 - 1000");
    expect(result).toContain("> 100K");
  });

  it("10000+ → covers 10K-50K through > 100K (10K is boundary)", () => {
    const result = mapEmployeeRange(10000);
    expect(result).toContain("10K - 50K");
    expect(result).toContain("50K - 100K");
    expect(result).toContain("> 100K");
  });

  // Max only (< X)
  it("max 100 → covers 0-25 and 25-100", () => {
    expect(mapEmployeeRange(undefined, 100)).toEqual(["0 - 25", "25 - 100"]);
  });

  it("max 25 → covers 0-25", () => {
    expect(mapEmployeeRange(undefined, 25)).toEqual(["0 - 25"]);
  });

  // Labels
  it("label: startup → 0-25", () => {
    expect(mapEmployeeRange(undefined, undefined, "startup")).toEqual(["0 - 25"]);
  });

  it("label: PME → 25-100 and 100-250", () => {
    expect(mapEmployeeRange(undefined, undefined, "PME")).toEqual(["25 - 100", "100 - 250"]);
  });

  it("label: ETI → 250-1000 and 1K-10K", () => {
    expect(mapEmployeeRange(undefined, undefined, "ETI")).toEqual(["250 - 1000", "1K - 10K"]);
  });

  it("label: enterprise → 10K-50K, 50K-100K, > 100K", () => {
    expect(mapEmployeeRange(undefined, undefined, "enterprise")).toEqual(["10K - 50K", "50K - 100K", "> 100K"]);
  });

  it("label: TPE → 0-25", () => {
    expect(mapEmployeeRange(undefined, undefined, "TPE")).toEqual(["0 - 25"]);
  });

  it("label: scaleup → 100-250, 250-1000", () => {
    expect(mapEmployeeRange(undefined, undefined, "scaleup")).toEqual(["100 - 250", "250 - 1000"]);
  });

  it("label: mid-market → 250-1000, 1K-10K", () => {
    expect(mapEmployeeRange(undefined, undefined, "mid-market")).toEqual(["250 - 1000", "1K - 10K"]);
  });

  it("label: SMB → 0-25, 25-100, 100-250", () => {
    expect(mapEmployeeRange(undefined, undefined, "SMB")).toEqual(["0 - 25", "25 - 100", "100 - 250"]);
  });

  // No input → undefined
  it("no inputs → undefined", () => {
    expect(mapEmployeeRange()).toBeUndefined();
  });

  // Label has priority but numeric range can override if both provided
  it("label + numeric range → uses numeric", () => {
    expect(mapEmployeeRange(50, 200, "startup")).toEqual(["25 - 100", "100 - 250"]);
  });
});

// ─── mapIndustry ─────────────────────────────────────────

describe("mapIndustry", () => {
  it("SaaS → Software & Internet", () => {
    expect(mapIndustry("SaaS")).toEqual(["Software & Internet"]);
  });

  it("fintech → Financial Services + Software & Internet", () => {
    expect(mapIndustry("fintech")).toEqual(expect.arrayContaining(["Financial Services", "Software & Internet"]));
  });

  it("e-commerce → Retail + Software & Internet", () => {
    expect(mapIndustry("e-commerce")).toEqual(expect.arrayContaining(["Retail", "Software & Internet"]));
  });

  it("gestion des déchets → Energy & Utilities", () => {
    expect(mapIndustry("gestion des déchets")).toEqual(["Energy & Utilities"]);
  });

  it("aéronautique → Manufacturing", () => {
    expect(mapIndustry("aéronautique")).toEqual(["Manufacturing"]);
  });

  it("consulting → Business Services", () => {
    expect(mapIndustry("consulting")).toEqual(["Business Services"]);
  });

  it("immobilier → Real Estate & Construction", () => {
    expect(mapIndustry("immobilier")).toEqual(["Real Estate & Construction"]);
  });

  it("exact valid value → passthrough", () => {
    expect(mapIndustry("Software & Internet")).toEqual(["Software & Internet"]);
  });

  it("case-insensitive match", () => {
    expect(mapIndustry("SAAS")).toEqual(["Software & Internet"]);
  });

  it("unknown industry → undefined", () => {
    expect(mapIndustry("xyzzy plugh")).toBeUndefined();
  });

  it("healthcare / santé → Healthcare, Pharmaceuticals, & Biotech", () => {
    expect(mapIndustry("santé")).toEqual(["Healthcare, Pharmaceuticals, & Biotech"]);
  });

  it("education → Education", () => {
    expect(mapIndustry("éducation")).toEqual(["Education"]);
  });

  it("logistique → Transportation & Storage", () => {
    expect(mapIndustry("logistique")).toEqual(["Transportation & Storage"]);
  });

  it("banque → Financial Services", () => {
    expect(mapIndustry("banque")).toEqual(["Financial Services"]);
  });

  it("EdTech → Education + Software & Internet", () => {
    expect(mapIndustry("EdTech")).toEqual(expect.arrayContaining(["Education", "Software & Internet"]));
  });
});

// ─── mapSubIndustry ──────────────────────────────────────

describe("mapSubIndustry", () => {
  it("automotive → Automotive", () => {
    expect(mapSubIndustry("automotive")).toEqual(["Automotive"]);
  });

  it("cybersecurity → Computer & Network Security", () => {
    expect(mapSubIndustry("cybersecurity")).toEqual(["Computer & Network Security"]);
  });

  it("logistics → Logistics and Supply Chain", () => {
    expect(mapSubIndustry("logistics")).toEqual(["Logistics and Supply Chain"]);
  });

  it("pharma → Pharmaceuticals", () => {
    expect(mapSubIndustry("pharma")).toEqual(["Pharmaceuticals"]);
  });

  it("mode → Apparel & Fashion", () => {
    expect(mapSubIndustry("mode")).toEqual(["Apparel & Fashion"]);
  });

  it("trucking → Transportation/Trucking/Railroad", () => {
    expect(mapSubIndustry("trucking")).toEqual(["Transportation/Trucking/Railroad"]);
  });

  it("gaming → Computer Games", () => {
    expect(mapSubIndustry("gaming")).toEqual(["Computer Games"]);
  });

  it("insurance → Insurance", () => {
    expect(mapSubIndustry("insurance")).toEqual(["Insurance"]);
  });

  it("unknown → undefined", () => {
    expect(mapSubIndustry("something random")).toBeUndefined();
  });
});

// ─── mapDepartment ───────────────────────────────────────

describe("mapDepartment", () => {
  it("sales → Sales", () => {
    expect(mapDepartment("sales")).toBe("Sales");
  });

  it("engineering → Engineering", () => {
    expect(mapDepartment("engineering")).toBe("Engineering");
  });

  it("ventes → Sales", () => {
    expect(mapDepartment("ventes")).toBe("Sales");
  });

  it("rh → Human Resources", () => {
    expect(mapDepartment("rh")).toBe("Human Resources");
  });

  it("informatique → IT & IS", () => {
    expect(mapDepartment("informatique")).toBe("IT & IS");
  });

  it("finance → Finance & Administration", () => {
    expect(mapDepartment("finance")).toBe("Finance & Administration");
  });

  it("exact valid value → passthrough", () => {
    expect(mapDepartment("Engineering")).toBe("Engineering");
  });

  it("unknown → undefined", () => {
    expect(mapDepartment("banana")).toBeUndefined();
  });

  it("HR → Human Resources", () => {
    expect(mapDepartment("HR")).toBe("Human Resources");
  });

  it("technique → Engineering", () => {
    expect(mapDepartment("technique")).toBe("Engineering");
  });
});

// ─── mapRevenue ──────────────────────────────────────────

describe("mapRevenue", () => {
  it("10M-50M → $10M - 50M", () => {
    expect(mapRevenue(10, 50)).toEqual(["$10M - 50M"]);
  });

  it("1M-10M → $1M - 10M", () => {
    expect(mapRevenue(1, 10)).toEqual(["$1M - 10M"]);
  });

  it("0-1M → $0 - 1M", () => {
    expect(mapRevenue(0, 1)).toEqual(["$0 - 1M"]);
  });

  it("50M-500M → covers 3 buckets", () => {
    expect(mapRevenue(50, 500)).toEqual(["$50M - 100M", "$100M - 250M", "$250M - 500M"]);
  });

  it("min only: > 100M → covers 100M+", () => {
    const result = mapRevenue(100);
    expect(result).toContain("$100M - 250M");
    expect(result).toContain("> $1B");
  });

  it("max only: < 10M → covers $0-1M and $1M-10M", () => {
    expect(mapRevenue(undefined, 10)).toEqual(["$0 - 1M", "$1M - 10M"]);
  });

  it("no inputs → undefined", () => {
    expect(mapRevenue()).toBeUndefined();
  });

  it("5M-25M → covers $1M-10M and $10M-50M", () => {
    expect(mapRevenue(5, 25)).toEqual(["$1M - 10M", "$10M - 50M"]);
  });

  it("> 1B → > $1B", () => {
    expect(mapRevenue(1000)).toEqual(["> $1B"]);
  });
});

// ─── mapNews ─────────────────────────────────────────────

describe("mapNews", () => {
  it("hiring → has_had_recent_job_change", () => {
    expect(mapNews(["hiring"])).toEqual(["has_had_recent_job_change"]);
  });

  it("funding → has_had_recent_funding", () => {
    expect(mapNews(["funding"])).toEqual(["has_had_recent_funding"]);
  });

  it("exact valid value passthrough", () => {
    expect(mapNews(["has_had_recent_funding"])).toEqual(["has_had_recent_funding"]);
  });

  it("multiple signals", () => {
    const result = mapNews(["hiring", "funding", "ipo"]);
    expect(result).toContain("has_had_recent_job_change");
    expect(result).toContain("has_had_recent_funding");
    expect(result).toContain("has_had_ipo");
  });

  it("French: levée de fonds → has_had_recent_funding", () => {
    expect(mapNews(["levée de fonds"])).toEqual(["has_had_recent_funding"]);
  });

  it("unknown signal → filtered out", () => {
    expect(mapNews(["unknown_signal"])).toBeUndefined();
  });

  it("empty array → undefined", () => {
    expect(mapNews([])).toBeUndefined();
  });

  it("acquisition → has_had_recent_acquisition_or_merger", () => {
    expect(mapNews(["acquisition"])).toEqual(["has_had_recent_acquisition_or_merger"]);
  });

  it("partnership → has_had_recent_new_partnerships", () => {
    expect(mapNews(["partnership"])).toEqual(["has_had_recent_new_partnerships"]);
  });
});

// ─── mapLocations ────────────────────────────────────────

describe("mapLocations", () => {
  it("Scandinavie → Sweden, Norway, Denmark, Finland", () => {
    expect(mapLocations(["Scandinavie"])).toEqual(
      expect.arrayContaining(["Sweden", "Norway", "Denmark", "Finland"]),
    );
  });

  it("DACH → Germany, Austria, Switzerland", () => {
    expect(mapLocations(["DACH"])).toEqual(
      expect.arrayContaining(["Germany", "Austria", "Switzerland"]),
    );
  });

  it("France → France", () => {
    expect(mapLocations(["France"])).toEqual(["France"]);
  });

  it("États-Unis → United States", () => {
    expect(mapLocations(["États-Unis"])).toEqual(["United States"]);
  });

  it("mondial / worldwide → empty (no filter)", () => {
    expect(mapLocations(["worldwide"])).toEqual([]);
  });

  it("global → empty (no filter)", () => {
    expect(mapLocations(["global"])).toEqual([]);
  });

  it("IDF → Paris", () => {
    expect(mapLocations(["IDF"])).toEqual(["Paris"]);
  });

  it("Bay Area → San Francisco", () => {
    expect(mapLocations(["Bay Area"])).toEqual(["San Francisco"]);
  });

  it("multiple locations", () => {
    const result = mapLocations(["France", "Germany"]);
    expect(result).toEqual(["France", "Germany"]);
  });

  it("empty array → empty", () => {
    expect(mapLocations([])).toEqual([]);
  });

  it("Benelux → Belgium, Netherlands, Luxembourg", () => {
    expect(mapLocations(["Benelux"])).toEqual(
      expect.arrayContaining(["Belgium", "Netherlands", "Luxembourg"]),
    );
  });

  it("LATAM → major Latin American countries", () => {
    const result = mapLocations(["LATAM"]);
    expect(result).toContain("Brazil");
    expect(result).toContain("Mexico");
  });

  it("mixed: country + region", () => {
    const result = mapLocations(["France", "DACH"]);
    expect(result).toContain("France");
    expect(result).toContain("Germany");
    expect(result).toContain("Austria");
  });

  it("French city: Lyon → Lyon", () => {
    expect(mapLocations(["Lyon"])).toEqual(["Lyon"]);
  });
});

// ─── buildFilterSummary ──────────────────────────────────

describe("buildFilterSummary", () => {
  it("summarizes job titles and industries", () => {
    const summary = buildFilterSummary({
      job_titles: ["CTO", "Chief Technology Officer"],
      industries: ["Software & Internet"],
      skip_owned_leads: true,
    } as any);
    expect(summary).toContain("CTO");
    expect(summary).toContain("Software & Internet");
  });

  it("summarizes employee count", () => {
    const summary = buildFilterSummary({
      job_titles: ["VP Sales"],
      employee_count: ["25 - 100", "100 - 250"],
      skip_owned_leads: true,
    } as any);
    expect(summary).toContain("VP Sales");
    expect(summary).toContain("25 - 100");
  });

  it("summarizes locations", () => {
    const summary = buildFilterSummary({
      job_titles: ["CEO"],
      locations: ["France", "Germany"],
      skip_owned_leads: true,
    } as any);
    expect(summary).toContain("France");
  });

  it("handles empty filters", () => {
    const summary = buildFilterSummary({ skip_owned_leads: true } as any);
    expect(summary).toBe("");
  });
});
