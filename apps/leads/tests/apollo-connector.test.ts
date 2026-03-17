import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enrichPerson,
  enrichOrganization,
  testApolloConnection,
} from "@/server/lib/connectors/apollo";

// ─── Mock fetch ─────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Helper: create a successful fetch response ────────

function okResponse(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

function errorResponse(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve("error"),
  });
}

// ─── enrichPerson ───────────────────────────────────────

describe("enrichPerson", () => {
  it("sends domain as 'domain' parameter, NOT 'organization_name'", async () => {
    mockFetch.mockReturnValue(okResponse({
      person: {
        email: "john@acme.com",
        first_name: "John",
        last_name: "Doe",
        title: "VP Sales",
      },
    }));

    await enrichPerson("test-key", {
      email: "john@acme.com",
      domain: "acme.com",
      firstName: "John",
      lastName: "Doe",
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://api.apollo.io/v1/people/match");
    const body = JSON.parse(options.body);
    expect(body.domain).toBe("acme.com");
    expect(body).not.toHaveProperty("organization_name");
  });

  it("sends all provided parameters correctly", async () => {
    mockFetch.mockReturnValue(okResponse({
      person: {
        email: "jane@corp.io",
        first_name: "Jane",
        title: "CTO",
        linkedin_url: "https://linkedin.com/in/jane",
      },
    }));

    await enrichPerson("test-key", {
      email: "jane@corp.io",
      firstName: "Jane",
      lastName: "Smith",
      domain: "corp.io",
      linkedinUrl: "https://linkedin.com/in/jane",
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({
      email: "jane@corp.io",
      first_name: "Jane",
      last_name: "Smith",
      domain: "corp.io",
      linkedin_url: "https://linkedin.com/in/jane",
    });
  });

  it("maps Apollo API response to ApolloPersonResult", async () => {
    mockFetch.mockReturnValue(okResponse({
      person: {
        email: "john@acme.com",
        email_status: "verified",
        first_name: "John",
        last_name: "Doe",
        title: "VP Sales",
        headline: "VP Sales at Acme",
        linkedin_url: "https://linkedin.com/in/johndoe",
        phone_numbers: [{ raw_number: "+1234567890" }],
        city: "San Francisco",
        state: "CA",
        country: "US",
        seniority: "vp",
        departments: ["sales"],
        organization: {
          name: "Acme Inc",
          primary_domain: "acme.com",
          industry: "SaaS",
          estimated_num_employees: 150,
          annual_revenue_printed: "$10M",
        },
      },
    }));

    const result = await enrichPerson("test-key", { email: "john@acme.com" });

    expect(result).toEqual({
      email: "john@acme.com",
      emailStatus: "verified",
      firstName: "John",
      lastName: "Doe",
      title: "VP Sales",
      headline: "VP Sales at Acme",
      linkedinUrl: "https://linkedin.com/in/johndoe",
      phone: "+1234567890",
      city: "San Francisco",
      state: "CA",
      country: "US",
      seniority: "vp",
      departments: ["sales"],
      organizationName: "Acme Inc",
      organizationDomain: "acme.com",
      organizationIndustry: "SaaS",
      organizationEmployeeCount: "150",
      organizationRevenue: "$10M",
    });
  });

  it("returns null when person not found", async () => {
    mockFetch.mockReturnValue(okResponse({ person: null }));

    const result = await enrichPerson("test-key", { email: "nobody@nowhere.com" });
    expect(result).toBeNull();
  });

  it("returns null on API error", async () => {
    mockFetch.mockReturnValue(errorResponse(401));

    const result = await enrichPerson("test-key", { email: "john@acme.com" });
    expect(result).toBeNull();
  });

  it("omits undefined optional params from request body", async () => {
    mockFetch.mockReturnValue(okResponse({ person: null }));

    await enrichPerson("test-key", { email: "test@test.com" });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toEqual({ email: "test@test.com" });
    expect(body).not.toHaveProperty("first_name");
    expect(body).not.toHaveProperty("domain");
    expect(body).not.toHaveProperty("linkedin_url");
  });

  it("sends API key in X-Api-Key header", async () => {
    mockFetch.mockReturnValue(okResponse({ person: null }));

    await enrichPerson("my-secret-key", { email: "test@test.com" });

    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers["X-Api-Key"]).toBe("my-secret-key");
  });
});

// ─── enrichOrganization ─────────────────────────────────

describe("enrichOrganization", () => {
  it("sends domain as query parameter", async () => {
    mockFetch.mockReturnValue(okResponse({
      organization: {
        name: "Acme",
        primary_domain: "acme.com",
        industry: "SaaS",
      },
    }));

    await enrichOrganization("test-key", "acme.com");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toBe("https://api.apollo.io/v1/organizations/enrich?domain=acme.com");
  });

  it("maps API response to ApolloOrganizationResult", async () => {
    mockFetch.mockReturnValue(okResponse({
      organization: {
        name: "Acme Inc",
        primary_domain: "acme.com",
        industry: "SaaS",
        estimated_num_employees: 250,
        annual_revenue_printed: "$25M",
        short_description: "A SaaS company",
        city: "NYC",
        state: "NY",
        country: "US",
        linkedin_url: "https://linkedin.com/company/acme",
        current_technologies: [{ name: "React" }, { name: "Node.js" }],
        keywords: ["saas", "sales"],
        total_funding: 5000000,
        latest_funding_round_date: "2025-06-15",
      },
    }));

    const result = await enrichOrganization("test-key", "acme.com");

    expect(result).toEqual({
      name: "Acme Inc",
      domain: "acme.com",
      industry: "SaaS",
      employeeCount: 250,
      estimatedRevenue: "$25M",
      shortDescription: "A SaaS company",
      city: "NYC",
      state: "NY",
      country: "US",
      linkedinUrl: "https://linkedin.com/company/acme",
      technologies: ["React", "Node.js"],
      keywords: ["saas", "sales"],
      fundingTotal: 5000000,
      latestFundingRoundDate: "2025-06-15",
    });
  });

  it("returns null when organization not found", async () => {
    mockFetch.mockReturnValue(okResponse({ organization: null }));

    const result = await enrichOrganization("test-key", "unknown.com");
    expect(result).toBeNull();
  });

  it("returns null on API error", async () => {
    mockFetch.mockReturnValue(errorResponse(500));

    const result = await enrichOrganization("test-key", "acme.com");
    expect(result).toBeNull();
  });

  it("URL-encodes the domain parameter", async () => {
    mockFetch.mockReturnValue(okResponse({ organization: null }));

    await enrichOrganization("test-key", "my domain.com");

    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain("domain=my%20domain.com");
  });
});

// ─── testApolloConnection ───────────────────────────────

describe("testApolloConnection", () => {
  it("returns true when health endpoint succeeds", async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true }));

    const result = await testApolloConnection("valid-key");
    expect(result).toBe(true);
  });

  it("falls back to people/search when health fails", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 404 }))
      .mockReturnValueOnce(Promise.resolve({ ok: true }));

    const result = await testApolloConnection("valid-key");
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toContain("/v1/people/search");
  });

  it("returns false when both endpoints fail", async () => {
    mockFetch
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 401 }))
      .mockReturnValueOnce(Promise.resolve({ ok: false, status: 401 }));

    const result = await testApolloConnection("invalid-key");
    expect(result).toBe(false);
  });

  it("returns false on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await testApolloConnection("any-key");
    expect(result).toBe(false);
  });
});
