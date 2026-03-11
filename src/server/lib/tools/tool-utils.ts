/**
 * Shared utilities for tools — extracted from instantly-tools.ts.
 *
 * Used by sourcing-tools.ts and esp-tools.ts.
 */

// ─── Build Custom Variables ─────────────────────────────

/**
 * Build custom variables for a lead's emails to push to an ESP campaign.
 * Always sets v2/v3 subject vars to prevent raw {{placeholder}} text
 * from being sent to prospects.
 */
export function buildLeadCustomVars(
  emails: { step: number; subject: string; body: string; userEdit?: string | null; subjectVariants?: string[] | null }[],
): Record<string, string> {
  const customVars: Record<string, string> = {};
  for (const email of emails) {
    const rawBody = email.userEdit ?? email.body;
    const htmlBody = rawBody.replace(/\n/g, "<br>");
    customVars[`email_step_${email.step}_subject`] = email.subject;
    customVars[`email_step_${email.step}_body`] = htmlBody;

    // Always set v2/v3 custom vars — if no variants exist, fall back to primary subject
    // to prevent ESP rendering raw {{email_step_N_subject_v2}} placeholder text
    const primarySubject = email.subject;
    customVars[`email_step_${email.step}_subject_v2`] = email.subjectVariants?.[0] ?? primarySubject;
    customVars[`email_step_${email.step}_subject_v3`] = email.subjectVariants?.[1] ?? primarySubject;
  }
  return customVars;
}

// ─── Verification Gate ──────────────────────────────────

const INVALID_STATUSES = new Set(["invalid", "spamtrap", "abuse", "disposable"]);

/**
 * Pre-push verification gate — checks if leads have been email-verified.
 *
 * Rules:
 * - No verifier connected → pass through (graceful degradation)
 * - Verifier connected + unverified leads → warning
 * - >5% of pushable leads are invalid → block
 */
export function checkVerificationGate(
  leads: { verificationStatus: string | null }[],
  hasVerifier: boolean,
): { canPush: boolean; warning?: string; unverifiedCount: number; invalidCount: number } {
  if (!hasVerifier || leads.length === 0) {
    return { canPush: true, unverifiedCount: 0, invalidCount: 0 };
  }

  const unverifiedCount = leads.filter((l) => l.verificationStatus === null).length;
  const invalidCount = leads.filter((l) => l.verificationStatus !== null && INVALID_STATUSES.has(l.verificationStatus)).length;
  const invalidRate = leads.length > 0 ? invalidCount / leads.length : 0;

  // Block if >5% invalid
  if (invalidRate > 0.05) {
    return {
      canPush: false,
      warning: `🚫 ${invalidCount}/${leads.length} leads (${Math.round(invalidRate * 100)}%) have invalid emails. Run verify_emails first and remove invalid leads to prevent bounces and protect your domain reputation.`,
      unverifiedCount,
      invalidCount,
    };
  }

  // Warn if unverified
  if (unverifiedCount > 0) {
    return {
      canPush: true,
      warning: `⚠️ ${unverifiedCount}/${leads.length} leads not verified. Run verify_emails first to prevent bounces. Unverified lists average 7.8% bounce rate vs 1.2% for verified lists.`,
      unverifiedCount,
      invalidCount,
    };
  }

  return { canPush: true, unverifiedCount: 0, invalidCount };
}

// ─── Cross-Campaign Dedup ───────────────────────────────

/** Lead statuses indicating the lead was already pushed to an ESP and is actively being contacted. */
export const ALREADY_CONTACTED_STATUSES = new Set([
  "PUSHED", "SENT", "REPLIED", "INTERESTED", "NOT_INTERESTED",
  "MEETING_BOOKED", "BOUNCED", "UNSUBSCRIBED",
]);

export interface CrossCampaignDuplicate {
  email: string;
  campaignId: string;
  campaignName: string;
}

export interface CrossCampaignDedupResult {
  duplicates: CrossCampaignDuplicate[];
  campaignNames: string[];
  safeEmails: string[];
  duplicateCount: number;
}

/**
 * Analyze cross-campaign dedup results from EmailPerformance records.
 *
 * Takes leads about to be pushed and performance records found in OTHER active
 * campaigns for those same emails. Returns which leads are safe vs duplicates.
 *
 * Pure function — DB query is done by the caller.
 */
export function analyzeCrossCampaignDedup(
  leadEmails: string[],
  performanceInOtherCampaigns: { email: string; campaignId: string; campaignName: string }[],
): CrossCampaignDedupResult {
  // Deduplicate: one entry per email (pick first campaign found)
  const seenEmails = new Set<string>();
  const duplicates: CrossCampaignDuplicate[] = [];

  for (const p of performanceInOtherCampaigns) {
    const emailLower = p.email.toLowerCase();
    if (seenEmails.has(emailLower)) continue;
    seenEmails.add(emailLower);
    duplicates.push({
      email: p.email,
      campaignId: p.campaignId,
      campaignName: p.campaignName,
    });
  }

  const campaignNames = [...new Set(performanceInOtherCampaigns.map((p) => p.campaignName))];
  const duplicateEmailSet = new Set(duplicates.map((d) => d.email.toLowerCase()));

  return {
    duplicates,
    campaignNames,
    safeEmails: leadEmails.filter((e) => !duplicateEmailSet.has(e.toLowerCase())),
    duplicateCount: duplicates.length,
  };
}
