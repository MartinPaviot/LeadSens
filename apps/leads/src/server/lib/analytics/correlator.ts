import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { cacheGet, cacheSet } from "@/lib/cache";

/** Cache TTL for correlator queries — matches analytics sync cron interval (30 min) */
const CORRELATOR_CACHE_TTL = 1800;

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
    JOIN "email_performance" ep
      ON ep."leadId" = de."leadId"
     AND ep."campaignId" = de."campaignId"
    WHERE de."workspaceId" = ${workspaceId}
      ${campaignFilter(campaignId)}
  `;
}

/** baseFrom + lead JOIN — only for queries that read lead columns (icpScore, jobTitle, companySize). */
function baseFromWithLead(workspaceId: string, campaignId?: string): Prisma.Sql {
  return Prisma.sql`
    FROM "drafted_email" de
    JOIN "lead" l ON de."leadId" = l.id
    JOIN "email_performance" ep
      ON ep."leadId" = de."leadId"
     AND ep."campaignId" = de."campaignId"
    WHERE de."workspaceId" = ${workspaceId}
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
  const cacheKey = `corr:signal:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

export async function getReplyRateByStep(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:step:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

export async function getReplyRateByQualityScore(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:quality:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

export async function getReplyRateByEnrichmentDepth(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:enrichdepth:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

export async function getReplyRateByIndustry(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:industry:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

export async function getReplyRateByWordCount(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:wordcount:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

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
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

/**
 * Reply rate by stored subject pattern (Question/Observation/Curiosity/Direct/Personalized).
 * Uses the subjectPattern field populated at draft time. Only includes records
 * where subjectPattern is stored (new drafts); old records without the field are excluded.
 */
export async function getReplyRateBySubjectPatternSQL(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:subjectpattern:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      de."subjectPattern"                                     AS dimension,
      COUNT(*)                                                AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END) AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."subjectPattern" IS NOT NULL
    GROUP BY de."subjectPattern"
    ORDER BY replied DESC
  `;
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

// ---------------------------------------------------------------------------
// CTA correlation (for Thompson Sampling)
// ---------------------------------------------------------------------------

/**
 * Reply rate by CTA used, prefixed with step number for per-step ranking.
 * Dimension format: "s{step}:{ctaUsed}" — e.g. "s0:Worth a quick look?"
 */
export async function getReplyRateByCta(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:cta:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      CONCAT('s', de.step, ':', de."ctaUsed")                  AS dimension,
      COUNT(*)                                                  AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)      AS opened,
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
    ${baseFrom(workspaceId, campaignId)}
      AND de."ctaUsed" IS NOT NULL
    GROUP BY de.step, de."ctaUsed"
    ORDER BY de.step, replied DESC
  `;
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

// ---------------------------------------------------------------------------
// ICP Backtesting queries
// ---------------------------------------------------------------------------

/**
 * Reply rate by ICP score bucket.
 * Validates which ICP score ranges perform best — useful for tuning the scoring threshold.
 */
export async function getReplyRateByIcpScore(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:icpscore:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      CASE
        WHEN l."icpScore" BETWEEN 5 AND 6 THEN '5-6'
        WHEN l."icpScore" BETWEEN 7 AND 8 THEN '7-8'
        WHEN l."icpScore" >= 9           THEN '9-10'
        ELSE 'below-5'
      END                                                   AS dimension,
      COUNT(*)                                              AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)    AS opened,
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)   AS replied
    ${baseFromWithLead(workspaceId, campaignId)}
      AND l."icpScore" IS NOT NULL
    GROUP BY
      CASE
        WHEN l."icpScore" BETWEEN 5 AND 6 THEN '5-6'
        WHEN l."icpScore" BETWEEN 7 AND 8 THEN '7-8'
        WHEN l."icpScore" >= 9           THEN '9-10'
        ELSE 'below-5'
      END
    ORDER BY dimension
  `;
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

/**
 * Reply rate by job title — identifies which roles respond best.
 * Returns top 10 by volume (filtered to minimum 5 sent).
 */
