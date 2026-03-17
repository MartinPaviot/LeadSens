/**
 * Notion Composio Connector — ExportProvider backed by Composio actions.
 *
 * Replaces direct Notion HTTP API calls with Composio SDK execution.
 * Uses NOTION_SEARCH_NOTION_PAGE and NOTION_CREATE_NOTION_PAGE actions.
 *
 * Property mapping: all values are converted to rich_text for simplicity.
 * The first property in the database title column uses the `title` type.
 * Rate limit: 350ms between page creations (Notion: 3 req/sec).
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import { sleep } from "./fetch-retry";
import type { ExportProvider, ExportRow } from "../providers/export-provider";

// ─── Constants ──────────────────────────────────────────

const RATE_LIMIT_DELAY_MS = 350; // Notion: 3 req/sec -> 333ms min, 350ms for safety

// ─── Composio Response Types ────────────────────────────

interface NotionTitlePart {
  text?: { content?: string };
  plain_text?: string;
}

interface NotionDatabaseResult {
  id: string;
  object?: string;
  title?: NotionTitlePart[];
}

interface NotionSearchResponse {
  results?: NotionDatabaseResult[];
}

interface NotionPageResponse {
  id?: string;
  object?: string;
}

// ─── Database Resolution ────────────────────────────────

/**
 * Search for a Notion database by name.
 * If no name given, returns the first database found.
 */
async function findDatabase(
  workspaceId: string,
  name?: string,
): Promise<string | null> {
  try {
    const result = await executeAction<NotionSearchResponse>(
      "NOTION_SEARCH_NOTION_PAGE",
      workspaceId,
      {
        query: name ?? "",
        filter: { property: "object", value: "database" },
      },
    );

    const results = result.results;
    if (!results || results.length === 0) return null;

    // If name is provided, try to match it
    if (name) {
      const needle = name.toLowerCase();
      const match = results.find((db) => {
        const dbTitle = extractDatabaseTitle(db);
        return dbTitle.toLowerCase().includes(needle);
      });
      if (match) return match.id;
    }

    // Return first result
    return results[0].id;
  } catch (err) {
    logger.warn("[notion-composio] findDatabase failed", {
      workspaceId,
      name,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Extract the title string from a Notion database result.
 */
function extractDatabaseTitle(db: NotionDatabaseResult): string {
  if (!db.title || db.title.length === 0) return "";
  const first = db.title[0];
  return first.plain_text ?? first.text?.content ?? "";
}

// ─── Property Mapping ───────────────────────────────────

/**
 * Build Notion page properties from an ExportRow.
 *
 * The first key uses the `title` type (required by Notion as the
 * database title column). All other keys use `rich_text`.
 * Null values are skipped.
 */
function buildProperties(
  row: ExportRow,
  titlePropertyName?: string,
): Record<string, Record<string, unknown>> {
  const properties: Record<string, Record<string, unknown>> = {};
  const keys = Object.keys(row);

  // Determine which key is the title property
  const titleKey = titlePropertyName ?? keys[0];

  for (const key of keys) {
    const value = row[key];
    if (value === null) continue;

    const stringValue = String(value).slice(0, 2000);

    if (key === titleKey) {
      properties[key] = {
        title: [{ text: { content: stringValue } }],
      };
    } else {
      properties[key] = {
        rich_text: [{ text: { content: stringValue } }],
      };
    }
  }

  return properties;
}

// ─── ExportProvider Factory ─────────────────────────────

/**
 * Create a Notion ExportProvider backed by Composio actions.
 *
 * Each row is created as a page in a Notion database.
 * Rate-limited to 3 requests per second per Notion API limits.
 */
export function createNotionComposioExport(
  workspaceId: string,
): ExportProvider {
  return {
    name: "notion",

    async exportRows(
      rows: ExportRow[],
      sheetOrTable?: string,
    ): Promise<{ exported: number; error?: string }> {
      if (rows.length === 0) {
        return { exported: 0 };
      }

      // Resolve the target database
      const databaseId = await findDatabase(workspaceId, sheetOrTable);
      if (!databaseId) {
        return {
          exported: 0,
          error: sheetOrTable
            ? `Notion database "${sheetOrTable}" not found`
            : "No Notion database found. Share a database with the integration first.",
        };
      }

      let exported = 0;

      // Determine the title property name from the first row's keys
      const firstRowKeys = Object.keys(rows[0]);
      const titlePropertyName = firstRowKeys[0];

      for (let i = 0; i < rows.length; i++) {
        // Rate limit between page creations
        if (i > 0) await sleep(RATE_LIMIT_DELAY_MS);

        const properties = buildProperties(rows[i], titlePropertyName);

        try {
          const result = await executeAction<NotionPageResponse>(
            "NOTION_CREATE_NOTION_PAGE",
            workspaceId,
            {
              parent: { database_id: databaseId },
              properties,
            },
          );

          if (result.id) {
            exported++;
          } else {
            logger.warn("[notion-composio] page creation returned no id", {
              row: i,
            });
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error("[notion-composio] failed to create page", {
            row: i,
            error: message,
          });

          // Abort on auth/permission errors
          if (message.includes("401") || message.includes("403")) {
            return {
              exported,
              error: `Auth/permission error at row ${i}: ${message}`,
            };
          }
          // Continue on other errors
        }
      }

      logger.info("[notion-composio] export complete", {
        exported,
        total: rows.length,
        databaseId,
      });

      return { exported };
    },
  };
}
