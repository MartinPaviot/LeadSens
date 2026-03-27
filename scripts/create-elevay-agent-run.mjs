// Run: node --env-file apps/elevay/.env scripts/create-elevay-agent-run.mjs

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connStr) { console.error("ERROR: DATABASE_URL or DIRECT_URL not set"); process.exit(1); }

const url = new URL(connStr.replace("postgresql://", "https://"));
const host = url.hostname;

console.log(`Connecting to: ${host}`);

async function neonQuery(sql) {
  const res = await fetch(`https://${host}/sql`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Neon-Connection-String": connStr },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`Neon HTTP API error ${res.status}: ${await res.text()}`);
  return res.json();
}

await neonQuery(`
  CREATE TABLE IF NOT EXISTS public.elevay_agent_run (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    output JSONB,
    "degradedSources" TEXT[] DEFAULT '{}',
    "durationMs" INTEGER,
    "brandProfileId" TEXT,
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  )
`);

await neonQuery(`
  CREATE INDEX IF NOT EXISTS elevay_agent_run_workspace_idx
  ON public.elevay_agent_run ("workspaceId", "agentCode", status, "createdAt" DESC)
`);

const rows = await neonQuery(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='elevay_agent_run'`
);
if ((rows.rows ?? []).length > 0) {
  console.log("✓ Table elevay_agent_run exists in DB.");
} else {
  console.error("✗ Table not found after creation."); process.exit(1);
}
