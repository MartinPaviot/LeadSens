/**
 * Airtable Composio Connector — ExportProvider backed by Composio actions.
 *
 * Replaces direct Airtable HTTP API calls with Composio SDK execution.
 * Uses AIRTABLE_LIST_BASES, AIRTABLE_GET_BASE_SCHEMA, AIRTABLE_CREATE_RECORDS.
 *
 * Records are batched into groups of 10 (Airtable API limit) with
 * 200ms delay between batches for rate limiting (5 req/sec).
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type { ExportProvider, ExportRow } from "../providers/export-provider";

// ─── Constants ──────────────────────────────────────────

const BATCH_SIZE = 10;
const RATE_LIMIT_DELAY_MS = 200;

// ─── Composio Response Types ────────────────────────────

interface AirtableBase {
  id: string;
  name: string;
}

interface AirtableListBasesResponse {
  bases?: AirtableBase[];
}

interface AirtableTable {
  id: string;
  name: string;
  fields?: Array<{ id: string; name: string; type: string }>;
}

interface AirtableGetBaseSchemaResponse {
  tables?: AirtableTable[];
}

interface AirtableCreatedRecord {
  id: string;
}

interface AirtableCreateRecordsResponse {
  records?: AirtableCreatedRecord[];
}

// ─── Target Resolution ──────────────────────────────────

/**
 * Resolve baseId and tableIdOrName from the `sheetOrTable` parameter.
 *
 * If `sheetOrTable` is "baseId/tableId", splits directly.
 * Otherwise, lists bases and tables to auto-resolve the first available target.
 */
async function resolveTarget(
  workspaceId: string,
  sheetOrTable?: string,
): Promise<{ baseId: string; tableIdOrName: string }> {
  // Explicit target: "baseId/tableId"
  if (sheetOrTable) {
    const parts = sheetOrTable.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { baseId: parts[0], tableIdOrName: parts[1] };
    }

    // Single value: try as table name in the first base
    const bases = await listBases(workspaceId);
    if (bases.length === 0) {
      throw new Error("No Airtable bases accessible");
    }
    return { baseId: bases[0].id, tableIdOrName: sheetOrTable };
  }

  // Auto-resolve: first base -> first table
  logger.info("[airtable-composio] no target specified, resolving first base/table");

  const bases = await listBases(workspaceId);
  if (bases.length === 0) {
    throw new Error("No Airtable bases accessible with this connection");
  }

  const baseId = bases[0].id;
  const tables = await listTables(workspaceId, baseId);
  if (tables.length === 0) {
    throw new Error(
      `No tables found in Airtable base "${bases[0].name}" (${baseId})`,
    );
  }

  logger.info("[airtable-composio] auto-resolved target", {
    baseId,
    baseName: bases[0].name,
    tableId: tables[0].id,
    tableName: tables[0].name,
  });

  return { baseId, tableIdOrName: tables[0].id };
}

async function listBases(workspaceId: string): Promise<AirtableBase[]> {
  const result = await executeAction<AirtableListBasesResponse>(
    "AIRTABLE_LIST_BASES",
    workspaceId,
    {},
  );
  return result.bases ?? [];
}

async function listTables(
  workspaceId: string,
  baseId: string,
): Promise<AirtableTable[]> {
  const result = await executeAction<AirtableGetBaseSchemaResponse>(
    "AIRTABLE_GET_BASE_SCHEMA",
    workspaceId,
    { baseId },
  );
  return result.tables ?? [];
}

// ─── ExportProvider Factory ─────────────────────────────

/**
 * Create an Airtable ExportProvider backed by Composio actions.
 *
 * Rows are batched into groups of 10 per Airtable API limits.
 * Each ExportRow is mapped to `{ fields: row }` for record creation.
 */
export function createAirtableComposioExport(
  workspaceId: string,
): ExportProvider {
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
        const { baseId, tableIdOrName } = await resolveTarget(
          workspaceId,
          sheetOrTable,
        );

        let exported = 0;
        const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          // Rate limit between batches
          if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

          const chunk = rows.slice(i, i + BATCH_SIZE);
          const records = chunk.map((row) => ({ fields: { ...row } }));

          const result = await executeAction<AirtableCreateRecordsResponse>(
            "AIRTABLE_CREATE_RECORDS",
            workspaceId,
            {
              baseId,
              tableIdOrName,
              records,
            },
          );

          const created = result.records?.length ?? 0;
          exported += created;
        }

        logger.info("[airtable-composio] export complete", {
          baseId,
          tableIdOrName,
          exported,
          batches: totalBatches,
        });

        return { exported };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[airtable-composio] export failed", {
          error: message,
          rowCount: rows.length,
        });
        return { exported: 0, error: message };
      }
    },
  };
}