export async function getReplyRateByJobTitle(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:jobtitle:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      COALESCE(l."jobTitle", 'Unknown')                       AS dimension,
      COUNT(*)                                                AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)      AS opened,
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)     AS replied
    ${baseFromWithLead(workspaceId, campaignId)}
    GROUP BY l."jobTitle"
    ORDER BY sent DESC
    LIMIT 10
  `;
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

/**
 * Reply rate by company size bucket.
 * Useful for identifying which company sizes convert best.
 */
export async function getReplyRateByCompanySize(
  workspaceId: string,
  campaignId?: string,
): Promise<CorrelationRow[]> {
  const cacheKey = `corr:companysize:${workspaceId}:${campaignId ?? "all"}`;
  const cached = await cacheGet<CorrelationRow[]>(cacheKey);
  if (cached) return cached;

  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT
      COALESCE(l."companySize", 'Unknown')                    AS dimension,
      COUNT(*)                                                AS sent,
      SUM(CASE WHEN ep."openCount" > 0 THEN 1 ELSE 0 END)      AS opened,
      SUM(CASE WHEN ${POSITIVE_REPLY_SQL} THEN 1 ELSE 0 END)     AS replied
    ${baseFromWithLead(workspaceId, campaignId)}
    GROUP BY l."companySize"
    ORDER BY sent DESC
    LIMIT 10
  `;
  const result = toCorrelationRows(rows);
  await cacheSet(cacheKey, result, CORRELATOR_CACHE_TTL);
  return result;
}

// ---------------------------------------------------------------------------
// Subject pattern correlation (for Thompson Sampling)
// ---------------------------------------------------------------------------

/**
 * Detect which subject line pattern a subject uses.
 * Heuristic-based classification matching the 5 documented patterns.
 */
export function detectSubjectPattern(subject: string): string {
  const lower = subject.toLowerCase().trim();

  // Question — ends with ? or starts with question words
  if (lower.endsWith("?") || /^(how|what|why|when|where|who|is|are|do|does|can|could|would|should|quick question)\b/.test(lower)) {
    return "Question";
  }

  // Personalized — starts with re:, congrats, following, saw your
  if (/^re:\s/.test(lower) || /^(congrats|following|saw your|noticed your|about your)\b/.test(lower)) {
    return "Personalized";
  }

  // Observation — contains noticed, saw, spotted + company/signal reference
  if (/\b(noticed|saw|spotted|observed)\b/.test(lower)) {
    return "Observation";
  }

  // Curiosity gap — contains idea, number+%, what X changed
  if (/\b(idea|what .* changed|shift|secret|surprising)\b/.test(lower) || /\d+%/.test(lower)) {
    return "Curiosity";
  }

  // Direct — short and to the point (everything else)
  return "Direct";
}

/**
 * Get reply rate by detected subject pattern.
 * Used for Thompson Sampling to rank patterns for new emails.
 *
 * When `campaignId` is provided, only emails from that campaign are counted.
 * Performance data is always matched to the same campaign as the DraftedEmail
 * to prevent cross-campaign contamination.
 */
export async function getReplyRateBySubjectPattern(
  workspaceId: string,
  campaignId?: string,
): Promise<Array<{ name: string; sent: number; replied: number }>> {
  // Get all drafted emails with performance data
  const emails = await prisma.draftedEmail.findMany({
    where: {
      lead: { workspaceId },
      step: 0, // Only step 0 subjects (primary emails)
      ...(campaignId ? { campaignId } : {}),
    },
    select: {
      subject: true,
      subjectPattern: true,
      campaignId: true,
      lead: {
        select: {
          performance: {
            select: {
              campaignId: true,
              replyCount: true,
              replyAiInterest: true,
            },
          },
        },
      },
    },
  });

  // Group by pattern — prefer stored subjectPattern, fall back to heuristic for old records
  const patternStats = new Map<string, { sent: number; replied: number }>();
  for (const email of emails) {
    const pattern = email.subjectPattern ?? detectSubjectPattern(email.subject);
    const stats = patternStats.get(pattern) ?? { sent: 0, replied: 0 };
    stats.sent++;
    // Match performance to SAME campaign as the drafted email (prevents cross-campaign noise)
    const perf = email.lead.performance.find(
      (p) => p.campaignId === email.campaignId,
    );
    if (perf && isPositiveReply(perf.replyCount, perf.replyAiInterest)) {
      stats.replied++;
    }
    patternStats.set(pattern, stats);
  }

  return [...patternStats.entries()].map(([name, stats]) => ({
    name,
    sent: stats.sent,
    replied: stats.replied,
  }));
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
    WHERE ep."campaignId" = ${campaignId}
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
