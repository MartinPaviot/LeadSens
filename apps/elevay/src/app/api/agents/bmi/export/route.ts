import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { BpiOutput, Risk, QuickWin, RoadmapPhase } from "@/agents/bpi-01/types";
import type { AgentOutput } from "@/agents/_shared/types";

// ── Input validation ──────────────────────────────────────────────────────────

const ExportSchema = z.object({
  format: z.enum(["pdf", "gdoc", "slides"]),
});

// ── Markdown report builder ───────────────────────────────────────────────────

function buildMarkdownReport(brandName: string, payload: BpiOutput): string {
  const { scores } = payload;

  const rows = (
    [
      ["Réputation", scores.reputation],
      ["Visibilité", scores.visibility],
      ["Présence sociale", scores.social],
      ["Dominance concurrentielle", scores.competitive],
    ] as [string, number][]
  )
    .map(([label, score]) => `| ${label} | **${score}/100** |`)
    .join("\n");

  const risks = payload.top_risks
    .map((r: Risk, i: number) => `${i + 1}. **[${r.urgency}]** ${r.description} *(${r.source})*`)
    .join("\n");

  const wins = payload.quick_wins
    .map(
      (w: QuickWin) =>
        `- **${w.action}** — impact: ${w.impact} · effort: ${w.effort} · ⏱ ${w.estimated_time}`,
    )
    .join("\n");

  const roadmap = payload.roadmap_90d
    .map(
      (p: RoadmapPhase) =>
        `**${p.label}** — ${p.objective}\n${p.actions.map((a: string) => `  - ${a}`).join("\n")}`,
    )
    .join("\n\n");

  return [
    `# Audit de présence en ligne — ${brandName}`,
    ``,
    `**Score global : ${scores.global}/100**`,
    ``,
    `| Axe | Score |`,
    `|-----|-------|`,
    rows,
    ``,
    `## Risques prioritaires`,
    risks || "*Aucun risque identifié*",
    ``,
    `## Quick wins`,
    wins || "*Aucun quick win identifié*",
    ``,
    `## Roadmap 90 jours`,
    roadmap || "*Roadmap non disponible*",
  ].join("\n");
}

// ── PDF builder (pdfkit) ──────────────────────────────────────────────────────

