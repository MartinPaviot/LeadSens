import {
  getReplyRateBySignalType,
  getReplyRateByStep,
  getReplyRateByQualityScore,
  getReplyRateByEnrichmentDepth,
  getReplyRateByIndustry,
  getReplyRateByWordCount,
  getReplyRateBySubjectVariant,
  type CorrelationRow,
  type VariantPerformanceRow,
} from "./correlator";
import { prisma } from "@/lib/prisma";

export interface PerformanceInsight {
  dimension: "signal_type" | "framework" | "quality_score" | "enrichment_depth" | "industry" | "word_count" | "subject_variant";
  topPerformer: { label: string; replyRate: number; sampleSize: number };
  bottomPerformer: { label: string; replyRate: number; sampleSize: number };
  recommendation: string;
  confidence: "high" | "medium" | "low"; // high >= 50, medium >= 20, low < 20
}

function getConfidence(totalSent: number): "high" | "medium" | "low" {
  if (totalSent >= 50) return "high";
  if (totalSent >= 20) return "medium";
  return "low";
}

function buildInsight(
  dimension: PerformanceInsight["dimension"],
  rows: CorrelationRow[],
): PerformanceInsight | null {
  // Need at least 2 rows with 20+ emails total to build an insight
  if (rows.length < 2) return null;
  const totalSent = rows.reduce((sum, r) => sum + r.sent, 0);
  if (totalSent < 20) return null;

  // Sort by replyRate descending
  const sorted = [...rows].sort((a, b) => b.replyRate - a.replyRate);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];

  // Build recommendation based on dimension
  const recommendations: Record<string, (top: CorrelationRow, bottom: CorrelationRow) => string> = {
    signal_type: (t, b) => `Your "${t.dimension}" signals get ${t.replyRate.toFixed(1)}% reply rate — prioritize these over "${b.dimension}" (${b.replyRate.toFixed(1)}%).`,
    framework: (t, b) => `Step "${t.dimension}" performs best at ${t.replyRate.toFixed(1)}% reply rate. "${b.dimension}" underperforms at ${b.replyRate.toFixed(1)}%.`,
    quality_score: (t, b) => `Emails scoring ${t.dimension} get ${t.replyRate.toFixed(1)}% reply rate vs ${b.replyRate.toFixed(1)}% for score ${b.dimension}.`,
    enrichment_depth: (t, b) => `"${t.dimension}" enrichment yields ${t.replyRate.toFixed(1)}% reply rate vs ${b.replyRate.toFixed(1)}% for "${b.dimension}". Invest in deeper enrichment.`,
    industry: (t, b) => `"${t.dimension}" industry responds best (${t.replyRate.toFixed(1)}% reply rate). "${b.dimension}" is weakest (${b.replyRate.toFixed(1)}%).`,
    word_count: (t, b) => `Emails in the ${t.dimension} word range get ${t.replyRate.toFixed(1)}% reply rate. ${b.dimension} words underperforms at ${b.replyRate.toFixed(1)}%.`,
    subject_variant: (t, b) => `Subject "${t.dimension}" gets ${t.replyRate.toFixed(1)}% reply rate vs "${b.dimension}" at ${b.replyRate.toFixed(1)}%. Consider using this pattern for future campaigns.`,
  };

  return {
    dimension,
    topPerformer: { label: top.dimension, replyRate: top.replyRate, sampleSize: top.sent },
    bottomPerformer: { label: bottom.dimension, replyRate: bottom.replyRate, sampleSize: bottom.sent },
    recommendation: recommendations[dimension]?.(top, bottom) ?? `"${top.dimension}" outperforms "${bottom.dimension}".`,
    confidence: getConfidence(totalSent),
  };
}

export async function getWorkspaceInsights(workspaceId: string): Promise<PerformanceInsight[]> {
  const [signalType, step, qualityScore, enrichmentDepth, industry, wordCount] = await Promise.all([
    getReplyRateBySignalType(workspaceId),
    getReplyRateByStep(workspaceId),
    getReplyRateByQualityScore(workspaceId),
    getReplyRateByEnrichmentDepth(workspaceId),
    getReplyRateByIndustry(workspaceId),
    getReplyRateByWordCount(workspaceId),
  ]);

  const insights: PerformanceInsight[] = [];
  const pairs: [PerformanceInsight["dimension"], CorrelationRow[]][] = [
    ["signal_type", signalType],
    ["framework", step],
    ["quality_score", qualityScore],
    ["enrichment_depth", enrichmentDepth],
    ["industry", industry],
    ["word_count", wordCount],
  ];

  for (const [dim, rows] of pairs) {
    const insight = buildInsight(dim, rows);
    if (insight) insights.push(insight);
  }

  return insights;
}

