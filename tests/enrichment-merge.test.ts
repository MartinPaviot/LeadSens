import { describe, it, expect } from "vitest";
import {
  mergeLinkedInData,
  mergeApolloData,
  resolveLeadUrl,
  summarizeEnrichmentQuality,
  extractLinkedInContext,
} from "@/server/lib/tools/enrichment-tools";
import type { LinkedInProfileData } from "@/server/lib/connectors/apify";
import type { ApolloPersonResult } from "@/server/lib/connectors/apollo";

// ─── Helpers ────────────────────────────────────────────

function makeLinkedIn(overrides: Partial<LinkedInProfileData> = {}): LinkedInProfileData {
  return {
    linkedinHeadline: null,
    linkedinSummary: null,
    recentLinkedInPosts: [],
    careerHistory: [],
    companyWebsite: null,
    ...overrides,
  };
}

function makeApollo(overrides: Partial<ApolloPersonResult> = {}): ApolloPersonResult {
  return { ...overrides };
}

// ═════════════════════════════════════════════════════════
// mergeLinkedInData
// ═════════════════════════════════════════════════════════

describe("mergeLinkedInData", () => {
  it("merges LinkedIn headline into null enrichment", () => {
    const result = mergeLinkedInData(null, makeLinkedIn({ linkedinHeadline: "VP of Sales" }));
    expect(result.linkedinHeadline).toBe("VP of Sales");
  });

  it("overwrites null headline with LinkedIn headline", () => {
    const base = { linkedinHeadline: null, companySummary: "Acme Corp" };
    const result = mergeLinkedInData(base, makeLinkedIn({ linkedinHeadline: "CEO at Acme" }));
    expect(result.linkedinHeadline).toBe("CEO at Acme");
    expect(result.companySummary).toBe("Acme Corp");
  });

  it("preserves existing headline when LinkedIn headline is null", () => {
    const base = { linkedinHeadline: "Existing Headline" };
    const result = mergeLinkedInData(base, makeLinkedIn({ linkedinHeadline: null }));
    expect(result.linkedinHeadline).toBe("Existing Headline");
  });

  it("replaces existing posts with non-empty LinkedIn posts", () => {
    const base = { recentLinkedInPosts: ["old post"] };
    const result = mergeLinkedInData(base, makeLinkedIn({ recentLinkedInPosts: ["new post 1", "new post 2"] }));
    expect(result.recentLinkedInPosts).toEqual(["new post 1", "new post 2"]);
  });

  it("preserves existing posts when LinkedIn posts are empty", () => {
    const base = { recentLinkedInPosts: ["existing post"] };
    const result = mergeLinkedInData(base, makeLinkedIn({ recentLinkedInPosts: [] }));
    expect(result.recentLinkedInPosts).toEqual(["existing post"]);
  });

  it("defaults to empty array when both posts are empty/missing", () => {
    const result = mergeLinkedInData(null, makeLinkedIn());
    expect(result.recentLinkedInPosts).toEqual([]);
  });

  it("replaces career with non-empty LinkedIn career", () => {
    const base = { careerHistory: ["old job"] };
    const result = mergeLinkedInData(base, makeLinkedIn({ careerHistory: ["CTO at Acme", "VP at Beta"] }));
    expect(result.careerHistory).toEqual(["CTO at Acme", "VP at Beta"]);
  });

  it("preserves existing career when LinkedIn career is empty", () => {
    const base = { careerHistory: ["existing role"] };
    const result = mergeLinkedInData(base, makeLinkedIn({ careerHistory: [] }));
    expect(result.careerHistory).toEqual(["existing role"]);
  });

  it("preserves all existing fields not related to LinkedIn", () => {
    const base = { companySummary: "Summary", painPoints: ["slow growth"], industry: "SaaS" };
    const result = mergeLinkedInData(base, makeLinkedIn({ linkedinHeadline: "CEO" }));
    expect(result.companySummary).toBe("Summary");
    expect(result.painPoints).toEqual(["slow growth"]);
    expect(result.industry).toBe("SaaS");
    expect(result.linkedinHeadline).toBe("CEO");
  });
});

// ═════════════════════════════════════════════════════════
// mergeApolloData
// ═════════════════════════════════════════════════════════

