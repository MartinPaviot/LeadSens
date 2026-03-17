import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock fetch for Instantly API calls ──────────────────

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ─── Mock logger ─────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ─── Import after mocks ─────────────────────────────────

import { createInstantlyESP } from "@/server/lib/connectors/instantly-esp";
import { createSmartleadESP } from "@/server/lib/connectors/smartlead";
import { createLemlistESP } from "@/server/lib/connectors/lemlist";
import type { ESPProvider } from "@/server/lib/providers/esp-provider";

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Instantly disableVariant ────────────────────────────

describe("InstantlyESP.disableVariant", () => {
  function makeESP(): ESPProvider {
    return createInstantlyESP("test-api-key");
  }

  function mockGetCampaign(sequences: unknown): void {
    // getCampaign is a GET request to the Instantly API
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "camp-1", sequences }),
    });
  }

  function mockUpdateCampaign(): void {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "camp-1" }),
    });
  }

  it("disables variant at step 0 by setting v_disabled: true", async () => {
    const sequences = [
      {
        steps: [
          {
            subject: "Primary",
            body: "body",
            variants: [
              { subject: "Primary", body: "body", v_disabled: false },
              { subject: "Variant B", body: "body B", v_disabled: false },
              { subject: "Variant C", body: "body C", v_disabled: false },
            ],
          },
        ],
      },
    ];

    mockGetCampaign(sequences);
    mockUpdateCampaign();

    const esp = makeESP();
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(true);

    // Verify PATCH call includes v_disabled: true for variant 1
    const patchCall = mockFetch.mock.calls[1];
    const patchBody = JSON.parse(patchCall[1].body);
    const updatedVariants = patchBody.sequences[0].steps[0].variants;
    expect(updatedVariants[0].v_disabled).toBe(false);
    expect(updatedVariants[1].v_disabled).toBe(true);
    expect(updatedVariants[2].v_disabled).toBe(false);
  });

  it("only disables variant in the specified step", async () => {
    const sequences = [
      {
        steps: [
          {
            variants: [
              { subject: "S0-A", body: "b", v_disabled: false },
              { subject: "S0-B", body: "b", v_disabled: false },
            ],
          },
          {
            variants: [
              { subject: "S1-A", body: "b", v_disabled: false },
              { subject: "S1-B", body: "b", v_disabled: false },
            ],
          },
        ],
      },
    ];

    mockGetCampaign(sequences);
    mockUpdateCampaign();

    const esp = makeESP();
    await esp.disableVariant("camp-1", 0, 1);

    const patchBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    // Step 0, variant 1 disabled
    expect(patchBody.sequences[0].steps[0].variants[1].v_disabled).toBe(true);
    // Step 1, variant 1 NOT disabled
    expect(patchBody.sequences[0].steps[1].variants[1].v_disabled).toBe(false);
  });

  it("returns false when campaign has no sequences", async () => {
    mockGetCampaign(null);

    const esp = makeESP();
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(false);
  });

  it("returns false when campaign has empty sequences", async () => {
    mockGetCampaign([{ steps: undefined }]);

    const esp = makeESP();
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(false);
  });

  it("returns false when API call fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const esp = makeESP();
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(false);
  });

  it("preserves existing v_disabled state on other variants", async () => {
    const sequences = [
      {
        steps: [
          {
            variants: [
              { subject: "A", body: "b", v_disabled: true }, // already disabled
              { subject: "B", body: "b", v_disabled: false },
            ],
          },
        ],
      },
    ];

    mockGetCampaign(sequences);
    mockUpdateCampaign();

    const esp = makeESP();
    await esp.disableVariant("camp-1", 0, 1);

    const patchBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    // Variant 0 keeps its existing v_disabled: true
    expect(patchBody.sequences[0].steps[0].variants[0].v_disabled).toBe(true);
    expect(patchBody.sequences[0].steps[0].variants[1].v_disabled).toBe(true);
  });

  it("handles missing v_disabled field (defaults to false)", async () => {
    const sequences = [
      {
        steps: [
          {
            variants: [
              { subject: "A", body: "b" }, // no v_disabled field
              { subject: "B", body: "b" },
            ],
          },
        ],
      },
    ];

    mockGetCampaign(sequences);
    mockUpdateCampaign();

    const esp = makeESP();
    await esp.disableVariant("camp-1", 0, 0);

    const patchBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(patchBody.sequences[0].steps[0].variants[0].v_disabled).toBe(true);
    expect(patchBody.sequences[0].steps[0].variants[1].v_disabled).toBe(false);
  });
});

// ─── Smartlead disableVariant ────────────────────────────

describe("SmartleadESP.disableVariant", () => {
  it("returns false (not supported)", async () => {
    const esp = createSmartleadESP("test-api-key");
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(false);
  });

  it("does not make any API calls", async () => {
    const esp = createSmartleadESP("test-api-key");
    await esp.disableVariant("camp-1", 0, 1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── Lemlist disableVariant ──────────────────────────────

describe("LemlistESP.disableVariant", () => {
  it("returns false (not supported)", async () => {
    const esp = createLemlistESP("test-api-key");
    const result = await esp.disableVariant("camp-1", 0, 1);
    expect(result).toBe(false);
  });

  it("does not make any API calls", async () => {
    const esp = createLemlistESP("test-api-key");
    await esp.disableVariant("camp-1", 0, 1);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ─── ESPProvider interface compliance ────────────────────

describe("ESPProvider interface compliance", () => {
  const providers: [string, () => ESPProvider][] = [
    ["Instantly", () => createInstantlyESP("test-key")],
    ["Smartlead", () => createSmartleadESP("test-key")],
    ["Lemlist", () => createLemlistESP("test-key")],
  ];

  it.each(providers)("%s implements disableVariant method", (_name, factory) => {
    const esp = factory();
    expect(typeof esp.disableVariant).toBe("function");
  });

  it.each(providers)("%s has correct name property", (_name, factory) => {
    const esp = factory();
    expect(["instantly", "smartlead", "lemlist"]).toContain(esp.name);
  });
});
