"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  cn,
} from "@leadsens/ui";
import { CaretDown, CaretRight, CaretUp, CheckSquare, Fire, Square, Thermometer, Snowflake } from "@phosphor-icons/react";
import { ScoreTooltip } from "./score-tooltip";
import { SignalPopover } from "./signal-popover";
import { LeadRowExpand } from "./lead-row-expand";

// ─── Types ───────────────────────────────────────────────

interface SignalData {
  name: string;
  detected: boolean;
  evidence: string;
  sources: Array<{ url: string; title: string; favicon?: string }>;
  reasoning: string;
  points: number;
}

export interface ScoredLeadData {
  id?: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  company?: string;
  domain?: string;
  industry?: string;
  employeeCount?: number;
  country?: string;
  linkedinUrl?: string;
  tier: "A" | "B" | "C" | "D";
  tierLabel: string;
  tierReasons: string[];
  heat: "Burning" | "Hot" | "Warm" | "Cold";
  heatLabel: string;
  heatReasons: string[];
  actionPhrase: string;
  signals: SignalData[];
  whyThisLead: string;
  numericScore: number;
  status?: string;
}

type SortField = "tier" | "heat" | "industry" | null;
type SortDir = "asc" | "desc";

interface TAMTableProps {
  leads: ScoredLeadData[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleAll?: () => void;
}

// ─── Colors ──────────────────────────────────────────────

const TIER_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
const HEAT_ORDER: Record<string, number> = { Burning: 0, Hot: 1, Warm: 2, Cold: 3 };

// ─── Industry Colors (Monaco-style colored badges) ──────

const INDUSTRY_COLORS: Array<{ pattern: RegExp; bg: string; text: string; border: string }> = [
  { pattern: /artificial|ai|machine learning|deep learning/i, bg: "bg-fuchsia-500/10", text: "text-fuchsia-700", border: "border-fuchsia-500/20" },
  { pattern: /software|saas|tech|cloud|platform/i, bg: "bg-blue-500/10", text: "text-blue-700", border: "border-blue-500/20" },
  { pattern: /fintech|financ|banking|insurance|payment/i, bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/20" },
  { pattern: /health|medic|pharma|biotech/i, bg: "bg-rose-500/10", text: "text-rose-700", border: "border-rose-500/20" },
  { pattern: /market|adverti|media|content|agency/i, bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/20" },
  { pattern: /educ|learn|training/i, bg: "bg-violet-500/10", text: "text-violet-700", border: "border-violet-500/20" },
  { pattern: /retail|commerce|shop|consumer/i, bg: "bg-orange-500/10", text: "text-orange-700", border: "border-orange-500/20" },
  { pattern: /real estate|property|construction/i, bg: "bg-teal-500/10", text: "text-teal-700", border: "border-teal-500/20" },
  { pattern: /consult|professional|legal|account/i, bg: "bg-indigo-500/10", text: "text-indigo-700", border: "border-indigo-500/20" },
];

function getIndustryColor(industry: string | undefined): { bg: string; text: string; border: string } {
  if (!industry) return { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/20" };
  const match = INDUSTRY_COLORS.find((c) => c.pattern.test(industry));
  return match ?? { bg: "bg-slate-500/10", text: "text-slate-600", border: "border-slate-500/20" };
}

// ─── Heat icon helper ───────────────────────────────────

function HeatIcon({ heat, className }: { heat: string; className?: string }) {
  switch (heat) {
    case "Burning":
      return <Fire weight="fill" className={cn("size-3", className)} />;
    case "Hot":
      return <Fire weight="fill" className={cn("size-3", className)} />;
    case "Warm":
      return <Thermometer weight="fill" className={cn("size-3", className)} />;
    default:
      return <Snowflake weight="fill" className={cn("size-3", className)} />;
  }
}

const STATUS_DISPLAY: Record<string, { label: string; className: string }> = {
  SOURCED: { label: "New", className: "bg-slate-100 text-slate-500 border-slate-200" },
  SCORED: { label: "Scored", className: "bg-slate-100 text-slate-500 border-slate-200" },
  ENRICHED: { label: "Enriched", className: "bg-blue-50 text-blue-500 border-blue-200" },
  DRAFTED: { label: "Drafted", className: "bg-violet-50 text-violet-500 border-violet-200" },
  PUSHED: { label: "Contacted", className: "bg-blue-50 text-blue-600 border-blue-200" },
  SENT: { label: "Contacted", className: "bg-blue-50 text-blue-600 border-blue-200" },
  REPLIED: { label: "Replied", className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
  MEETING_BOOKED: { label: "Meeting", className: "bg-amber-50 text-amber-600 border-amber-200" },
  CONVERTED: { label: "Won", className: "bg-emerald-50 text-emerald-600 border-emerald-200" },
};

// ─── Column count (for colSpan) ─────────────────────────

const COL_COUNT = 12; // checkbox + expand + account + status + score + industry + size + 5 signals

// ─── Signal Cell ─────────────────────────────────────────

function SignalCell({ signal }: { signal: SignalData | undefined }) {
  if (!signal) return <TableCell className="text-center text-[11px] text-muted-foreground/30">No</TableCell>;

  if (!signal.detected) {
    return (
      <TableCell className="text-center text-[11px] text-muted-foreground/30">
        No
      </TableCell>
    );
  }

  return (
    <TableCell className="text-center">
      <SignalPopover {...signal}>
        <button type="button" className="text-[11px] font-medium text-emerald-600 cursor-pointer hover:text-emerald-700 transition-colors">
          Yes
        </button>
      </SignalPopover>
    </TableCell>
  );
}

// ─── Favicon ────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-teal-500", "bg-blue-500", "bg-orange-500", "bg-rose-500",
  "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-indigo-500",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function CompanyFavicon({ domain, company }: { domain?: string; company?: string }) {
  const letter = (company ?? "?")[0]?.toUpperCase() ?? "?";
  const colorClass = AVATAR_COLORS[hashString(company ?? "") % AVATAR_COLORS.length];

  return (
    <div className="relative size-5 shrink-0">
      {domain && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://www.google.com/s2/favicons?sz=32&domain=${encodeURIComponent(domain)}`}
          alt=""
          className="size-5 rounded shrink-0 absolute inset-0"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
            const sibling = e.currentTarget.nextElementSibling;
            if (sibling) (sibling as HTMLElement).style.display = "flex";
          }}
        />
      )}
      <div
        className={cn("size-5 rounded flex items-center justify-center shrink-0 text-white", colorClass)}
        style={{ display: domain ? "none" : "flex" }}
      >
        <span className="text-[9px] font-bold">{letter}</span>
      </div>
    </div>
  );
}

// ─── Sortable Header ────────────────────────────────────

function SortableHead({
  label,
  field,
  activeField,
  activeDir,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  activeDir: SortDir;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = activeField === field;
  return (
    <TableHead className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}>
      <button
        type="button"
        className="inline-flex items-center gap-0.5 w-full"
        onClick={() => onSort(field)}
      >
        {label}
        {isActive && (
          activeDir === "asc"
            ? <CaretUp className="size-3 text-foreground" weight="bold" />
            : <CaretDown className="size-3 text-foreground" weight="bold" />
        )}
      </button>
    </TableHead>
  );
}

// ─── Component ───────────────────────────────────────────

export function TAMTable({ leads, selectedIds, onToggleSelect, onToggleAll }: TAMTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  // Default sort: Score DESC (best leads first)
  const [sortField, setSortField] = useState<SortField>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") {
        setSortDir("desc");
      } else {
        // Third click: reset
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setExpandedRow(null); // Collapse on sort change
  }, [sortField, sortDir]);

