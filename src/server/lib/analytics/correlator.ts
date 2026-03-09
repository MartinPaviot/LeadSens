import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface CorrelationRow {
  dimension: string;
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build the optional campaignId WHERE clause fragment. */
function campaignFilter(campaignId?: string): Prisma.Sql {
  return campaignId
    ? Prisma.sql`AND de."campaignId" = ${campaignId}`
    : Prisma.empty;
}

/** Shared FROM + JOIN + base WHERE used by every query. */
function baseFrom(workspaceId: string, campaignId?: string): Prisma.Sql {
  return Prisma.sql`
    FROM "drafted_email" de
    JOIN "lead" l ON de."leadId" = l.id
    JOIN "email_performance" ep
      ON ep."leadId" = l.id
     AND ep."campaignId" = de."campaignId"
    WHERE l."workspaceId" = ${workspaceId}
      ${campaignFilter(campaignId)}
  `;
}

interface RawRow {
  dimension: string;
  sent: bigint;
  opened: bigint;
  replied: bigint;
}

/** Convert raw DB rows (bigint counts) into CorrelationRow[] with rates. */
function toCorrelationRows(rows: RawRow[]): CorrelationRow[] {
  return rows
    .filter((r) => Number(r.sent) >= 5)
    .map((r) => {
      const sent = Number(r.sent);
      const opened = Number(r.opened);
      const replied = Number(r.replied);
      return {
        dimension: r.dimension,
        sent,
        opened,
        replied,
        openRate: Math.round((opened / sent) * 10000) / 100,
        replyRate: Math.round((replied / sent) * 10000) / 100,
      };
    });
}

// ---------------------------------------------------------------------------
// Correlation queries
// ---------------------------------------------------------------------------

export async function getReplyRateBySignalType(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      de."signalType"                                     AS dimension,
      COUNT(*)                                            AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)  AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END) AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."signalType" IS NOT NULL
    GROUP BY de."signalType"
    ORDER BY replied DESC
  `;
  return toCorrelationRows(rows);
}

export async function getReplyRateByStep(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      COALESCE(de."frameworkName", CONCAT('Step ', de.step)) AS dimension,
      COUNT(*)                                                AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)      AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)     AS replied
    ${baseFrom(workspaceId, campaignId)}
    GROUP BY de.step, de."frameworkName"
    ORDER BY de.step
  `;
  return toCorrelationRows(rows);
}

export async function getReplyRateByQualityScore(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      CASE
        WHEN de."qualityScore" BETWEEN 1 AND 4 THEN '1-4'
        WHEN de."qualityScore" BETWEEN 5 AND 6 THEN '5-6'
        WHEN de."qualityScore" BETWEEN 7 AND 8 THEN '7-8'
        WHEN de."qualityScore" BETWEEN 9 AND 10 THEN '9-10'
      END                                                   AS dimension,
      COUNT(*)                                              AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)   AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."qualityScore" IS NOT NULL
    GROUP BY
      CASE
        WHEN de."qualityScore" BETWEEN 1 AND 4 THEN '1-4'
        WHEN de."qualityScore" BETWEEN 5 AND 6 THEN '5-6'
        WHEN de."qualityScore" BETWEEN 7 AND 8 THEN '7-8'
        WHEN de."qualityScore" BETWEEN 9 AND 10 THEN '9-10'
      END
    ORDER BY dimension
  `;
  return toCorrelationRows(rows);
}

export async function getReplyRateByEnrichmentDepth(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      de."enrichmentDepth"                                  AS dimension,
      COUNT(*)                                              AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)   AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."enrichmentDepth" IS NOT NULL
    GROUP BY de."enrichmentDepth"
    ORDER BY replied DESC
  `;
  return toCorrelationRows(rows);
}

export async function getReplyRateByIndustry(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      de."leadIndustry"                                     AS dimension,
      COUNT(*)                                              AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)   AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."leadIndustry" IS NOT NULL
    GROUP BY de."leadIndustry"
    ORDER BY replied DESC
  `;
  return toCorrelationRows(rows);
}

export async function getReplyRateByWordCount(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      CASE
        WHEN de."bodyWordCount" < 50  THEN '<50'
        WHEN de."bodyWordCount" < 80  THEN '50-80'
        WHEN de."bodyWordCount" < 120 THEN '80-120'
        ELSE '120+'
      END                                                   AS dimension,
      COUNT(*)                                              AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ep."replyCount" > 0 THEN 1 ELSE 0 END)   AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."bodyWordCount" IS NOT NULL
    GROUP BY
      CASE
        WHEN de."bodyWordCount" < 50  THEN '<50'
        WHEN de."bodyWordCount" < 80  THEN '50-80'
        WHEN de."bodyWordCount" < 120 THEN '80-120'
        ELSE '120+'
      END
    ORDER BY
      CASE dimension
        WHEN '<50'    THEN 1
        WHEN '50-80'  THEN 2
        WHEN '80-120' THEN 3
        WHEN '120+'   THEN 4
      END
  `;
  return toCorrelationRows(rows);
}
