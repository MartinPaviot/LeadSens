/**
 * Provider Registry — Returns the right provider based on workspace integrations.
 *
 * Registry-driven: connectors are looked up from the integration registry.
 * Static connector maps ensure Next.js bundling works correctly.
 *
 * When COMPOSIO_API_KEY is set, Composio-backed connectors are preferred
 * for supported integrations (HubSpot, Salesforce, Pipedrive, Slack,
 * Calendly, Airtable, Notion, Lemlist). Custom connectors remain for
 * unsupported tools (Instantly, email verifiers, Lusha, scraping, etc.).
 *
 * ESP: Instantly, Smartlead, Lemlist
 * CRM: HubSpot, Pipedrive, Salesforce
 * Sourcing: Instantly (SuperSearch)
 * Verifier: ZeroBounce
 * Enrichment: Apollo (via getApolloApiKey)
 *
 * Usage:
 *   const esp = await getESPProvider(workspaceId);
 *   const campaign = await esp.createCampaign({ ... });
 */

import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { cacheGet, cacheSet, cacheInvalidatePattern } from "@/lib/cache";
import {
  getConnectorsByCategory,
  getConnectorConfig,
} from "@/server/lib/integrations/registry";
import { isComposioEnabled } from "@/server/lib/composio/client";
import type { ESPProvider } from "./esp-provider";
import type { SourcingProvider } from "./sourcing-provider";
import type { CRMProvider } from "./crm-provider";
import type { EmailVerifier } from "./email-verifier";
import type { EnrichmentProvider } from "./enrichment-provider";
import type { ExportProvider } from "./export-provider";
import type { SchedulingProvider } from "./scheduling-provider";
import type { NotificationProvider } from "./notification-provider";

// ─── Static connector maps (required for Next.js bundling) ──

type ConnectorFactory<T> = (apiKey: string, metadata?: Record<string, unknown> | null) => T | Promise<T>;

const ESP_CONNECTOR_MAP: Record<
  string,
  () => Promise<ConnectorFactory<ESPProvider>>
> = {
  INSTANTLY: () =>
    import("@/server/lib/connectors/instantly-esp").then(
      (m) => m.createInstantlyESP,
    ),
  SMARTLEAD: () =>
    import("@/server/lib/connectors/smartlead").then(
      (m) => m.createSmartleadESP,
    ),
  LEMLIST: () =>
    import("@/server/lib/connectors/lemlist").then((m) => m.createLemlistESP),
  WOODPECKER: () =>
    import("@/server/lib/connectors/woodpecker").then((m) => m.createWoodpeckerESP),
  MAILSHAKE: () =>
    import("@/server/lib/connectors/mailshake").then((m) => m.createMailshakeESP),
  REPLY_IO: () =>
    import("@/server/lib/connectors/reply-io").then((m) => m.createReplyIoESP),
  SALESHANDY: () =>
    import("@/server/lib/connectors/saleshandy").then((m) => m.createSaleshandyESP),
  QUICKMAIL: () =>
    import("@/server/lib/connectors/quickmail").then((m) => m.createQuickMailESP),
  KLENTY: () =>
    import("@/server/lib/connectors/klenty").then((m) => m.createKlentyESP),
  SALESLOFT: () =>
    import("@/server/lib/connectors/salesloft").then((m) => m.createSalesloftESP),
  GMASS: () =>
    import("@/server/lib/connectors/gmass").then((m) => m.createGmassESP),
  SNOV_IO: () =>
    import("@/server/lib/connectors/snov-io").then((m) => m.createSnovIoESP),
};

const SOURCING_CONNECTOR_MAP: Record<
  string,
  () => Promise<ConnectorFactory<SourcingProvider>>
> = {
  INSTANTLY: () =>
    import("@/server/lib/connectors/instantly-sourcing").then(
      (m) => m.createInstantlySourcing,
    ),
};

const CRM_CONNECTOR_MAP: Record<
  string,
  (workspaceId: string) => Promise<CRMProvider>
