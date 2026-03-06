import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

type EnrichmentJson = Record<string, unknown>;

function str(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return String(val);
}

function arr(val: unknown): string {
  if (!Array.isArray(val) || val.length === 0) return "";
  return val
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        const text = str(obj.event ?? obj.statement ?? obj.change ?? "");
        const date = str(obj.date);
        return date ? `${text} (${date})` : text;
      }
      return String(item);
    })
    .join("; ");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user?.workspaceId) {
    return new Response("No workspace", { status: 403 });
  }

  const { campaignId } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign || campaign.workspaceId !== user.workspaceId) {
    return Response.json({ error: "Campaign not found" }, { status: 404 });
  }

  const url = new URL(req.url);
  const format = url.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const leads = await prisma.lead.findMany({
    where: { campaignId, workspaceId: user.workspaceId },
    include: {
      emails: {
        orderBy: { step: "asc" },
        select: { step: true, subject: true, body: true },
      },
    },
    orderBy: { icpScore: { sort: "desc", nulls: "last" } },
  });

  // Build leads sheet data
  const leadsRows = leads.map((l) => {
    const e = (l.enrichmentData as EnrichmentJson) ?? {};
    const row: Record<string, string> = {
      "First Name": str(l.firstName),
      "Last Name": str(l.lastName),
      Email: str(l.email),
      Company: str(l.company),
      "Job Title": str(l.jobTitle),
      "LinkedIn URL": str(l.linkedinUrl),
      Phone: str(l.phone),
      Website: str(l.website),
      Country: str(l.country),
      "Company Size": str(l.companySize),
      Industry: str(l.industry),
      "ICP Score": l.icpScore != null ? String(l.icpScore) : "",
      Status: l.status,
      // Enrichment fields
      "Company Summary": str(e.companySummary),
      Products: arr(e.products),
      "Target Market": str(e.targetMarket),
      "Value Proposition": str(e.valueProposition),
      "Pain Points": arr(e.painPoints),
      "Recent News": arr(e.recentNews),
      "Buying Signals": arr(e.signals),
      "Tech Stack": arr(e.techStack),
      "Hiring Signals": arr(e.hiringSignals),
      "Funding Signals": arr(e.fundingSignals),
      "Product Launches": arr(e.productLaunches),
      "Leadership Changes": arr(e.leadershipChanges),
      "Public Priorities": arr(e.publicPriorities),
      "Tech Stack Changes": arr(e.techStackChanges),
      "LinkedIn Headline": str(e.linkedinHeadline),
      "Career History": arr(e.careerHistory),
      "Recent LinkedIn Posts": arr(e.recentLinkedInPosts),
      "Team Size": str(e.teamSize),
    };

    if (format === "csv") {
      // Flatten emails into columns for CSV
      for (let step = 0; step < 6; step++) {
        const email = l.emails.find((em) => em.step === step);
        row[`Step ${step} Subject`] = email?.subject ?? "";
        row[`Step ${step} Body`] = email?.body ?? "";
      }
    }

    return row;
  });

  if (format === "xlsx") {
    // Build emails sheet
    const emailRows: Record<string, string>[] = [];
    for (const l of leads) {
      for (const email of l.emails) {
        emailRows.push({
          "First Name": str(l.firstName),
          "Last Name": str(l.lastName),
          Email: str(l.email),
          Company: str(l.company),
          Step: String(email.step),
          Subject: email.subject,
          Body: email.body,
        });
      }
    }

    const wb = XLSX.utils.book_new();
    const wsLeads = XLSX.utils.json_to_sheet(leadsRows);
    XLSX.utils.book_append_sheet(wb, wsLeads, "Leads");

    if (emailRows.length > 0) {
      const wsEmails = XLSX.utils.json_to_sheet(emailRows);
      XLSX.utils.book_append_sheet(wb, wsEmails, "Emails");
    }

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}-export.xlsx"`,
      },
    });
  }

  // CSV format
  if (leadsRows.length === 0) {
    return new Response("\uFEFF", {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}-export.csv"`,
      },
    });
  }

  const headers = Object.keys(leadsRows[0]);
  const csvLines = [
    headers.map(escapeCsvField).join(","),
    ...leadsRows.map((row) => headers.map((h) => escapeCsvField(row[h] ?? "")).join(",")),
  ];

  return new Response("\uFEFF" + csvLines.join("\n"), {
    headers: {
      "Content-Type": "text/csv;charset=utf-8",
      "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}-export.csv"`,
    },
  });
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
