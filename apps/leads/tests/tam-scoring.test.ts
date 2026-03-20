import { describe, it, expect } from "vitest";
import { scoreLead, scoreLeads, type ScoredLead, type LeadInput } from "@/server/lib/tam/score-leads";
import type { InferredICP } from "@/server/lib/tam/infer-icp";
import type { SignalResult } from "@/server/lib/tam/detect-signals";

// ─── Helpers ─────────────────────────────────────────────

function makeICP(overrides: Partial<InferredICP> = {}): InferredICP {
  return {
    roles: [
      { title: "VP Sales", variations: ["Head of Sales", "Sales Director"], seniority: "VP", why: "Decision maker" },
    ],
    companies: {
      industries: ["SaaS", "B2B Tech"],
      employeeRange: { min: 50, max: 1000, sweetSpot: 200 },
      geography: ["United States", "United Kingdom"],
    },
    buyingSignals: [],
    disqualifiers: [],
    summary: "Mid-market B2B SaaS VP Sales",
    ...overrides,
  };
}

function makeSignal(name: string, detected: boolean, points: number = 0): SignalResult {
  return {
    name,
    detected,
    evidence: detected ? `${name} detected` : "",
    sources: [],
    reasoning: detected ? `${name} reasoning` : `No ${name}`,
    points,
  };
}

function makeLead(overrides: Partial<LeadInput> = {}): LeadInput {
  return {
    firstName: "John",
    lastName: "Doe",
    title: "VP Sales",
    company: "Acme SaaS",
    domain: "acmesaas.com",
    industry: "SaaS",
    employeeCount: 200,
    country: "United States",
    ...overrides,
  };
}

// ─── Tier Assignment Tests ───────────────────────────────

describe("TAM score-leads: Tier assignment", () => {
  const icp = makeICP();

  it("assigns Tier A when all 4 criteria match", () => {
    const lead = makeLead();
    const result = scoreLead(lead, icp, []);
    expect(result.tier).toBe("A");
    expect(result.tierLabel).toBe("Perfect Fit");
    expect(result.tierMatchCount).toBe(4);
  });

  it("assigns Tier B when 3 criteria match", () => {
    const lead = makeLead({ industry: "Healthcare" }); // industry doesn't match
    const result = scoreLead(lead, icp, []);
    expect(result.tier).toBe("B");
    expect(result.tierLabel).toBe("Strong Fit");
    expect(result.tierMatchCount).toBe(3);
  });

  it("assigns Tier C when 2 criteria match", () => {
    const lead = makeLead({ industry: "Healthcare", country: "Brazil" });
    const result = scoreLead(lead, icp, []);
    expect(result.tier).toBe("C");
    expect(result.tierLabel).toBe("Moderate Fit");
    expect(result.tierMatchCount).toBe(2);
  });

  it("assigns Tier D when 0-1 criteria match", () => {
    const lead = makeLead({
      title: "Junior Developer",
      industry: "Healthcare",
      employeeCount: 5,
      country: "Brazil",
    });
    const result = scoreLead(lead, icp, []);
    expect(result.tier).toBe("D");
    expect(result.tierLabel).toBe("Weak Fit");
  });

  it("matches title variations", () => {
    const lead = makeLead({ title: "Head of Sales" });
    const result = scoreLead(lead, icp, []);
    expect(result.tierReasons).toEqual(
      expect.arrayContaining([expect.stringContaining("Head of Sales")])
    );
    // Title should match via variations
    expect(result.tierMatchCount).toBeGreaterThanOrEqual(3);
  });

  it("handles missing fields gracefully", () => {
    const lead = makeLead({ title: undefined, industry: undefined });
    const result = scoreLead(lead, icp, []);
    // Should not crash, just lower match count
    expect(result.tier).toBeDefined();
  });

  it("treats no geography constraint as match", () => {
    const noGeoIcp = makeICP({
      companies: {
        industries: ["SaaS"],
        employeeRange: { min: 50, max: 1000, sweetSpot: 200 },
        geography: [],
      },
    });
    const lead = makeLead({ country: "Japan" });
    const result = scoreLead(lead, noGeoIcp, []);
    // Geography should count as a match when ICP has no constraint
    expect(result.tierReasons).not.toEqual(
      expect.arrayContaining([expect.stringContaining("not in ICP geography")])
    );
  });
});

// ─── Heat Assignment Tests ───────────────────────────────

