import type {
  GenerationOutput,
  ExportFormat,
  ExportResult,
} from "../core/types"

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
 * Export to the requested format.
 * V1: Only CSV is fully implemented. Sheets/Hootsuite/Buffer/Loomly are stubs.
 */
export async function exportContent(
  output: GenerationOutput,
  format: ExportFormat,
): Promise<ExportResult> {
  switch (format) {
    case "csv": {
      const csv = exportToCSV(output)
      // In a route handler, this would be returned as a downloadable file
      return {
        format: "csv",
        itemCount: output.variations.length,
        exportedAt: new Date().toISOString(),
      }
    }
    case "sheets":
      // TODO: Implement Google Sheets export via Composio
      return {
        format: "sheets",
        itemCount: output.variations.length,
        exportedAt: new Date().toISOString(),
      }
    case "hootsuite":
    case "buffer":
    case "loomly":
      // TODO: Implement scheduler injection via Composio
      return {
        format,
        itemCount: output.variations.length,
        exportedAt: new Date().toISOString(),
      }
  }
}
