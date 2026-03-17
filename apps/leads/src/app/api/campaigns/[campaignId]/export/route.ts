import { z } from "zod/v4";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuthError, ForbiddenError, NotFoundError, toErrorResponse } from "@/lib/errors";
import * as XLSX from "xlsx";

const exportQuerySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("csv"),
});

function str(val: unknown): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  return String(val);
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ campaignId: string }> },
) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      throw new AuthError();
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user?.workspaceId) {
      throw new ForbiddenError("No workspace");
    }

    const { campaignId } = await params;

    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
    });
    if (!campaign || campaign.workspaceId !== user.workspaceId) {
      throw new NotFoundError("Campaign", campaignId);
    }

    const url = new URL(req.url);
    const parsed = exportQuerySchema.safeParse({
      format: url.searchParams.get("format") ?? undefined,
    });
    const format = parsed.success ? parsed.data.format : "csv";

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

    // Build leads sheet data — flat enrichment columns read directly from DB
    const leadsRows = leads.map((l: typeof leads[number]) => {
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
        // Flat enrichment columns (direct from DB, no JSON parsing)
        "Company Positioning": str(l.companyPositioning),
        "Company One-Liner": str(l.companyOneLiner),
        "Company Description": str(l.companyDescription),
        "Pain Points": str(l.painPointsFlat),
        Products: str(l.productsFlat),
        "Value Prop": str(l.valueProp),
        "Target Customers": str(l.targetCustomers),
        "Buying Signals": str(l.buyingSignals),
        "Tech Stack": str(l.techStackFlat),
        "LinkedIn Headline": str(l.linkedinHeadline),
        "Career History": str(l.careerHistory),
        "Recent Posts": str(l.recentPosts),
      };

      if (format === "csv") {
        // Flatten emails into columns for CSV
        for (let step = 0; step < 6; step++) {
          const email = l.emails.find((em: typeof l.emails[number]) => em.step === step);
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
      ...leadsRows.map((row: Record<string, string>) => headers.map((h) => escapeCsvField(row[h] ?? "")).join(",")),
    ];

    return new Response("\uFEFF" + csvLines.join("\n"), {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="${campaign.name.replace(/[^a-zA-Z0-9-_ ]/g, "")}-export.csv"`,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
