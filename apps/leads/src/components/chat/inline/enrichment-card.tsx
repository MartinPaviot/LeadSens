"use client";

import { useCallback, useState } from "react";
import { Badge, Button, Card } from "@leadsens/ui";
import {
  CaretDown,
  CaretRight,
  Globe,
  Lightning,
  Target,
  Lightbulb,
  DownloadSimple,
  Buildings,
  LinkedinLogo,
  Users,
  TrendUp,
  Megaphone,
  UserSwitch,
  Flag,
  Gear,
} from "@phosphor-icons/react";
import { escapeCsv, formatArrayField, downloadBlob } from "@/lib/csv-utils";

// ── Structured signal types ──

interface LeadershipChange {
  event: string;
  date?: string | null;
  source?: string | null;
}

interface PublicPriority {
  statement: string;
  source?: string | null;
  date?: string | null;
}

interface TechStackChange {
  change: string;
  date?: string | null;
}

// ── Lead interface matching enrichmentDataSchema ──

interface EnrichedLead {
  name: string;
  company: string | null;
  jobTitle: string | null;
  icpScore: number | null;
  scraped: boolean;
  enrichment: {
    companySummary?: string | null;
    products?: string[];
    targetMarket?: string | null;
    valueProposition?: string | null;
    painPoints?: string[];
    recentNews?: string[];
    techStack?: string[];
    signals?: string[];
    // Structured signals (may be string[] for legacy or {detail,date,source}[] for new data)
    hiringSignals?: (string | { detail: string; date?: string | null; source?: string | null })[];
    fundingSignals?: (string | { detail: string; date?: string | null; source?: string | null })[];
    productLaunches?: string[];
    leadershipChanges?: LeadershipChange[];
    publicPriorities?: PublicPriority[];
    techStackChanges?: TechStackChange[];
    // LinkedIn data
    linkedinHeadline?: string | null;
    recentLinkedInPosts?: string[];
    careerHistory?: string[];
    // Meta
    industry?: string | null;
    teamSize?: string | null;
  } | null;
}

interface EnrichmentCardProps {
  title: string;
  leads: EnrichedLead[];
  campaignId?: string;
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score == null) return <Badge variant="outline">-</Badge>;
  if (score >= 8) return <Badge className="bg-green-600/20 text-green-400 border-green-600/30">{score}</Badge>;
  if (score >= 5) return <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">{score}</Badge>;
  return <Badge className="bg-red-600/20 text-red-400 border-red-600/30">{score}</Badge>;
}

function TagList({ items, icon }: { items: string[]; icon?: React.ReactNode }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {icon}
      {items.map((item, i) => (
        <span key={i} className="inline-block text-[11px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

function StructuredSignalList<T extends { date?: string | null }>({
  items,
  textKey,
}: {
  items: T[];
  textKey: keyof T & string;
}) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span key={i} className="inline-block text-[11px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
          {String(item[textKey] ?? "")}
          {item.date && <span className="ml-1 text-muted-foreground/60">· {item.date}</span>}
        </span>
      ))}
    </div>
  );
}

function SectionHeader({
  icon,
  label,
  open,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground/80 hover:text-foreground transition-colors w-full"
    >
      {open ? <CaretDown className="size-2.5" /> : <CaretRight className="size-2.5" />}
      {icon}
      {label}
    </button>
  );
}

// ── Enrichment section checks ──

function hasCompanyData(e: NonNullable<EnrichedLead["enrichment"]>): boolean {
  return !!(e.companySummary || e.products?.length || e.targetMarket || e.valueProposition || e.painPoints?.length || e.recentNews?.length);
}

function hasSignalData(e: NonNullable<EnrichedLead["enrichment"]>): boolean {
  return !!(
    e.signals?.length ||
    e.hiringSignals?.length ||
    e.fundingSignals?.length ||
    e.productLaunches?.length ||
    e.leadershipChanges?.length ||
    e.publicPriorities?.length ||
    e.techStackChanges?.length ||
    e.techStack?.length
  );
}

function hasLinkedInData(e: NonNullable<EnrichedLead["enrichment"]>): boolean {
  return !!(e.linkedinHeadline || e.careerHistory?.length || e.recentLinkedInPosts?.length);
}