async function buildPdf(brandName: string, payload: BpiOutput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const { scores } = payload;
    const globalScore = scores.global;
    const scoreColor = globalScore >= 70 ? "#22c55e" : globalScore >= 40 ? "#f59e0b" : "#ef4444";

    // ── Header ────────────────────────────────────────
    doc.fontSize(20).font("Helvetica-Bold").fillColor("#111827")
       .text(`Audit BPI-01 — ${brandName}`, 50, 50);
    doc.fontSize(10).font("Helvetica").fillColor("#6b7280")
       .text(
         `Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
         50,
         80,
       );

    // Score circle
    doc.circle(500, 75, 28).fillAndStroke(scoreColor, scoreColor);
    doc.fontSize(14).font("Helvetica-Bold").fillColor("white")
       .text(`${globalScore}`, 488, 67, { width: 24, align: "center" });
    doc.fontSize(7).fillColor("white").text("/100", 490, 84, { width: 20, align: "center" });

    doc.moveDown(2);

    // ── Score bars ────────────────────────────────────
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Scores par axe", 50);
    doc.moveDown(0.5);

    const axes: [string, number][] = [
      ["Réputation", scores.reputation],
      ["Visibilité", scores.visibility],
      ["Présence sociale", scores.social],
      ["Dominance concurrentielle", scores.competitive],
    ];

    for (const [label, score] of axes) {
      const barColor = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
      const y = doc.y;
      doc.fontSize(9).font("Helvetica").fillColor("#374151").text(label, 50, y, { width: 150 });
      doc.fontSize(9).font("Helvetica-Bold").fillColor("#111827").text(`${score}/100`, 205, y, { width: 55 });
      doc.rect(270, y + 2, 240, 8).fillColor("#e5e7eb").fill();
      doc.rect(270, y + 2, (score / 100) * 240, 8).fillColor(barColor).fill();
      doc.moveDown(1.2);
    }
    doc.moveDown(1);

    // ── Risks ─────────────────────────────────────────
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Risques prioritaires");
    doc.moveDown(0.5);

    const urgencyColors: Record<string, string> = {
      high: "#ef4444",
      medium: "#f59e0b",
      low: "#6b7280",
    };

    for (const risk of payload.top_risks.slice(0, 5)) {
      const badgeColor = urgencyColors[risk.urgency] ?? "#6b7280";
      const y = doc.y;
      doc.roundedRect(50, y, 44, 14, 7).fillColor(badgeColor).fill();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
         .text(risk.urgency.toUpperCase(), 50, y + 3, { width: 44, align: "center" });
      doc.fontSize(9).font("Helvetica").fillColor("#374151")
         .text(risk.description, 103, y, { width: 407 });
      doc.moveDown(1.2);
    }
    doc.moveDown(0.5);

    // ── Quick wins ────────────────────────────────────
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Quick wins");
    doc.moveDown(0.5);

    const effortColors: Record<string, string> = {
      low: "#22c55e",
      medium: "#f59e0b",
      high: "#ef4444",
    };

    for (const win of payload.quick_wins.slice(0, 5)) {
      const badgeColor = effortColors[win.effort] ?? "#6b7280";
      const y = doc.y;
      doc.roundedRect(50, y, 44, 14, 7).fillColor(badgeColor).fill();
      doc.fontSize(7).font("Helvetica-Bold").fillColor("white")
         .text(win.effort.toUpperCase(), 50, y + 3, { width: 44, align: "center" });
      doc.fontSize(9).font("Helvetica").fillColor("#374151")
         .text(
           `${win.action} — impact: ${win.impact} · ${win.estimated_time}`,
           103,
           y,
           { width: 407 },
         );
      doc.moveDown(1.2);
    }

    // ── Roadmap — new page ────────────────────────────
    doc.addPage();
    doc.fontSize(13).font("Helvetica-Bold").fillColor("#111827").text("Roadmap 90 jours", 50, 50);
    doc.moveDown(1);

    const colWidth = 160;
    const colGap = 15;
    const cols = [50, 50 + colWidth + colGap, 50 + (colWidth + colGap) * 2];
    const phases = payload.roadmap_90d.slice(0, 3);
    const startY = doc.y;

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      if (!phase) continue;
      const x = cols[i] ?? 50;
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1d4ed8")
         .text(phase.label, x, startY, { width: colWidth });
      doc.fontSize(8).font("Helvetica").fillColor("#6b7280")
         .text(phase.objective, x, startY + 16, { width: colWidth });
      let itemY = startY + 36;
      for (const action of phase.actions) {
        doc.fontSize(8).font("Helvetica").fillColor("#374151")
           .text(`• ${action}`, x, itemY, { width: colWidth });
        itemY += doc.currentLineHeight() + 4;
      }
    }

    doc.end();
  });
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
      title: `BPI-01 — ${brandName} — ${new Date().toLocaleDateString("fr-FR")}`,
    }),
  });

  const doc = await createRes.json() as {
    documentId?: string;
    error?: { message: string };
  };

  if (!doc.documentId) {
    throw new Error(doc.error?.message ?? "Impossible de créer le document");
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

// ── Route POST ────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Auth
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ type: "error", message: "Non autorisé." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.workspaceId) {
    return NextResponse.json({ type: "error", message: "Espace de travail introuvable." }, { status: 400 });
  }

  // Validate input
  const body = await req.json() as unknown;
  const parsed = ExportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ type: "error", message: "Format d'export invalide." }, { status: 400 });
  }
  const { format } = parsed.data;

  // Fetch latest completed run
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
      message: "Aucun audit disponible. Lancez d'abord un audit en cliquant sur **Auditer ma marque**.",
    });
  }

  const agentOutput = run.output as AgentOutput<BpiOutput> | null;
  if (!agentOutput?.payload || !agentOutput.brand_profile) {
    return NextResponse.json({
      type: "error",
      message: "Les données de l'audit sont corrompues. Relancez un audit.",
    });
  }

  const brandName = agentOutput.brand_profile.brand_name;
  const payload = agentOutput.payload;

  // ── PDF export ────────────────────────────────────────────────────────────
  if (format === "pdf") {
    const pdfBuffer = await buildPdf(brandName, payload);
    const base64 = pdfBuffer.toString("base64");
    const slug = brandName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    return NextResponse.json({
      type: "pdf",
      dataUrl: `data:application/pdf;base64,${base64}`,
      filename: `bpi-01-${slug}.pdf`,
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
        message: "Google Drive non connecté. Reconnectez-le dans vos paramètres.",
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

    const docUrl = await createGoogleDoc(accessToken, brandName, payload);
    return NextResponse.json({ type: "gdoc", url: docUrl });
  }

  // slides — not yet implemented
  return NextResponse.json({
    type: "error",
    message: "L'export Google Slides n'est pas encore disponible.",
  });
}
