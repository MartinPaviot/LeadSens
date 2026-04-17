import type {
  GenerationOutput,
  ExportFormat,
  ExportResult,
} from "../core/types"
import { prisma } from "@/lib/prisma"
import { agentWarn } from "@/agents/_shared/agent-logger"

const AGENT = "SCW-16"

/**
 * Export generated content to CSV format.
 * Returns CSV string content for download.
 */
export function exportToCSV(output: GenerationOutput): string {
  const header = [
    "Platform",
    "Format",
    "Variation",
    "Content",
    "Hashtags",
    "CTA",
    "Characters",
    "Limit",
  ].join(",")

  const rows = output.variations.map((v) => {
    const escapedContent = `"${v.content.replace(/"/g, '""')}"`
    const escapedCta = `"${v.cta.replace(/"/g, '""')}"`
    return [
      v.platform,
      v.format,
      v.variationIndex + 1,
      escapedContent,
      `"${v.hashtags.join(", ")}"`,
      escapedCta,
      v.characterCount,
      v.characterLimit,
    ].join(",")
  })

  return [header, ...rows].join("\n")
}

/**
 * Export content to Google Sheets via the Sheets API.
 */
async function exportToGoogleSheets(output: GenerationOutput, workspaceId?: string): Promise<ExportResult> {
  if (!workspaceId) {
    return { format: "sheets", itemCount: output.variations.length, exportedAt: new Date().toISOString() }
  }

  const integration = await prisma.integration.findFirst({
    where: { workspaceId, type: "google-drive", status: "ACTIVE" },
    select: { accessToken: true },
  })

  if (!integration?.accessToken) {
    agentWarn(AGENT, "exporter", "No Google Drive integration connected for Sheets export")
    return { format: "sheets", itemCount: output.variations.length, exportedAt: new Date().toISOString() }
  }

  try {
    // Create a new spreadsheet
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { title: `Elevay Content — ${new Date().toLocaleDateString()}` },
        sheets: [{ properties: { title: "Content Variations" } }],
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!createRes.ok) {
      agentWarn(AGENT, "exporter", `Google Sheets API create failed: ${createRes.status}`)
      return { format: "sheets", itemCount: output.variations.length, exportedAt: new Date().toISOString() }
    }

    const sheet = await createRes.json() as { spreadsheetId?: string; spreadsheetUrl?: string }
    if (!sheet.spreadsheetId) {
      return { format: "sheets", itemCount: output.variations.length, exportedAt: new Date().toISOString() }
    }

    // Write data to the sheet
    const headers = ["Platform", "Format", "Variation", "Content", "Hashtags", "CTA", "Characters"]
    const rows = output.variations.map((v) => [
      v.platform,
      v.format,
      String(v.variationIndex + 1),
      v.content,
      v.hashtags.join(", "),
      v.cta,
      String(v.characterCount),
    ])

    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet.spreadsheetId}/values/A1:G${rows.length + 1}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${integration.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [headers, ...rows] }),
        signal: AbortSignal.timeout(15_000),
      },
    )

    return {
      format: "sheets",
      url: sheet.spreadsheetUrl,
      itemCount: output.variations.length,
      exportedAt: new Date().toISOString(),
    }
  } catch (err) {
    agentWarn(AGENT, "exporter", "Google Sheets export failed", err instanceof Error ? err.message : err)
    return { format: "sheets", itemCount: output.variations.length, exportedAt: new Date().toISOString() }
  }
}

/**
 * Export to the requested format.
 * CSV is fully local. Sheets uses Google API. Scheduler tools are not yet integrated.
 */
export async function exportContent(
  output: GenerationOutput,
  format: ExportFormat,
  workspaceId?: string,
): Promise<ExportResult> {
  switch (format) {
    case "csv": {
      return {
        format: "csv",
        itemCount: output.variations.length,
        exportedAt: new Date().toISOString(),
      }
    }
    case "sheets":
      return exportToGoogleSheets(output, workspaceId)
    case "hootsuite":
    case "buffer":
    case "loomly":
      agentWarn(AGENT, "exporter", `${format} export not yet implemented`)
      return {
        format,
        itemCount: output.variations.length,
        exportedAt: new Date().toISOString(),
      }
  }
}
