export function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatArrayField(items: unknown[] | null | undefined): string {
  if (!items?.length) return "";
  return items
    .map((item) =>
      typeof item === "string"
        ? item
        : typeof item === "object" && item !== null
          ? formatStructuredSignal(item as Record<string, unknown>)
          : String(item),
    )
    .join("; ");
}

function formatStructuredSignal(obj: Record<string, unknown>): string {
  const text = (obj.event ?? obj.statement ?? obj.change ?? "") as string;
  const date = obj.date as string | null | undefined;
  return date ? `${text} (${date})` : text;
}

export function downloadBlob(content: string, filename: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["\uFEFF" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