> = {
  HUBSPOT: async (workspaceId: string) => {
    const { createHubSpotCRM } = await import(
      "@/server/lib/connectors/hubspot-crm"
    );
    return createHubSpotCRM(workspaceId);
  },
  PIPEDRIVE: async (workspaceId: string) => {
    const { createPipedriveCRM } = await import(
      "@/server/lib/connectors/pipedrive-crm"
    );
    const integration = await getActiveIntegration(workspaceId, "PIPEDRIVE");
    if (!integration?.apiKey) throw new Error("Pipedrive not connected");
    return createPipedriveCRM(decryptApiKey(integration));
  },
  SALESFORCE: async (workspaceId: string) => {
    const { createSalesforceCRM } = await import(
      "@/server/lib/connectors/salesforce-crm"
    );
    return createSalesforceCRM(workspaceId);
  },
};

const VERIFIER_CONNECTOR_MAP: Record<
  string,
  () => Promise<ConnectorFactory<EmailVerifier>>
> = {
  ZEROBOUNCE: () =>
    import("@/server/lib/connectors/zerobounce").then(
      (m) => m.createZeroBounceVerifier,
    ),
  NEVERBOUNCE: () =>
    import("@/server/lib/connectors/neverbounce").then(
      (m) => m.createNeverBounceVerifier,
    ),
  DEBOUNCE: () =>
    import("@/server/lib/connectors/debounce").then(
      (m) => m.createDeBounceVerifier,
    ),
  MILLIONVERIFIER: () =>
    import("@/server/lib/connectors/millionverifier").then(
      (m) => m.createMillionVerifierVerifier,
    ),
};

// OAuth-based ESP connectors (need workspaceId, not apiKey)
// Reserved for future OAuth-based ESPs
const ESP_OAUTH_CONNECTOR_MAP: Record<
  string,
  (workspaceId: string) => Promise<ESPProvider>
> = {};

// OAuth-based Enrichment connectors
const ENRICHMENT_OAUTH_CONNECTOR_MAP: Record<
  string,
  (workspaceId: string) => Promise<EnrichmentProvider>
> = {
  ZOOMINFO: async (workspaceId: string) => {
    const { createZoomInfoEnrichment } = await import(
      "@/server/lib/connectors/zoominfo"
    );
    return createZoomInfoEnrichment(workspaceId);
  },
};

// ─── Composio-backed connector maps (workspaceId-based, no API key needed) ──
// When COMPOSIO_API_KEY is set, these are preferred over custom connectors.
// Composio manages credentials via its entity/connection system.

type ComposioFactory<T> = (workspaceId: string) => T | Promise<T>;

const COMPOSIO_CRM_MAP: Record<string, () => Promise<ComposioFactory<CRMProvider>>> = {
  HUBSPOT: () =>
    import("@/server/lib/connectors/hubspot-composio").then(
      (m) => m.createHubSpotComposioCRM,
    ),
  SALESFORCE: () =>
    import("@/server/lib/connectors/salesforce-composio").then(
      (m) => m.createSalesforceComposioCRM,
    ),
  PIPEDRIVE: () =>
    import("@/server/lib/connectors/pipedrive-composio").then(
      (m) => m.createPipedriveComposioCRM,
    ),
};

const COMPOSIO_ESP_MAP: Record<string, () => Promise<ComposioFactory<ESPProvider>>> = {
  LEMLIST: () =>
    import("@/server/lib/connectors/lemlist-composio").then(
      (m) => m.createLemlistComposioESP,
    ),
};

const COMPOSIO_EXPORT_MAP: Record<string, () => Promise<ComposioFactory<ExportProvider>>> = {
  AIRTABLE: () =>
    import("@/server/lib/connectors/airtable-composio").then(
      (m) => m.createAirtableComposioExport,
    ),
  NOTION: () =>
    import("@/server/lib/connectors/notion-composio").then(
      (m) => m.createNotionComposioExport,
    ),
  GOOGLE_SHEETS: () =>
    import("@/server/lib/connectors/google-sheets-composio").then(
      (m) => m.createGoogleSheetsComposioExport,
    ),
};

const COMPOSIO_SCHEDULING_MAP: Record<string, () => Promise<ComposioFactory<SchedulingProvider>>> = {
  CALENDLY: () =>
    import("@/server/lib/connectors/calendly-composio").then(
      (m) => m.createCalendlyComposioScheduling,
    ),
};

