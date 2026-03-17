import { logger } from "@/lib/logger";
import { testApolloConnection } from "@/server/lib/connectors/apollo";
import { testLemlistConnection } from "@/server/lib/connectors/lemlist";
import { testSmartleadConnection } from "@/server/lib/connectors/smartlead";
import {
  testZeroBounceConnection,
  getZeroBounceCredits,
} from "@/server/lib/connectors/zerobounce";
import { testNeverBounceConnection, getNeverBounceCredits } from "@/server/lib/connectors/neverbounce";
import { testDeBounceConnection, getDeBounceCredits } from "@/server/lib/connectors/debounce";
import { testMillionVerifierConnection, getMillionVerifierCredits } from "@/server/lib/connectors/millionverifier";
import { testWoodpeckerConnection } from "@/server/lib/connectors/woodpecker";
import { testMailshakeConnection } from "@/server/lib/connectors/mailshake";
import { testReplyIoConnection } from "@/server/lib/connectors/reply-io";
import { testSaleshandyConnection } from "@/server/lib/connectors/saleshandy";
import { testQuickMailConnection } from "@/server/lib/connectors/quickmail";
import { testKlentyConnection } from "@/server/lib/connectors/klenty";
import { testSalesloftConnection } from "@/server/lib/connectors/salesloft";
import { testGmassConnection } from "@/server/lib/connectors/gmass";
import { testSnovIoConnection } from "@/server/lib/connectors/snov-io";
import { testLushaConnection } from "@/server/lib/connectors/lusha";
import { testSeamlessConnection } from "@/server/lib/connectors/seamless-ai";
import { testAirtableConnection } from "@/server/lib/connectors/airtable";
import { testNotionConnection } from "@/server/lib/connectors/notion";
import { testPipedriveConnection } from "@/server/lib/connectors/pipedrive";
import type { ConnectorConfig, ConnectorCategory, ConnectorMeta } from "./types";

// ─── Full Connector Registry ────────────────────────────
// All 57 tools. Only tier 1 (6 existing) have testConnection.

