import { readFileSync } from "fs";
import { resolve } from "path";
import { Composio, AuthScheme } from "@composio/core";

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

async function main() {
  const composio = new Composio({ apiKey: API_KEY });

  // For the missing API_KEY apps, try creating connection via appName
  const apiKeyApps = [
    { slug: "apollo", envKey: "APOLLO_API_KEY" },
    { slug: "pipedrive", envKey: "PIPEDRIVE_API_KEY" },
    { slug: "airtable", envKey: "AIRTABLE_API_KEY" },
    { slug: "lemlist", envKey: "LEMLIST_API_KEY" },
  ];

  for (const app of apiKeyApps) {
    console.log(`\n--- ${app.slug} ---`);
    const apiKey = process.env[app.envKey];

    // Try initiate with appName (no auth config ID)
    if (apiKey) {
      console.log(`  Has API key from ${app.envKey}`);
      try {
        const conn = await composio.connectedAccounts.initiate(
          ENTITY_ID,
          undefined as unknown as string,
          {
            appName: app.slug,
            config: AuthScheme.APIKey({ generic_api_key: apiKey }),
          },
        );
        console.log(`  ✅ Connection: ${conn.id} (${conn.status})`);
      } catch (err: any) {
        const details = err?.cause?.error?.error ?? {};
        console.log(`  ❌ ${details.message ?? err.message}`.slice(0, 200));
        if (details.suggested_fix) console.log(`  Fix: ${details.suggested_fix}`);

        // Try without authConfigId parameter
        try {
          console.log("  Trying alternative: link()...");
          const entity = await composio.connectedAccounts.link(
            ENTITY_ID,
            app.slug,
            { generic_api_key: apiKey },
          );
          console.log(`  ✅ Link: ${JSON.stringify(entity).slice(0, 200)}`);
        } catch (err2: any) {
          console.log(`  ❌ Link: ${err2.message}`.slice(0, 200));
        }
      }
    } else {
      console.log(`  ℹ️ No ${app.envKey} in .env — skipping (you'll provide it)`);
    }
  }

  // Also check: what auth configs exist now?
  console.log("\n\n--- Current auth configs ---");
  const all = await (composio as any).authConfigs.list({});
  for (const c of (all?.items ?? [])) {
    const slug = c.toolkit?.slug ?? "?";
    console.log(`  ${c.id} | ${slug} | ${c.authScheme}`);
  }
}
main().catch(console.error);
