/**
 * Notion Connector — Export data to Notion databases.
 *
 * Endpoints used:
 * - GET  /v1/users/me — Test connection (auth check)
 * - POST /v1/search   — Search for databases
 * - POST /v1/pages    — Create a page (row) in a database
 *
 * Auth: `Authorization: Bearer ntn_TOKEN` + `Notion-Version: 2022-06-28`
 * Rate limit: 3 req/sec
 * API docs: https://developers.notion.com/reference
 */

import { z } from "zod/v4";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type { ExportProvider, ExportRow } from "../providers/export-provider";

const NOTION_BASE = "https://api.notion.com";
const NOTION_VERSION = "2022-06-28";
const MAX_RETRIES = 3;
const RATE_LIMIT_DELAY_MS = 350; // 3 req/sec → 333ms min, 350ms for safety

// ─── API Response Schemas ───────────────────────────────

const notionUserSchema = z.object({
  object: z.literal("user"),
  id: z.string(),
});

const notionDatabaseSchema = z.object({
  object: z.literal("database"),
  id: z.string(),
  title: z.array(z.object({ plain_text: z.string().optional() })).optional(),
});

const notionSearchSchema = z.object({
  results: z.array(notionDatabaseSchema),
});

const notionPageSchema = z.object({
  object: z.literal("page"),
  id: z.string(),
});

// ─── API Helpers ────────────────────────────────────────

function buildHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };
}

async function notionFetch(
  apiKey: string,
  path: string,
  method: "GET" | "POST" = "GET",
  body?: Record<string, unknown>,
): Promise<unknown> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${NOTION_BASE}${path}`, {
        method,
        headers: buildHeaders(apiKey),
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw new Error(
        `Notion ${method} ${path} failed: ${err instanceof Error ? err.message : "network error"}`,
      );
    }

    if (res.ok) {
      return res.json();
    }

    // Retry on 429 or 5xx
    if ((res.status === 429 || res.status >= 500) && attempt < MAX_RETRIES) {
      const retryAfter = res.headers.get("retry-after");
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * 1000;
      await sleep(delay);
      continue;
    }

    const text = await res.text().catch(() => "");
    throw new Error(
      `Notion ${method} ${path} returned ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  throw new Error(`Notion ${method} ${path} failed after ${MAX_RETRIES} retries`);
}

// ─── Property Mapping ───────────────────────────────────

/**
 * Map a key/value pair to a Notion page property.
 * - string → rich_text
 * - number → number
 * - boolean → checkbox
 * - null → skip (omitted by caller)
 */
function toNotionProperty(
  value: string | number | boolean,
): Record<string, unknown> {
  if (typeof value === "number") {
    return { number: value };
  }
  if (typeof value === "boolean") {
    return { checkbox: value };
  }
  // string
  return {
    rich_text: [{ text: { content: String(value).slice(0, 2000) } }],
  };
}

/**
 * Build Notion properties payload from an ExportRow.
 * Skips null values (Notion doesn't accept null property writes).
 */
function buildProperties(
  row: ExportRow,
): Record<string, Record<string, unknown>> {
  const properties: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null) continue;
    properties[key] = toNotionProperty(value);
  }
  return properties;
}

// ─── Public API ─────────────────────────────────────────

/**
 * Test Notion API key by fetching the current user.
 * Returns true if the token is valid.
 */
export async function testNotionConnection(apiKey: string): Promise<boolean> {
  try {
    const json = await notionFetch(apiKey, "/v1/users/me");
    const parsed = notionUserSchema.safeParse(json);
    return parsed.success;
  } catch {
    return false;
  }
}

/**
 * Search for the first available Notion database.
 * Returns the database ID or null if none found.
 */
async function findFirstDatabase(apiKey: string): Promise<string | null> {
  try {
    const json = await notionFetch(apiKey, "/v1/search", "POST", {
      filter: { value: "database", property: "object" },
      page_size: 1,
    });
    const parsed = notionSearchSchema.safeParse(json);
    if (!parsed.success || parsed.data.results.length === 0) return null;
    return parsed.data.results[0].id;
  } catch (err) {
    logger.warn("Notion: failed to search databases", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ─── ExportProvider implementation ──────────────────────

export function createNotionExport(apiKey: string): ExportProvider {
  return {
    name: "notion",

    async exportRows(
      rows: ExportRow[],
      sheetOrTable?: string,
    ): Promise<{ exported: number; error?: string }> {
      // Resolve database ID
      const databaseId = sheetOrTable ?? (await findFirstDatabase(apiKey));
      if (!databaseId) {
        return { exported: 0, error: "No Notion database ID provided and no databases found" };
      }

      let exported = 0;

      for (let i = 0; i < rows.length; i++) {
        // Rate limit: 3 req/sec
        if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

        const properties = buildProperties(rows[i]);

        try {
          const json = await notionFetch(apiKey, "/v1/pages", "POST", {
            parent: { database_id: databaseId },
            properties,
          });

          const parsed = notionPageSchema.safeParse(json);
          if (parsed.success) {
            exported++;
          } else {
            logger.warn("Notion: unexpected page response", {
              row: i,
              response: JSON.stringify(json).slice(0, 200),
            });
          }
        } catch (err) {
          // Parse Notion error for better diagnostics
          const message = err instanceof Error ? err.message : String(err);
          logger.error("Notion: failed to create page", {
            row: i,
            error: message,
          });

          // If it's an auth or permission error, abort early
          if (
            message.includes("returned 401") ||
            message.includes("returned 403")
          ) {
            return {
              exported,
              error: `Auth/permission error at row ${i}: ${message}`,
            };
          }
          // For other errors, continue with remaining rows
        }
      }

      logger.info("Notion: export complete", {
        exported,
        total: rows.length,
        databaseId,
      });

      return { exported };
    },
  };
}
