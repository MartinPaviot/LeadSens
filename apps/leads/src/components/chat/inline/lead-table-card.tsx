"use client";

import { useCallback, useMemo, useState } from "react";
import { Badge, Button, Card } from "@leadsens/ui";
import { DownloadSimple, CaretDown } from "@phosphor-icons/react";
import { escapeCsv, downloadBlob } from "@/lib/csv-utils";

interface LeadRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  company?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  icpScore?: number | null;
  status: string;
  enrichmentContext?: string | null;
  enrichmentLinkedin?: string | null;
  enrichmentSignals?: string | null;
  enrichmentDiagnostic?: string | null;
}

interface LeadTableCardProps {
  title: string;
  leads: LeadRow[];
  campaignId?: string;
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return null;
  if (score >= 8) return <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px] py-0">{score}</Badge>;
  if (score >= 5) return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30 text-[10px] py-0">{score}</Badge>;
  return <Badge className="bg-red-600/20 text-red-400 border-red-600/30 text-[10px] py-0">{score}</Badge>;
}

/** Calculate enrichment completeness and show a tiny quality indicator */
function DataQualityBadge({ lead }: { lead: LeadRow }) {
  const fields = [
    { key: "email", has: !!lead.email },
    { key: "company", has: !!lead.company },
    { key: "title", has: !!lead.jobTitle },
    { key: "LinkedIn", has: !!lead.linkedinUrl },
    { key: "context", has: !!lead.enrichmentContext },
    { key: "signals", has: !!lead.enrichmentSignals },
  ];
  const filled = fields.filter((f) => f.has).length;
  const pct = Math.round((filled / fields.length) * 100);
  const missing = fields.filter((f) => !f.has).map((f) => f.key);

  const color =
    pct >= 80
      ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
      : pct >= 50
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : "text-red-400 bg-red-500/10 border-red-500/20";

  return (
    <span
      className={`inline-flex items-center px-1 py-0 rounded text-[9px] font-medium border ${color}`}
      title={missing.length > 0 ? `Missing: ${missing.join(", ")}` : "Complete"}
    >
      {pct}%
    </span>
  );
}

/** Detect which columns have at least one non-empty value */
function useVisibleColumns(leads: LeadRow[]) {
  return useMemo(() => {
    const hasName = leads.some((l) => l.firstName || l.lastName);
    const hasEmail = leads.some((l) => l.email && l.email.length > 0);
    const hasCompany = leads.some((l) => l.company);
    const hasTitle = leads.some((l) => l.jobTitle);
    const hasLinkedin = leads.some((l) => l.linkedinUrl);
    const hasScore = leads.some((l) => l.icpScore != null);
    const hasEnrichment = leads.some(
      (l) => l.enrichmentContext || l.enrichmentLinkedin || l.enrichmentSignals || l.enrichmentDiagnostic,
    );
    // Show data quality when enrichment has been attempted (at least one lead has context or signals)
    const hasDataQuality = leads.some(
      (l) => l.enrichmentContext || l.enrichmentSignals || l.enrichmentLinkedin,
    );
    return { hasName, hasEmail, hasCompany, hasTitle, hasLinkedin, hasScore, hasEnrichment, hasDataQuality };
  }, [leads]);
}