export interface CampaignReport {
  overview: {
    sent: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    bounceRate: number;
  };
  stepBreakdown: Array<{
    step: number;
    framework: string;
    sent: number;
    opened: number;
    replied: number;
    openRate: number;
    replyRate: number;
  }>;
  variantBreakdown: VariantPerformanceRow[];
  topLeads: Array<{
    name: string;
    company: string | null;
    email: string;
    openCount: number;
    replyCount: number;
  }>;
  insights: PerformanceInsight[];
}

const FRAMEWORK_NAMES = [
  "PAS (Timeline Hook)", "Value-add", "Social Proof",
  "New Angle", "Micro-value", "Breakup",
];

export async function getCampaignReport(workspaceId: string, campaignId: string): Promise<CampaignReport> {
  // Overview from StepAnalytics aggregate
  const steps = await prisma.stepAnalytics.findMany({
    where: { campaignId },
    orderBy: { step: "asc" },
  });

  const overview = steps.reduce(
    (acc, s) => ({
      sent: acc.sent + s.sent,
      opened: acc.opened + s.opened,
      replied: acc.replied + s.replied,
      bounced: acc.bounced + s.bounced,
    }),
    { sent: 0, opened: 0, replied: 0, bounced: 0 },
  );

  const openRate = overview.sent > 0 ? (overview.opened / overview.sent) * 100 : 0;
  const replyRate = overview.sent > 0 ? (overview.replied / overview.sent) * 100 : 0;
  const bounceRate = overview.sent > 0 ? (overview.bounced / overview.sent) * 100 : 0;

  // Step breakdown
  const stepBreakdown = steps.map((s) => ({
    step: s.step,
    framework: FRAMEWORK_NAMES[s.step] ?? `Step ${s.step}`,
    sent: s.sent,
    opened: s.opened,
    replied: s.replied,
    openRate: s.openRate ?? (s.sent > 0 ? (s.opened / s.sent) * 100 : 0),
    replyRate: s.replyRate ?? (s.sent > 0 ? (s.replied / s.sent) * 100 : 0),
  }));

  // Top leads (by replies, then opens)
  const topLeads = await prisma.emailPerformance.findMany({
    where: { campaignId },
    orderBy: [{ replyCount: "desc" }, { openCount: "desc" }],
    take: 5,
    include: {
      lead: { select: { firstName: true, lastName: true, company: true, email: true } },
    },
  });

  // Campaign-specific insights + variant breakdown
  const [signalType, step, variantBreakdown] = await Promise.all([
    getReplyRateBySignalType(workspaceId, campaignId),
    getReplyRateByStep(workspaceId, campaignId),
    getReplyRateBySubjectVariant(workspaceId, campaignId),
  ]);

  const insights: PerformanceInsight[] = [];
  const signalInsight = buildInsight("signal_type", signalType);
  if (signalInsight) insights.push(signalInsight);
  const stepInsight = buildInsight("framework", step);
  if (stepInsight) insights.push(stepInsight);

  // Build variant insight if we have enough data
  if (variantBreakdown.length >= 2) {
    const variantCorrelationRows: CorrelationRow[] = variantBreakdown.map((v) => ({
      dimension: v.subject,
      sent: v.sent,
      opened: v.opened,
      replied: v.replied,
      openRate: v.openRate,
      replyRate: v.replyRate,
    }));
    const variantInsight = buildInsight("subject_variant" as PerformanceInsight["dimension"], variantCorrelationRows);
    if (variantInsight) insights.push(variantInsight);
  }

  return {
    overview: { ...overview, openRate, replyRate, bounceRate },
    stepBreakdown,
    variantBreakdown,
    topLeads: topLeads.map((p) => ({
      name: [p.lead.firstName, p.lead.lastName].filter(Boolean).join(" "),
      company: p.lead.company,
      email: p.lead.email,
      openCount: p.openCount,
      replyCount: p.replyCount,
    })),
    insights,
  };
}
