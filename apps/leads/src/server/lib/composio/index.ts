/**
 * Composio Integration Module — Unified auth and action execution layer.
 *
 * When COMPOSIO_API_KEY is set, Composio-backed connectors are used for:
 * - CRM: HubSpot, Salesforce, Pipedrive
 * - ESP: Lemlist
 * - Export: Airtable, Notion
 * - Scheduling: Calendly
 * - Notification: Slack
 * - Enrichment: Apollo (standalone functions)
 *
 * Custom connectors remain for:
 * - Instantly (SuperSearch preview + email reply gaps)
 * - Email verifiers (ZeroBounce, NeverBounce, DeBounce, MillionVerifier)
 * - Lusha, Seamless.AI (enrichment gaps)
 * - Smartlead, and 8+ niche ESPs (no Composio connector)
 * - Jina, Apify, TinyFish (scraping, no auth needed)
 */

export { getComposioClient, isComposioEnabled } from "./client";
export { executeAction } from "./execute";
export type { ExecuteOptions } from "./execute";
export {
  connectWithApiKey,
  connectWithOAuth,
  getConnectionStatus,
} from "./connection";
export type {
  ConnectionResult,
  OAuthConnectionResult,
} from "./connection";