const COMPOSIO_NOTIFICATION_MAP: Record<string, () => Promise<ComposioFactory<NotificationProvider>>> = {
  SLACK: () =>
    import("@/server/lib/connectors/slack-composio").then(
      (m) => m.createSlackComposioNotification,
    ),
};

// ─── Integration loader ─────────────────────────────────

export async function getActiveIntegration(
  workspaceId: string,
  type: string,
) {
  // Check Redis cache first (5 min TTL — invalidated on connect/disconnect)
  const cacheKey = `integration:${workspaceId}:${type}`;
  const cached = await cacheGet<{ id: string; apiKey: string | null; type: string; metadata: unknown; status: string } | null>(cacheKey);
  if (cached !== null) {
    if (cached.status !== "ACTIVE") return null;
    return cached as typeof integration;
  }

  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type } },
  });

  // Cache the result (even null/inactive) for 5 minutes
  await cacheSet(cacheKey, integration, 300);

  if (!integration || integration.status !== "ACTIVE") return null;
  return integration;
}

/** Invalidate cached integrations for a workspace (call on connect/disconnect) */
export async function invalidateIntegrationCache(workspaceId: string): Promise<void> {
  await cacheInvalidatePattern(`integration:${workspaceId}:*`);
}

function decryptApiKey(integration: {
  apiKey: string | null;
  type: string;
}): string {
  if (!integration.apiKey) throw new Error(`No API key for ${integration.type}`);
  return decrypt(integration.apiKey);
}

// ─── ESP Provider Factory ────────────────────────────────

export async function getESPProvider(
  workspaceId: string,
): Promise<ESPProvider | null> {
  const useComposio = isComposioEnabled();
  const espConnectors = getConnectorsByCategory("esp");

  for (const connector of espConnectors) {
    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    // Composio-backed ESP connectors (Lemlist)
    if (useComposio && COMPOSIO_ESP_MAP[connector.id]) {
      const factory = await COMPOSIO_ESP_MAP[connector.id]();
      return factory(workspaceId);
    }

    // API-key-based connectors
    const factory = ESP_CONNECTOR_MAP[connector.id];
    if (factory) {
      const createFn = await factory();
      return createFn(decryptApiKey(integration), integration.metadata as Record<string, unknown> | null);
    }

    // OAuth-based connectors
    const oauthFactory = ESP_OAUTH_CONNECTOR_MAP[connector.id];
    if (oauthFactory) {
      return oauthFactory(workspaceId);
    }
  }
  return null;
}

/** Get ESP provider name for a workspace (without initializing) */
export async function getESPType(workspaceId: string): Promise<string | null> {
  const espConnectors = getConnectorsByCategory("esp");

  for (const connector of espConnectors) {
    if (!ESP_CONNECTOR_MAP[connector.id] && !ESP_OAUTH_CONNECTOR_MAP[connector.id] && !COMPOSIO_ESP_MAP[connector.id]) continue;
    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (integration) return connector.id;
  }
  return null;
}

// ─── Sourcing Provider Factory ───────────────────────────

export async function getSourcingProvider(
  workspaceId: string,
): Promise<SourcingProvider | null> {
  const config = getConnectorConfig("INSTANTLY");
  if (!config) return null;

  const factory = SOURCING_CONNECTOR_MAP[config.id];
  if (!factory) return null;

  const integration = await getActiveIntegration(workspaceId, config.id);
  if (!integration) return null;

  const createFn = await factory();
  return createFn(decryptApiKey(integration));
}

/** Get all active sourcing providers */
export async function getAllSourcingProviders(
  workspaceId: string,
): Promise<SourcingProvider[]> {
  const providers: SourcingProvider[] = [];
  for (const [type, factory] of Object.entries(SOURCING_CONNECTOR_MAP)) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    const createFn = await factory();
    const provider = await createFn(decryptApiKey(integration));
    providers.push(provider);
  }
  return providers;
}

// ─── CRM Provider Factory ────────────────────────────────