describe("mergeApolloData", () => {
  it("merges Apollo email status into null enrichment", () => {
    const result = mergeApolloData(null, makeApollo({ emailStatus: "verified" }));
    expect(result.apolloEmailStatus).toBe("verified");
  });

  it("preserves existing apolloEmailStatus when Apollo provides null", () => {
    const base = { apolloEmailStatus: "verified" };
    const result = mergeApolloData(base, makeApollo({}));
    expect(result.apolloEmailStatus).toBe("verified");
  });

  it("sets Apollo-specific fields (headline, seniority, departments)", () => {
    const result = mergeApolloData(null, makeApollo({
      headline: "VP Sales",
      seniority: "vp",
      departments: ["sales", "marketing"],
    }));
    expect(result.apolloHeadline).toBe("VP Sales");
    expect(result.apolloSeniority).toBe("vp");
    expect(result.apolloDepartments).toEqual(["sales", "marketing"]);
  });

  it("defaults departments to empty array when not provided", () => {
    const result = mergeApolloData(null, makeApollo({}));
    expect(result.apolloDepartments).toEqual([]);
  });

  it("fills industry gap from Apollo org data", () => {
    const result = mergeApolloData(null, makeApollo({ organizationIndustry: "Technology" }));
    expect(result.industry).toBe("Technology");
  });

  it("does NOT overwrite existing industry", () => {
    const base = { industry: "Healthcare" };
    const result = mergeApolloData(base, makeApollo({ organizationIndustry: "Technology" }));
    expect(result.industry).toBe("Healthcare");
  });

  it("fills teamSize gap from Apollo org data", () => {
    const result = mergeApolloData(null, makeApollo({ organizationEmployeeCount: "51-200" }));
    expect(result.teamSize).toBe("51-200");
  });

  it("does NOT overwrite existing teamSize", () => {
    const base = { teamSize: "11-50" };
    const result = mergeApolloData(base, makeApollo({ organizationEmployeeCount: "51-200" }));
    expect(result.teamSize).toBe("11-50");
  });

  it("fills revenue gap from Apollo org data", () => {
    const result = mergeApolloData(null, makeApollo({ organizationRevenue: "$10M-$50M" }));
    expect(result.revenue).toBe("$10M-$50M");
  });

  it("does NOT overwrite existing revenue", () => {
    const base = { revenue: "$1M-$10M" };
    const result = mergeApolloData(base, makeApollo({ organizationRevenue: "$10M-$50M" }));
    expect(result.revenue).toBe("$1M-$10M");
  });

  it("preserves all existing fields not related to Apollo", () => {
    const base = { companySummary: "Summary", linkedinHeadline: "CEO", painPoints: ["churn"] };
    const result = mergeApolloData(base, makeApollo({ emailStatus: "verified" }));
    expect(result.companySummary).toBe("Summary");
    expect(result.linkedinHeadline).toBe("CEO");
    expect(result.painPoints).toEqual(["churn"]);
  });

  it("fills all 3 org gaps simultaneously when base has none", () => {
    const result = mergeApolloData(null, makeApollo({
      organizationIndustry: "SaaS",
      organizationEmployeeCount: "201-500",
      organizationRevenue: "$50M+",
    }));
    expect(result.industry).toBe("SaaS");
    expect(result.teamSize).toBe("201-500");
    expect(result.revenue).toBe("$50M+");
  });
});

// ═════════════════════════════════════════════════════════
// resolveLeadUrl
// ═════════════════════════════════════════════════════════

describe("resolveLeadUrl", () => {
  it("returns companyDomain with https:// prefix (priority 1)", () => {
    expect(resolveLeadUrl({ companyDomain: "acme.com" })).toBe("https://acme.com");
  });

  it("preserves existing https:// in companyDomain", () => {
    expect(resolveLeadUrl({ companyDomain: "https://acme.com" })).toBe("https://acme.com");
  });

  it("preserves http:// in companyDomain", () => {
    expect(resolveLeadUrl({ companyDomain: "http://acme.com" })).toBe("http://acme.com");
  });

  it("falls back to website when companyDomain is null (priority 2)", () => {
    expect(resolveLeadUrl({ companyDomain: null, website: "acme.io" })).toBe("https://acme.io");
  });

  it("falls back to website when companyDomain is undefined", () => {
    expect(resolveLeadUrl({ website: "acme.io" })).toBe("https://acme.io");
  });

  it("preserves https:// in website", () => {
    expect(resolveLeadUrl({ website: "https://acme.io" })).toBe("https://acme.io");
  });

  it("falls back to linkedinCompanyUrl (priority 3)", () => {
    expect(resolveLeadUrl({}, "linkedin-company.com")).toBe("https://linkedin-company.com");
  });

  it("preserves https:// in linkedinCompanyUrl", () => {
    expect(resolveLeadUrl({}, "https://linkedin-company.com")).toBe("https://linkedin-company.com");
  });

  it("returns null when no source available", () => {
    expect(resolveLeadUrl({})).toBeNull();
    expect(resolveLeadUrl({ companyDomain: null, website: null })).toBeNull();
  });

  it("prefers companyDomain over website", () => {
    expect(resolveLeadUrl({ companyDomain: "primary.com", website: "fallback.com" })).toBe("https://primary.com");
  });

  it("prefers website over linkedinCompanyUrl", () => {
    expect(resolveLeadUrl({ website: "direct.com" }, "linkedin.com")).toBe("https://direct.com");
  });

  it("trims whitespace from companyDomain", () => {
    expect(resolveLeadUrl({ companyDomain: "  acme.com  " })).toBe("https://acme.com");
  });

  it("trims whitespace from website", () => {
    expect(resolveLeadUrl({ website: "  acme.io  " })).toBe("https://acme.io");
  });

  it("trims whitespace from linkedinCompanyUrl", () => {
    expect(resolveLeadUrl({}, "  li.com  ")).toBe("https://li.com");
  });

  it("skips empty-string companyDomain (falls to website)", () => {
    expect(resolveLeadUrl({ companyDomain: "", website: "fallback.com" })).toBe("https://fallback.com");
  });

  it("skips whitespace-only companyDomain", () => {
    expect(resolveLeadUrl({ companyDomain: "   ", website: "fallback.com" })).toBe("https://fallback.com");
  });
});

