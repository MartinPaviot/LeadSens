import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { BpiOutput, Priority90d } from "@/agents/bpi-01/types";
import type { MtsOutput, TrendingTopic, SaturatedTopic, RoadmapEntry } from "@/agents/mts-02/types";
import type { CiaOutput, CompetitorScore, StrategicZone, Threat, ActionPhase } from "@/agents/cia-03/types";
import type { AgentOutput } from "@/agents/_shared/types";

// ── Input validation ──────────────────────────────────────────────────────────

const ExportSchema = z.object({
  format: z.enum(["pdf", "gdoc", "slides"]),
  agentCode: z.enum(["BPI-01", "MTS-02", "CIA-03"]).default("BPI-01"),
});

// ── Markdown report builder ───────────────────────────────────────────────────

function buildMarkdownReport(brandName: string, payload: BpiOutput): string {
  const { scores } = payload;

  const rows = (
    [
      ["SERP",                     scores.serp],
      ["Press",                    scores.press],
      ["YouTube",                  scores.youtube],
      ["Social media",             scores.social],
      ["Organic SEO",              scores.seo],
      ["Competitive benchmark",    scores.benchmark],
    ] as [string, number][]
  )
    .map(([label, score]) => `| ${label} | **${score}/100** |`)
    .join("\n");

  const priorities = payload.priorities_90d
    .map((p: Priority90d, i: number) => `${i + 1}. **[${p.tag}]** ${p.action}\n   *${p.source_problem}*`)
    .join("\n");

  return [
    `# Brand Presence Audit — ${brandName}`,
    ``,
    `**Global score: ${scores.global}/100**`,
    ``,
    `| Axis | Score |`,
    `|------|-------|`,
    rows,
    ``,
    `## 90-day priorities`,
    priorities || "*No priorities identified*",
  ].join("\n");
}

// ── MTS Markdown report builder ───────────────────────────────────────────────

function buildMtsMarkdownReport(sector: string, payload: MtsOutput): string {
  const top5 = [...payload.trending_topics]
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 5);

  const topics = top5
    .map((t: TrendingTopic) => `- **${t.topic}** (${t.opportunity_score}/100, +${Math.round(t.growth_4w)}%) — ${t.best_channel} — ${t.suggested_angle}`)
    .join("\n");

  const saturated = payload.saturated_topics
    .map((t: SaturatedTopic) => `- ${t.topic}: ${t.reason}`)
    .join("\n");

  const roadmap = payload.roadmap_30d
    .map((e: RoadmapEntry) => `- Week ${e.week} · ${e.canal} · ${e.format}: ${e.suggested_title} (${e.objective})`)
    .join("\n");

  return [
    `# Market Trends — ${sector}`,
    ``,
    `**Score: ${payload.global_score}/100** · ${payload.analysis_period} · ${payload.mode}`,
    ``,
    `## Top opportunities`,
    topics || "*None identified*",
    ``,
    `## Saturated topics (avoid)`,
    saturated || "*None*",
    ``,
    `## 30-day roadmap`,
    roadmap || "*Roadmap not available*",
  ].join("\n");
}

// ── CIA Markdown report builder ───────────────────────────────────────────────

function buildCiaMarkdownReport(brandName: string, payload: CiaOutput): string {
  const allScored = payload.competitor_scores;
  const scores = allScored
    .map((c: CompetitorScore) => `| ${c.entity}${c.is_client ? " *(vous)*" : ""} | **${c.global_score}/100** | ${c.level} | ${c.seo_score} | ${c.product_score} | ${c.social_score} | ${c.content_score} |`)
    .join("\n");

  const zones = payload.strategic_zones
    .map((z: StrategicZone) => `| ${z.axis} | ${z.zone} | ${z.directive} |`)
    .join("\n");

  const threats = payload.threats
    .map((t) => `- **[${t.urgency}]** ${t.description}`)
    .join("\n");

  const opps = payload.opportunities
    .map((o) => `- **${o.description}** — effort: ${o.effort} · impact: ${o.impact} · ${o.timeframe}`)
    .join("\n");

  const plan = payload.action_plan_60d
    .map((p: ActionPhase) => `**${p.label}** : ${p.objective}\n${p.actions.map((a: string) => `  - ${a}`).join("\n")}`)
    .join("\n\n");

  return [
    `# Competitive Analysis — ${brandName}`,
    ``,
    `**Score: ${payload.brand_score}/100** · ${payload.analysis_date.slice(0, 10)}`,
    ``,
    `## Competitive ranking`,
    `| Entity | Score | Level | SEO | Product | Social | Content |`,
    `|--------|-------|-------|-----|---------|--------|---------|`,
    scores,
    ``,
    `## Strategic zones`,
    `| Axis | Zone | Directive |`,
    `|------|------|-----------|`,
    zones || "| *None* | | |",
    ``,
    `## Threats`,
    threats || "*None*",
    ``,
    `## Opportunities`,
    opps || "*None*",
    ``,
    `## 60-day action plan`,
    plan || "*Plan not available*",
  ].join("\n");
}

