import { prisma } from "@/lib/prisma";
import type { LeadStatus } from "@prisma/client";

/**
 * Valid lead status transitions.
 * Pre-launch: SOURCED → SCORED → ENRICHED → DRAFTED → PUSHED
 * Post-launch: PUSHED → SENT → REPLIED → INTERESTED/NOT_INTERESTED → MEETING_BOOKED
 *              PUSHED/SENT → BOUNCED/UNSUBSCRIBED
 */
export const VALID_TRANSITIONS: Record<string, LeadStatus[]> = {
  // Pre-launch pipeline
  SOURCED: ["SCORED", "SKIPPED"],
  SCORED: ["ENRICHED", "SKIPPED"],
  ENRICHED: ["DRAFTED"],
  DRAFTED: ["PUSHED"],
  // Post-launch lifecycle
  PUSHED: ["SENT", "BOUNCED", "UNSUBSCRIBED"],
  SENT: ["REPLIED", "BOUNCED", "UNSUBSCRIBED"],
  REPLIED: ["INTERESTED", "NOT_INTERESTED", "MEETING_BOOKED"],
  INTERESTED: ["MEETING_BOOKED"],
};

/**
 * Transition a lead to a new status, validating the transition is allowed.
 * Throws if the transition is invalid (e.g., SOURCED → DRAFTED).
 */
export async function transitionLeadStatus(
  leadId: string,
  to: LeadStatus,
): Promise<void> {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    select: { status: true },
  });

  const allowed = VALID_TRANSITIONS[lead.status];
  if (!allowed?.includes(to)) {
    throw new Error(
      `Invalid lead status transition: ${lead.status} → ${to}. ` +
      `Allowed transitions from ${lead.status}: ${allowed?.join(", ") ?? "none"}.`,
    );
  }

  await prisma.lead.update({
    where: { id: leadId },
    data: { status: to },
  });
}

/**
 * Transition multiple leads to a new status in a single transaction.
 * Validates each lead's current status allows the transition.
 */
export async function transitionLeadsStatus(
  leadIds: string[],
  to: LeadStatus,
): Promise<{ transitioned: number; skipped: number }> {
  const leads = await prisma.lead.findMany({
    where: { id: { in: leadIds } },
    select: { id: true, status: true },
  });

  const validIds: string[] = [];
  let skipped = 0;

  for (const lead of leads) {
    const allowed = VALID_TRANSITIONS[lead.status];
    if (allowed?.includes(to)) {
      validIds.push(lead.id);
    } else {
      skipped++;
    }
  }

  if (validIds.length > 0) {
    await prisma.lead.updateMany({
      where: { id: { in: validIds } },
      data: { status: to },
    });
  }

  return { transitioned: validIds.length, skipped };
}
