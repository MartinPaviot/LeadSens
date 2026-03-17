/**
 * Airtable Connector — Export provider for pushing data to Airtable bases.
 *
 * Endpoints used:
 * - GET  /v0/meta/bases                — List accessible bases (connection test)
 * - GET  /v0/meta/bases/{baseId}/tables — List tables in a base
 * - POST /v0/{baseId}/{tableId}        — Create records (batch: up to 10/request)
 *
 * Auth: `Authorization: Bearer PAT_TOKEN` header (Personal Access Token)
 * Rate limit: 5 req/sec → 200ms sleep between batches
 * API docs: https://airtable.com/developers/web/api/introduction
 */

import { z } from "zod/v4";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type { ExportProvider, ExportRow } from "../providers/export-provider";

const AT_BASE = "https://api.airtable.com";
const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY_MS = 200;
const REQUEST_TIMEOUT_MS = 15_000;

// ─── API Response Schemas ───────────────────────────────

const atBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const atBasesListSchema = z.object({
  bases: z.array(atBaseSchema),
});

const atTableSchema = z.object({
  id: z.string(),
  name: z.string(),
});

const atTablesListSchema = z.object({
  tables: z.array(atTableSchema),
});

const atCreateRecordsSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
    }),
  ),
});

// ─── API Helpers ────────────────────────────────────────

async function atFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${AT_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Airtable ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

// ─── Connection Test ────────────────────────────────────

/**
 * Test Airtable API key by listing accessible bases.
 * Returns true if the PAT is valid and can list bases.
 */
export async function testAirtableConnection(apiKey: string): Promise<boolean> {
  try {
    const json = await atFetch(apiKey, "/v0/meta/bases");
    const parsed = atBasesListSchema.safeParse(json);
    return parsed.success;
  } catch (err) {
    logger.warn("Airtable connection test failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ─── Internal Helpers ───────────────────────────────────

/**
 * Resolve baseId/tableId from the `sheetOrTable` param.
 * Expected format: "baseId/tableId". If not provided, uses first base's first table.
 */
async function resolveTarget(
  apiKey: string,
  sheetOrTable?: string,
): Promise<{ baseId: string; tableId: string }> {
  if (sheetOrTable) {
    const parts = sheetOrTable.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      throw new Error(
        `Invalid Airtable target "${sheetOrTable}". Expected format: "baseId/tableId"`,
      );
    }
    return { baseId: parts[0], tableId: parts[1] };
  }

  // Auto-resolve: first base → first table
  logger.info("Airtable: no target specified, resolving first base/table");

  const basesJson = await atFetch(apiKey, "/v0/meta/bases");
  const bases = atBasesListSchema.parse(basesJson);

  if (bases.bases.length === 0) {
    throw new Error("No Airtable bases accessible with this API key");
  }

  const baseId = bases.bases[0].id;

  const tablesJson = await atFetch(apiKey, `/v0/meta/bases/${baseId}/tables`);
  const tables = atTablesListSchema.parse(tablesJson);

  if (tables.tables.length === 0) {
    throw new Error(`No tables found in Airtable base "${bases.bases[0].name}" (${baseId})`);
  }

  const tableId = tables.tables[0].id;
  logger.info("Airtable: auto-resolved target", {
    baseId,
    baseName: bases.bases[0].name,
    tableId,
    tableName: tables.tables[0].name,
  });

  return { baseId, tableId };
}

// ─── ExportProvider Implementation ──────────────────────

/**
 * Create an Airtable ExportProvider instance.
 */
export function createAirtableExport(apiKey: string): ExportProvider {
  return {
    name: "airtable",

    async exportRows(
      rows: ExportRow[],
      sheetOrTable?: string,
    ): Promise<{ exported: number; error?: string }> {
      if (rows.length === 0) {
        return { exported: 0 };
      }

      try {
        const { baseId, tableId } = await resolveTarget(apiKey, sheetOrTable);
        let exported = 0;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

          const chunk = rows.slice(i, i + BATCH_SIZE);
          const records = chunk.map((row) => ({ fields: { ...row } }));

          const json = await atFetch(
            apiKey,
            `/v0/${baseId}/${tableId}`,
            "POST",
            { records },
          );

          const parsed = atCreateRecordsSchema.parse(json);
          exported += parsed.records.length;
        }

        logger.info("Airtable export complete", {
          baseId,
          tableId,
          exported,
          batches: Math.ceil(rows.length / BATCH_SIZE),
        });

        return { exported };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Airtable export failed", { error: message, rowCount: rows.length });
        return { exported: 0, error: message };
      }
    },
  };
}
