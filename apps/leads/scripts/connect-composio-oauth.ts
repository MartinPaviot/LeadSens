/**
 * Generate Composio OAuth connection URLs for all OAuth apps.
 * Run: npx tsx scripts/connect-composio-oauth.ts
 *
 * For each app, generates a URL the user opens in their browser to authorize.
 * After authorization, the connection becomes ACTIVE in Composio.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Composio } from "@composio/core";

for (const rawLine of readFileSync(resolve(process.cwd(), ".env"), "utf-8").split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    const val = match[2].replace(/^"|"$/g, "").trim();
    if (!process.env[match[1]]) process.env[match[1]] = val;
  }
}

const API_KEY = process.env.COMPOSIO_API_KEY!;
const ENTITY_ID = (process.env.COMPOSIO_ENTITY_ID ?? "default").replace(/"/g, "");

const OAUTH_APPS = [
  { name: "HubSpot", authConfigId: process.env.COMPOSIO_AUTH_CONFIG_HUBSPOT },
  { name: "Salesforce", authConfigId: process.env.COMPOSIO_AUTH_CONFIG_SALESFORCE },
  { name: "Calendly", authConfigId: process.env.COMPOSIO_AUTH_CONFIG_CALENDLY },
  { name: "Slack", authConfigId: process.env.COMPOSIO_AUTH_CONFIG_SLACK },
  { name: "Notion", authConfigId: process.env.COMPOSIO_AUTH_CONFIG_NOTION },
];

async function main() {
  const composio = new Composio({ apiKey: API_KEY });

  console.log("🔗 Generating OAuth connection URLs...");
  console.log(`   Entity: ${ENTITY_ID}\n`);

  for (const app of OAUTH_APPS) {
    if (!app.authConfigId) {
      console.log(`❌ ${app.name}: No auth config ID. Set COMPOSIO_AUTH_CONFIG_${app.name.toUpperCase()} in .env`);
      continue;
    }

    // First check if connection already exists
    try {
      const conns = await composio.connectedAccounts.list({ userId: ENTITY_ID });
      const existing = (conns?.items ?? []).find(
        (c: any) => c.authConfig?.id === app.authConfigId && c.status === "ACTIVE"
      );
      if (existing) {
        console.log(`✅ ${app.name}: Already connected (${existing.id})`);
        continue;
      }
    } catch {
      // ignore list errors
    }

    try {
      const conn = await composio.connectedAccounts.initiate(
        ENTITY_ID,
        app.authConfigId,
      );

      if (conn.redirectUrl) {
        console.log(`🔗 ${app.name}:`);
        console.log(`   ${conn.redirectUrl}`);
        console.log(`   Connection ID: ${conn.id}\n`);
      } else {
        console.log(`⚠️ ${app.name}: No redirect URL returned (status: ${conn.status})`);
      }
    } catch (err) {
      console.log(`❌ ${app.name}: ${(err as Error).message.slice(0, 150)}`);
    }
  }

  console.log("\n📋 Instructions:");
  console.log("1. Open each URL above in your browser");
  console.log("2. Authorize the LeadSens app");
  console.log("3. After authorization, the connection becomes ACTIVE");
  console.log("4. Re-run this script to verify all are connected");
}

main().catch(console.error);
