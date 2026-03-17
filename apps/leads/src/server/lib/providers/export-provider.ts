/**
 * ExportProvider — Abstraction for data export destinations.
 *
 * Future implementations: Google Sheets, Airtable, Notion, etc.
 */

export interface ExportRow {
  [key: string]: string | number | boolean | null;
}

export interface ExportProvider {
  readonly name: string;

  /** Export rows to the destination */
  exportRows(rows: ExportRow[], sheetOrTable?: string): Promise<{ exported: number; error?: string }>;
}
