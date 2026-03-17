/**
 * Test script: Composio SDK → Instantly API
 * Run: npx tsx scripts/test-composio-instantly.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { Composio, AuthScheme } from "@composio/core";

// Load .env
const envPath = resolve(process.cwd(), ".env");
for (const rawLine of readFileSync(envPath, "utf-8").split("\n")) {
  const line = rawLine.replace(/\r$/, "");
  const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (match) {
    const val = match[2].replace(/^"|"$/g, "").trim();
    if (!process.env[match[1]]) process.env[match[1]] = val;
  }
}

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY!;
const INSTANTLY_API_KEY = process.env.INSTANTLY_API_KEY!;
const ENTITY_ID = (process.env.COMPOSIO_ENTITY_ID ?? "default").replace(/"/g, "");

async function main() {
  const composio = new Composio({ apiKey: COMPOSIO_API_KEY });

  // Step 1: Find auth config
  const configs = await (composio as any).authConfigs.list({ toolkit: "instantly" });
  const authConfigId = configs.items.find(
    (c: any) => c.authScheme === "API_KEY" && !c.isDisabled
  )?.id;
  console.log(`Auth config: ${authConfigId}`);

  // Step 2: Create/verify connection
  try {
    const conn = await composio.connectedAccounts.initiate(
      ENTITY_ID, authConfigId,
      { config: AuthScheme.APIKey({ generic_api_key: INSTANTLY_API_KEY }) },
    );
    console.log(`Connection: ${conn.id} (${conn.status})`);
  } catch (err) {
    console.log("Connection exists or error:", (err as Error).message.slice(0, 100));
  }

  // Step 3: LIST_ACCOUNTS — count mailboxes
  console.log("\nFetching accounts (paginated)...");
  let total = 0;
  let cursor: string | undefined;
  const emails: string[] = [];

  do {
    const args: Record<string, unknown> = { limit: 100, status: 1 };
    if (cursor) args.starting_after = cursor;

    const result = await composio.tools.execute("INSTANTLY_LIST_ACCOUNTS", {
      userId: ENTITY_ID,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    }) as any;

    const items = result?.items ?? result?.data?.items ?? [];
    total += items.length;
    for (const acc of items) {
      if (acc?.email) emails.push(acc.email);
    }
    cursor = result?.next_starting_after;
    console.log(`   Page: ${items.length} accounts (total so far: ${total})`);
  } while (cursor);

  console.log(`\n✅ Total mailboxes: ${total}`);
  console.log(`   First 5: ${emails.slice(0, 5).join(", ")}`);
  console.log(`   Last 5:  ${emails.slice(-5).join(", ")}`);
  console.log(`\n📌 Save these to .env:`);
  console.log(`   COMPOSIO_AUTH_CONFIG_INSTANTLY="${authConfigId}"`);
}

main().catch(console.error);
