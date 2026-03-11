/**
 * Provider Registry — Returns the right provider based on workspace integrations.
 *
 * Registry-driven: connectors are looked up from the integration registry.
 * Static connector maps ensure Next.js bundling works correctly.
 *
 * ESP: Instantly, Smartlead, Lemlist
 * CRM: HubSpot
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
import {
  getConnectorsByCategory,
  getConnectorConfig,
} from "@/server/lib/integrations/registry";
import type { ESPProvider } from "./esp-provider";
import type { SourcingProvider } from "./sourcing-provider";
import type { CRMProvider } from "./crm-provider";
import type { EmailVerifier } from "./email-verifier";

// ─── Static connector maps (required for Next.js bundling) ──

type ConnectorFactory<T> = (apiKey: string) => T | Promise<T>;

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

// ─── Integration loader ─────────────────────────────────

export async function getActiveIntegration(
  workspaceId: string,
  type: string,
) {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type } },
  });
  if (!integration || integration.status !== "ACTIVE") return null;
  return integration;
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
  const espConnectors = getConnectorsByCategory("esp");

  for (const connector of espConnectors) {
    const factory = ESP_CONNECTOR_MAP[connector.id];
    if (!factory) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    const createFn = await factory();
    return createFn(decryptApiKey(integration));
  }
  return null;
}

/** Get ESP provider name for a workspace (without initializing) */
export async function getESPType(workspaceId: string): Promise<string | null> {
  const espConnectors = getConnectorsByCategory("esp");

  for (const connector of espConnectors) {
    if (!ESP_CONNECTOR_MAP[connector.id]) continue;
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
  const crmConnectors = getConnectorsByCategory("crm");

  for (const connector of crmConnectors) {
    const factory = CRM_CONNECTOR_MAP[connector.id];
    if (!factory) continue;

    const integration = await getActiveIntegration(workspaceId, connector.id);
    if (!integration) continue;

    return factory(workspaceId);
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

// ─── Workspace Integration Summary ───────────────────────

export interface WorkspaceProviders {
  esp: string | null;
  sourcing: string[];
  crm: string | null;
  verifier: string | null;
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

  return {
    esp: espConnectors.find((c) => ESP_CONNECTOR_MAP[c.id] && types.has(c.id))?.id ?? null,
    sourcing: sourcingIds.filter((id) => types.has(id)),
    crm: crmConnectors.find((c) => CRM_CONNECTOR_MAP[c.id] && types.has(c.id))?.id ?? null,
    verifier: verifierConnectors.find((c) => VERIFIER_CONNECTOR_MAP[c.id] && types.has(c.id))?.id ?? null,
  };
}
