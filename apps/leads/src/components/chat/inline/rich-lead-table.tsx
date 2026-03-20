"use client";

import { useState } from "react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Badge,
  Card,
} from "@leadsens/ui";
import { CaretDown, CaretRight, Check, X, Users } from "@phosphor-icons/react";
import { ScoreTooltip } from "@/components/tam/score-tooltip";
import { SignalPopover } from "@/components/tam/signal-popover";
import { LeadRowExpand } from "@/components/tam/lead-row-expand";

// ─── Types ───────────────────────────────────────────────

interface SignalData {
  name: string;
  detected: boolean;
  evidence: string;
  sources: Array<{ url: string; title: string; favicon?: string }>;
  reasoning: string;
  points: number;
}

interface ScoredLeadData {
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
}

interface RichLeadTableProps {
  title?: string;
  leads: ScoredLeadData[];
  mode?: "tam" | "campaign";
}

// ─── Colors ──────────────────────────────────────────────

const TIER_BADGE: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 hover:bg-emerald-500/20",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/20 hover:bg-blue-500/20",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20",
  D: "bg-red-500/10 text-red-700 border-red-500/20 hover:bg-red-500/20",
};

const HEAT_BADGE: Record<string, string> = {
  Burning: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  Hot: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  Warm: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  Cold: "bg-slate-500/10 text-slate-600 border-slate-500/20",
};

// ─── Signal Cell ─────────────────────────────────────────

function SignalCell({ signal }: { signal: SignalData | undefined }) {
  if (!signal) return <TableCell className="text-center text-muted-foreground/40">—</TableCell>;

  const icon = signal.detected ? (
    <Check weight="bold" className="size-3.5 text-emerald-600" />
  ) : (
    <X weight="bold" className="size-3.5 text-muted-foreground/30" />
  );

  if (!signal.detected) {
    return <TableCell className="text-center">{icon}</TableCell>;
  }

  return (
    <TableCell className="text-center">
      <SignalPopover {...signal}>
        <button type="button" className="cursor-pointer hover:bg-muted/50 rounded p-0.5 transition-colors">
          {icon}
        </button>
      </SignalPopover>
    </TableCell>
  );
}

// ─── Component ───────────────────────────────────────────

export function RichLeadTable({ title, leads, mode = "tam" }: RichLeadTableProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  // Check if leads have signal data (TAM-scored leads do, basic leads don't)
  const hasSignals = leads.some((l) => l.signals && l.signals.length > 0);

  const getSignal = (lead: ScoredLeadData, name: string) =>
    lead.signals?.find((s) => s.name === name);

  return (
    <Card className="overflow-hidden my-2">
      {/* Header */}
      {title && (
        <div className="px-4 py-2.5 border-b flex items-center gap-2">
          <Users weight="duotone" className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">{title}</h3>
          <span className="text-xs text-muted-foreground ml-auto">
            {leads.length} {leads.length === 1 ? "lead" : "leads"}
          </span>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Account</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Industry</TableHead>
              {hasSignals && (
                <>
                  <TableHead className="text-center text-[11px]">Hiring?</TableHead>
                  <TableHead className="text-center text-[11px]">Sales?</TableHead>
                  <TableHead className="text-center text-[11px]">Funded?</TableHead>
                  <TableHead className="text-center text-[11px]">Tech?</TableHead>
                  <TableHead className="text-center text-[11px]">New?</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead, i) => {
              const isExpanded = expandedRow === i;
              return (
                <TableRow key={i} className="group">
                  {/* Expand toggle */}
                  <TableCell className="px-1">
                    <button
                      type="button"
                      onClick={() => setExpandedRow(isExpanded ? null : i)}
                      className="p-0.5 rounded hover:bg-muted/50 transition-colors"
                    >
                      {isExpanded ? (
                        <CaretDown className="size-3.5 text-muted-foreground" />
                      ) : (
                        <CaretRight className="size-3.5 text-muted-foreground" />
                      )}
                    </button>
                  </TableCell>

                  {/* Account */}
                  <TableCell>
                    <div>
                      <p className="text-xs font-medium text-foreground truncate max-w-[180px]">
                        {lead.company ?? "Unknown"}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                        {lead.firstName} {lead.lastName} · {lead.title}
                      </p>
                    </div>
                  </TableCell>

                  {/* Score (Tier + Heat) */}
                  <TableCell className="text-center">
                    {lead.tier && lead.heat ? (
                      <ScoreTooltip
                        tier={lead.tier}
                        tierLabel={lead.tierLabel ?? ""}
                        tierReasons={lead.tierReasons ?? []}
                        heat={lead.heat}
                        heatLabel={lead.heatLabel ?? ""}
                        heatReasons={lead.heatReasons ?? []}
                        actionPhrase={lead.actionPhrase ?? ""}
                      >
                        <button type="button" className="inline-flex gap-0.5 cursor-pointer">
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${TIER_BADGE[lead.tier] ?? ""}`}>
                            {lead.tier}
                          </Badge>
                          <Badge variant="outline" className={`text-[10px] px-1 py-0 ${HEAT_BADGE[lead.heat] ?? ""}`}>
                            {lead.heat}
                          </Badge>
                        </button>
                      </ScoreTooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {lead.numericScore ?? "—"}/10
                      </span>
                    )}
                  </TableCell>

                  {/* Industry */}
                  <TableCell>
                    <span className="text-[11px] text-muted-foreground truncate max-w-[100px] block">
                      {lead.industry ?? "—"}
                    </span>
                  </TableCell>

                  {/* Signal columns */}
                  {hasSignals && (
                    <>
                      <SignalCell signal={getSignal(lead, "Hiring Outbound")} />
                      <SignalCell signal={getSignal(lead, "Sales-Led Growth")} />
                      <SignalCell signal={getSignal(lead, "Recent Funding")} />
                      <SignalCell signal={getSignal(lead, "Tech Stack Fit")} />
                      <SignalCell signal={getSignal(lead, "New in Role")} />
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>

          {/* Expanded row */}
          {expandedRow !== null && leads[expandedRow] && (
            <TableBody>
              <TableRow>
                <TableCell colSpan={hasSignals ? 9 : 4} className="bg-muted/20 p-0">
                  <LeadRowExpand lead={leads[expandedRow]} />
                </TableCell>
              </TableRow>
            </TableBody>
          )}
        </Table>
      </div>

      {/* Footer hint */}
      {mode === "tam" && leads.length > 0 && (
        <div className="px-4 py-2 border-t text-center">
          <p className="text-[11px] text-muted-foreground">
            Type &ldquo;launch campaign with my best leads&rdquo; to start outreach
          </p>
        </div>
      )}
    </Card>
  );
}