// ═════════════════════════════════════════════════════════
// summarizeEnrichmentQuality
// ═════════════════════════════════════════════════════════

describe("summarizeEnrichmentQuality", () => {
  it("returns 'none' for null input", () => {
    const result = summarizeEnrichmentQuality(null);
    expect(result.quality).toBe("none");
    expect(result.has).toEqual([]);
    expect(result.missing).toEqual(["all fields"]);
  });

  it("returns 'none' for empty object (no fields)", () => {
    const result = summarizeEnrichmentQuality({});
    expect(result.quality).toBe("none");
    expect(result.has).toEqual([]);
  });

  it("returns 'minimal' with 1 field", () => {
    const result = summarizeEnrichmentQuality({ companySummary: "A company" });
    expect(result.quality).toBe("minimal");
    expect(result.has).toContain("companySummary");
  });

  it("returns 'minimal' with 2 fields", () => {
    const result = summarizeEnrichmentQuality({
      companySummary: "A company",
      linkedinHeadline: "CEO",
    });
    expect(result.quality).toBe("minimal");
    expect(result.has.length).toBe(2);
  });

  it("returns 'partial' with 3 fields", () => {
    const result = summarizeEnrichmentQuality({
      companySummary: "A company",
      linkedinHeadline: "CEO",
      painPoints: ["slow growth"],
    });
    expect(result.quality).toBe("partial");
  });

  it("returns 'partial' with 4 fields", () => {
    const result = summarizeEnrichmentQuality({
      companySummary: "A company",
      linkedinHeadline: "CEO",
      painPoints: ["slow growth"],
      products: ["Widget"],
    });
    expect(result.quality).toBe("partial");
  });

  it("returns 'rich' with 5+ fields", () => {
    const result = summarizeEnrichmentQuality({
      companySummary: "A company",
      linkedinHeadline: "CEO",
      painPoints: ["slow growth"],
      products: ["Widget"],
      careerHistory: ["CTO at Foo"],
    });
    expect(result.quality).toBe("rich");
  });

  it("counts painPoints array with prefix", () => {
    const result = summarizeEnrichmentQuality({ painPoints: ["p1", "p2", "p3"] });
    expect(result.has).toContain("3 painPoints");
  });

  it("counts products array with prefix", () => {
    const result = summarizeEnrichmentQuality({ products: ["A", "B"] });
    expect(result.has).toContain("2 products");
  });

  it("counts career entries with prefix", () => {
    const result = summarizeEnrichmentQuality({ careerHistory: ["role1", "role2"] });
    expect(result.has).toContain("2 careerHistory");
  });

  it("counts LinkedIn posts with prefix", () => {
    const result = summarizeEnrichmentQuality({ recentLinkedInPosts: ["post1"] });
    expect(result.has).toContain("1 linkedInPosts");
  });

  it("aggregates signals across all 6 types", () => {
    const result = summarizeEnrichmentQuality({
      hiringSignals: [{ detail: "hiring" }],
      fundingSignals: [{ detail: "funding" }],
      productLaunches: ["new product"],
      leadershipChanges: [{ detail: "new CEO" }],
      publicPriorities: ["expansion"],
      techStackChanges: ["migrated to AWS"],
    });
    expect(result.has).toContain("6 signals");
  });

  it("reports missing signals when none present", () => {
    const result = summarizeEnrichmentQuality({ companySummary: "A company" });
    expect(result.missing).toContain("signals");
  });

  it("reports missing companySummary", () => {
    const result = summarizeEnrichmentQuality({ linkedinHeadline: "CEO" });
    expect(result.missing).toContain("companySummary");
  });

  it("reports missing painPoints", () => {
    const result = summarizeEnrichmentQuality({ companySummary: "X" });
    expect(result.missing).toContain("painPoints");
  });

  it("reports missing linkedinHeadline", () => {
    const result = summarizeEnrichmentQuality({ companySummary: "X" });
    expect(result.missing).toContain("linkedinHeadline");
  });

  it("includes industry value in has", () => {
    const result = summarizeEnrichmentQuality({ industry: "SaaS" });
    expect(result.has).toContain("industry:SaaS");
  });

  it("includes apolloEmailStatus value in has", () => {
    const result = summarizeEnrichmentQuality({ apolloEmailStatus: "verified" });
    expect(result.has).toContain("apolloEmail:verified");
  });

  it("includes apolloSeniority value in has", () => {
    const result = summarizeEnrichmentQuality({ apolloSeniority: "vp" });
    expect(result.has).toContain("seniority:vp");
  });

  it("ignores empty arrays for painPoints/products", () => {
    const result = summarizeEnrichmentQuality({
      painPoints: [],
      products: [],
    });
    expect(result.has).not.toContainEqual(expect.stringContaining("painPoints"));
    expect(result.has).not.toContainEqual(expect.stringContaining("products"));
    expect(result.missing).toContain("painPoints");
  });

  it("ignores non-array values for painPoints (treats as empty)", () => {
    const result = summarizeEnrichmentQuality({ painPoints: "not an array" });
    expect(result.has).not.toContainEqual(expect.stringContaining("painPoints"));
    expect(result.missing).toContain("painPoints");
  });

  it("full enrichment returns rich with complete has list", () => {
    const result = summarizeEnrichmentQuality({
      companySummary: "B2B SaaS",
      painPoints: ["scaling", "churn"],
      products: ["CRM"],
      linkedinHeadline: "VP Sales",
      careerHistory: ["Manager at X", "VP at Y"],
      recentLinkedInPosts: ["Great quarter!"],
      hiringSignals: [{ detail: "3 open roles" }],
      fundingSignals: [{ detail: "Series B" }],
      industry: "Technology",
      apolloEmailStatus: "verified",
      apolloSeniority: "vp",
    });
    expect(result.quality).toBe("rich");
    expect(result.has.length).toBeGreaterThanOrEqual(9);
    expect(result.missing).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════
// extractLinkedInContext
// ═════════════════════════════════════════════════════════

describe("extractLinkedInContext", () => {
  it("returns null for null enrichment", () => {
    expect(extractLinkedInContext(null)).toBeNull();
  });

  it("returns null when no LinkedIn fields present", () => {
    expect(extractLinkedInContext({ companySummary: "Test" })).toBeNull();
  });

  it("returns null when all LinkedIn fields are empty", () => {
    expect(extractLinkedInContext({
      linkedinHeadline: null,
      careerHistory: [],
      recentLinkedInPosts: [],
    })).toBeNull();
  });

  it("extracts headline alone", () => {
    const result = extractLinkedInContext({ linkedinHeadline: "VP Sales" });
    expect(result).not.toBeNull();
    expect(result!.headline).toBe("VP Sales");
    // career and posts are undefined when not present in input
    expect(result!.career).toBeUndefined();
    expect(result!.posts).toBeUndefined();
  });

  it("extracts career alone", () => {
    const result = extractLinkedInContext({ careerHistory: ["CTO at X"] });
    expect(result).not.toBeNull();
    expect(result!.career).toEqual(["CTO at X"]);
    expect(result!.headline).toBeUndefined();
  });

  it("extracts posts alone", () => {
    const result = extractLinkedInContext({ recentLinkedInPosts: ["Great news!"] });
    expect(result).not.toBeNull();
    expect(result!.posts).toEqual(["Great news!"]);
    expect(result!.headline).toBeUndefined();
  });

  it("extracts all three LinkedIn fields", () => {
    const result = extractLinkedInContext({
      linkedinHeadline: "CEO",
      careerHistory: ["Manager"],
      recentLinkedInPosts: ["Hiring!"],
      companySummary: "Acme", // non-LinkedIn field preserved but not extracted
    });
    expect(result).toEqual({
      headline: "CEO",
      career: ["Manager"],
      posts: ["Hiring!"],
    });
  });
});
