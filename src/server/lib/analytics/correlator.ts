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

export interface VariantPerformanceRow {
  variantIndex: number;
  subject: string;
  sent: number;
  opened: number;
  replied: number;
  openRate: number;
  replyRate: number;
}

// ---------------------------------------------------------------------------
// Positive reply filtering
// ---------------------------------------------------------------------------

/**
 * Minimum AI interest score to count a reply as "positive".
 * Scale: 1-10 where 1-2 = very negative, 3-4 = negative, 5-6 = neutral/lukewarm,
 * 7-8 = interested, 9-10 = very interested.
 * Replies with no classification (NULL) are counted as positive for backward compat.
 */
export const POSITIVE_REPLY_INTEREST_THRESHOLD = 5;

/**
 * Pure function: determines if a reply should be counted as positive.
 * - No reply (replyCount = 0) → false
 * - Reply with no AI classification (null) → true (backward compat)
 * - Reply with interest >= threshold → true
 * - Reply with interest < threshold → false (negative/"stop emailing me")
 */
export function isPositiveReply(
  replyCount: number,
  replyAiInterest: number | null,
): boolean {
  if (replyCount <= 0) return false;
  if (replyAiInterest === null || replyAiInterest === undefined) return true;
  return replyAiInterest >= POSITIVE_REPLY_INTEREST_THRESHOLD;
}

/**
 * SQL fragment for counting only positive (or unclassified) replies.
 * Replaces the old `ep."replyCount" > 0` condition.
 */
const POSITIVE_REPLY_SQL = Prisma.sql`
  ep."replyCount" > 0
  AND (ep."replyAiInterest" IS NULL OR ep."replyAiInterest" >= ${POSITIVE_REPLY_INTEREST_THRESHOLD})
`;

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

export interface RawRow {
  dimension: string;
  sent: bigint;
  opened: bigint;
  replied: bigint;
}

/** Convert raw DB rows (bigint counts) into CorrelationRow[] with rates. */
export function toCorrelationRows(rows: RawRow[]): CorrelationRow[] {
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END) AS replied
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)     AS replied
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
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
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
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

// ---------------------------------------------------------------------------
// Subject variant correlation (A/B testing)
// ---------------------------------------------------------------------------

export interface RawVariantRow {
  variantIndex: number;
  sent: bigint;
  opened: bigint;
  replied: bigint;
}

/**
 * Resolve the subject text for a given variant index.
 * 0 = primary subject, 1+ = subjectVariants[index-1].
 * Falls back to "Variant N" label if text unavailable.
 */
export function getSubjectForVariant(
  variantIndex: number,
  primarySubject: string | null,
  variants: string[] | null,
): string {
  if (variantIndex === 0) return primarySubject ?? "Primary";
  if (variants && typeof variants[variantIndex - 1] === "string") {
    return variants[variantIndex - 1];
  }
  return `Variant ${variantIndex + 1}`;
}

/**
 * Convert raw variant rows into VariantPerformanceRow[] with rates and subject text.
 * Filters out variants with < 5 sent (consistent with toCorrelationRows threshold).
 */
export function toVariantPerformanceRows(
  rows: RawVariantRow[],
  primarySubject: string | null,
  variants: string[] | null,
): VariantPerformanceRow[] {
  return rows
    .filter((r) => Number(r.sent) >= 5)
    .map((r) => {
      const sent = Number(r.sent);
      const opened = Number(r.opened);
      const replied = Number(r.replied);
      const vi = Number(r.variantIndex);
      return {
        variantIndex: vi,
        subject: getSubjectForVariant(vi, primarySubject, variants),
        sent,
        opened,
        replied,
        openRate: Math.round((opened / sent) * 10000) / 100,
        replyRate: Math.round((replied / sent) * 10000) / 100,
      };
    });
}

/**
 * Get reply rate breakdown by A/B subject variant for a campaign.
 * Requires variant attribution data (AB-ATTR-01) to be synced first.
 *
 * @param step - Step to get subject texts from (default 0, since attribution is step-0 based)
 */
export async function getReplyRateBySubjectVariant(
  workspaceId: string,
  campaignId: string,
  step: number = 0,
): Promise<VariantPerformanceRow[]> {
  // 1. Raw counts grouped by variantIndex
  const rows = await prisma.$queryRaw<RawVariantRow[]>`
    SELECT
      ep."variantIndex"                                       AS "variantIndex",
      COUNT(*)                                                AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN
        ep."replyCount" > 0
        AND (ep."replyAiInterest" IS NULL OR ep."replyAiInterest" >= ${POSITIVE_REPLY_INTEREST_THRESHOLD})
      THEN 1 ELSE 0 END)                                     AS replied
    FROM "email_performance" ep
    JOIN "lead" l ON ep."leadId" = l.id
    WHERE l."workspaceId" = ${workspaceId}
      AND ep."campaignId" = ${campaignId}
      AND ep."variantIndex" IS NOT NULL
    GROUP BY ep."variantIndex"
    ORDER BY ep."variantIndex"
  `;

  // 2. Get subject texts from a representative DraftedEmail for this step
  const drafted = await prisma.draftedEmail.findFirst({
    where: { campaignId, step },
    select: { subject: true, subjectVariants: true },
  });

  // 3. Map to enriched rows with subject text
  return toVariantPerformanceRows(
    rows,
    drafted?.subject ?? null,
    drafted?.subjectVariants as string[] | null,
  );
}