export async function getCRMProvider(
  workspaceId: string,
): Promise<CRMProvider | null> {
  const useComposio = isComposioEnabled();
  const crmConnectors = getConnectorsByCategory("crm");

  for (const connector of crmConnectors) {
    // Must have either a custom or Composio factory
    if (!CRM_CONNECTOR_MAP[connector.id] && !COMPOSIO_CRM_MAP[connector.id]) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    // Composio-backed CRM connectors (HubSpot, Salesforce, Pipedrive)
    if (useComposio && COMPOSIO_CRM_MAP[connector.id]) {
      const factory = await COMPOSIO_CRM_MAP[connector.id]();
      return factory(workspaceId);
    }

    // Custom CRM connectors
    const factory = CRM_CONNECTOR_MAP[connector.id];
    if (factory) {
      return factory(workspaceId);
    }
  }
  return null;
}

// ─── Email Verifier Factory ──────────────────────────────

export async function getEmailVerifier(
  workspaceId: string,
): Promise<EmailVerifier | null> {
  const verifierConnectors = getConnectorsByCategory("email_verification");

  for (const connector of verifierConnectors) {
    const factory = VERIFIER_CONNECTOR_MAP[connector.id];
    if (!factory) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    const createFn = await factory();
    return createFn(decryptApiKey(integration));
  }
  return null;
}

// ─── Apollo API Key ─────────────────────────────────────

/** Get decrypted Apollo API key for enrichment (if connected) */
export async function getApolloApiKey(
  workspaceId: string,
): Promise<string | null> {
  const integration = await getActiveIntegration(workspaceId, "APOLLO");
  if (!integration) return null;
  try {
    return decryptApiKey(integration);
  } catch {
    return null;
  }
}

// ─── Enrichment Provider Factory ─────────────────────────

const ENRICHMENT_CONNECTOR_MAP: Record<
  string,
  () => Promise<ConnectorFactory<EnrichmentProvider>>
> = {
  LUSHA: () =>
    import("@/server/lib/connectors/lusha").then(
      (m) => m.createLushaEnrichment,
    ),
  SEAMLESS_AI: () =>
    import("@/server/lib/connectors/seamless-ai").then(
      (m) => m.createSeamlessEnrichment,
    ),
};

export async function getEnrichmentProvider(
  workspaceId: string,
): Promise<EnrichmentProvider | null> {
  // API-key-based enrichment providers
  for (const [type, factory] of Object.entries(ENRICHMENT_CONNECTOR_MAP)) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    const createFn = await factory();
    return createFn(decryptApiKey(integration));
  }

  // OAuth-based enrichment providers
  for (const [type, factory] of Object.entries(ENRICHMENT_OAUTH_CONNECTOR_MAP)) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    return factory(workspaceId);
  }

  return null;
}

// ─── Export Provider Factory ─────────────────────────────

const EXPORT_CONNECTOR_MAP: Record<
  string,
  () => Promise<ConnectorFactory<ExportProvider>>
> = {
  AIRTABLE: () =>
    import("@/server/lib/connectors/airtable").then(
      (m) => m.createAirtableExport,
    ),
  NOTION: () =>
    import("@/server/lib/connectors/notion").then(
      (m) => m.createNotionExport,
    ),
};

export async function getExportProvider(
  workspaceId: string,
): Promise<ExportProvider | null> {
  const useComposio = isComposioEnabled();
  const allTypes = new Set([
    ...Object.keys(EXPORT_CONNECTOR_MAP),
    ...Object.keys(COMPOSIO_EXPORT_MAP),
  ]);

  for (const type of allTypes) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    // Composio-backed export (Airtable, Notion)
    if (useComposio && COMPOSIO_EXPORT_MAP[type]) {
      const factory = await COMPOSIO_EXPORT_MAP[type]();
      return factory(workspaceId);
    }

    // Custom export
    const customFactory = EXPORT_CONNECTOR_MAP[type];
    if (customFactory) {
      const createFn = await customFactory();
      return createFn(decryptApiKey(integration));
    }
  }
  return null;
}

// ─── Scheduling Provider Factory ─────────────────────────

const SCHEDULING_CONNECTOR_MAP: Record<
  string,
  (workspaceId: string) => Promise<SchedulingProvider>
> = {
  CALENDLY: async (workspaceId: string) => {
    const { createCalendlyScheduling } = await import(
      "@/server/lib/connectors/calendly"
    );
    return createCalendlyScheduling(workspaceId);
  },
};

