import { describe, it, expect } from "vitest";
import {
  buildCRMEnrichmentProperties,
  buildEnrichmentNotes,
} from "@/server/lib/tools/crm-tools";

// Minimal lead factory — only fields used by CRM enrichment
function makeLead(overrides: Record<string, unknown> = {}) {
  return {
    industry: null,
    website: null,
    linkedinUrl: null,
    country: null,
    companySize: null,
    icpScore: null,
    companyOneLiner: null,
    painPointsFlat: null,
    buyingSignals: null,
    linkedinHeadline: null,
    techStackFlat: null,
    valueProp: null,
    careerHistory: null,
    ...overrides,
  };
}

// ─── buildCRMEnrichmentProperties ───────────────────────

describe("buildCRMEnrichmentProperties", () => {
  it("returns empty object for lead with no enrichment data", () => {
    const props = buildCRMEnrichmentProperties(makeLead());
    expect(props).toEqual({});
  });

  it("maps industry to industry", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ industry: "SaaS" }));
    expect(props.industry).toBe("SaaS");
  });

  it("maps website to website", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ website: "https://acme.com" }));
    expect(props.website).toBe("https://acme.com");
  });

  it("maps country to country", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ country: "France" }));
    expect(props.country).toBe("France");
  });

  it("maps companySize to numberofemployees", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ companySize: "51-200" }));
    expect(props.numberofemployees).toBe("51-200");
  });

  it("includes description when enrichment notes exist", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ icpScore: 8 }));
    expect(props.description).toContain("ICP Score: 8/10");
  });

  it("omits description when no enrichment notes", () => {
    const props = buildCRMEnrichmentProperties(makeLead({ industry: "SaaS" }));
    expect(props.description).toBeUndefined();
  });

  it("includes all standard fields for a rich lead", () => {
    const props = buildCRMEnrichmentProperties(makeLead({
      industry: "FinTech",
      website: "https://payco.io",
      country: "United States",
      companySize: "201-500",
      icpScore: 9,
      painPointsFlat: "Manual invoicing, slow reconciliation",
    }));

    expect(props.industry).toBe("FinTech");
    expect(props.website).toBe("https://payco.io");
    expect(props.country).toBe("United States");
    expect(props.numberofemployees).toBe("201-500");
    expect(props.description).toContain("ICP Score: 9/10");
    expect(props.description).toContain("Pain Points: Manual invoicing");
  });

  it("does not include linkedinUrl as a standard property", () => {
    // LinkedIn URL is in the notes, not a standard CRM property
    const props = buildCRMEnrichmentProperties(makeLead({
      linkedinUrl: "https://linkedin.com/in/jdoe",
      linkedinHeadline: "VP of Engineering",
    }));
    expect(props).not.toHaveProperty("linkedinUrl");
    expect(props).not.toHaveProperty("hs_linkedinid");
    expect(props.description).toContain("LinkedIn: VP of Engineering");
  });
});

// ─── buildEnrichmentNotes ───────────────────────────────

describe("buildEnrichmentNotes", () => {
  it("returns empty string for lead with no enrichment data", () => {
    expect(buildEnrichmentNotes(makeLead())).toBe("");
  });

  it("includes ICP score", () => {
    const notes = buildEnrichmentNotes(makeLead({ icpScore: 7 }));
    expect(notes).toContain("ICP Score: 7/10");
  });

  it("includes LinkedIn headline", () => {
    const notes = buildEnrichmentNotes(makeLead({ linkedinHeadline: "CTO at Startup" }));
    expect(notes).toContain("LinkedIn: CTO at Startup");
  });

  it("includes company one-liner", () => {
    const notes = buildEnrichmentNotes(makeLead({ companyOneLiner: "AI-powered invoicing" }));
    expect(notes).toContain("Company: AI-powered invoicing");
  });

  it("includes pain points", () => {
    const notes = buildEnrichmentNotes(makeLead({ painPointsFlat: "Manual processes, data silos" }));
    expect(notes).toContain("Pain Points: Manual processes, data silos");
  });

  it("includes buying signals", () => {
    const notes = buildEnrichmentNotes(makeLead({ buyingSignals: "Hiring SDRs, Series B" }));
    expect(notes).toContain("Buying Signals: Hiring SDRs, Series B");
  });

  it("includes value proposition", () => {
    const notes = buildEnrichmentNotes(makeLead({ valueProp: "Automate outbound in 10 minutes" }));
    expect(notes).toContain("Value Proposition: Automate outbound in 10 minutes");
  });

  it("includes tech stack", () => {
    const notes = buildEnrichmentNotes(makeLead({ techStackFlat: "React, Node.js, PostgreSQL" }));
    expect(notes).toContain("Tech Stack: React, Node.js, PostgreSQL");
  });

  it("includes career history", () => {
    const notes = buildEnrichmentNotes(makeLead({ careerHistory: "VP Sales at Acme (2020-2024)" }));
    expect(notes).toContain("Career: VP Sales at Acme (2020-2024)");
  });

  it("starts with LeadSens header", () => {
    const notes = buildEnrichmentNotes(makeLead({ icpScore: 5 }));
    expect(notes.startsWith("--- LeadSens Enrichment ---")).toBe(true);
  });

  it("combines multiple sections with newlines", () => {
    const notes = buildEnrichmentNotes(makeLead({
      icpScore: 9,
      linkedinHeadline: "Head of Growth",
      painPointsFlat: "Low reply rates",
      buyingSignals: "Hiring outbound team",
    }));

    const lines = notes.split("\n");
    expect(lines[0]).toBe("--- LeadSens Enrichment ---");
    expect(lines[1]).toBe("ICP Score: 9/10");
    expect(lines[2]).toBe("LinkedIn: Head of Growth");
    // Pain points before buying signals (order in function)
    expect(lines[3]).toBe("Pain Points: Low reply rates");
    expect(lines[4]).toBe("Buying Signals: Hiring outbound team");
  });

  it("handles ICP score 0 correctly", () => {
    const notes = buildEnrichmentNotes(makeLead({ icpScore: 0 }));
    expect(notes).toContain("ICP Score: 0/10");
  });

  it("full enrichment includes all 8 sections", () => {
    const notes = buildEnrichmentNotes(makeLead({
      icpScore: 8,
      linkedinHeadline: "CEO",
      companyOneLiner: "B2B SaaS platform",
      painPointsFlat: "Lead gen, qualification",
      buyingSignals: "Raised $5M",
      valueProp: "Automate prospecting",
      techStackFlat: "Next.js, Prisma",
      careerHistory: "Ex-Google",
    }));

    const lines = notes.split("\n");
    // Header + 8 sections = 9 lines
    expect(lines).toHaveLength(9);
  });
});
