/**
 * Setup Composio auth configs for all migratable apps.
 *
 * For each app, finds or creates an auth config and prints the env var to set.
 * Run: npx tsx scripts/setup-composio-auth-configs.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Composio } from "@composio/core";

// Load .env
for (const rawLine of readFileSync(resolve(process.cwd(), ".env"), "utf-8").split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    const val = match[2].replace(/^"|"$/g, "").trim();
    if (!process.env[match[1]]) process.env[match[1]] = val;
  }
}

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY!;

// Apps to configure with their auth scheme
const APPS = [
  // API Key apps
  { slug: "instantly", envVar: "COMPOSIO_AUTH_CONFIG_INSTANTLY", scheme: "API_KEY" },
  { slug: "apollo", envVar: "COMPOSIO_AUTH_CONFIG_APOLLO", scheme: "API_KEY" },
  { slug: "pipedrive", envVar: "COMPOSIO_AUTH_CONFIG_PIPEDRIVE", scheme: "API_KEY" },
  { slug: "airtable", envVar: "COMPOSIO_AUTH_CONFIG_AIRTABLE", scheme: "API_KEY" },
  { slug: "notion", envVar: "COMPOSIO_AUTH_CONFIG_NOTION", scheme: "API_KEY" },
  { slug: "lemlist", envVar: "COMPOSIO_AUTH_CONFIG_LEMLIST", scheme: "API_KEY" },
  // OAuth apps
  { slug: "hubspot", envVar: "COMPOSIO_AUTH_CONFIG_HUBSPOT", scheme: "OAUTH2" },
  { slug: "salesforce", envVar: "COMPOSIO_AUTH_CONFIG_SALESFORCE", scheme: "OAUTH2" },
  { slug: "calendly", envVar: "COMPOSIO_AUTH_CONFIG_CALENDLY", scheme: "OAUTH2" },
  { slug: "slack", envVar: "COMPOSIO_AUTH_CONFIG_SLACK", scheme: "OAUTH2" },
  { slug: "zoominfo", envVar: "COMPOSIO_AUTH_CONFIG_ZOOMINFO", scheme: "OAUTH2" },
];

async function main() {
  const composio = new Composio({ apiKey: COMPOSIO_API_KEY });
  const authConfigs = (composio as any).authConfigs;

  console.log("🔧 Finding/creating auth configs for all apps...\n");

  const envLines: string[] = [];

  for (const app of APPS) {
    process.stdout.write(`${app.slug.padEnd(12)} `);

    try {
      // List existing configs
      const list = await authConfigs.list({ toolkit: app.slug });
      const items = list?.items ?? [];

      // Find matching auth config
      let config = items.find(
        (c: any) => c.authScheme === app.scheme && !c.isDisabled
      );

      // For OAuth, prefer Composio-managed (built-in OAuth app)
      if (app.scheme === "OAUTH2") {
        const managed = items.find(
          (c: any) => c.authScheme === "OAUTH2" && c.isComposioManaged && !c.isDisabled
        );
        if (managed) config = managed;
      }

      if (config) {
        console.log(`✅ Found: ${config.id} (${config.authScheme}, managed=${config.isComposioManaged ?? false})`);
        envLines.push(`${app.envVar}="${config.id}"`);
      } else if (items.length > 0) {
        // Use first available
        config = items[0];
        console.log(`ℹ️  Using: ${config.id} (${config.authScheme}, only option)`);
        envLines.push(`${app.envVar}="${config.id}"`);
      } else {
        // No config exists — try to create for API_KEY apps
        if (app.scheme === "API_KEY") {
          try {
            const created = await authConfigs.create({
              toolkitSlug: app.slug,
              name: `LeadSens ${app.slug}`,
              authScheme: "API_KEY",
              useComposioAuth: false,
            });
            console.log(`🆕 Created: ${created.id}`);
            envLines.push(`${app.envVar}="${created.id}"`);
          } catch (err) {
            console.log(`❌ Create failed: ${(err as Error).message.slice(0, 100)}`);
          }
        } else {
          console.log(`❌ No auth config found. Set up OAuth in Composio dashboard.`);
        }
      }
    } catch (err) {
      console.log(`❌ Error: ${(err as Error).message.slice(0, 100)}`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📋 Add these to your .env file:\n");
  console.log("# Composio Auth Configs");
  for (const line of envLines) {
    console.log(line);
  }
  console.log("");
}

main().catch(console.error);
