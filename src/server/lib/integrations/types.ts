import { z } from "zod/v4";

// ─── Connector Categories ───────────────────────────────

export const connectorCategorySchema = z.enum([
  "esp",
  "lead_database",
  "enrichment",
  "email_verification",
  "warmup",
  "crm",
  "linkedin_outreach",
  "scheduling",
  "workflow",
  "notification",
  "export",
]);
export type ConnectorCategory = z.infer<typeof connectorCategorySchema>;

// ─── Auth Methods ───────────────────────────────────────

export const authMethodSchema = z.enum([
  "api_key",
  "oauth",
  "webhook_url",
  "coming_soon",
]);
export type AuthMethod = z.infer<typeof authMethodSchema>;

// ─── Provider Interfaces ────────────────────────────────

export const providerInterfaceSchema = z.enum([
  "esp",
  "sourcing",
  "crm",
  "email_verifier",
  "enrichment",
  "scheduling",
  "notification",
  "export",
  "workflow",
  "none",
]);
export type ProviderInterface = z.infer<typeof providerInterfaceSchema>;

// ─── Test Connection ────────────────────────────────────

export interface TestConnectionResult {
  ok: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

// ─── Connector Config ───────────────────────────────────

export interface ConnectorConfig {
  /** Unique ID, e.g. "INSTANTLY", "SALESHANDY" */
  id: string;
  /** Human-readable name, e.g. "Instantly" */
  name: string;
  category: ConnectorCategory;
  authMethod: AuthMethod;
  providerInterface: ProviderInterface;
  /** Validates the credential and returns ok/error */
  testConnection?: (credential: string) => Promise<TestConnectionResult>;
  baseUrl?: string;
  capabilities?: string[];
  brandColor?: string;
  /** Placeholder text for the API key input */
  placeholder?: string;
  /** Short description shown on the card */
  description?: string;
  /** Implementation priority: 1=shipped, 2=next, 3=future */
  tier: 1 | 2 | 3;
}

// ─── Serializable Config (no functions, safe for client) ─

export interface ConnectorMeta {
  id: string;
  name: string;
  category: ConnectorCategory;
  authMethod: AuthMethod;
  providerInterface: ProviderInterface;
  brandColor?: string;
  placeholder?: string;
  description?: string;
  tier: 1 | 2 | 3;
}

// ─── Integration type validator (replaces Prisma enum) ──

export const integrationTypeSchema = z.string().min(1);
