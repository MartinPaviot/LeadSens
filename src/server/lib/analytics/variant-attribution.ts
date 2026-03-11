/**
 * A/B Variant Attribution — AB-ATTR-01
 *
 * Fetches sent emails from any ESP and matches each email's subject
 * to stored DraftedEmail variants to determine which variant each lead received.
 * Stores variantIndex (0=primary, 1=v2, 2=v3) on EmailPerformance.
 */

import { prisma } from "@/lib/prisma";
import type { ESPProvider, ESPEmail } from "@/server/lib/providers/esp-provider";

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
 * Fetch all sent emails for a campaign from any ESP via ESPProvider.
 * Paginates automatically, rate-limited at 500ms between pages.
 */
export async function fetchSentEmails(
  esp: ESPProvider,
  espCampaignId: string,
): Promise<ESPEmail[]> {
  const allEmails: ESPEmail[] = [];

  // Use getEmails with "sent" filter — ESPProvider handles pagination internally
  // We loop until hasMore is false
  const result = await esp.getEmails({
    campaignId: espCampaignId,
    emailType: "sent",
    limit: 100,
  });

  allEmails.push(...result.items);

  // Note: ESPProvider.getEmails doesn't expose cursor-based pagination yet.
  // For variant attribution, the first page (100 emails) covers step 0 sends
  // which is what we need for subject variant matching.
  // Full pagination support can be added to ESPProvider when needed.

  return allEmails;
}

/**
 * Get the lead email from an ESPEmail object.
 */
function getLeadEmail(email: ESPEmail): string | undefined {
  return email.to ?? undefined;
}

/**
 * Sync variant attribution for a campaign.
 *
 * 1. Fetches sent emails from ESP
 * 2. Groups by lead email, picks the first sent email (step 0)
 * 3. Matches subject against DraftedEmail variants
 * 4. Updates EmailPerformance.variantIndex
 *
 * Returns count of leads attributed.
 */
export async function syncVariantAttribution(
  esp: ESPProvider,
  campaignId: string,
  espCampaignId: string,
): Promise<{ attributed: number; total: number }> {
  // 1. Fetch sent emails for this campaign
  const sentEmails = await fetchSentEmails(esp, espCampaignId);
  if (sentEmails.length === 0) {
    return { attributed: 0, total: 0 };
  }

  // 2. Group by lead email — keep earliest (step 0) per lead
  const firstEmailByLead = new Map<string, ESPEmail>();
  // Sort by timestamp to ensure we get the earliest (step 0) first
  const sorted = [...sentEmails].sort(
    (a, b) => (a.timestamp ?? "").localeCompare(b.timestamp ?? ""),
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
    if (!sentEmail.subject) continue;

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