function buildLeadCsv(leads: LeadRow[]): string {
  const headers = [
    "Name", "Email", "Company", "Job Title", "LinkedIn URL", "ICP Score", "Status",
    "Context", "LinkedIn Summary", "Signals", "Diagnostic",
  ];
  const rows = leads.map((l) =>
    [
      [l.firstName, l.lastName].filter(Boolean).join(" "),
      l.email,
      l.company || "",
      l.jobTitle || "",
      l.linkedinUrl || "",
      l.icpScore != null ? String(l.icpScore) : "",
      l.status,
      l.enrichmentContext || "",
      l.enrichmentLinkedin || "",
      l.enrichmentSignals || "",
      l.enrichmentDiagnostic || "",
    ].map(escapeCsv),
  );
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

function LeadTableExport({ leads, campaignId }: { leads: LeadRow[]; campaignId?: string }) {
  const [open, setOpen] = useState(false);

  const handleQuickCsv = useCallback(() => {
    downloadBlob(buildLeadCsv(leads), "leads.csv");
    setOpen(false);
  }, [leads]);

  const handleFullExport = useCallback(
    (format: "csv" | "xlsx") => {
      if (!campaignId) return;
      const a = document.createElement("a");
      a.href = `/api/campaigns/${campaignId}/export?format=${format}`;
      a.download = `campaign-export.${format}`;
      a.click();
      setOpen(false);
    },
    [campaignId],
  );

  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 px-2" onClick={() => setOpen(!open)}>
        <DownloadSimple className="size-3" />
        Export
        <CaretDown className="size-2" />
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-md py-1 min-w-[160px]">
            <button
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
              onClick={handleQuickCsv}
            >
              Quick CSV (table data)
            </button>
            {campaignId && (
              <>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  onClick={() => handleFullExport("csv")}
                >
                  Full Export (CSV)
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  onClick={() => handleFullExport("xlsx")}
                >
                  Full Export (XLSX)
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function LeadTableCard({ title, leads, campaignId }: LeadTableCardProps) {
  const cols = useVisibleColumns(leads);

  return (
    <Card className="overflow-hidden my-2 border-border/60">
      <div className="px-4 py-2.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] tabular-nums">
              {leads.length}
            </Badge>
            <LeadTableExport leads={leads} campaignId={campaignId} />
          </div>
        </div>
      </div>
      <div className="max-h-[600px] overflow-y-auto">
        <table className="w-full text-[10px] table-fixed">
          <colgroup>
            <col className="w-5" />
            {cols.hasName && <col className={cols.hasEnrichment ? "w-[10%]" : "w-[20%]"} />}
            {cols.hasLinkedin && <col className="w-7" />}
            {cols.hasEmail && <col className={cols.hasEnrichment ? "w-[14%]" : undefined} />}
            {cols.hasCompany && <col className={cols.hasEnrichment ? "w-[10%]" : "w-[24%]"} />}
            {cols.hasTitle && <col className={cols.hasEnrichment ? "w-[10%]" : "w-[28%]"} />}
            {cols.hasScore && <col className="w-9" />}
            {cols.hasDataQuality && <col className="w-8" />}
            {cols.hasEnrichment && <col className="w-[12%]" />}
            {cols.hasEnrichment && <col className="w-[12%]" />}
            {cols.hasEnrichment && <col className="w-[10%]" />}
            {cols.hasEnrichment && <col className="w-[12%]" />}
          </colgroup>
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/40">
              <th className="pl-2 pr-0.5 py-2 align-middle text-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">#</th>
              {cols.hasName && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">Name</th>}
              {cols.hasLinkedin && <th className="px-1 py-2 align-middle text-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">LI</th>}
              {cols.hasEmail && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">Email</th>}
              {cols.hasCompany && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">Co.</th>}
              {cols.hasTitle && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">Title</th>}
              {cols.hasScore && <th className="px-1 py-2 align-middle text-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40">ICP</th>}
              {cols.hasDataQuality && <th className="px-1 py-2 align-middle text-center text-[10px] uppercase tracking-wider font-medium text-muted-foreground bg-muted/40" title="Data Quality">DQ</th>}
              {cols.hasEnrichment && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-muted-foreground/70 bg-muted/40">Ctx</th>}
              {cols.hasEnrichment && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-blue-400/70 bg-muted/40">LI</th>}
              {cols.hasEnrichment && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-emerald-400/70 bg-muted/40">Sig</th>}
              {cols.hasEnrichment && <th className="px-2 py-2 align-middle text-left text-[10px] uppercase tracking-wider font-medium text-amber-400/70 bg-muted/40">Diag</th>}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, idx) => (
              <tr key={lead.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                <td className="pl-2 pr-0.5 py-1.5 align-middle text-center text-muted-foreground/50 tabular-nums">{idx + 1}</td>
                {cols.hasName && (
                  <td className="px-2 py-1.5 align-middle font-medium truncate" title={[lead.firstName, lead.lastName].filter(Boolean).join(" ")}>
                    {[lead.firstName, lead.lastName].filter(Boolean).join(" ")}
                  </td>
                )}
                {cols.hasLinkedin && (
                  <td className="px-1 py-1.5 align-middle text-center">
                    {lead.linkedinUrl ? (
                      <a
                        href={lead.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 transition-colors"
                        title="View LinkedIn profile"
                      >
                        <svg className="inline-block w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                      </a>
                    ) : (
                      <span className="text-muted-foreground/30">—</span>
                    )}
                  </td>
                )}
                {cols.hasEmail && (
                  <td className="px-2 py-1.5 align-middle text-muted-foreground truncate" title={lead.email}>{lead.email}</td>
                )}
                {cols.hasCompany && (
                  <td className="px-2 py-1.5 align-middle truncate" title={lead.company ?? undefined}>{lead.company}</td>
                )}
                {cols.hasTitle && (
                  <td className="px-2 py-1.5 align-middle truncate text-muted-foreground" title={lead.jobTitle ?? undefined}>{lead.jobTitle}</td>
                )}
                {cols.hasScore && (
                  <td className="px-1 py-1.5 align-middle text-center">
                    <ScoreBadge score={lead.icpScore} />
                  </td>
                )}
                {cols.hasDataQuality && (
                  <td className="px-1 py-1.5 align-middle text-center">
                    <DataQualityBadge lead={lead} />
                  </td>
                )}
                {cols.hasEnrichment && (
                  <td className="px-2 py-1.5 align-middle truncate text-muted-foreground" title={lead.enrichmentContext ?? undefined}>
                    {lead.enrichmentContext ?? <span className="text-muted-foreground/30">—</span>}
                  </td>
                )}
                {cols.hasEnrichment && (
                  <td className="px-2 py-1.5 align-middle truncate text-blue-400/80" title={lead.enrichmentLinkedin ?? undefined}>
                    {lead.enrichmentLinkedin ?? <span className="text-muted-foreground/30">—</span>}
                  </td>
                )}
                {cols.hasEnrichment && (
                  <td className="px-2 py-1.5 align-middle truncate text-emerald-400/80" title={lead.enrichmentSignals ?? undefined}>
                    {lead.enrichmentSignals ?? <span className="text-muted-foreground/30">—</span>}
                  </td>
                )}
                {cols.hasEnrichment && (
                  <td className="px-2 py-1.5 align-middle truncate text-amber-400/80" title={lead.enrichmentDiagnostic ?? undefined}>
                    {lead.enrichmentDiagnostic ?? <span className="text-muted-foreground/30">—</span>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
