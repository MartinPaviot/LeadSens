/**
 * A/B Variant Attribution — AB-ATTR-01
 *
 * Fetches sent emails from Instantly and matches each email's subject
 * to stored DraftedEmail variants to determine which variant each lead received.
 * Stores variantIndex (0=primary, 1=v2, 2=v3) on EmailPerformance.
 */

import { prisma } from "@/lib/prisma";
import { getEmails, type InstantlyEmail } from "@/server/lib/connectors/instantly";

// ─── Pure Functions ─────────────────────────────────────────

/**
 * Normalize a subject line for comparison.
 * Strips "Re: ", "Fwd: " prefixes, trims whitespace, lowercases.
 */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(?:re|fwd|fw):\s*/i, "")
    .trim()
    .toLowerCase();
}

/**
 * Match a sent email's subject against stored primary + variant subjects.
 * Returns 0 for primary, 1+ for variant index, null for no match.
 *
 * Uses normalized comparison (case-insensitive, stripped prefixes).
 */
export function matchVariantIndex(
  sentSubject: string,
  primarySubject: string,
  variants: string[] | null | undefined,
): number | null {
  const normalized = normalizeSubject(sentSubject);

  // Check primary (index 0)
  if (normalized === normalizeSubject(primarySubject)) {
    return 0;
  }

  // Check variants (index 1, 2, ...)
  if (variants && Array.isArray(variants)) {
    for (let i = 0; i < variants.length; i++) {
      if (typeof variants[i] === "string" && normalized === normalizeSubject(variants[i])) {
        return i + 1;
      }
    }
  }

  return null;
}

// ─── Sync Logic ─────────────────────────────────────────────

/**
 * Fetch all sent emails (ue_type=1) for a campaign from Instantly.
 * Paginates automatically, rate-limited at 500ms between pages.
 */
export async function fetchSentEmails(
  apiKey: string,
  instantlyCampaignId: string,
): Promise<InstantlyEmail[]> {
  const allEmails: InstantlyEmail[] = [];
  let startingAfter: string | undefined;

  do {
    const page = await getEmails(apiKey, {
      campaign_id: instantlyCampaignId,
      email_type: "1", // sent_campaign
      limit: 100,
      starting_after: startingAfter,
    });

    allEmails.push(...(page.items ?? []));
    startingAfter = page.next_starting_after;

    // Rate limit: 500ms between pages
    if (startingAfter) {
      await new Promise((r) => setTimeout(r, 500));
    }
  } while (startingAfter);

  return allEmails;
}

/**
 * Get the lead email from an Instantly email object.
 * Handles both `lead` and `lead_email` field names.
 */
function getLeadEmail(email: InstantlyEmail): string | undefined {
  return email.lead ?? email.lead_email ?? undefined;
}

/**
 * Sync variant attribution for a campaign.
 *
 * 1. Fetches all sent emails from Instantly
 * 2. Groups by lead email, picks the first sent email (step 0)
 * 3. Matches subject against DraftedEmail variants
 * 4. Updates EmailPerformance.variantIndex
 *
 * Returns count of leads attributed.
 */
export async function syncVariantAttribution(
  apiKey: string,
  campaignId: string,
  instantlyCampaignId: string,
): Promise<{ attributed: number; total: number }> {
  // 1. Fetch all sent emails for this campaign
  const sentEmails = await fetchSentEmails(apiKey, instantlyCampaignId);
  if (sentEmails.length === 0) {
    return { attributed: 0, total: 0 };
  }

  // 2. Group by lead email — keep earliest (step 0) per lead
  const firstEmailByLead = new Map<string, InstantlyEmail>();
  // Sort by timestamp to ensure we get the earliest (step 0) first
  const sorted = [...sentEmails].sort(
    (a, b) => a.timestamp_created.localeCompare(b.timestamp_created),
  );
  for (const email of sorted) {
    const leadEmail = getLeadEmail(email);
    if (leadEmail && !firstEmailByLead.has(leadEmail)) {
      firstEmailByLead.set(leadEmail, email);
    }
  }

  // 3. For each lead, match subject to variants and update EmailPerformance
  let attributed = 0;
  const total = firstEmailByLead.size;

  for (const [leadEmail, sentEmail] of firstEmailByLead) {
    // Find DraftedEmail for step 0 of this lead
    const drafted = await prisma.draftedEmail.findFirst({
      where: {
        campaignId,
        step: 0,
        lead: { email: leadEmail },
      },
      select: {
        subject: true,
        subjectVariants: true,
      },
    });

    if (!drafted) continue;

    const variantIndex = matchVariantIndex(
      sentEmail.subject,
      drafted.subject,
      drafted.subjectVariants as string[] | null,
    );

    if (variantIndex === null) continue;

    // Update EmailPerformance — only if variantIndex is currently null (don't overwrite)
    const updated = await prisma.emailPerformance.updateMany({
      where: {
        campaignId,
        email: leadEmail,
        variantIndex: null,
      },
      data: { variantIndex },
    });

    if (updated.count > 0) {
      attributed++;
    }
  }

  return { attributed, total };
}
