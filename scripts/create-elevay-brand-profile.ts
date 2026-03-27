import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(__dirname, "../apps/elevay/.env") });

// Import after env is loaded
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(`
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
  `);
  console.log("Table created successfully");

  // Verify
  const rows = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='elevay_brand_profile'`
  );
  if (rows.length > 0) {
    console.log("Verified: table exists in DB");
  } else {
    console.error("ERROR: table not found after creation");
    process.exit(1);
  }

  await prisma.$disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