describe("TAM score-leads: Heat assignment", () => {
  const icp = makeICP();
  const lead = makeLead();

  it("assigns Burning with 3+ signals", () => {
    const signals = [
      makeSignal("Hiring Outbound", true, 10),
      makeSignal("Sales-Led Growth", true, 8),
      makeSignal("Recent Funding", true, 10),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.heat).toBe("Burning");
    expect(result.heatLabel).toBe("Great Signals");
    expect(result.heatSignalCount).toBe(3);
  });

  it("assigns Hot with 2 signals", () => {
    const signals = [
      makeSignal("Hiring Outbound", true, 10),
      makeSignal("Sales-Led Growth", true, 8),
      makeSignal("Recent Funding", false),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.heat).toBe("Hot");
    expect(result.heatSignalCount).toBe(2);
  });

  it("assigns Warm with 1 signal", () => {
    const signals = [
      makeSignal("Hiring Outbound", true, 10),
      makeSignal("Sales-Led Growth", false),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.heat).toBe("Warm");
    expect(result.heatSignalCount).toBe(1);
  });

  it("assigns Cold with 0 signals", () => {
    const signals = [
      makeSignal("Hiring Outbound", false),
      makeSignal("Sales-Led Growth", false),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.heat).toBe("Cold");
    expect(result.heatSignalCount).toBe(0);
  });
});

// ─── Action Phrases Tests ────────────────────────────────

describe("TAM score-leads: Action phrases", () => {
  const icp = makeICP();

  it("A + Burning → immediate action", () => {
    const lead = makeLead();
    const signals = [
      makeSignal("Hiring Outbound", true, 10),
      makeSignal("Sales-Led Growth", true, 8),
      makeSignal("Recent Funding", true, 10),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.actionPhrase).toContain("immediately");
  });

  it("D + Cold → skip", () => {
    const lead = makeLead({
      title: "Junior Developer",
      industry: "Agriculture",
      employeeCount: 3,
      country: "Nepal",
    });
    const result = scoreLead(lead, icp, []);
    expect(result.actionPhrase).toContain("skip");
  });
});

// ─── Numeric Score Tests ─────────────────────────────────

describe("TAM score-leads: Numeric score", () => {
  const icp = makeICP();

  it("A + Burning gives highest score", () => {
    const lead = makeLead();
    const signals = [
      makeSignal("a", true, 10),
      makeSignal("b", true, 8),
      makeSignal("c", true, 5),
    ];
    const result = scoreLead(lead, icp, signals);
    expect(result.numericScore).toBe(10); // 10*0.6 + 10*0.4 = 10
  });

  it("D + Cold gives lowest score", () => {
    const lead = makeLead({
      title: "Intern",
      industry: "Agriculture",
      employeeCount: 3,
      country: "Nepal",
    });
    const result = scoreLead(lead, icp, []);
    expect(result.numericScore).toBeLessThanOrEqual(2);
  });
});

// ─── Sorting Tests ───────────────────────────────────────

describe("TAM score-leads: scoreLeads sorting", () => {
  const icp = makeICP();

  it("sorts Tier A before Tier D", () => {
    const leads = [
      { lead: makeLead({ title: "Intern", industry: "Agriculture", employeeCount: 3, country: "Nepal" }), signals: [] },
      { lead: makeLead(), signals: [makeSignal("a", true, 10), makeSignal("b", true, 8), makeSignal("c", true, 5)] },
    ];
    const sorted = scoreLeads(leads, icp);
    expect(sorted[0].tier).toBe("A");
    expect(sorted[sorted.length - 1].tier).toBe("D");
  });

  it("within same tier, sorts Burning before Cold", () => {
    const leads = [
      { lead: makeLead(), signals: [] },
      { lead: makeLead(), signals: [makeSignal("a", true, 10), makeSignal("b", true, 8), makeSignal("c", true, 5)] },
    ];
    const sorted = scoreLeads(leads, icp);
    expect(sorted[0].heat).toBe("Burning");
    expect(sorted[1].heat).toBe("Cold");
  });
});

// ─── whyThisLead Tests ───────────────────────────────────

describe("TAM score-leads: whyThisLead", () => {
  const icp = makeICP();

  it("includes lead name and company", () => {
    const lead = makeLead({ firstName: "Jane", lastName: "Smith", company: "TechCorp" });
    const result = scoreLead(lead, icp, []);
    expect(result.whyThisLead).toContain("Jane");
    expect(result.whyThisLead).toContain("Smith");
    expect(result.whyThisLead).toContain("TechCorp");
  });

  it("includes signal evidence when signals detected", () => {
    const lead = makeLead();
    const signals = [makeSignal("Hiring Outbound", true, 10)];
    const result = scoreLead(lead, icp, signals);
    expect(result.whyThisLead).toContain("Hiring Outbound detected");
  });
});
