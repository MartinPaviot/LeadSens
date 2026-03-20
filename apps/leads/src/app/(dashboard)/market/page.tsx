"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Target,
  ArrowsClockwise,
  Rocket,
  Envelope,
  MagnifyingGlass,
  PlugsConnected,
} from "@phosphor-icons/react";
import {
  Card,
  Button,
  cn,
} from "@leadsens/ui";
import { useAgentPanel } from "@/components/agent-panel/agent-panel-context";
import { TAMTable } from "@/components/tam/tam-table";

// ─── Types ──────────────────────────────────────────────

interface TAMResult {
  icp: { roles: Array<{ title: string }> };
  counts: {
    total: number;
    byRole: Array<{ role: string; count: number }>;
    byGeo: Array<{ region: string; count: number }>;
  };
  leads: Array<Record<string, unknown>>;
  burningEstimate: number;
  roles?: string[];
}

interface DBLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  jobTitle: string | null;
  email: string;
  linkedinUrl: string | null;
  country: string | null;
  industry: string | null;
  companySize: string | null;
  icpScore: number | null;
  icpBreakdown: Record<string, unknown> | null;
  enrichmentData: Record<string, unknown> | null;
  status: string;
  createdAt: string;
}

// ─── Helpers ────────────────────────────────────────────

function scoreTier(score: number | null): "A" | "B" | "C" | "D" {
  if (!score) return "D";
  if (score >= 9) return "A";
  if (score >= 7) return "B";
  if (score >= 5) return "C";
  return "D";
}

function scoreHeat(breakdown: Record<string, unknown> | null): "Burning" | "Hot" | "Warm" | "Cold" {
  if (!breakdown) return "Cold";
  const signals = breakdown.signals as Array<{ detected?: boolean }> | undefined;
  if (!signals) return "Cold";
  const detected = signals.filter((s) => s.detected).length;
  if (detected >= 4) return "Burning";
  if (detected >= 3) return "Hot";
  if (detected >= 1) return "Warm";
  return "Cold";
}

function dbLeadToScoredLead(lead: DBLead) {
  const tier = scoreTier(lead.icpScore);
  const breakdown = lead.icpBreakdown as Record<string, unknown> | null;
  const heat = scoreHeat(breakdown);
  const signals = (breakdown?.signals as Array<Record<string, unknown>> | undefined) ?? [];

  const scoreDisplay = lead.icpScore != null ? `${lead.icpScore}/10` : "—";

  return {
    id: lead.id,
    firstName: lead.firstName ?? undefined,
    lastName: lead.lastName ?? undefined,
    title: lead.jobTitle ?? undefined,
    company: lead.company ?? undefined,
    domain: (lead.enrichmentData?.domain as string | undefined) ?? (lead.company ? undefined : undefined),
    industry: lead.industry ?? undefined,
    employeeCount: lead.companySize ? parseInt(lead.companySize, 10) || undefined : undefined,
    country: lead.country ?? undefined,
    linkedinUrl: lead.linkedinUrl ?? undefined,
    tier,
    tierLabel: tier === "A" ? "Top prospect" : tier === "B" ? "Good fit" : tier === "C" ? "Moderate" : "Low fit",
    tierReasons: (breakdown?.tierReasons as string[] | undefined) ?? [`Score: ${scoreDisplay}`],
    heat,
    heatLabel: heat === "Burning" ? "Multiple signals" : heat === "Hot" ? "Strong signals" : heat === "Warm" ? "Some signals" : "No signals",
    heatReasons: (breakdown?.heatReasons as string[] | undefined) ?? signals.filter((s) => s.detected).map((s) => String(s.name ?? s.evidence ?? "")),
    actionPhrase: (breakdown?.actionPhrase as string | undefined) ?? `${tier === "A" ? "Priority" : "Consider"} outreach to ${lead.firstName ?? "this contact"}`,
    signals: signals.map((s) => ({
      name: String(s.name ?? ""),
      detected: Boolean(s.detected),
      evidence: String(s.evidence ?? ""),
      sources: (s.sources as Array<{ url: string; title: string; favicon?: string }>) ?? [],
      reasoning: String(s.reasoning ?? ""),
      points: Number(s.points ?? 0),
    })),
    whyThisLead: (breakdown?.whyThisLead as string | undefined) ?? `Score ${scoreDisplay} — ${lead.jobTitle ?? "Contact"} at ${lead.company ?? "Unknown"}`,
    numericScore: lead.icpScore ?? 0,
    status: lead.status,
  };
}