export async function getSchedulingProvider(
  workspaceId: string,
): Promise<SchedulingProvider | null> {
  const useComposio = isComposioEnabled();
  const schedulingConnectors = getConnectorsByCategory("scheduling");

  for (const connector of schedulingConnectors) {
    if (!SCHEDULING_CONNECTOR_MAP[connector.id] && !COMPOSIO_SCHEDULING_MAP[connector.id]) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    // Composio-backed scheduling (Calendly)
    if (useComposio && COMPOSIO_SCHEDULING_MAP[connector.id]) {
      const factory = await COMPOSIO_SCHEDULING_MAP[connector.id]();
      return factory(workspaceId);
    }

    // Custom scheduling
    const factory = SCHEDULING_CONNECTOR_MAP[connector.id];
    if (factory) {
      return factory(workspaceId);
    }
  }
  return null;
}

// ─── Notification Provider Factory ───────────────────────

const NOTIFICATION_CONNECTOR_MAP: Record<
  string,
  (workspaceId: string) => Promise<NotificationProvider>
> = {
  SLACK: async (workspaceId: string) => {
    const { createSlackNotification } = await import(
      "@/server/lib/connectors/slack"
    );
    return createSlackNotification(workspaceId);
  },
};

export async function getNotificationProvider(
  workspaceId: string,
): Promise<NotificationProvider | null> {
  const useComposio = isComposioEnabled();
  const notifConnectors = getConnectorsByCategory("notification");

  for (const connector of notifConnectors) {
    if (!NOTIFICATION_CONNECTOR_MAP[connector.id] && !COMPOSIO_NOTIFICATION_MAP[connector.id]) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    // Composio-backed notification (Slack)
    if (useComposio && COMPOSIO_NOTIFICATION_MAP[connector.id]) {
      const factory = await COMPOSIO_NOTIFICATION_MAP[connector.id]();
      return factory(workspaceId);
    }

    // Custom notification
    const factory = NOTIFICATION_CONNECTOR_MAP[connector.id];
    if (factory) {
      return factory(workspaceId);
    }
  }
  return null;
}

// ─── Workspace Integration Summary ───────────────────────

export interface WorkspaceProviders {
  esp: string | null;
  sourcing: string[];
  crm: string | null;
  verifier: string | null;
  enrichment: string | null;
  export: string | null;
  scheduling: string | null;
  notification: string | null;
}

export async function getWorkspaceProviders(
  workspaceId: string,
): Promise<WorkspaceProviders> {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { type: true },
  });

  const types = new Set(integrations.map((i) => i.type));

  const espConnectors = getConnectorsByCategory("esp");
  const sourcingIds = Object.keys(SOURCING_CONNECTOR_MAP);
  const crmConnectors = getConnectorsByCategory("crm");
  const verifierConnectors = getConnectorsByCategory("email_verification");
  const schedulingConnectors = getConnectorsByCategory("scheduling");
  const notificationConnectors = getConnectorsByCategory("notification");

  return {
    esp: espConnectors.find((c) => (ESP_CONNECTOR_MAP[c.id] || ESP_OAUTH_CONNECTOR_MAP[c.id] || COMPOSIO_ESP_MAP[c.id]) && types.has(c.id))?.id ?? null,
    sourcing: sourcingIds.filter((id) => types.has(id)),
    crm: crmConnectors.find((c) => (CRM_CONNECTOR_MAP[c.id] || COMPOSIO_CRM_MAP[c.id]) && types.has(c.id))?.id ?? null,
    verifier: verifierConnectors.find((c) => VERIFIER_CONNECTOR_MAP[c.id] && types.has(c.id))?.id ?? null,
    enrichment: Object.keys(ENRICHMENT_CONNECTOR_MAP).find((id) => types.has(id)) ?? null,
    export: [...new Set([...Object.keys(EXPORT_CONNECTOR_MAP), ...Object.keys(COMPOSIO_EXPORT_MAP)])].find((id) => types.has(id)) ?? null,
    scheduling: schedulingConnectors.find((c) => (SCHEDULING_CONNECTOR_MAP[c.id] || COMPOSIO_SCHEDULING_MAP[c.id]) && types.has(c.id))?.id ?? null,
    notification: notificationConnectors.find((c) => (NOTIFICATION_CONNECTOR_MAP[c.id] || COMPOSIO_NOTIFICATION_MAP[c.id]) && types.has(c.id))?.id ?? null,
  };
}
