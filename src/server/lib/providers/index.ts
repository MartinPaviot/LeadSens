/**
 * Provider Registry — Returns the right provider based on workspace integrations.
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
import type { IntegrationType } from "@prisma/client";
import type { ESPProvider } from "./esp-provider";
import type { SourcingProvider } from "./sourcing-provider";
import type { CRMProvider } from "./crm-provider";
import type { EmailVerifier } from "./email-verifier";

// ─── Integration types that map to providers ────────────
// Only types that have a real implementation are listed here.
// Extend these arrays when adding new connectors.

const ESP_TYPES = ["INSTANTLY", "SMARTLEAD", "LEMLIST"] as const;
const CRM_TYPES = ["HUBSPOT"] as const;
const SOURCING_TYPES = ["INSTANTLY"] as const;
const VERIFIER_TYPES = ["ZEROBOUNCE"] as const;

type ESPType = (typeof ESP_TYPES)[number];
type CRMType = (typeof CRM_TYPES)[number];
type SourcingType = (typeof SOURCING_TYPES)[number];
type VerifierType = (typeof VERIFIER_TYPES)[number];

// ─── Integration loader ─────────────────────────────────

export async function getActiveIntegration(
  workspaceId: string,
  type: IntegrationType,
) {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_type: { workspaceId, type } },
  });
  if (!integration || integration.status !== "ACTIVE") return null;
  return integration;
}

function decryptApiKey(integration: { apiKey: string | null; type: string }): string {
  if (!integration.apiKey) throw new Error(`No API key for ${integration.type}`);
  return decrypt(integration.apiKey);
}

// ─── ESP Provider Factory ────────────────────────────────

export async function getESPProvider(workspaceId: string): Promise<ESPProvider | null> {
  for (const type of ESP_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    switch (type) {
      case "INSTANTLY": {
        const { createInstantlyESP } = await import("@/server/lib/connectors/instantly-esp");
        return createInstantlyESP(decryptApiKey(integration));
      }
      case "SMARTLEAD": {
        const { createSmartleadESP } = await import("@/server/lib/connectors/smartlead");
        return createSmartleadESP(decryptApiKey(integration));
      }
      case "LEMLIST": {
        const { createLemlistESP } = await import("@/server/lib/connectors/lemlist");
        return createLemlistESP(decryptApiKey(integration));
      }
    }
  }
  return null;
}

/** Get ESP provider name for a workspace (without initializing) */
export async function getESPType(workspaceId: string): Promise<ESPType | null> {
  for (const type of ESP_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (integration) return type;
  }
  return null;
}

// ─── Sourcing Provider Factory ───────────────────────────

export async function getSourcingProvider(workspaceId: string): Promise<SourcingProvider | null> {
  for (const type of SOURCING_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    switch (type) {
      case "INSTANTLY": {
        const { createInstantlySourcing } = await import("@/server/lib/connectors/instantly-sourcing");
        return createInstantlySourcing(decryptApiKey(integration));
      }
    }
  }
  return null;
}

/** Get all active sourcing providers */
export async function getAllSourcingProviders(workspaceId: string): Promise<SourcingProvider[]> {
  const providers: SourcingProvider[] = [];
  for (const type of SOURCING_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    switch (type) {
      case "INSTANTLY": {
        const { createInstantlySourcing } = await import("@/server/lib/connectors/instantly-sourcing");
        providers.push(createInstantlySourcing(decryptApiKey(integration)));
        break;
      }
    }
  }
  return providers;
}

// ─── CRM Provider Factory ────────────────────────────────

export async function getCRMProvider(workspaceId: string): Promise<CRMProvider | null> {
  for (const type of CRM_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    switch (type) {
      case "HUBSPOT": {
        const { createHubSpotCRM } = await import("@/server/lib/connectors/hubspot-crm");
        return createHubSpotCRM(workspaceId);
      }
    }
  }
  return null;
}

// ─── Email Verifier Factory ──────────────────────────────

export async function getEmailVerifier(workspaceId: string): Promise<EmailVerifier | null> {
  for (const type of VERIFIER_TYPES) {
    const integration = await getActiveIntegration(workspaceId, type);
    if (!integration) continue;

    switch (type) {
      case "ZEROBOUNCE": {
        const { createZeroBounceVerifier } = await import("@/server/lib/connectors/zerobounce");
        return createZeroBounceVerifier(decryptApiKey(integration));
      }
    }
  }
  return null;
}

// ─── Apollo API Key ─────────────────────────────────────

/** Get decrypted Apollo API key for enrichment (if connected) */
export async function getApolloApiKey(workspaceId: string): Promise<string | null> {
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
  esp: ESPType | null;
  sourcing: SourcingType[];
  crm: CRMType | null;
  verifier: VerifierType | null;
}

export async function getWorkspaceProviders(workspaceId: string): Promise<WorkspaceProviders> {
  const integrations = await prisma.integration.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: { type: true },
  });

  const types = new Set(integrations.map((i) => i.type as string));

  return {
    esp: ESP_TYPES.find((t) => types.has(t)) ?? null,
    sourcing: SOURCING_TYPES.filter((t) => types.has(t)) as SourcingType[],
    crm: CRM_TYPES.find((t) => types.has(t)) ?? null,
    verifier: VERIFIER_TYPES.find((t) => types.has(t)) ?? null,
  };
}