// ── PDF styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    paddingTop: 50,
    paddingBottom: 50,
    paddingHorizontal: 50,
    color: "#374151",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 9,
    color: "#6b7280",
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreNumber: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
  },
  scoreDenom: {
    fontSize: 7,
    color: "#ffffff",
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  axisRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  axisLabel: {
    width: 140,
    fontSize: 9,
    color: "#374151",
  },
  axisScore: {
    width: 48,
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
  },
  barBg: {
    flex: 1,
    height: 7,
    backgroundColor: "#e5e7eb",
    borderRadius: 4,
  },
  barFill: {
    height: 7,
    borderRadius: 4,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 7,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginRight: 8,
    minWidth: 42,
  },
  badgeText: {
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textAlign: "center",
  },
  riskText: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
  },
  roadmapGrid: {
    flexDirection: "row",
    gap: 12,
  },
  roadmapCol: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1d4ed8",
    marginBottom: 3,
  },
  phaseObjective: {
    fontSize: 8,
    color: "#6b7280",
    marginBottom: 6,
  },
  phaseAction: {
    fontSize: 8,
    color: "#374151",
    marginBottom: 3,
  },
});

// ── Color helpers ─────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  return score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
}

const tagColors: Record<string, string> = {
  "Urgent": "#ef4444",
  "Moyen terme": "#f59e0b",
  "Quick win": "#22c55e",
};

// ── PDF component ─────────────────────────────────────────────────────────────

