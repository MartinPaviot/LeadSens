import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock logger to avoid structured logger side effects
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock prisma + encryption (only used by getInstantlyClient, not direct API functions)
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/encryption", () => ({ decrypt: (v: string) => v }));

import {
  resolveLocation,
  normalizePreviewLead,
  normalizeStoredLead,
  mapRevenueToAPI,
  countLeads,
  previewLeads,
  sourceLeads,
  createCampaign,
  getCampaign,
  listCampaigns,
  listAccounts,
  getCampaignAnalytics,
  getCampaignStepAnalytics,
  getLeadsWithPerformance,
  getEmails,
  activateCampaign,
  pauseCampaign,
  listLeads,
  createLead,
  updateLead,
  deleteLead,
  addLeadsToCampaign,
  updateLeadInterestStatus,
  getEnrichmentStatus,
} from "@/server/lib/connectors/instantly";

const API_KEY = "test-api-key";

/** Minimal valid filters (skip_owned_leads has a Zod default, but TypeScript needs it explicit) */
const EMPTY_FILTERS = { skip_owned_leads: true } as const;

// ─── Fetch mock helper ──────────────────────────────────

let fetchMock: ReturnType<typeof vi.fn>;

function mockFetchOnce(body: unknown, status = 200) {
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function mockFetchSequence(responses: Array<{ body: unknown; status?: number }>) {
  for (const r of responses) {
    mockFetchOnce(r.body, r.status ?? 200);
  }
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Pure Functions ──────────────────────────────────────

describe("resolveLocation", () => {
  it("resolves known country names", () => {
    const result = resolveLocation("France");
    expect(result).toEqual({ place_id: expect.any(String), label: "France" });
    expect(result!.place_id).toBeTruthy();
  });

  it("resolves case-insensitively (same place_id, different label)", () => {
    const upper = resolveLocation("UNITED STATES");
    const lower = resolveLocation("united states");
    expect(upper!.place_id).toBe(lower!.place_id);
    expect(upper!.label).toBe("UNITED STATES"); // preserves original label
    expect(lower!.label).toBe("united states");
  });

  it("trims whitespace", () => {
    const result = resolveLocation("  germany  ");
    expect(result).not.toBeNull();
    expect(result!.place_id).toBeTruthy();
  });

  it("resolves city names", () => {
    expect(resolveLocation("paris")).not.toBeNull();
    expect(resolveLocation("london")).not.toBeNull();
    expect(resolveLocation("new york")).not.toBeNull();
    expect(resolveLocation("tokyo")).not.toBeNull();
  });

  it("resolves common aliases (usa, uk, uae)", () => {
    expect(resolveLocation("usa")).not.toBeNull();
    expect(resolveLocation("uk")).not.toBeNull();
    expect(resolveLocation("uae")).not.toBeNull();
    expect(resolveLocation("us")).not.toBeNull();
  });

  it("returns null for unknown locations", () => {
    expect(resolveLocation("Middle Earth")).toBeNull();
    expect(resolveLocation("Atlantis")).toBeNull();
    expect(resolveLocation("")).toBeNull();
  });

  it("usa and united states resolve to same place_id", () => {
    const usa = resolveLocation("usa");
    const full = resolveLocation("united states");
    expect(usa!.place_id).toBe(full!.place_id);
  });
});

describe("normalizePreviewLead", () => {
  it("normalizes full preview lead", () => {
    const result = normalizePreviewLead({
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      jobTitle: "CTO",
      location: "San Francisco",
      linkedIn: "https://linkedin.com/in/johndoe",
      companyName: "Acme Inc",
    });

    expect(result).toEqual({
      email: "", // preview never includes email
      firstName: "John",
      lastName: "Doe",
      company: "Acme Inc",
      jobTitle: "CTO",
      linkedinUrl: "https://linkedin.com/in/johndoe",
      phone: null,
      website: null,
      location: "San Francisco",
      companyDomain: null,
    });
  });

  it("handles empty preview lead", () => {
    const result = normalizePreviewLead({});
    expect(result.email).toBe("");
    expect(result.firstName).toBeNull();
    expect(result.lastName).toBeNull();
    expect(result.company).toBeNull();
    expect(result.jobTitle).toBeNull();
    expect(result.linkedinUrl).toBeNull();
  });

  it("prefixes LinkedIn URL with https:// if missing", () => {
    const result = normalizePreviewLead({ linkedIn: "linkedin.com/in/johndoe" });
    expect(result.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
  });

  it("keeps https:// LinkedIn URL as-is", () => {
    const result = normalizePreviewLead({ linkedIn: "https://linkedin.com/in/johndoe" });
    expect(result.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
  });

  it("returns null linkedinUrl when linkedIn is undefined", () => {
    const result = normalizePreviewLead({ firstName: "Alice" });
    expect(result.linkedinUrl).toBeNull();
  });
});

describe("normalizeStoredLead", () => {
  it("normalizes full stored lead with top-level + payload fields", () => {
    const result = normalizeStoredLead({
      id: "lead-1",
      email: "john@acme.com",
      first_name: "John",
      last_name: "Doe",
      company_name: "Acme Inc",
      phone: "+1234567890",
      website: "acme.com",
      company_domain: "acme.com",
      payload: {
        jobTitle: "CTO",
        linkedIn: "linkedin.com/in/johndoe",
        location: "New York",
      },
    });

    expect(result).toEqual({
      email: "john@acme.com",
      firstName: "John",
      lastName: "Doe",
      company: "Acme Inc",
      jobTitle: "CTO",
      linkedinUrl: "https://linkedin.com/in/johndoe",
      phone: "+1234567890",
      website: "acme.com",
      location: "New York",
      companyDomain: "acme.com",
    });
  });

  it("prefers top-level fields over payload", () => {
    const result = normalizeStoredLead({
      id: "lead-2",
      email: "jane@corp.com",
      first_name: "Jane",
      payload: { firstName: "Janet" }, // should be ignored
    });
    expect(result.firstName).toBe("Jane");
  });

  it("falls back to payload when top-level is null", () => {
    const result = normalizeStoredLead({
      id: "lead-3",
      email: "bob@corp.com",
      first_name: null,
      payload: { firstName: "Bob", companyName: "Corp Ltd" },
    });
    expect(result.firstName).toBe("Bob");
    expect(result.company).toBe("Corp Ltd");
  });

  it("handles null payload", () => {
    const result = normalizeStoredLead({
      id: "lead-4",
      email: "test@test.com",
      payload: null,
    });
    expect(result.email).toBe("test@test.com");
    expect(result.firstName).toBeNull();
    expect(result.jobTitle).toBeNull();
  });

  it("prefixes LinkedIn URL with https:// from payload", () => {
    const result = normalizeStoredLead({
      id: "lead-5",
      email: "a@b.com",
      payload: { linkedIn: "linkedin.com/in/alice" },
    });
    expect(result.linkedinUrl).toBe("https://linkedin.com/in/alice");
  });
});

// ─── Filter Preparation (tested via countLeads) ─────────

describe("filter preparation via countLeads", () => {
  it("transforms job_titles to title.include", async () => {
    mockFetchOnce({ number_of_leads: 42 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, job_titles: ["CTO", "VP Engineering"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.title).toEqual({ include: ["CTO", "VP Engineering"] });
  });

  it("transforms industries to industry.include", async () => {
    mockFetchOnce({ number_of_leads: 10 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, industries: ["Business Services"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.industry).toEqual({ include: ["Business Services"] });
  });

  it("transforms sub_industries to subIndustry.include", async () => {
    mockFetchOnce({ number_of_leads: 5 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, sub_industries: ["SaaS"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.subIndustry).toEqual({ include: ["SaaS"] });
  });

  it("transforms employee_count to employeeCount (camelCase)", async () => {
    mockFetchOnce({ number_of_leads: 100 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, employee_count: ["0 - 25", "25 - 100"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.employeeCount).toEqual(["0 - 25", "25 - 100"]);
  });

  it("maps revenue values through REVENUE_TO_API", async () => {
    mockFetchOnce({ number_of_leads: 20 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, revenue: ["$1M - 10M", "$10M - 50M"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.revenue).toEqual(["$1 - 10M", "$10 - 50M"]);
  });

  it("NEVER sends level to API — converts to title instead", async () => {
    mockFetchOnce({ number_of_leads: 30 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, level: ["C-Level"], department: ["Sales"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.level).toBeUndefined();
    expect(body.search_filters.title).toBeDefined();
    expect(body.search_filters.title.include).toContain("Chief Revenue Officer");
  });

  it("does not convert level to title when job_titles already present", async () => {
    mockFetchOnce({ number_of_leads: 30 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, level: ["C-Level"], job_titles: ["CEO"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.title).toEqual({ include: ["CEO"] });
  });

  it("transforms keyword_filter to object format", async () => {
    mockFetchOnce({ number_of_leads: 15 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, keyword_filter: "machine learning" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.keyword_filter).toEqual({ include: "machine learning" });
  });

  it("transforms lookalike_domain to look_alike", async () => {
    mockFetchOnce({ number_of_leads: 50 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, lookalike_domain: "stripe.com" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.look_alike).toBe("stripe.com");
    expect(body.search_filters.lookalike_domain).toBeUndefined();
  });

  it("transforms company_names to company_name", async () => {
    mockFetchOnce({ number_of_leads: 5 });

    await countLeads(API_KEY, {
      ...EMPTY_FILTERS, company_names: { include: ["Stripe"], exclude: ["Stripe Atlas"] },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.company_name).toEqual({
      include: ["Stripe"],
      exclude: ["Stripe Atlas"],
    });
  });

  it("resolves string locations to place_id objects", async () => {
    mockFetchOnce({ number_of_leads: 200 });

    const result = await countLeads(API_KEY, { ...EMPTY_FILTERS, locations: ["France", "Germany"] });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.locations).toHaveLength(2);
    expect(body.search_filters.locations[0]).toHaveProperty("place_id");
    expect(body.search_filters.locations[0]).toHaveProperty("label");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns on unresolvable locations", async () => {
    mockFetchOnce({ number_of_leads: 0 });

    const result = await countLeads(API_KEY, { ...EMPTY_FILTERS, locations: ["Narnia", "France"] });

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("Narnia");
  });

  it("transforms location_filter_type company_hq to company", async () => {
    mockFetchOnce({ number_of_leads: 10 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, location_filter_type: "company_hq" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.location_mode).toBe("company");
  });

  it("passes through names.include as name array", async () => {
    mockFetchOnce({ number_of_leads: 2 });

    await countLeads(API_KEY, { ...EMPTY_FILTERS, names: { include: ["John", "Jane"] } });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.search_filters.name).toEqual(["John", "Jane"]);
  });

  it("sends Authorization header with Bearer token", async () => {
    mockFetchOnce({ number_of_leads: 0 });

    await countLeads(API_KEY, EMPTY_FILTERS);

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${API_KEY}`);
  });
});

// ─── Count / Preview Response ────────────────────────────

describe("countLeads", () => {
  it("extracts count from number_of_leads", async () => {
    mockFetchOnce({ number_of_leads: 1234 });
    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(1234);
  });

  it("falls back to count field", async () => {
    mockFetchOnce({ count: 56 });
    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(56);
  });

  it("falls back to total_count field", async () => {
    mockFetchOnce({ total_count: 78 });
    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(78);
  });

  it("returns 0 when no count fields present", async () => {
    mockFetchOnce({});
    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(0);
  });
});

describe("previewLeads", () => {
  it("returns leads array from response", async () => {
    mockFetchOnce({
      number_of_leads: 2,
      leads: [
        { firstName: "Alice", jobTitle: "CTO" },
        { firstName: "Bob", jobTitle: "VP" },
      ],
    });

    const result = await previewLeads(API_KEY, EMPTY_FILTERS);
    expect(result.leads).toHaveLength(2);
    expect(result.leads[0].firstName).toBe("Alice");
  });

  it("returns empty array when no leads in response", async () => {
    mockFetchOnce({ number_of_leads: 0 });
    const result = await previewLeads(API_KEY, EMPTY_FILTERS);
    expect(result.leads).toEqual([]);
  });
});

// ─── Retry Logic ─────────────────────────────────────────

describe("retry logic", () => {
  it("retries on 429 and succeeds", async () => {
    mockFetchSequence([
      { body: "rate limited", status: 429 },
      { body: { number_of_leads: 10 }, status: 200 },
    ]);

    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(10);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 500 and succeeds", async () => {
    mockFetchSequence([
      { body: "server error", status: 500 },
      { body: { number_of_leads: 5 }, status: 200 },
    ]);

    const result = await countLeads(API_KEY, EMPTY_FILTERS);
    expect(result.count).toBe(5);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries exhausted", async () => {
    mockFetchSequence([
      { body: "error", status: 429 },
      { body: "error", status: 429 },
      { body: "error", status: 429 },
    ]);

    await expect(countLeads(API_KEY, EMPTY_FILTERS)).rejects.toThrow("[Instantly]");
  });

  it("does not retry on 4xx (non-429)", async () => {
    mockFetchOnce("forbidden", 403);

    await expect(countLeads(API_KEY, EMPTY_FILTERS)).rejects.toThrow("403");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// ─── Campaign Operations ─────────────────────────────────

describe("createCampaign", () => {
  it("formats steps with variants from subjects array", async () => {
    mockFetchOnce({ id: "camp-1", name: "Test", status: 0 });

    await createCampaign(API_KEY, {
      name: "Test Campaign",
      steps: [
        { subject: "Primary", subjects: ["Primary", "Alt A", "Alt B"], body: "Hello", delay: 0 },
        { subject: "Follow up", body: "Following up", delay: 3 },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const steps = body.sequences[0].steps;

    // Step 0: 3 variants (from subjects array)
    expect(steps[0].variants).toHaveLength(3);
    expect(steps[0].variants[0].subject).toBe("Primary");
    expect(steps[0].variants[1].subject).toBe("Alt A");
    expect(steps[0].variants[2].subject).toBe("Alt B");
    expect(steps[0].delay).toBe(0);
    expect(steps[0].type).toBe("email");
    expect(steps[0].delay_unit).toBe("days");

    // Step 1: 1 variant (fallback to subject)
    expect(steps[1].variants).toHaveLength(1);
    expect(steps[1].variants[0].subject).toBe("Follow up");
    expect(steps[1].delay).toBe(3);
  });

  it("uses default schedule when none provided", async () => {
    mockFetchOnce({ id: "camp-2", name: "Test", status: 0 });

    await createCampaign(API_KEY, {
      name: "Test",
      steps: [{ body: "Hi" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.campaign_schedule).toBeDefined();
    expect(body.campaign_schedule.schedules[0].timezone).toBe("Europe/Sarajevo");
    expect(body.campaign_schedule.schedules[0].timing).toEqual({ from: "09:00", to: "17:00" });
  });

  it("uses default delay of 3 days for non-first steps", async () => {
    mockFetchOnce({ id: "camp-3", name: "Test", status: 0 });

    await createCampaign(API_KEY, {
      name: "Test",
      steps: [
        { body: "Step 0" },
        { body: "Step 1" },
      ],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const steps = body.sequences[0].steps;
    expect(steps[0].delay).toBe(0); // first step
    expect(steps[1].delay).toBe(3); // default for non-first
  });
});

describe("getCampaign", () => {
  it("returns campaign data", async () => {
    mockFetchOnce({ id: "camp-1", name: "My Campaign", status: 1 });
    const result = await getCampaign(API_KEY, "camp-1");
    expect(result.id).toBe("camp-1");
    expect(result.name).toBe("My Campaign");
    expect(result.status).toBe(1);
  });
});

describe("activateCampaign", () => {
  it("calls POST /campaigns/{id}/activate", async () => {
    mockFetchOnce({});
    await activateCampaign(API_KEY, "camp-1");
    expect(fetchMock.mock.calls[0][0]).toContain("/campaigns/camp-1/activate");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });
});

describe("pauseCampaign", () => {
  it("calls POST /campaigns/{id}/pause", async () => {
    mockFetchOnce({});
    await pauseCampaign(API_KEY, "camp-1");
    expect(fetchMock.mock.calls[0][0]).toContain("/campaigns/camp-1/pause");
  });
});

// ─── Campaign Pagination ─────────────────────────────────

describe("listCampaigns", () => {
  it("paginates through all campaigns", async () => {
    mockFetchSequence([
      {
        body: {
          items: [{ id: "c1", name: "Camp 1", status: 1 }],
          next_starting_after: "c1",
        },
      },
      {
        body: {
          items: [{ id: "c2", name: "Camp 2", status: 1 }],
          // no next_starting_after → last page
        },
      },
    ]);

    const result = await listCampaigns(API_KEY);
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c1");
    expect(result[1].id).toBe("c2");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when no campaigns", async () => {
    mockFetchOnce({ items: [] });
    const result = await listCampaigns(API_KEY);
    expect(result).toEqual([]);
  });
});

describe("listAccounts", () => {
  it("paginates through all accounts", async () => {
    mockFetchSequence([
      {
        body: {
          items: [{ email: "acc1@mail.com", status: 1, warmup_status: 1, provider_code: 1 }],
          next_starting_after: "acc1",
        },
      },
      {
        body: {
          items: [{ email: "acc2@mail.com", status: 1, warmup_status: 0, provider_code: 2 }],
        },
      },
    ]);

    const result = await listAccounts(API_KEY);
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("acc1@mail.com");
  });
});

// ─── Campaign Analytics ──────────────────────────────────

describe("getCampaignAnalytics", () => {
  it("extracts first item from array response", async () => {
    mockFetchOnce([
      { campaign_id: "c1", total_leads: 100, emails_sent: 80, replied: 10, bounced: 3 },
    ]);

    const result = await getCampaignAnalytics(API_KEY, "c1");
    expect(result.total_leads).toBe(100);
    expect(result.emails_sent).toBe(80);
    expect(result.replied).toBe(10);
  });

  it("handles single object response (non-array)", async () => {
    mockFetchOnce({
      campaign_id: "c1",
      total_leads: 50,
      emails_sent: 40,
      replied: 5,
      bounced: 1,
    });

    const result = await getCampaignAnalytics(API_KEY, "c1");
    expect(result.total_leads).toBe(50);
  });

  it("throws when no analytics found", async () => {
    mockFetchOnce([]);
    await expect(getCampaignAnalytics(API_KEY, "c1")).rejects.toThrow("No analytics found");
  });
});

describe("getCampaignStepAnalytics", () => {
  it("normalizes { steps: [...] } response shape", async () => {
    mockFetchOnce({
      steps: [
        { step: 0, sent: 100, opened: 60, replied: 10, bounced: 2 },
        { step: 1, sent: 80, opened: 40, replied: 5, bounced: 1 },
      ],
    });

    const result = await getCampaignStepAnalytics(API_KEY, "c1");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0]).toEqual({ step: 0, sent: 100, opened: 60, replied: 10, bounced: 2 });
  });

  it("handles raw array response (no wrapper)", async () => {
    mockFetchOnce([
      { step_number: 0, emails_sent: 50, emails_read: 30, replies: 5, bounces: 2 },
    ]);

    const result = await getCampaignStepAnalytics(API_KEY, "c1");
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toEqual({ step: 0, sent: 50, opened: 30, replied: 5, bounced: 2 });
  });

  it("handles alternate field names in response", async () => {
    mockFetchOnce({
      steps: [
        { step_number: 1, emails_sent: 20, emails_opened: 15, replies: 3, bounces: 0 },
      ],
    });

    const result = await getCampaignStepAnalytics(API_KEY, "c1");
    expect(result.steps[0]).toEqual({ step: 1, sent: 20, opened: 15, replied: 3, bounced: 0 });
  });

  it("returns empty steps when no data", async () => {
    mockFetchOnce({});
    const result = await getCampaignStepAnalytics(API_KEY, "c1");
    expect(result.steps).toEqual([]);
  });
});

// ─── Leads ───────────────────────────────────────────────

describe("listLeads", () => {
  it("returns items and pagination cursor", async () => {
    mockFetchOnce({
      items: [
        { id: "l1", email: "a@b.com" },
        { id: "l2", email: "c@d.com" },
      ],
      next_starting_after: "l2",
    });

    const result = await listLeads(API_KEY, { campaignId: "c1" });
    expect(result.items).toHaveLength(2);
    expect(result.nextStartingAfter).toBe("l2");
  });

  it("sends correct body params", async () => {
    mockFetchOnce({ items: [] });

    await listLeads(API_KEY, { listId: "list-1", limit: 50, startingAfter: "cursor-abc" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.list_id).toBe("list-1");
    expect(body.limit).toBe(50);
    expect(body.starting_after).toBe("cursor-abc");
  });

  it("defaults limit to 100", async () => {
    mockFetchOnce({ items: [] });
    await listLeads(API_KEY, {});

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.limit).toBe(100);
  });
});

describe("createLead", () => {
  it("maps camelCase params to snake_case body", async () => {
    mockFetchOnce({ id: "new-lead", email: "test@test.com" });

    await createLead(API_KEY, {
      email: "test@test.com",
      firstName: "Test",
      lastName: "User",
      companyName: "Corp",
      campaign: "camp-1",
      customVariables: { key1: "val1" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe("test@test.com");
    expect(body.first_name).toBe("Test");
    expect(body.last_name).toBe("User");
    expect(body.company_name).toBe("Corp");
    expect(body.campaign).toBe("camp-1");
    expect(body.custom_variables).toEqual({ key1: "val1" });
  });
});

describe("updateLead", () => {
  it("maps camelCase data to snake_case body", async () => {
    mockFetchOnce({ id: "l1", email: "test@test.com" });

    await updateLead(API_KEY, "l1", {
      firstName: "Updated",
      ltInterestStatus: 1,
      customVariables: { v2: "subject2" },
    });

    expect(fetchMock.mock.calls[0][0]).toContain("/leads/l1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.first_name).toBe("Updated");
    expect(body.lt_interest_status).toBe(1);
  });
});

describe("deleteLead", () => {
  it("calls DELETE /leads/{id}", async () => {
    mockFetchOnce({});
    await deleteLead(API_KEY, "l1");
    expect(fetchMock.mock.calls[0][0]).toContain("/leads/l1");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("addLeadsToCampaign", () => {
  it("sends lead_ids and campaign_id", async () => {
    mockFetchOnce({});
    await addLeadsToCampaign(API_KEY, { leadIds: ["l1", "l2"], campaignId: "c1" });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.lead_ids).toEqual(["l1", "l2"]);
    expect(body.campaign_id).toBe("c1");
  });
});

describe("updateLeadInterestStatus", () => {
  it("sends correct body", async () => {
    mockFetchOnce({});
    await updateLeadInterestStatus(API_KEY, { leadId: "l1", interestStatus: 1 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.lead_id).toBe("l1");
    expect(body.interest_status).toBe(1);
  });
});

// ─── Leads with Performance ──────────────────────────────

describe("getLeadsWithPerformance", () => {
  it("maps raw lead fields to LeadWithPerformance", async () => {
    mockFetchOnce({
      items: [
        {
          id: "l1",
          email: "alice@corp.com",
          email_open_count: 3,
          email_reply_count: 1,
          email_click_count: 2,
          lt_interest_status: 1,
          timestamp_last_open: "2026-03-10T10:00:00Z",
          timestamp_last_reply: "2026-03-10T12:00:00Z",
        },
      ],
    });

    const result = await getLeadsWithPerformance(API_KEY, "c1");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      id: "l1",
      email: "alice@corp.com",
      openCount: 3,
      replyCount: 1,
      clickCount: 2,
      interestStatus: 1,
      lastOpenAt: "2026-03-10T10:00:00Z",
      lastReplyAt: "2026-03-10T12:00:00Z",
    });
  });

  it("defaults missing performance fields to 0/null", async () => {
    mockFetchOnce({
      items: [{ id: "l2", email: "bob@corp.com" }],
    });

    const result = await getLeadsWithPerformance(API_KEY, "c1");
    expect(result.items[0].openCount).toBe(0);
    expect(result.items[0].replyCount).toBe(0);
    expect(result.items[0].clickCount).toBe(0);
    expect(result.items[0].interestStatus).toBeNull();
    expect(result.items[0].lastOpenAt).toBeNull();
  });
});

// ─── Emails ──────────────────────────────────────────────

describe("getEmails", () => {
  it("builds correct query string", async () => {
    mockFetchOnce({ items: [], next_starting_after: undefined });

    await getEmails(API_KEY, {
      campaign_id: "c1",
      email_type: "1",
      is_unread: true,
      lead: "alice@test.com",
      limit: 50,
      starting_after: "cursor-xyz",
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("campaign_id=c1");
    expect(url).toContain("email_type=1");
    expect(url).toContain("is_unread=1");
    expect(url).toContain("lead=alice%40test.com");
    expect(url).toContain("limit=50");
    expect(url).toContain("starting_after=cursor-xyz");
  });

  it("defaults limit to 25", async () => {
    mockFetchOnce({ items: [] });

    await getEmails(API_KEY, {});

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=25");
  });

  it("sets is_unread=0 for false", async () => {
    mockFetchOnce({ items: [] });

    await getEmails(API_KEY, { is_unread: false });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("is_unread=0");
  });
});

// ─── Enrichment Status ───────────────────────────────────

describe("getEnrichmentStatus", () => {
  it("normalizes snake_case response", async () => {
    mockFetchOnce({ in_progress: true, exists: true, enrichment_payload: { data: "test" } });

    const result = await getEnrichmentStatus(API_KEY, "resource-1");
    expect(result.inProgress).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.enrichmentPayload).toEqual({ data: "test" });
  });

  it("handles camelCase response", async () => {
    mockFetchOnce({ inProgress: false, exists: true });

    const result = await getEnrichmentStatus(API_KEY, "resource-2");
    expect(result.inProgress).toBe(false);
  });

  it("defaults to false when fields missing", async () => {
    mockFetchOnce({});

    const result = await getEnrichmentStatus(API_KEY, "resource-3");
    expect(result.inProgress).toBe(false);
    expect(result.exists).toBe(false);
  });
});

// ─── Source Leads ────────────────────────────────────────

describe("sourceLeads", () => {
  it("sends enrichment options at top level", async () => {
    mockFetchOnce({ id: "s1", resource_id: "res-1" });

    await sourceLeads(API_KEY, {
      searchFilters: { ...EMPTY_FILTERS, job_titles: ["CTO"] },
      limit: 50,
      searchName: "My Search",
      listName: "My List",
      enrichment: { work_email_enrichment: true, fully_enriched_profile: true },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.work_email_enrichment).toBe(true);
    expect(body.fully_enriched_profile).toBe(true);
    expect(body.limit).toBe(50);
    expect(body.search_name).toBe("My Search");
    expect(body.list_name).toBe("My List");
  });

  it("normalizes resource_id from response", async () => {
    mockFetchOnce({ id: "s1", resource_id: "res-abc" });

    const result = await sourceLeads(API_KEY, {
      searchFilters: EMPTY_FILTERS,
      limit: 10,
      searchName: "Test",
      listName: "Test List",
    });

    expect(result.resourceId).toBe("res-abc");
  });

  it("defaults to work_email_enrichment when no enrichment options", async () => {
    mockFetchOnce({ id: "s2", resource_id: "res-2" });

    await sourceLeads(API_KEY, {
      searchFilters: EMPTY_FILTERS,
      limit: 10,
      searchName: "Test",
      listName: "Test List",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.work_email_enrichment).toBe(true);
  });
});
