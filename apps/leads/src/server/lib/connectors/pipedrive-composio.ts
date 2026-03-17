/**
 * Pipedrive CRM Provider (Composio-backed) — Replaces direct HTTP API calls
 * with Composio SDK action execution for Pipedrive CRM operations.
 *
 * Actions used:
 * - PIPEDRIVE_SEARCH_PERSONS — search by email (one at a time, term + fields: "email")
 * - PIPEDRIVE_ADD_A_PERSON — create person with name, email[], phone[], org_name, job_title
 * - PIPEDRIVE_UPDATE_A_PERSON — update person by ID
 *
 * Pipedrive quirks:
 * - Uses `name` (combined first+last) instead of separate first/last name
 * - Emails and phones are arrays of { value, primary, label } objects
 * - Search is per-email (no batch endpoint), so we loop
 * - Person IDs are numbers, but CRMProvider uses string IDs
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  CRMProvider,
  CRMContact,
} from "@/server/lib/providers/crm-provider";

// ─── Pipedrive Response Types ──────────────────────────

interface PipedriveEmail {
  value?: string | null;
  primary?: boolean | null;
  label?: string | null;
}

interface PipedrivePhone {
  value?: string | null;
  primary?: boolean | null;
  label?: string | null;
}

interface PipedrivePerson {
  id: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  org_name?: string | null;
  job_title?: string | null;
  emails?: PipedriveEmail[] | null;
  phones?: PipedrivePhone[] | null;
  [key: string]: unknown;
}

interface PipedriveSearchItem {
  item: PipedrivePerson;
}

interface PipedriveSearchResponse {
  data: {
    items: PipedriveSearchItem[];
  } | null;
}

interface PipedriveMutationResponse {
  success: boolean;
  data: PipedrivePerson | null;
}

// ─── Helpers ───────────────────────────────────────────

function toCRMContact(person: PipedrivePerson): CRMContact {
  const primaryEmail =
    person.emails?.find((e) => e.primary)?.value ??
    person.emails?.[0]?.value;

  const primaryPhone =
    person.phones?.find((p) => p.primary)?.value ??
    person.phones?.[0]?.value;

  return {
    id: String(person.id),
    email: primaryEmail ?? undefined,
    firstName: person.first_name ?? undefined,
    lastName: person.last_name ?? undefined,
    company: person.org_name ?? undefined,
    jobTitle: person.job_title ?? undefined,
    phone: primaryPhone ?? undefined,
    raw: person as Record<string, unknown>,
  };
}

/**
 * Build a display name from first/last name, falling back to email.
 */
function buildName(
  firstName?: string,
  lastName?: string,
  fallback?: string,
): string {
  const parts: string[] = [];
  if (firstName) parts.push(firstName);
  if (lastName) parts.push(lastName);
  if (parts.length > 0) return parts.join(" ");
  return fallback ?? "Unknown";
}

// ─── CRM Provider Factory ──────────────────────────────

export function createPipedriveComposioCRM(workspaceId: string): CRMProvider {
  return {
    name: "pipedrive",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      if (emails.length === 0) return [];

      const results: CRMContact[] = [];

      // Pipedrive search is per-term — no batch search endpoint
      for (const email of emails) {
        try {
          const response = await executeAction<PipedriveSearchResponse>(
            "PIPEDRIVE_SEARCH_PERSONS",
            workspaceId,
            {
              term: email,
              fields: "email",
            },
          );

          if (response.data?.items && Array.isArray(response.data.items)) {
            for (const searchItem of response.data.items) {
              const contact = toCRMContact(searchItem.item);
              // Verify the email actually matches (search can return partial matches)
              if (
                contact.email &&
                contact.email.toLowerCase() === email.toLowerCase()
              ) {
                results.push(contact);
              }
            }
          }
        } catch (err) {
          logger.warn("[pipedrive-composio] searchContacts failed for email", {
            workspaceId,
            email,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return results;
    },

    async createContact(data: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      jobTitle?: string;
      phone?: string;
    }): Promise<CRMContact> {
      const name = buildName(data.firstName, data.lastName, data.email);

      const args: Record<string, unknown> = {
        name,
        email: [{ value: data.email, primary: true, label: "work" }],
      };

      if (data.company) args.org_name = data.company;
      if (data.jobTitle) args.job_title = data.jobTitle;
      if (data.phone) {
        args.phone = [{ value: data.phone, primary: true, label: "work" }];
      }

      const response = await executeAction<PipedriveMutationResponse>(
        "PIPEDRIVE_ADD_A_PERSON",
        workspaceId,
        args,
      );

      if (!response.success || !response.data) {
        throw new Error(
          `Pipedrive createContact failed for ${data.email}`,
        );
      }

      logger.info("[pipedrive-composio] person created", {
        workspaceId,
        personId: response.data.id,
        email: data.email,
      });

      return toCRMContact(response.data);
    },

    async updateContact(
      contactId: string,
      data: Record<string, string>,
    ): Promise<CRMContact> {
      const personId = parseInt(contactId, 10);
      if (Number.isNaN(personId)) {
        throw new Error(
          `Invalid Pipedrive person ID: ${contactId} (expected numeric)`,
        );
      }

      const response = await executeAction<PipedriveMutationResponse>(
        "PIPEDRIVE_UPDATE_A_PERSON",
        workspaceId,
        {
          id: personId,
          ...data,
        },
      );

      if (!response.success || !response.data) {
        throw new Error(
          `Pipedrive updateContact failed for person ${contactId}`,
        );
      }

      logger.info("[pipedrive-composio] person updated", {
        workspaceId,
        personId,
      });

      return toCRMContact(response.data);
    },

    async checkDuplicates(
      emails: string[],
    ): Promise<{ existing: string[]; new: string[] }> {
      if (emails.length === 0) return { existing: [], new: [] };

      const existingEmails = new Set<string>();

      // Search each email individually (Pipedrive has no batch search)
      for (const email of emails) {
        try {
          const response = await executeAction<PipedriveSearchResponse>(
            "PIPEDRIVE_SEARCH_PERSONS",
            workspaceId,
            {
              term: email,
              fields: "email",
            },
          );

          if (response.data?.items && Array.isArray(response.data.items)) {
            // Verify exact email match in results
            for (const searchItem of response.data.items) {
              const personEmails = searchItem.item.emails ?? [];
              const hasExactMatch = personEmails.some(
                (e) =>
                  e.value &&
                  e.value.toLowerCase() === email.toLowerCase(),
              );
              if (hasExactMatch) {
                existingEmails.add(email.toLowerCase());
                break; // Found a match, no need to check more items
              }
            }
          }
        } catch (err) {
          logger.warn(
            "[pipedrive-composio] checkDuplicates failed for email",
            {
              workspaceId,
              email,
              error: err instanceof Error ? err.message : String(err),
            },
          );
        }
      }

      return {
        existing: emails.filter((e) => existingEmails.has(e.toLowerCase())),
        new: emails.filter((e) => !existingEmails.has(e.toLowerCase())),
      };
    },
  };
}