function LeadRow({ lead }: { lead: EnrichedLead }) {
  const [expanded, setExpanded] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(true);
  const [signalsOpen, setSignalsOpen] = useState(true);
  const [linkedinOpen, setLinkedinOpen] = useState(true);

  const e = lead.enrichment;
  const hasData = e && (hasCompanyData(e) || hasSignalData(e) || hasLinkedInData(e));

  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => hasData && setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="shrink-0 text-muted-foreground">
          {hasData ? (
            expanded ? <CaretDown className="size-3.5" /> : <CaretRight className="size-3.5" />
          ) : (
            <span className="size-3.5 inline-block" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">{lead.name || "-"}</span>
            {lead.company && <span className="text-[11px] text-muted-foreground truncate">@ {lead.company}</span>}
            {e?.industry && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">{e.industry}</Badge>
            )}
            {e?.teamSize && (
              <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0">
                <Users className="size-2.5 mr-0.5" />{e.teamSize}
              </Badge>
            )}
          </div>
          {lead.jobTitle && <p className="text-[11px] text-muted-foreground truncate">{lead.jobTitle}</p>}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          {lead.scraped ? (
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-[10px]">scraped</Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">no data</Badge>
          )}
          <ScoreBadge score={lead.icpScore} />
        </div>
      </button>

      {expanded && hasData && e && (
        <div className="px-4 pb-3 pl-11 space-y-3">

          {/* ── Company section ── */}
          {hasCompanyData(e) && (
            <div className="space-y-2">
              <SectionHeader
                icon={<Buildings className="size-3" />}
                label="Company"
                open={companyOpen}
                onToggle={() => setCompanyOpen(!companyOpen)}
              />
              {companyOpen && (
                <div className="pl-4 space-y-2">
                  {e.companySummary && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{e.companySummary}</p>
                  )}
                  {e.painPoints && e.painPoints.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Target className="size-3" /> Pain points
                      </div>
                      <TagList items={e.painPoints} />
                    </div>
                  )}
                  {e.products && e.products.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Lightbulb className="size-3" /> Products
                      </div>
                      <TagList items={e.products} />
                    </div>
                  )}
                  {e.valueProposition && (
                    <p className="text-[11px] text-muted-foreground italic">Value prop: {e.valueProposition}</p>
                  )}
                  {e.targetMarket && (
                    <p className="text-[11px] text-muted-foreground italic">Target: {e.targetMarket}</p>
                  )}
                  {e.recentNews && e.recentNews.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Megaphone className="size-3" /> Recent news
                      </div>
                      <TagList items={e.recentNews} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Signals section ── */}
          {hasSignalData(e) && (
            <div className="space-y-2">
              <SectionHeader
                icon={<Lightning className="size-3" />}
                label="Signals"
                open={signalsOpen}
                onToggle={() => setSignalsOpen(!signalsOpen)}
              />
              {signalsOpen && (
                <div className="pl-4 space-y-2">
                  {e.signals && e.signals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <TrendUp className="size-3" /> Buying signals
                      </div>
                      <TagList items={e.signals} />
                    </div>
                  )}
                  {e.hiringSignals && e.hiringSignals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Users className="size-3" /> Hiring
                      </div>
                      <TagList items={e.hiringSignals.map((s) => typeof s === "string" ? s : s.detail + (s.date ? ` (${s.date})` : ""))} />
                    </div>
                  )}
                  {e.fundingSignals && e.fundingSignals.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <TrendUp className="size-3" /> Funding
                      </div>
                      <TagList items={e.fundingSignals.map((s) => typeof s === "string" ? s : s.detail + (s.date ? ` (${s.date})` : ""))} />
                    </div>
                  )}
                  {e.productLaunches && e.productLaunches.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Megaphone className="size-3" /> Product launches
                      </div>
                      <TagList items={e.productLaunches} />
                    </div>
                  )}
                  {e.leadershipChanges && e.leadershipChanges.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <UserSwitch className="size-3" /> Leadership changes
                      </div>
                      <StructuredSignalList items={e.leadershipChanges} textKey="event" />
                    </div>
                  )}
                  {e.publicPriorities && e.publicPriorities.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Flag className="size-3" /> Public priorities
                      </div>
                      <StructuredSignalList items={e.publicPriorities} textKey="statement" />
                    </div>
                  )}
                  {e.techStack && e.techStack.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Globe className="size-3" /> Tech stack
                      </div>
                      <TagList items={e.techStack} />
                    </div>
                  )}
                  {e.techStackChanges && e.techStackChanges.length > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[11px] font-medium text-foreground/70">
                        <Gear className="size-3" /> Tech changes
                      </div>
                      <StructuredSignalList items={e.techStackChanges} textKey="change" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── LinkedIn section ── */}
          {hasLinkedInData(e) && (
            <div className="space-y-2">
              <SectionHeader
                icon={<LinkedinLogo className="size-3" />}
                label="LinkedIn"
                open={linkedinOpen}
                onToggle={() => setLinkedinOpen(!linkedinOpen)}
              />
              {linkedinOpen && (
                <div className="pl-4 space-y-2">
                  {e.linkedinHeadline && (
                    <p className="text-xs text-muted-foreground italic border-l-2 border-blue-500/30 pl-2">
                      &ldquo;{e.linkedinHeadline}&rdquo;
                    </p>
                  )}
                  {e.careerHistory && e.careerHistory.length > 0 && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-medium text-foreground/60">Career</span>
                      {e.careerHistory.slice(0, 3).map((role, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground truncate pl-2">
                          {role}
                        </p>
                      ))}
                      {e.careerHistory.length > 3 && (
                        <p className="text-[10px] text-muted-foreground/50 pl-2">+{e.careerHistory.length - 3} more</p>
                      )}
                    </div>
                  )}
                  {e.recentLinkedInPosts && e.recentLinkedInPosts.length > 0 && (
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-medium text-foreground/60">Recent posts</span>
                      {e.recentLinkedInPosts.slice(0, 2).map((post, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground pl-2 line-clamp-2">
                          {post.length > 120 ? post.slice(0, 120) + "..." : post}
                        </p>
                      ))}
                      {e.recentLinkedInPosts.length > 2 && (
                        <p className="text-[10px] text-muted-foreground/50 pl-2">+{e.recentLinkedInPosts.length - 2} more</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── CSV export ──

function buildCsv(leads: EnrichedLead[]): string {
  const headers = [
    "Name", "Company", "Job Title", "ICP Score", "Scraped",
    "Industry", "Team Size",
    "Company Summary", "Products", "Target Market", "Value Proposition",
    "Pain Points", "Recent News", "Buying Signals", "Tech Stack",
    "Hiring Signals", "Funding Signals", "Product Launches",
    "Leadership Changes", "Public Priorities", "Tech Stack Changes",
    "LinkedIn Headline", "Career History", "Recent LinkedIn Posts",
  ];
  const rows = leads.map((l) => {
    const e = l.enrichment;
    return [
      l.name || "",
      l.company || "",
      l.jobTitle || "",
      l.icpScore != null ? String(l.icpScore) : "",
      l.scraped ? "Yes" : "No",
      e?.industry || "",
      e?.teamSize || "",
      e?.companySummary || "",
      e?.products?.join("; ") || "",
      e?.targetMarket || "",
      e?.valueProposition || "",
      e?.painPoints?.join("; ") || "",
      e?.recentNews?.join("; ") || "",
      e?.signals?.join("; ") || "",
      e?.techStack?.join("; ") || "",
      e?.hiringSignals?.map((s) => typeof s === "string" ? s : s.detail + (s.date ? ` (${s.date})` : "")).join("; ") || "",
      e?.fundingSignals?.map((s) => typeof s === "string" ? s : s.detail + (s.date ? ` (${s.date})` : "")).join("; ") || "",
      e?.productLaunches?.join("; ") || "",
      formatArrayField(e?.leadershipChanges),
      formatArrayField(e?.publicPriorities),
      formatArrayField(e?.techStackChanges),
      e?.linkedinHeadline || "",
      e?.careerHistory?.join("; ") || "",
      e?.recentLinkedInPosts?.join("; ") || "",
    ].map(escapeCsv);
  });
  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ── Export dropdown ──

function ExportDropdown({ leads, campaignId }: { leads: EnrichedLead[]; campaignId?: string }) {
  const [open, setOpen] = useState(false);

  const handleQuickCsv = useCallback(() => {
    downloadBlob(buildCsv(leads), "enrichment-data.csv");
    setOpen(false);
  }, [leads]);

  const handleFullExport = useCallback(
    (format: "csv" | "xlsx") => {
      if (!campaignId) return;
      // Trigger server-side export download
      const url = `/api/campaigns/${campaignId}/export?format=${format}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `campaign-export.${format}`;
      a.click();
      setOpen(false);
    },
    [campaignId],
  );

  return (
    <div className="relative">
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setOpen(!open)}>
        <DownloadSimple className="size-3.5" />
        Export
        <CaretDown className="size-2.5" />
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
              Quick CSV (visible fields)
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

export function EnrichmentCard({ title, leads, campaignId }: EnrichmentCardProps) {
  const scrapedCount = leads.filter((l) => l.scraped).length;

  return (
    <Card className="overflow-hidden my-2">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">
            {leads.length} leads enriched ({scrapedCount} scraped)
          </p>
        </div>
        <ExportDropdown leads={leads} campaignId={campaignId} />
      </div>
      <div className="max-h-[500px] overflow-y-auto">
        {leads.map((lead, i) => (
          <LeadRow key={i} lead={lead} />
        ))}
      </div>
    </Card>
  );
}