function AuditPDF({ brandName, payload }: { brandName: string; payload: BpiOutput }) {
  const { scores } = payload;
  const globalColor = scoreColor(scores.global);
  const dateStr = new Date().toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const axes: [string, number][] = [
    ["SERP",                     scores.serp],
    ["Press",                    scores.press],
    ["YouTube",                  scores.youtube],
    ["Social media",             scores.social],
    ["Organic SEO",              scores.seo],
    ["Competitive benchmark",    scores.benchmark],
  ];

  return (
    <Document>
      {/* Page 1 — scores + priorities */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>BPI-01 Audit — {brandName}</Text>
            <Text style={styles.subtitle}>Generated on {dateStr}</Text>
          </View>
          <View style={[styles.scoreCircle, { backgroundColor: globalColor }]}>
            <Text style={styles.scoreNumber}>{scores.global}</Text>
            <Text style={styles.scoreDenom}>/100</Text>
          </View>
        </View>

        {/* Score bars */}
        <Text style={styles.sectionTitle}>Scores by axis</Text>
        {axes.map(([label, score]) => (
          <View key={label} style={styles.axisRow}>
            <Text style={styles.axisLabel}>{label}</Text>
            <Text style={styles.axisScore}>{score}/100</Text>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${score}%`, backgroundColor: scoreColor(score) },
                ]}
              />
            </View>
          </View>
        ))}

        {/* 90-day priorities */}
        <Text style={styles.sectionTitle}>90-day priorities</Text>
        {payload.priorities_90d.slice(0, 5).map((prio: Priority90d, i: number) => (
          <View key={i} style={styles.riskRow}>
            <View style={[styles.badge, { backgroundColor: tagColors[prio.tag] ?? "#6b7280" }]}>
              <Text style={styles.badgeText}>{prio.tag.toUpperCase()}</Text>
            </View>
            <Text style={styles.riskText}>
              {prio.action} — {prio.source_problem}
            </Text>
          </View>
        ))}

        {/* Trustpilot — shown only if data available */}
        {payload.trustpilot?.found && payload.trustpilot.rating !== undefined && (
          <>
            <Text style={styles.sectionTitle}>Trustpilot</Text>
            <View style={styles.riskRow}>
              <View style={[styles.badge, { backgroundColor: scoreColor(payload.trustpilot.rating * 20) }]}>
                <Text style={styles.badgeText}>{payload.trustpilot.rating}/5</Text>
              </View>
              <Text style={styles.riskText}>
                {payload.trustpilot.sentiment_label ?? "–"}
                {payload.trustpilot.review_count ? ` · ${payload.trustpilot.review_count} reviews` : ""}
              </Text>
            </View>
          </>
        )}
      </Page>
    </Document>
  );
}

// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildPdf(brandName: string, payload: BpiOutput): Promise<Buffer> {
  return renderToBuffer(<AuditPDF brandName={brandName} payload={payload} />);
}

// ── MTS PDF component ─────────────────────────────────────────────────────────

function MtsPDF({ sector, payload }: { sector: string; payload: MtsOutput }) {
  const top5 = [...payload.trending_topics]
    .sort((a: TrendingTopic, b: TrendingTopic) => b.opportunity_score - a.opportunity_score)
    .slice(0, 5);
  const dateStr = new Date().toLocaleDateString("en-US", {
    day: "numeric", month: "long", year: "numeric",
  });
  const globalColor = scoreColor(payload.global_score);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Market Trends — {sector}</Text>
            <Text style={styles.subtitle}>Generated on {dateStr} · {payload.analysis_period} · {payload.mode}</Text>
          </View>
          <View style={[styles.scoreCircle, { backgroundColor: globalColor }]}>
            <Text style={styles.scoreNumber}>{payload.global_score}</Text>
            <Text style={styles.scoreDenom}>/100</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Top opportunities</Text>
        {top5.map((t: TrendingTopic, i: number) => (
          <View key={i} style={styles.riskRow}>
            <View style={[styles.badge, { backgroundColor: "#6366f1" }]}>
              <Text style={styles.badgeText}>{t.opportunity_score}</Text>
            </View>
            <Text style={styles.riskText}>{t.topic} (+{Math.round(t.growth_4w)}% · {t.best_channel}) — {t.suggested_angle}</Text>
          </View>
        ))}
        {payload.saturated_topics.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Saturated topics (avoid)</Text>
            {payload.saturated_topics.map((t: SaturatedTopic, i: number) => (
              <Text key={i} style={styles.riskText}>• {t.topic}: {t.reason}</Text>
            ))}
          </>
        )}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>30-Day Content Roadmap</Text>
        {payload.roadmap_30d.map((entry: RoadmapEntry, i: number) => (
          <View key={i} style={{ marginBottom: 8 }}>
            <Text style={styles.phaseLabel}>Week {entry.week} — {entry.canal} ({entry.format}) — {entry.objective}</Text>
            <Text style={styles.riskText}>{entry.suggested_title}</Text>
            <Text style={[styles.riskText, { color: "#6b7280" }]}>Topic: {entry.topic}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

async function buildMtsPdf(sector: string, payload: MtsOutput): Promise<Buffer> {
  return renderToBuffer(<MtsPDF sector={sector} payload={payload} />);
}

// ── CIA PDF component ─────────────────────────────────────────────────────────

function CiaPDF({ brandName, payload }: { brandName: string; payload: CiaOutput }) {
  const green = payload.strategic_zones.filter((z: StrategicZone) => z.zone === "green");
  const red = payload.strategic_zones.filter((z: StrategicZone) => z.zone === "red");
  const dateStr = new Date().toLocaleDateString("en-US", {
    day: "numeric", month: "long", year: "numeric",
  });
  const globalColor = scoreColor(payload.brand_score);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Competitive Analysis — {brandName}</Text>
            <Text style={styles.subtitle}>Generated on {dateStr}</Text>
          </View>
          <View style={[styles.scoreCircle, { backgroundColor: globalColor }]}>
            <Text style={styles.scoreNumber}>{payload.brand_score}</Text>
            <Text style={styles.scoreDenom}>/100</Text>
          </View>
        </View>
        <Text style={styles.sectionTitle}>Competitive ranking</Text>
        {payload.competitor_scores.map((c: CompetitorScore, i: number) => (
          <View key={i} style={styles.axisRow}>
            <Text style={styles.axisLabel}>{c.entity}{c.is_client ? " (vous)" : ""}</Text>
            <Text style={styles.axisScore}>{c.global_score}/100</Text>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: `${c.global_score}%`, backgroundColor: c.is_client ? "#0ea5e9" : scoreColor(c.global_score) }]} />
            </View>
          </View>
        ))}
        <Text style={styles.sectionTitle}>Threats</Text>
        {payload.threats.slice(0, 3).map((t: Threat, i: number) => (
          <View key={i} style={styles.riskRow}>
            <View style={[styles.badge, { backgroundColor: t.urgency === "critical" ? "#ef4444" : t.urgency === "medium" ? "#f59e0b" : "#6b7280" }]}>
              <Text style={styles.badgeText}>{t.urgency.toUpperCase()}</Text>
            </View>
            <Text style={styles.riskText}>{t.description}</Text>
          </View>
        ))}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>Strategic zones</Text>
        <Text style={[styles.phaseLabel, { color: "#22c55e" }]}>Green zones (opportunities)</Text>
        {green.map((z: StrategicZone, i: number) => (
          <Text key={i} style={styles.riskText}>• {z.axis}: {z.directive}</Text>
        ))}
        <Text style={[styles.phaseLabel, { color: "#ef4444", marginTop: 12 }]}>Red zones (threats)</Text>
        {red.map((z: StrategicZone, i: number) => (
          <Text key={i} style={styles.riskText}>• {z.axis}: {z.directive}</Text>
        ))}
      </Page>
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>60-Day Action Plan</Text>
        {payload.action_plan_60d.map((phase: ActionPhase, i: number) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={styles.phaseLabel}>{phase.label}</Text>
            <Text style={styles.phaseObjective}>{phase.objective}</Text>
            {phase.actions.map((a: string, j: number) => (
              <Text key={j} style={styles.phaseAction}>• {a}</Text>
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}

async function buildCiaPdf(brandName: string, payload: CiaOutput): Promise<Buffer> {
  return renderToBuffer(<CiaPDF brandName={brandName} payload={payload} />);
}

// ── Google token refresh ──────────────────────────────────────────────────────

async function refreshGoogleToken(integration: {
  refreshToken: string | null;
  workspaceId: string;
}): Promise<string> {
  if (!integration.refreshToken) throw new Error("No refresh token");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: integration.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json() as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };

  if (!data.access_token) {
    throw new Error(`Token refresh failed: ${data.error ?? "unknown"}`);
  }

  await prisma.integration.update({
    where: {
      workspaceId_type: { workspaceId: integration.workspaceId, type: "google-docs" },
    },
    data: {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in ?? 3600) * 1000),
    },
  });

  return data.access_token;
}

// ── Google Docs creator ───────────────────────────────────────────────────────

async function createGoogleDoc(
  accessToken: string,
  brandName: string,
  payload: BpiOutput,
): Promise<string> {
  // 1. Create the document
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: `BPI-01 — ${brandName} — ${new Date().toLocaleDateString("en-US")}`,
    }),
  });

  const doc = await createRes.json() as {
    documentId?: string;
    error?: { message: string };
  };

  if (!doc.documentId) {
    throw new Error(doc.error?.message ?? "Failed to create Google Doc");
  }

  // 2. Insert content via batchUpdate
  const markdown = buildMarkdownReport(brandName, payload);

  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: markdown,
          },
        },
      ],
    }),
  });

  return `https://docs.google.com/document/d/${doc.documentId}/edit`;
}

async function createGoogleDocMts(
  accessToken: string,
  sector: string,
  payload: MtsOutput,
): Promise<string> {
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `MTS-02 — ${sector} — ${new Date().toLocaleDateString("en-US")}` }),
  });
  const doc = await createRes.json() as { documentId?: string; error?: { message: string } };
  if (!doc.documentId) throw new Error(doc.error?.message ?? "Failed to create Google Doc");
  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: buildMtsMarkdownReport(sector, payload) } }] }),
  });
  return `https://docs.google.com/document/d/${doc.documentId}/edit`;
}