  // Sort leads
  const sortedLeads = useMemo(() => {
    if (!sortField) return leads;
    const sorted = [...leads];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "tier":
          cmp = (TIER_ORDER[a.tier] ?? 3) - (TIER_ORDER[b.tier] ?? 3);
          break;
        case "heat":
          cmp = (HEAT_ORDER[a.heat] ?? 3) - (HEAT_ORDER[b.heat] ?? 3);
          break;
        case "industry":
          cmp = (a.industry ?? "").localeCompare(b.industry ?? "");
          break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [leads, sortField, sortDir]);

  const getSignal = (lead: ScoredLeadData, name: string) =>
    lead.signals.find((s) => s.name === name);

  const hasSelection = !!selectedIds && !!onToggleSelect;
  const allSelected = hasSelection && selectedIds.size > 0 && selectedIds.size === leads.length;

  return (
    <Table className="[&_td]:py-1.5 [&_th]:py-2">
      <TableHeader>
        <TableRow>
          {/* Checkbox header */}
          {hasSelection && (
            <TableHead className="w-8 px-2">
              <button type="button" onClick={onToggleAll} className="p-0.5">
                {allSelected ? (
                  <CheckSquare className="size-3.5 text-foreground" weight="fill" />
                ) : selectedIds.size > 0 ? (
                  <CheckSquare className="size-3.5 text-muted-foreground" />
                ) : (
                  <Square className="size-3.5 text-muted-foreground/40" />
                )}
              </button>
            </TableHead>
          )}
          <TableHead className="w-6" />
          <TableHead>Account</TableHead>
          <TableHead className="text-[11px]">Status</TableHead>
          <SortableHead label="Score" field="tier" activeField={sortField} activeDir={sortDir} onSort={handleSort} />
          <SortableHead label="Industry" field="industry" activeField={sortField} activeDir={sortDir} onSort={handleSort} />
          <TableHead className="text-[11px] text-right">Size</TableHead>
          <TableHead className="text-center text-[11px]">Hiring?</TableHead>
          <TableHead className="text-center text-[11px]">Sales?</TableHead>
          <TableHead className="text-center text-[11px]">Funded?</TableHead>
          <TableHead className="text-center text-[11px]">Tech?</TableHead>
          <TableHead className="text-center text-[11px]">New?</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedLeads.map((lead, i) => {
          const isExpanded = expandedRow === i;
          const leadId = lead.id ?? String(i);
          const isSelected = selectedIds?.has(leadId) ?? false;
          const statusInfo = STATUS_DISPLAY[lead.status ?? "SOURCED"] ?? STATUS_DISPLAY.SOURCED;

          return (
            <Fragment key={leadId}>
              <TableRow className={cn("group row-hover transition-colors", isSelected && "bg-primary/5")}>
                {/* Checkbox */}
                {hasSelection && (
                  <TableCell className="px-2">
                    <button
                      type="button"
                      onClick={() => onToggleSelect(leadId)}
                      className="p-0.5"
                    >
                      {isSelected ? (
                        <CheckSquare className="size-3.5 text-primary" weight="fill" />
                      ) : (
                        <Square className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>
                )}

                {/* Expand toggle */}
                <TableCell className="px-1">
                  <button
                    type="button"
                    onClick={() => setExpandedRow(isExpanded ? null : i)}
                    className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                  >
                    {isExpanded ? (
                      <CaretDown className="size-3 text-muted-foreground" />
                    ) : (
                      <CaretRight className="size-3 text-muted-foreground" />
                    )}
                  </button>
                </TableCell>

                {/* Account with favicon */}
                <TableCell>
                  <div className="flex items-center gap-2">
                    <CompanyFavicon domain={lead.domain} company={lead.company} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate max-w-[200px]">
                        {lead.company ?? "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                        {lead.firstName} {lead.lastName} · {lead.title}
                      </p>
                    </div>
                  </div>
                </TableCell>

                {/* Status (before Score — Monaco order) */}
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 rounded ${statusInfo.className}`}>
                    {statusInfo.label}
                  </Badge>
                </TableCell>

                {/* Score — Monaco style: "A | 🔥 Burning" */}
                <TableCell>
                  {(() => {
                    const heatColor = lead.heat === "Burning" ? "text-orange-500" : lead.heat === "Hot" ? "text-rose-500" : lead.heat === "Warm" ? "text-amber-500" : "text-slate-400";
                    const scoreContent = (
                      <span className="inline-flex items-center gap-1.5">
                        <span className={cn(
                          "size-5 rounded-md text-white text-[11px] font-bold flex items-center justify-center shrink-0",
                          lead.tier === "A" ? "bg-emerald-500" : lead.tier === "B" ? "bg-blue-500" : lead.tier === "C" ? "bg-amber-500" : "bg-slate-400",
                        )}>
                          {lead.tier}
                        </span>
                        <span className="text-muted-foreground/25">|</span>
                        <span className={cn("inline-flex items-center gap-0.5", heatColor)}>
                          <HeatIcon heat={lead.heat} className={heatColor} />
                          <span className="text-[11px] font-medium">{lead.heat}</span>
                        </span>
                      </span>
                    );

                    return lead.numericScore != null && lead.numericScore > 0 ? (
                      <ScoreTooltip
                        tier={lead.tier}
                        tierLabel={lead.tierLabel}
                        tierReasons={lead.tierReasons}
                        heat={lead.heat}
                        heatLabel={lead.heatLabel}
                        heatReasons={lead.heatReasons}
                        actionPhrase={lead.actionPhrase}
                      >
                        <button type="button" className="cursor-pointer">
                          {scoreContent}
                        </button>
                      </ScoreTooltip>
                    ) : scoreContent;
                  })()}
                </TableCell>

                {/* Industry — colored badge */}
                <TableCell>
                  {lead.industry ? (
                    <span className={cn(
                      "text-[10px] font-medium px-2 py-0.5 rounded-full border truncate max-w-[130px] inline-block",
                      getIndustryColor(lead.industry).bg,
                      getIndustryColor(lead.industry).text,
                      getIndustryColor(lead.industry).border,
                    )}>
                      {lead.industry}
                    </span>
                  ) : null}
                </TableCell>

                {/* Size (employee count) */}
                <TableCell className="text-right">
                  {lead.employeeCount ? (
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {lead.employeeCount.toLocaleString()}
                    </span>
                  ) : null}
                </TableCell>

                {/* Signal columns */}
                <SignalCell signal={getSignal(lead, "Hiring Outbound")} />
                <SignalCell signal={getSignal(lead, "Sales-Led Growth")} />
                <SignalCell signal={getSignal(lead, "Recent Funding")} />
                <SignalCell signal={getSignal(lead, "Tech Stack Fit")} />
                <SignalCell signal={getSignal(lead, "New in Role")} />
              </TableRow>

              {/* Inline expanded row */}
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={COL_COUNT} className="bg-muted/20 p-0">
                    <LeadRowExpand lead={lead} />
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
