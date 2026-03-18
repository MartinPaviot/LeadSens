import { describe, it, expect } from "vitest";
import {
  getConnectorConfig,
  getConnectorsByCategory,
  getAllConnectors,
  getConnectableConnectors,
  getAllConnectorMetas,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
} from "@/server/lib/integrations/registry";
import type { ConnectorCategory } from "@/server/lib/integrations/types";

describe("Integration Registry", () => {
  // ─── Basic structure ───────────────────────────────────

  it("has at least 50 connectors", () => {
    expect(getAllConnectors().length).toBeGreaterThanOrEqual(50);
  });

  it("all connectors have required fields", () => {
    for (const c of getAllConnectors()) {
      expect(c.id).toBeTruthy();
      expect(c.name).toBeTruthy();
      expect(c.category).toBeTruthy();
      expect(c.authMethod).toBeTruthy();
      expect(c.providerInterface).toBeTruthy();
      expect([1, 2, 3]).toContain(c.tier);
    }
  });

  it("all connector IDs are unique", () => {
    const ids = getAllConnectors().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("IDs are uppercase", () => {
    for (const c of getAllConnectors()) {
      expect(c.id).toBe(c.id.toUpperCase());
    }
  });

  // ─── Existing 6 integrations ──────────────────────────

  const EXISTING_IDS = [
    "INSTANTLY",
    "SMARTLEAD",
    "LEMLIST",
    "APOLLO",
    "ZEROBOUNCE",
    "HUBSPOT",
  ];

  it("all 6 existing integrations are tier 1", () => {
    for (const id of EXISTING_IDS) {
      const config = getConnectorConfig(id);
      expect(config, `${id} not found in registry`).toBeDefined();
      expect(config!.tier).toBe(1);
    }
  });

  it("existing API key integrations have testConnection", () => {
    const apiKeyIds = ["INSTANTLY", "SMARTLEAD", "LEMLIST", "APOLLO", "ZEROBOUNCE"];
    for (const id of apiKeyIds) {
      const config = getConnectorConfig(id);
      expect(config?.testConnection, `${id} missing testConnection`).toBeTypeOf("function");
    }
  });

  it("HubSpot uses composio auth method", () => {
    const hubspot = getConnectorConfig("HUBSPOT");
    expect(hubspot?.authMethod).toBe("composio");
  });

  // ─── Phase 1A connectors (6 new) ─────────────────────

  const PHASE_1A_IDS = [
    "NEVERBOUNCE",
    "DEBOUNCE",
    "MILLIONVERIFIER",
    "WOODPECKER",
    "MAILSHAKE",
    "REPLY_IO",
  ];

  it("all 6 Phase 1A connectors are tier 2", () => {
    for (const id of PHASE_1A_IDS) {
      const config = getConnectorConfig(id);
      expect(config, `${id} not found in registry`).toBeDefined();
      expect(config!.tier, `${id} should be tier 2`).toBe(2);
    }
  });

  it("Phase 1A connectors have testConnection", () => {
    for (const id of PHASE_1A_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.testConnection, `${id} missing testConnection`).toBeTypeOf("function");
    }
  });

  it("Phase 1A connectors have api_key auth method", () => {
    for (const id of PHASE_1A_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.authMethod, `${id} should be api_key`).toBe("api_key");
    }
  });

  it("Phase 1A connectors have placeholder text", () => {
    for (const id of PHASE_1A_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.placeholder, `${id} missing placeholder`).toBeTruthy();
    }
  });

  it("getConnectableConnectors includes Phase 1A", () => {
    const connectable = getConnectableConnectors();
    const ids = connectable.map((c) => c.id);
    for (const id of PHASE_1A_IDS) {
      expect(ids, `${id} should be connectable`).toContain(id);
    }
  });

  it("getConnectableConnectors returns at least 12", () => {
    const connectable = getConnectableConnectors();
    expect(connectable.length).toBeGreaterThanOrEqual(12);
  });

  // ─── Phase 1B — Email Sending expansion (4 new) ─────

  const PHASE_1B_ESP_IDS = [
    "SALESHANDY",
    "QUICKMAIL",
    "KLENTY",
  ];

  it("all 3 Phase 1B ESP connectors exist in registry", () => {
    for (const id of PHASE_1B_ESP_IDS) {
      const config = getConnectorConfig(id);
      expect(config, `${id} not found in registry`).toBeDefined();
    }
  });

  it("Phase 1B ESP connectors are tier 2", () => {
    for (const id of PHASE_1B_ESP_IDS) {
      const config = getConnectorConfig(id);
      expect(config!.tier, `${id} should be tier 2`).toBe(2);
    }
  });

  it("Phase 1B ESP connectors have api_key auth method", () => {
    for (const id of PHASE_1B_ESP_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.authMethod, `${id} should be api_key`).toBe("api_key");
    }
  });

  it("Phase 1B ESP connectors have testConnection", () => {
    for (const id of PHASE_1B_ESP_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.testConnection, `${id} missing testConnection`).toBeTypeOf("function");
    }
  });

  it("Phase 1B ESP connectors have placeholder text", () => {
    for (const id of PHASE_1B_ESP_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.placeholder, `${id} missing placeholder`).toBeTruthy();
    }
  });

  it("getConnectableConnectors includes Phase 1B", () => {
    const connectable = getConnectableConnectors();
    const ids = connectable.map((c) => c.id);
    for (const id of PHASE_1B_ESP_IDS) {
      expect(ids, `${id} should be connectable`).toContain(id);
    }
  });

  it("at least 9 ESP tools are connectable via api_key", () => {
    const espConnectors = getConnectorsByCategory("esp");
    const connectable = espConnectors.filter((c) => c.authMethod === "api_key");
    // Instantly, Smartlead, Lemlist, Woodpecker, Mailshake, Reply.io, SalesHandy, QuickMail, Klenty
    // + Salesloft, GMass, Snov.io = 12 total
    expect(connectable.length).toBeGreaterThanOrEqual(12);
  });

  // ─── Phase 1C — Market expansion (3 new) ──────────────

  const PHASE_1C_IDS = [
    "SALESLOFT",
    "GMASS",
    "SNOV_IO",
  ];

  it("all 3 Phase 1C ESP connectors exist in registry", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config, `${id} not found in registry`).toBeDefined();
    }
  });

  it("Phase 1C connectors are tier 2", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config!.tier, `${id} should be tier 2`).toBe(2);
    }
  });

  it("Phase 1C connectors have api_key auth method", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.authMethod, `${id} should be api_key`).toBe("api_key");
    }
  });

  it("Phase 1C connectors have testConnection", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.testConnection, `${id} missing testConnection`).toBeTypeOf("function");
    }
  });

  it("Phase 1C connectors have placeholder text", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.placeholder, `${id} missing placeholder`).toBeTruthy();
    }
  });

  it("Phase 1C connectors are in esp category", () => {
    for (const id of PHASE_1C_IDS) {
      const config = getConnectorConfig(id);
      expect(config?.category, `${id} should be in esp category`).toBe("esp");
    }
  });

  it("getConnectableConnectors includes Phase 1C", () => {
    const connectable = getConnectableConnectors();
    const ids = connectable.map((c) => c.id);
    for (const id of PHASE_1C_IDS) {
      expect(ids, `${id} should be connectable`).toContain(id);
    }
  });

  it("Outreach is oauth and Salesforge is coming_soon", () => {
    const outreach = getConnectorConfig("OUTREACH");
    expect(outreach).toBeDefined();
    expect(outreach!.authMethod).toBe("oauth");
    expect(outreach!.category).toBe("esp");
    expect(outreach!.oauthConfig).toBeDefined();

    const salesforge = getConnectorConfig("SALESFORGE");
    expect(salesforge).toBeDefined();
    expect(salesforge!.authMethod).toBe("coming_soon");
    expect(salesforge!.category).toBe("esp");
  });

  it("getConnectableConnectors returns at least 25", () => {
    const connectable = getConnectableConnectors();
    // 19 onboarding tools + existing tier 2 connectors
    expect(connectable.length).toBeGreaterThanOrEqual(25);
  });

  it("all 19 onboarding tools are connectable (zero coming_soon)", () => {
    const onboardingIds = [
      "INSTANTLY", "LEMLIST", "SMARTLEAD", "REPLY_IO", "OUTREACH",
      "APOLLO", "ZOOMINFO", "SEAMLESS_AI", "LUSHA",
      "ZEROBOUNCE", "MILLIONVERIFIER",
      "HUBSPOT", "SALESFORCE", "PIPEDRIVE",
      "CALENDLY", "SLACK",
      "CSV", "AIRTABLE", "NOTION",
    ];
    for (const id of onboardingIds) {
      const config = getConnectorConfig(id);
      expect(config, `${id} should exist in registry`).toBeDefined();
      expect(config!.authMethod, `${id} should not be coming_soon`).not.toBe("coming_soon");
    }
  });

  // ─── Categories ───────────────────────────────────────

  it("CATEGORY_ORDER covers all categories in registry", () => {
    const categories = new Set(getAllConnectors().map((c) => c.category));
    for (const cat of categories) {
      expect(CATEGORY_ORDER).toContain(cat);
    }
  });

  it("CATEGORY_LABELS has a label for every category in CATEGORY_ORDER", () => {
    for (const cat of CATEGORY_ORDER) {
      expect(CATEGORY_LABELS[cat]).toBeTruthy();
    }
  });

  it("getConnectorsByCategory returns only matching connectors", () => {
    const espConnectors = getConnectorsByCategory("esp");
    expect(espConnectors.length).toBeGreaterThanOrEqual(3);
    for (const c of espConnectors) {
      expect(c.category).toBe("esp");
    }
  });

  // ─── Connectable filter ───────────────────────────────

  it("getConnectableConnectors excludes coming_soon", () => {
    const connectable = getConnectableConnectors();
    for (const c of connectable) {
      expect(c.authMethod).not.toBe("coming_soon");
    }
  });

  it("all 6 existing are connectable", () => {
    const connectable = getConnectableConnectors();
    const ids = connectable.map((c) => c.id);
    for (const id of EXISTING_IDS) {
      expect(ids).toContain(id);
    }
  });

  // ─── Client-safe serialization ────────────────────────

  it("getAllConnectorMetas strips testConnection", () => {
    const metas = getAllConnectorMetas();
    for (const m of metas) {
      expect(m).not.toHaveProperty("testConnection");
      expect(m).not.toHaveProperty("baseUrl");
      expect(m).not.toHaveProperty("capabilities");
    }
  });

  it("getAllConnectorMetas preserves display fields", () => {
    const metas = getAllConnectorMetas();
    const instantly = metas.find((m) => m.id === "INSTANTLY");
    expect(instantly).toBeDefined();
    expect(instantly!.name).toBe("Instantly");
    expect(instantly!.category).toBe("esp");
    expect(instantly!.brandColor).toBe("#3B82F6");
    expect(instantly!.placeholder).toBe("Instantly API V2 Key");
  });

  // ─── Lookup ───────────────────────────────────────────

  it("getConnectorConfig returns undefined for unknown ID", () => {
    expect(getConnectorConfig("NONEXISTENT")).toBeUndefined();
  });

  it("getConnectorConfig is case-sensitive", () => {
    expect(getConnectorConfig("instantly")).toBeUndefined();
    expect(getConnectorConfig("INSTANTLY")).toBeDefined();
  });

  // ─── Provider interface mapping ───────────────────────

  it("ESP connectors map to esp provider interface", () => {
    const espConnectors = getConnectorsByCategory("esp");
    for (const c of espConnectors) {
      expect(c.providerInterface).toBe("esp");
    }
  });

  it("CRM connectors map to crm provider interface", () => {
    const crmConnectors = getConnectorsByCategory("crm");
    for (const c of crmConnectors) {
      expect(c.providerInterface).toBe("crm");
    }
  });

  it("email verification connectors map to email_verifier interface", () => {
    const verifiers = getConnectorsByCategory("email_verification");
    for (const c of verifiers) {
      expect(c.providerInterface).toBe("email_verifier");
    }
  });
});
