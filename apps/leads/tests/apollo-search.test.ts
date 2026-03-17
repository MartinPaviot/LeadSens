import { describe, it, expect, vi } from "vitest";

// Mock Prisma (enrichment-tools.ts imports it at module level)
vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

// Mock providers (enrichment-tools.ts imports getApolloApiKey)
vi.mock("@/server/lib/providers", () => ({
  getApolloApiKey: vi.fn(),
}));

import { mapToolArgsToApolloParams } from "@/server/lib/tools/enrichment-tools";

describe("mapToolArgsToApolloParams", () => {
  it("maps basic titles", () => {
    const result = mapToolArgsToApolloParams({ titles: ["VP of Sales"] });
    expect(result.person_titles).toEqual(["VP of Sales"]);
    expect(result.include_similar_titles).toBe(true);
    expect(result.per_page).toBe(25);
  });

  it("maps seniorities", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["Sales Manager"],
      seniorities: ["director", "vp"],
    });
    expect(result.person_seniorities).toEqual(["director", "vp"]);
  });

  it("maps company domains", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["CTO"],
      company_domains: ["notion.so", "stripe.com"],
    });
    expect(result.q_organization_domains_list).toEqual(["notion.so", "stripe.com"]);
  });

  it("maps industries to keyword tags", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["Head of Engineering"],
      industries: ["SaaS", "fintech"],
    });
    expect(result.q_organization_keyword_tags).toEqual(["SaaS", "fintech"]);
  });

  it("maps employee range", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["CEO"],
      employee_range: "50,200",
    });
    expect(result.organization_num_employees_ranges).toEqual(["50,200"]);
  });

  it("maps person and company locations separately", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["VP"],
      person_locations: ["New York, NY"],
      company_locations: ["San Francisco, CA"],
    });
    expect(result.person_locations).toEqual(["New York, NY"]);
    expect(result.organization_locations).toEqual(["San Francisco, CA"]);
  });

  it("maps tech stack with underscore replacement", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["CTO"],
      tech_stack: ["Google Analytics", "wordpress.org", "HubSpot"],
    });
    expect(result.currently_using_any_of_technology_uids).toEqual([
      "google_analytics",
      "wordpress_org",
      "hubspot",
    ]);
  });

  it("maps hiring signals", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["VP of Sales"],
      hiring_for: ["SDR", "Account Executive"],
    });
    expect(result.q_organization_job_titles).toEqual(["SDR", "Account Executive"]);
  });

  it("disables similar titles when strict", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["CTO"],
      strict_titles: true,
    });
    expect(result.include_similar_titles).toBe(false);
  });

  it("respects max_results", () => {
    const result = mapToolArgsToApolloParams({
      titles: ["CEO"],
      max_results: 50,
    });
    expect(result.per_page).toBe(50);
  });

  it("handles minimal args (titles only)", () => {
    const result = mapToolArgsToApolloParams({ titles: ["Developer"] });
    expect(result.person_titles).toEqual(["Developer"]);
    expect(result.person_seniorities).toBeUndefined();
    expect(result.q_organization_domains_list).toBeUndefined();
    expect(result.q_organization_keyword_tags).toBeUndefined();
    expect(result.organization_num_employees_ranges).toBeUndefined();
    expect(result.person_locations).toBeUndefined();
    expect(result.organization_locations).toBeUndefined();
    expect(result.currently_using_any_of_technology_uids).toBeUndefined();
    expect(result.q_organization_job_titles).toBeUndefined();
  });
});
