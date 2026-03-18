/**
 * Google Sheets Composio Connector — ExportProvider backed by Composio actions.
 *
 * Uses Composio's Google Sheets integration to append rows to a spreadsheet.
 * The `sheetOrTable` parameter accepts:
 *   - A Google Sheets URL (spreadsheet ID is extracted automatically)
 *   - A plain spreadsheet ID
 *   - A "spreadsheetId/sheetName" pair
 *   - Omitted: creates a new spreadsheet named "LeadSens Export"
 *
 * Composio action names (verify in Composio dashboard if these change):
 *   GOOGLESHEETS_CREATE_SPREADSHEET — create new spreadsheet
 *   GOOGLESHEETS_BATCH_UPDATE_VALUES_IN_SPREADSHEET — write rows
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type { ExportProvider, ExportRow } from "../providers/export-provider";

// ─── Composio Response Types ────────────────────────────

interface CreateSpreadsheetResponse {
  spreadsheetId?: string;
  spreadsheetUrl?: string;
}

interface BatchUpdateResponse {
  spreadsheetId?: string;
  totalUpdatedRows?: number;
  totalUpdatedCells?: number;
}

// ─── Helpers ────────────────────────────────────────────

/**
 * Extract spreadsheet ID from a Google Sheets URL or return the value as-is.
 *
 * URL format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
 */
function extractSpreadsheetId(value: string): string {
  const urlMatch = value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  // "spreadsheetId/sheetName" or plain ID
  return value.split("/")[0] ?? value;
}

/**
 * Extract sheet name from "spreadsheetId/sheetName" — defaults to "Sheet1".
 */
function extractSheetName(value: string): string {
  if (value.includes("/spreadsheets/d/")) {
    // URL format doesn't encode sheet name; default to first sheet
    return "Sheet1";
  }
  const parts = value.split("/");
  return parts.length >= 2 ? (parts[1] ?? "Sheet1") : "Sheet1";
}

/**
 * Convert ExportRow[] to a 2D values array for the Sheets API.
 * First row = headers, remaining rows = values.
 */
function rowsToValues(rows: ExportRow[]): string[][] {
  if (rows.length === 0) return [];

  const headers = Object.keys(rows[0]!);
  const headerRow = headers;
  const dataRows = rows.map((row) =>
    headers.map((h) => {
      const v = row[h];
      if (v === null || v === undefined) return "";
      return String(v);
    }),
  );

  return [headerRow, ...dataRows];
}

// ─── ExportProvider Factory ─────────────────────────────

/**
 * Create a Google Sheets ExportProvider backed by Composio actions.
 */
export function createGoogleSheetsComposioExport(
  workspaceId: string,
): ExportProvider {
  return {
    name: "google_sheets",

    async exportRows(
      rows: ExportRow[],
      sheetOrTable?: string,
    ): Promise<{ exported: number; error?: string }> {
      if (rows.length === 0) {
        return { exported: 0 };
      }

      try {
        let spreadsheetId: string;
        let sheetName: string;

        if (sheetOrTable) {
          spreadsheetId = extractSpreadsheetId(sheetOrTable);
          sheetName = extractSheetName(sheetOrTable);
        } else {
          // Auto-create a new spreadsheet
          logger.info("[google-sheets-composio] no target specified, creating new spreadsheet");
          const created = await executeAction<CreateSpreadsheetResponse>(
            "GOOGLESHEETS_CREATE_SPREADSHEET",
            workspaceId,
            { title: "LeadSens Export" },
          );
          if (!created.spreadsheetId) {
            throw new Error("Google Sheets did not return a spreadsheet ID");
          }
          spreadsheetId = created.spreadsheetId;
          sheetName = "Sheet1";
          logger.info("[google-sheets-composio] created new spreadsheet", {
            spreadsheetId,
            url: created.spreadsheetUrl,
          });
        }

        const values = rowsToValues(rows);
        const range = `${sheetName}!A1`;

        const result = await executeAction<BatchUpdateResponse>(
          "GOOGLESHEETS_BATCH_UPDATE_VALUES_IN_SPREADSHEET",
          workspaceId,
          {
            spreadsheetId,
            range,
            values,
            valueInputOption: "USER_ENTERED",
          },
        );

        const exported = result.totalUpdatedRows ?? rows.length;

        logger.info("[google-sheets-composio] export complete", {
          spreadsheetId,
          sheetName,
          exported,
        });

        return { exported };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("[google-sheets-composio] export failed", {
          error: message,
          rowCount: rows.length,
        });
        return { exported: 0, error: message };
      }
    },
  };
}