async function createGoogleDocCia(
  accessToken: string,
  brandName: string,
  payload: CiaOutput,
): Promise<string> {
  const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ title: `CIA-03 — ${brandName} — ${new Date().toLocaleDateString("en-US")}` }),
  });
  const doc = await createRes.json() as { documentId?: string; error?: { message: string } };
  if (!doc.documentId) throw new Error(doc.error?.message ?? "Failed to create Google Doc");
  await fetch(`https://docs.googleapis.com/v1/documents/${doc.documentId}:batchUpdate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ requests: [{ insertText: { location: { index: 1 }, text: buildCiaMarkdownReport(brandName, payload) } }] }),
  });
  return `https://docs.google.com/document/d/${doc.documentId}/edit`;
}

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ type: "error", message: "Unauthorized." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return NextResponse.json({ type: "error", message: "Workspace not found." }, { status: 400 });
  }

  // Validate input
  const body = await req.json() as unknown;
  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ type: "error", message: "Invalid export format." }, { status: 400 });
  }
  const { format, agentCode } = parsed.data;

  // ── MTS-02 PDF ────────────────────────────────────────────────────────────
  if (agentCode === "MTS-02" && format === "pdf") {
    const run = await prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: "MTS-02", status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!run?.output) {
      return NextResponse.json({ type: "error", message: "No MTS-02 run found. Please run a market trends analysis first." }, { status: 404 });
    }
    const agentOutput = run.output as unknown as AgentOutput<MtsOutput>;
    const sector = agentOutput.brand_profile?.sector ?? agentOutput.payload.session_context.sector;
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildMtsPdf(sector, agentOutput.payload);
    } catch (err) {
      console.error("[mts-pdf-export] error:", err);
      return NextResponse.json({ type: "error", message: "PDF generation failed." }, { status: 500 });
    }
    const slug = sector.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="mts-02-${slug}.pdf"`,
      },
    });
  }

  // ── CIA-03 PDF ────────────────────────────────────────────────────────────
  if (agentCode === "CIA-03" && format === "pdf") {
    const run = await prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: "CIA-03", status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!run?.output) {
      return NextResponse.json({ type: "error", message: "No CIA-03 run found. Please run a competitive analysis first." }, { status: 404 });
    }
    const agentOutput = run.output as unknown as AgentOutput<CiaOutput>;
    const brandName = agentOutput.brand_profile?.brand_name ?? "Brand";
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildCiaPdf(brandName, agentOutput.payload);
    } catch (err) {
      console.error("[cia-pdf-export] error:", err);
      return NextResponse.json({ type: "error", message: "PDF generation failed." }, { status: 500 });
    }
    const slug = brandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="cia-03-${slug}.pdf"`,
      },
    });
  }

  // ── MTS-02 Google Docs ────────────────────────────────────────────────────
  if (agentCode === "MTS-02" && format === "gdoc") {
    const run = await prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: "MTS-02", status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!run?.output) {
      return NextResponse.json({ type: "error", message: "No MTS-02 run found. Please run a market trends analysis first." }, { status: 404 });
    }
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: user.workspaceId, type: "google-docs" } },
    });
    if (!integration || integration.status !== "ACTIVE") {
      return NextResponse.json({ type: "error", message: "Google Drive not connected. Please reconnect it in your settings." });
    }
    let accessToken = integration.accessToken!;
    if (integration.expiresAt && integration.expiresAt < new Date(Date.now() + 60_000)) {
      accessToken = await refreshGoogleToken({ refreshToken: integration.refreshToken, workspaceId: user.workspaceId });
    }
    const agentOutput = run.output as unknown as AgentOutput<MtsOutput>;
    const sector = agentOutput.brand_profile?.sector ?? agentOutput.payload.session_context.sector;
    try {
      const docUrl = await createGoogleDocMts(accessToken, sector, agentOutput.payload);
      return NextResponse.json({ type: "gdoc", url: docUrl });
    } catch (err) {
      console.error("[gdoc-export] MTS-02 error:", err);
      return NextResponse.json(
        { type: "error", message: err instanceof Error ? err.message : "Google Docs export failed." },
        { status: 500 },
      );
    }
  }

  // ── CIA-03 Google Docs ────────────────────────────────────────────────────
  if (agentCode === "CIA-03" && format === "gdoc") {
    const run = await prisma.elevayAgentRun.findFirst({
      where: { workspaceId: user.workspaceId, agentCode: "CIA-03", status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!run?.output) {
      return NextResponse.json({ type: "error", message: "No CIA-03 run found. Please run a competitive analysis first." }, { status: 404 });
    }
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: user.workspaceId, type: "google-docs" } },
    });
    if (!integration || integration.status !== "ACTIVE") {
      return NextResponse.json({ type: "error", message: "Google Drive not connected. Please reconnect it in your settings." });
    }
    let accessToken = integration.accessToken!;
    if (integration.expiresAt && integration.expiresAt < new Date(Date.now() + 60_000)) {
      accessToken = await refreshGoogleToken({ refreshToken: integration.refreshToken, workspaceId: user.workspaceId });
    }
    const agentOutput = run.output as unknown as AgentOutput<CiaOutput>;
    const brandName = agentOutput.brand_profile?.brand_name ?? "Brand";
    try {
      const docUrl = await createGoogleDocCia(accessToken, brandName, agentOutput.payload);
      return NextResponse.json({ type: "gdoc", url: docUrl });
    } catch (err) {
      console.error("[gdoc-export] CIA-03 error:", err);
      return NextResponse.json(
        { type: "error", message: err instanceof Error ? err.message : "Google Docs export failed." },
        { status: 500 },
      );
    }
  }

  // ── BPI-01 (default) ─────────────────────────────────────────────────────
  const run = await prisma.elevayAgentRun.findFirst({
    where: {
      workspaceId: user.workspaceId,
      agentCode: "BPI-01",
      status: { in: ["COMPLETED", "PARTIAL"] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!run) {
    return NextResponse.json({
      type: "error",
      message: "No audit available. Please run a brand audit first.",
    });
  }

  const agentOutput = run.output as AgentOutput<BpiOutput> | null;
  if (!agentOutput?.payload || !agentOutput.brand_profile) {
    return NextResponse.json({
      type: "error",
      message: "Audit data is corrupted. Please run a new audit.",
    });
  }

  const brandName = agentOutput.brand_profile.brand_name;
  const payload = agentOutput.payload;

  // ── PDF export ────────────────────────────────────────────────────────────
  if (format === "pdf") {
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await buildPdf(brandName, payload);
    } catch (err) {
      console.error("[pdf-export] error:", err);
      console.error("[pdf-export] error stack:", err instanceof Error ? err.stack : String(err));
      return NextResponse.json(
        { type: "error", message: "PDF generation failed." },
        { status: 500 },
      );
    }
    const slug = brandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const filename = `bpi-01-${slug}.pdf`;
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // ── Google Docs export ────────────────────────────────────────────────────
  if (format === "gdoc") {
    const integration = await prisma.integration.findUnique({
      where: { workspaceId_type: { workspaceId: user.workspaceId, type: "google-docs" } },
    });

    if (!integration || integration.status !== "ACTIVE") {
      return NextResponse.json({
        type: "error",
        message: "Google Drive not connected. Please reconnect it in your settings.",
      });
    }

    // Refresh token if expired (60s margin)
    let accessToken = integration.accessToken!;
    if (integration.expiresAt && integration.expiresAt < new Date(Date.now() + 60_000)) {
      accessToken = await refreshGoogleToken({
        refreshToken: integration.refreshToken,
        workspaceId: user.workspaceId,
      });
    }

    try {
      const docUrl = await createGoogleDoc(accessToken, brandName, payload);
      return NextResponse.json({ type: "gdoc", url: docUrl });
    } catch (err) {
      console.error("[gdoc-export] BPI-01 error:", err);
      return NextResponse.json(
        { type: "error", message: err instanceof Error ? err.message : "Google Docs export failed." },
        { status: 500 },
      );
    }
  }

  // slides — not yet implemented
  return NextResponse.json({
    type: "error",
    message: "Google Slides export is not yet available.",
  });
}