const CONNECTORS: ConnectorConfig[] = [
  // ═══════════════════════════════════════════════════════
  // ESP (Email Sending Platforms)
  // ═══════════════════════════════════════════════════════
  {
    id: "INSTANTLY",
    name: "Instantly",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Sourcing & email campaigns",
    placeholder: "Instantly API V2 Key",
    brandColor: "#3B82F6",
    tier: 1,
    testConnection: async (apiKey) => {
      try {
        const res = await fetch("https://api.instantly.ai/api/v2/accounts", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) return { ok: false, error: "Invalid API key" };
        const accounts = (await res.json()) as { email?: string }[];
        return {
          ok: true,
          meta: {
            accountEmail: accounts?.[0]?.email,
            accounts: accounts?.length ?? 0,
          },
        };
      } catch {
        return { ok: false, error: "Could not reach Instantly API. Check your connection." };
      }
    },
    onConnect: async (apiKey) => {
      const actions: string[] = [];
      const warnings: string[] = [];
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const webhookUrl = `${appUrl}/api/webhooks/instantly`;

      try {
        // List existing webhooks
        const listRes = await fetch("https://api.instantly.ai/api/v2/webhooks", {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10_000),
        });

        if (listRes.ok) {
          const webhooks = (await listRes.json()) as { target_hook_url?: string; name?: string; event_type?: string }[];

          // Check if LeadSens webhook already exists
          const existing = webhooks.find((w) => w.target_hook_url === webhookUrl);
          if (existing) {
            actions.push("Webhook already configured — no changes made");
            logger.info("[instantly] Webhook already configured", { webhookUrl });
            return { actions, warnings };
          }

          // Warn about other webhooks (user might have Zapier, etc.)
          const otherWebhooks = webhooks.filter((w) => w.target_hook_url && w.target_hook_url !== webhookUrl);
          if (otherWebhooks.length > 0) {
            warnings.push(
              `${otherWebhooks.length} existing webhook(s) found in your Instantly account (${otherWebhooks.map((w) => w.name ?? w.target_hook_url).join(", ")}). They will not be modified.`,
            );
          }
        }

        // Create LeadSens webhook for all events
        const createRes = await fetch("https://api.instantly.ai/api/v2/webhooks", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            target_hook_url: webhookUrl,
            event_type: "all_events",
            name: "LeadSens Pipeline",
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (createRes.ok) {
          actions.push("Webhook auto-configured — LeadSens will receive real-time events (replies, bounces, opens, clicks)");
          logger.info("[instantly] Webhook auto-created", { webhookUrl });
        } else {
          const text = await createRes.text().catch(() => "");
          warnings.push("Could not auto-create webhook. You can set it up manually in Instantly → Settings → Webhooks.");
          logger.warn("[instantly] Failed to auto-create webhook", { status: createRes.status, text: text.slice(0, 200) });
        }
      } catch (err) {
        warnings.push("Webhook auto-setup failed. You can set it up manually in Instantly → Settings → Webhooks.");
        logger.warn("[instantly] Webhook auto-setup failed", { error: err instanceof Error ? err.message : "unknown" });
      }

      return { actions, warnings };
    },
  },
  {
    id: "SMARTLEAD",
    name: "Smartlead",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Email campaigns & sequences",
    placeholder: "Smartlead API Key",
    brandColor: "#14B8A6",
    tier: 1,
    testConnection: async (apiKey) => {
      const ok = await testSmartleadConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "LEMLIST",
    name: "Lemlist",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Email campaigns & outreach sequences",
    placeholder: "Lemlist API Key",
    brandColor: "#8B5CF6",
    tier: 1,
    testConnection: async (apiKey) => {
      const ok = await testLemlistConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "SALESHANDY",
    name: "SalesHandy",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Cold email automation with unlimited team members",
    placeholder: "SalesHandy API Key",
    brandColor: "#F97316",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testSaleshandyConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "WOODPECKER",
    name: "Woodpecker",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Cold email & follow-up automation",
    placeholder: "Woodpecker API Key",
    brandColor: "#22C55E",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testWoodpeckerConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "MAILSHAKE",
    name: "Mailshake",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Sales engagement & outreach",
    placeholder: "Mailshake API Key",
    brandColor: "#EF4444",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testMailshakeConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "QUICKMAIL",
    name: "QuickMail",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Deliverability-focused cold email with inbox rotation",
    placeholder: "QuickMail API Key",
    brandColor: "#6366F1",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testQuickMailConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "REPLY_IO",
    name: "Reply.io",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Multichannel sales engagement",
    placeholder: "Reply.io API Key",
    brandColor: "#0EA5E9",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testReplyIoConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "KLENTY",
    name: "Klenty",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "AI-powered sales engagement with adaptive cadences",
    placeholder: "Klenty API Key",
    brandColor: "#5046E5",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testKlentyConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "SALESLOFT",
    name: "Salesloft",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Sales engagement platform with cadences & analytics",
    placeholder: "Salesloft API Key",
    brandColor: "#0B6CFF",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testSalesloftConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "GMASS",
    name: "GMass",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Gmail-based cold email campaigns at scale",
    placeholder: "GMass API Key",
    brandColor: "#F59E0B",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testGmassConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "SNOV_IO",
    name: "Snov.io",
    category: "esp",
    authMethod: "api_key",
    providerInterface: "esp",
    description: "Drip campaigns & email finder with built-in verification",
    placeholder: "client_id:client_secret",
    brandColor: "#3B82F6",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testSnovIoConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid credentials. Format: client_id:client_secret" };
    },
  },
  {
    id: "OUTREACH",
    name: "Outreach",
    category: "esp",
    authMethod: "oauth",
    providerInterface: "esp",
    description: "Enterprise sales engagement & sequences",
    brandColor: "#5951FF",
    tier: 2,
    oauthConfig: {
      authUrl: "https://api.outreach.io/oauth/authorize",
      tokenUrl: "https://api.outreach.io/oauth/token",
      scopes: ["prospects.read", "prospects.write", "sequences.read", "sequences.write", "sequenceSteps.read", "mailings.read"],
      clientIdEnvVar: "OUTREACH_CLIENT_ID",
      clientSecretEnvVar: "OUTREACH_CLIENT_SECRET",
      pkce: true,
    },
  },
  {
    id: "YESWARE",
    name: "Yesware",
    category: "esp",
    authMethod: "coming_soon", // No public API — browser extension only
    providerInterface: "esp",
    description: "Email tracking & automation inside Gmail/Outlook",
    brandColor: "#0066FF",
    tier: 3,
  },
  {
    id: "SALESFORGE",
    name: "Salesforge",
    category: "esp",
    authMethod: "coming_soon", // No public API
    providerInterface: "esp",
    description: "AI-powered email personalization at scale",
    brandColor: "#FF5722",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Lead Database / Sourcing
  // ═══════════════════════════════════════════════════════
  {
    id: "APOLLO",
    name: "Apollo",
    category: "lead_database",
    authMethod: "api_key",
    providerInterface: "enrichment",
    description: "Contact enrichment & email finding",
    placeholder: "Apollo API Key",
    brandColor: "#A855F7",
    tier: 1,
    testConnection: async (apiKey) => {
      const ok = await testApolloConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "LUSHA",
    name: "Lusha",
    category: "lead_database",
    authMethod: "api_key",
    providerInterface: "enrichment",
    description: "B2B contact & company data",
    placeholder: "Lusha API Key",
    brandColor: "#6366F1",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testLushaConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key" };
    },
  },
  {
    id: "ZOOMINFO",
    name: "ZoomInfo",
    category: "lead_database",
    authMethod: "oauth",
    providerInterface: "enrichment",
    description: "Enterprise B2B intelligence (requires API license)",
    brandColor: "#7C3AED",
    tier: 2,
    oauthConfig: {
      authUrl: "https://api.zoominfo.com/authenticate",
      tokenUrl: "https://api.zoominfo.com/authenticate",
      scopes: [],
      clientIdEnvVar: "ZOOMINFO_CLIENT_ID",
      clientSecretEnvVar: "ZOOMINFO_CLIENT_SECRET",
      pkce: true,
    },
  },
  {
    id: "COGNISM",
    name: "Cognism",
    category: "lead_database",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "GDPR-compliant B2B data",
    brandColor: "#2563EB",
    tier: 3,
  },
  {
    id: "ROCKETREACH",
    name: "RocketReach",
    category: "lead_database",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Email & phone lookup",
    brandColor: "#DC2626",
    tier: 3,
  },
  {
    id: "LEADIQ",
    name: "LeadIQ",
    category: "lead_database",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Prospect data capture",
    brandColor: "#0891B2",
    tier: 3,
  },
  {
    id: "SEAMLESS_AI",
    name: "Seamless.AI",
    category: "lead_database",
    authMethod: "api_key",
    providerInterface: "enrichment",
    description: "Real-time lead generation (requires API license)",
    placeholder: "Seamless.AI API Key",
    brandColor: "#059669",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testSeamlessConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API key or no API access" };
    },
  },
  // Snov.io moved to ESP category — it's primarily a drip campaign tool
  {
    id: "HUNTER",
    name: "Hunter.io",
    category: "lead_database",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Email finder by domain",
    brandColor: "#F97316",
    tier: 3,
  },
  {
    id: "KASPR",
    name: "Kaspr",
    category: "lead_database",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "LinkedIn contact data",
    brandColor: "#8B5CF6",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Enrichment
  // ═══════════════════════════════════════════════════════
  {
    id: "CLEARBIT",
    name: "Clearbit",
    category: "enrichment",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Company & person enrichment",
    brandColor: "#3B82F6",
    tier: 3,
  },
  {
    id: "DROPCONTACT",
    name: "Dropcontact",
    category: "enrichment",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "GDPR-compliant email enrichment",
    brandColor: "#EC4899",
    tier: 3,
  },
  {
    id: "PEOPLEDATALABS",
    name: "People Data Labs",
    category: "enrichment",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Person & company data API",
    brandColor: "#6366F1",
    tier: 3,
  },
  {
    id: "FULLCONTACT",
    name: "FullContact",
    category: "enrichment",
    authMethod: "coming_soon",
    providerInterface: "enrichment",
    description: "Identity resolution & enrichment",
    brandColor: "#14B8A6",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Email Verification
  // ═══════════════════════════════════════════════════════
  {
    id: "ZEROBOUNCE",
    name: "ZeroBounce",
    category: "email_verification",
    authMethod: "api_key",
    providerInterface: "email_verifier",
    description: "Email verification & bounce protection",
    placeholder: "ZeroBounce API Key",
    brandColor: "#F59E0B",
    tier: 1,
    testConnection: async (apiKey) => {
      const ok = await testZeroBounceConnection(apiKey);
      if (!ok) return { ok: false, error: "Invalid API key" };
      try {
        const credits = await getZeroBounceCredits(apiKey);
        return { ok: true, meta: { credits } };
      } catch {
        return { ok: true, meta: {} };
      }
    },
  },
  {
    id: "NEVERBOUNCE",
    name: "NeverBounce",
    category: "email_verification",
    authMethod: "api_key",
    providerInterface: "email_verifier",
    description: "Email verification at scale",
    placeholder: "NeverBounce API Key",
    brandColor: "#22C55E",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testNeverBounceConnection(apiKey);
      if (!ok) return { ok: false, error: "Invalid API key" };
      try {
        const credits = await getNeverBounceCredits(apiKey);
        return { ok: true, meta: { credits } };
      } catch {
        return { ok: true, meta: {} };
      }
    },
  },
  {
    id: "DEBOUNCE",
    name: "DeBounce",
    category: "email_verification",
    authMethod: "api_key",
    providerInterface: "email_verifier",
    description: "Email list cleaning",
    placeholder: "DeBounce API Key",
    brandColor: "#0EA5E9",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testDeBounceConnection(apiKey);
      if (!ok) return { ok: false, error: "Invalid API key" };
      try {
        const credits = await getDeBounceCredits(apiKey);
        return { ok: true, meta: { credits } };
      } catch {
        return { ok: true, meta: {} };
      }
    },
  },
  {
    id: "MILLIONVERIFIER",
    name: "MillionVerifier",
    category: "email_verification",
    authMethod: "api_key",
    providerInterface: "email_verifier",
    description: "Bulk email verification",
    placeholder: "MillionVerifier API Key",
    brandColor: "#EF4444",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testMillionVerifierConnection(apiKey);
      if (!ok) return { ok: false, error: "Invalid API key" };
      try {
        const credits = await getMillionVerifierCredits(apiKey);
        return { ok: true, meta: { credits } };
      } catch {
        return { ok: true, meta: {} };
      }
    },
  },

  // ═══════════════════════════════════════════════════════
  // Warmup
  // ═══════════════════════════════════════════════════════
  {
    id: "WARMBOX",
    name: "Warmbox",
    category: "warmup",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "Email warmup & deliverability",
    brandColor: "#F97316",
    tier: 3,
  },
  {
    id: "MAILIVERY",
    name: "Mailivery",
    category: "warmup",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "AI-powered email warmup",
    brandColor: "#8B5CF6",
    tier: 3,
  },
  {
    id: "MAILREACH",
    name: "MailReach",
    category: "warmup",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "Email deliverability optimizer",
    brandColor: "#EC4899",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // CRM
  // ═══════════════════════════════════════════════════════
  {
    id: "HUBSPOT",
    name: "HubSpot",
    category: "crm",
    authMethod: "oauth",
    providerInterface: "crm",
    description: "CRM, contacts & deal tracking",
    brandColor: "#F97316",
    tier: 1,
  },
  {
    id: "SALESFORCE",
    name: "Salesforce",
    category: "crm",
    authMethod: "oauth",
    providerInterface: "crm",
    description: "Enterprise CRM platform",
    brandColor: "#0EA5E9",
    tier: 2,
    oauthConfig: {
      authUrl: "https://login.salesforce.com/services/oauth2/authorize",
      tokenUrl: "https://login.salesforce.com/services/oauth2/token",
      scopes: ["api", "refresh_token"],
      clientIdEnvVar: "SALESFORCE_CLIENT_ID",
      clientSecretEnvVar: "SALESFORCE_CLIENT_SECRET",
    },
  },
  {
    id: "PIPEDRIVE",
    name: "Pipedrive",
    category: "crm",
    authMethod: "api_key",
    providerInterface: "crm",
    description: "Sales-focused CRM",
    placeholder: "Pipedrive API Token",
    brandColor: "#22C55E",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testPipedriveConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid API token" };
    },
  },
  {
    id: "CLOSE",
    name: "Close",
    category: "crm",
    authMethod: "coming_soon",
    providerInterface: "crm",
    description: "CRM for inside sales",
    brandColor: "#1D4ED8",
    tier: 3,
  },
  {
    id: "FOLK",
    name: "Folk",
    category: "crm",
    authMethod: "coming_soon",
    providerInterface: "crm",
    description: "Lightweight CRM",
    brandColor: "#A855F7",
    tier: 3,
  },
  {
    id: "ATTIO",
    name: "Attio",
    category: "crm",
    authMethod: "coming_soon",
    providerInterface: "crm",
    description: "Next-gen CRM platform",
    brandColor: "#6366F1",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // LinkedIn Outreach
  // ═══════════════════════════════════════════════════════
  {
    id: "EXPANDI",
    name: "Expandi",
    category: "linkedin_outreach",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "LinkedIn outreach automation",
    brandColor: "#1D4ED8",
    tier: 3,
  },
  {
    id: "WAALAXY",
    name: "Waalaxy",
    category: "linkedin_outreach",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "LinkedIn + email prospecting",
    brandColor: "#7C3AED",
    tier: 3,
  },
  {
    id: "DRIPIFY",
    name: "Dripify",
    category: "linkedin_outreach",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "LinkedIn automation tool",
    brandColor: "#0891B2",
    tier: 3,
  },
  {
    id: "PHANTOMBUSTER",
    name: "PhantomBuster",
    category: "linkedin_outreach",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "LinkedIn data extraction & automation",
    brandColor: "#A855F7",
    tier: 3,
  },
  {
    id: "LINKEDHELPER",
    name: "Linked Helper",
    category: "linkedin_outreach",
    authMethod: "coming_soon",
    providerInterface: "none",
    description: "LinkedIn automation assistant",
    brandColor: "#3B82F6",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Scheduling
  // ═══════════════════════════════════════════════════════
  {
    id: "CALENDLY",
    name: "Calendly",
    category: "scheduling",
    authMethod: "oauth",
    providerInterface: "scheduling",
    description: "Meeting scheduling",
    brandColor: "#3B82F6",
    tier: 2,
    oauthConfig: {
      authUrl: "https://auth.calendly.com/oauth/authorize",
      tokenUrl: "https://auth.calendly.com/oauth/token",
      scopes: [],
      clientIdEnvVar: "CALENDLY_CLIENT_ID",
      clientSecretEnvVar: "CALENDLY_CLIENT_SECRET",
    },
  },
  {
    id: "CAL_COM",
    name: "Cal.com",
    category: "scheduling",
    authMethod: "coming_soon",
    providerInterface: "scheduling",
    description: "Open-source scheduling",
    brandColor: "#111827",
    tier: 2,
  },
  {
    id: "SAVVYCAL",
    name: "SavvyCal",
    category: "scheduling",
    authMethod: "coming_soon",
    providerInterface: "scheduling",
    description: "Scheduling made easy",
    brandColor: "#6366F1",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Workflow / Automation
  // ═══════════════════════════════════════════════════════
  {
    id: "ZAPIER",
    name: "Zapier",
    category: "workflow",
    authMethod: "coming_soon",
    providerInterface: "workflow",
    description: "Connect apps & automate workflows",
    brandColor: "#FF4F00",
    tier: 2,
  },
  {
    id: "MAKE",
    name: "Make",
    category: "workflow",
    authMethod: "coming_soon",
    providerInterface: "workflow",
    description: "Visual automation platform",
    brandColor: "#6366F1",
    tier: 2,
  },
  {
    id: "N8N",
    name: "n8n",
    category: "workflow",
    authMethod: "coming_soon",
    providerInterface: "workflow",
    description: "Self-hostable workflow automation",
    brandColor: "#EA4B71",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Notifications
  // ═══════════════════════════════════════════════════════
  {
    id: "SLACK",
    name: "Slack",
    category: "notification",
    authMethod: "oauth",
    providerInterface: "notification",
    description: "Team notifications & alerts",
    brandColor: "#4A154B",
    tier: 2,
    oauthConfig: {
      authUrl: "https://slack.com/oauth/v2/authorize",
      tokenUrl: "https://slack.com/api/oauth.v2.access",
      scopes: ["chat:write", "channels:read"],
      clientIdEnvVar: "SLACK_CLIENT_ID",
      clientSecretEnvVar: "SLACK_CLIENT_SECRET",
    },
  },
  {
    id: "DISCORD",
    name: "Discord",
    category: "notification",
    authMethod: "coming_soon",
    providerInterface: "notification",
    description: "Team communication & webhooks",
    brandColor: "#5865F2",
    tier: 3,
  },
  {
    id: "TEAMS",
    name: "Microsoft Teams",
    category: "notification",
    authMethod: "coming_soon",
    providerInterface: "notification",
    description: "Enterprise team notifications",
    brandColor: "#6264A7",
    tier: 3,
  },

  // ═══════════════════════════════════════════════════════
  // Export
  // ═══════════════════════════════════════════════════════
  {
    id: "CSV",
    name: "CSV",
    category: "export",
    authMethod: "none",
    providerInterface: "export",
    description: "Built-in CSV import & export",
    brandColor: "#10B981",
    tier: 1,
  },
  {
    id: "GOOGLE_SHEETS",
    name: "Google Sheets",
    category: "export",
    authMethod: "coming_soon",
    providerInterface: "export",
    description: "Export leads to spreadsheets",
    brandColor: "#34A853",
    tier: 2,
  },
  {
    id: "AIRTABLE",
    name: "Airtable",
    category: "export",
    authMethod: "api_key",
    providerInterface: "export",
    description: "Flexible database & export",
    placeholder: "Airtable Personal Access Token",
    brandColor: "#FCBF49",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testAirtableConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid token" };
    },
  },
  {
    id: "NOTION",
    name: "Notion",
    category: "export",
    authMethod: "api_key",
    providerInterface: "export",
    description: "All-in-one workspace export",
    placeholder: "Notion Integration Token",
    brandColor: "#000000",
    tier: 2,
    testConnection: async (apiKey) => {
      const ok = await testNotionConnection(apiKey);
      return ok ? { ok: true } : { ok: false, error: "Invalid token" };
    },
  },
];

// ─── Lookup Functions ───────────────────────────────────

const connectorMap = new Map(CONNECTORS.map((c) => [c.id, c]));

export function getConnectorConfig(id: string): ConnectorConfig | undefined {
  return connectorMap.get(id);
}

export function getConnectorsByCategory(
  category: ConnectorCategory,
): ConnectorConfig[] {
  return CONNECTORS.filter((c) => c.category === category);
}

export function getAllConnectors(): ConnectorConfig[] {
  return [...CONNECTORS];
}

/** Connectors that can actually be connected (not "coming_soon") */
export function getConnectableConnectors(): ConnectorConfig[] {
  return CONNECTORS.filter((c) => c.authMethod !== "coming_soon");
}

// ─── Client-safe serialization ──────────────────────────

/** Strip testConnection functions for client-side use */
export function toConnectorMeta(config: ConnectorConfig): ConnectorMeta {
  return {
    id: config.id,
    name: config.name,
    category: config.category,
    authMethod: config.authMethod,
    providerInterface: config.providerInterface,
    brandColor: config.brandColor,
    placeholder: config.placeholder,
    description: config.description,
    tier: config.tier,
    hasOAuth: !!config.oauthConfig,
  };
}

export function getAllConnectorMetas(): ConnectorMeta[] {
  return CONNECTORS.map(toConnectorMeta);
}

/** Category display order and labels */
export const CATEGORY_LABELS: Record<ConnectorCategory, string> = {
  esp: "Email Sending",
  lead_database: "Lead Database",
  enrichment: "Enrichment",
  email_verification: "Email Verification",
  warmup: "Email Warmup",
  crm: "CRM",
  linkedin_outreach: "LinkedIn Outreach",
  scheduling: "Scheduling",
  workflow: "Workflow Automation",
  notification: "Notifications",
  export: "Export",
};

export const CATEGORY_ORDER: ConnectorCategory[] = [
  "esp",
  "lead_database",
  "crm",
  "email_verification",
  "enrichment",
  "warmup",
  "linkedin_outreach",
  "scheduling",
  "workflow",
  "notification",
  "export",
];
