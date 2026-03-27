// Plain ESM script — uses Node.js 22 built-in fetch + Neon HTTP API
// No external dependencies needed.
// Run: node --env-file apps/elevay/.env scripts/create-elevay-brand-profile.mjs

const connStr = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connStr) {
  console.error("ERROR: DATABASE_URL or DIRECT_URL not set");
  process.exit(1);
}

// Parse connection string: postgresql://user:password@host/dbname?...
const url = new URL(connStr.replace("postgresql://", "https://"));
const host = url.hostname;
const password = decodeURIComponent(url.password);
const database = url.pathname.replace("/", "");

console.log(`Connecting to: ${host} / ${database}`);

async function neonQuery(sql) {
  // Neon serverless HTTP API
  const endpoint = `https://${host}/sql`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Neon-Connection-String": connStr,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Neon HTTP API error ${res.status}: ${text}`);
  }
  return res.json();
}

const CREATE_SQL = `
  CREATE TABLE IF NOT EXISTS public.elevay_brand_profile (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "workspaceId" TEXT NOT NULL UNIQUE,
    brand_name TEXT,
    brand_url TEXT,
    country TEXT,
    language TEXT,
    competitors JSONB DEFAULT '[]',
    primary_keyword TEXT,
    secondary_keyword TEXT,
    sector TEXT,
    priority_channels TEXT[] DEFAULT '{}',
    objective TEXT,
    "exportFormat" TEXT,
    report_recurrence TEXT,
    social_connections JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP DEFAULT NOW(),
    "updatedAt" TIMESTAMP DEFAULT NOW()
  )
`;

const VERIFY_SQL = `
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = 'elevay_brand_profile'
`;

try {
  console.log("Creating table...");
  await neonQuery(CREATE_SQL);
  console.log("Table created (or already existed).");

  console.log("Verifying...");
  const result = await neonQuery(VERIFY_SQL);
  const rows = result.rows ?? [];
  if (rows.length > 0) {
    console.log("✓ Table elevay_brand_profile exists in DB.");
  } else {
    console.error("✗ Table not found after creation.");
    process.exit(1);
  }
} catch (e) {
  console.error("Error:", e.message);
  process.exit(1);
}