const TIER_BADGE: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  B: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  C: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  D: "bg-red-500/10 text-red-700 border-red-500/20",
};

// ─── Component ──────────────────────────────────────────

export default function MarketPage() {
  const agentPanel = useAgentPanel();
  const [tamData, setTamData] = useState<TAMResult | null>(null);
  const [tamBuiltAt, setTamBuiltAt] = useState<string | null>(null);
  const [dbLeads, setDbLeads] = useState<DBLead[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Fetch TAM + leads on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/trpc/workspace.getTAM")
        .then((r) => r.json())
        .then((d) => d?.result?.data ?? null)
        .catch(() => null),
      fetch("/api/trpc/workspace.getMarketLeads?input=" + encodeURIComponent(JSON.stringify({ limit: 50 })))
        .then((r) => r.json())
        .then((d) => d?.result?.data ?? { leads: [], total: 0 })
        .catch(() => ({ leads: [], total: 0 })),
    ])
      .then(([tam, leadData]) => {
        if (tam) {
          setTamData(tam.result as TAMResult);
          setTamBuiltAt(tam.builtAt);
        }
        setDbLeads((leadData as { leads: DBLead[]; total: number }).leads);
        setTotalLeads((leadData as { leads: DBLead[]; total: number }).total);
      })
      .finally(() => setLoading(false));
  }, []);

  // Load more leads
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const res = await fetch(
        "/api/trpc/workspace.getMarketLeads?input=" +
          encodeURIComponent(JSON.stringify({
            limit: 50,
            offset: dbLeads.length,
            ...(tierFilter !== "all" ? { tier: tierFilter } : {}),
          })),
      );
      const data = await res.json();
      const result = data?.result?.data as { leads: DBLead[]; total: number } | undefined;
      if (result) {
        setDbLeads((prev) => [...prev, ...result.leads]);
        setTotalLeads(result.total);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [dbLeads.length, tierFilter]);

  // Filter leads by tier
  const filteredLeads = tierFilter === "all"
    ? dbLeads
    : dbLeads.filter((l) => scoreTier(l.icpScore) === tierFilter);

  // Convert to TAM table format
  const scoredLeads = filteredLeads.map(dbLeadToScoredLead);

  // TAM display data from tamResult blob (if exists)
  const tamLeads = tamData?.leads?.map((l) => l as unknown as ReturnType<typeof dbLeadToScoredLead>) ?? [];

  // Use DB leads if available, fallback to TAM blob leads
  const displayLeads = scoredLeads.length > 0 ? scoredLeads : tamLeads;

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  const selectedLeads = dbLeads.filter((l) => selectedIds.has(l.id));
  const selectedNames = selectedLeads
    .map((l) => `${l.firstName ?? ""} ${l.lastName ?? ""}`.trim() || l.email)
    .slice(0, 5);

  // Count by tier
  const tierCounts = {
    A: dbLeads.filter((l) => scoreTier(l.icpScore) === "A").length,
    B: dbLeads.filter((l) => scoreTier(l.icpScore) === "B").length,
    C: dbLeads.filter((l) => scoreTier(l.icpScore) === "C").length,
    D: dbLeads.filter((l) => scoreTier(l.icpScore) === "D").length,
  };

  // ─── Empty state ──────────────────────────────────────

  if (!loading && !tamData && dbLeads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <Target className="size-12 text-muted-foreground/30 mb-4" />
        <h1 className="text-lg font-semibold mb-1">Your Market</h1>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">
          Your market hasn&apos;t been mapped yet. Complete onboarding to build your TAM,
          or ask the agent to analyze your market.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => agentPanel.open("Build my TAM — analyze my market and find leads")}
          >
            <Target className="size-4 mr-1.5" />
            Build TAM
          </Button>
          <Button variant="outline" asChild>
            <a href="/settings/integrations">
              <PlugsConnected className="size-4 mr-1.5" />
              Connect Apollo
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header — single line */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold font-heading">Market</h1>
          <span className="text-sm text-muted-foreground">
            {totalLeads > 0 && `· ${totalLeads.toLocaleString()} leads`}
            {tamBuiltAt && ` · Updated ${new Date(tamBuiltAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => agentPanel.open("Refresh my TAM — re-analyze my market")}
        >
          <ArrowsClockwise className="size-3.5 mr-1.5" />
          Refresh TAM
        </Button>
      </div>

      {/* TAM Summary — compact stat bar */}
      {tamData && (
        <div className="flex items-center gap-2 flex-wrap mb-6 text-sm">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-foreground font-medium tabular-nums">
            <Target className="size-3.5 text-muted-foreground" />
            {tamData.counts.total.toLocaleString("en-US")} accounts
          </span>
          {tamData.burningEstimate > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-700 font-medium tabular-nums">
              ~{tamData.burningEstimate.toLocaleString("en-US")} Burning
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border text-foreground/80 tabular-nums">
            {(totalLeads > 0 ? totalLeads : tamData.leads.length).toLocaleString("en-US")} scored
          </span>
          {tierCounts.A > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-medium tabular-nums">
              {tierCounts.A} Tier A
            </span>
          )}
        </div>
      )}

      {/* Filters + Tier Pills */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTierFilter("all")}
            className={cn(
              "text-xs px-2.5 py-0.5 rounded-full border transition-colors",
              tierFilter === "all"
                ? "bg-foreground text-background border-foreground"
                : "border-border text-muted-foreground hover:border-foreground/30",
            )}
          >
            All ({dbLeads.length})
          </button>
          {(["A", "B", "C", "D"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(tierFilter === t ? "all" : t)}
              className={cn(
                "text-xs px-2.5 py-0.5 rounded-full border transition-colors",
                tierFilter === t
                  ? TIER_BADGE[t] + " font-medium"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              Tier {t} ({tierCounts[t]})
            </button>
          ))}
        </div>
        {selectedIds.size > 0 && (
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} selected
          </span>
        )}
      </div>

      {/* Leads Table */}
      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : displayLeads.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <TAMTable
              leads={displayLeads}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleAll={toggleAll}
            />
          </div>
        </Card>
      ) : (
        <div className="text-center py-12">
          <MagnifyingGlass className="size-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            No leads match this filter.
          </p>
        </div>
      )}

      {/* Load More */}
      {!loading && dbLeads.length < totalLeads && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : `Load more (${totalLeads - dbLeads.length} remaining)`}
          </Button>
        </div>
      )}

      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 md:bottom-4 md:left-1/2 md:-translate-x-1/2 md:max-w-2xl md:rounded-xl">
          <div className="bg-card border-t shadow-lg px-4 py-2.5 flex items-center justify-between gap-3 md:rounded-xl md:border">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} lead{selectedIds.size !== 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="text-xs h-7"
                onClick={() => {
                  agentPanel.open(
                    `Launch a campaign for these ${selectedIds.size} selected leads: ${selectedNames.join(", ")}`,
                  );
                }}
              >
                <Rocket className="size-3 mr-1" />
                Launch campaign
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => {
                  agentPanel.open(
                    `Draft personalized emails for these ${selectedIds.size} leads: ${selectedNames.join(", ")}`,
                  );
                }}
              >
                <Envelope className="size-3 mr-1" />
                Draft emails
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => {
                  agentPanel.open(
                    `Enrich these ${selectedIds.size} leads: ${selectedNames.join(", ")}`,
                  );
                }}
              >
                <MagnifyingGlass className="size-3 mr-1" />
                Enrich
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
