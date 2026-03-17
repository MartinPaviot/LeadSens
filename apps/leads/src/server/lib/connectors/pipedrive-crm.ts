/**
 * Pipedrive CRM Provider — wraps the raw Pipedrive connector
 * to implement the CRMProvider interface.
 */

import * as pipedrive from "./pipedrive";
import type { CRMProvider, CRMContact } from "@/server/lib/providers/crm-provider";
import { logger } from "@/lib/logger";

// ─── Helpers ────────────────────────────────────────────

function personToContact(person: {
  id: number;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  org_name?: string | null;
  job_title?: string | null;
  phones?: Array<{ value?: string | null }> | null;
  emails?: Array<{ value?: string | null; primary?: boolean | null }> | null;
}): CRMContact {
  const primaryEmail = person.emails?.find((e) => e.primary)?.value
    ?? person.emails?.[0]?.value;
  const primaryPhone = person.phones?.[0]?.value;

  return {
    id: String(person.id),
    email: primaryEmail ?? undefined,
    firstName: person.first_name ?? undefined,
    lastName: person.last_name ?? undefined,
    company: person.org_name ?? undefined,
    jobTitle: person.job_title ?? undefined,
    phone: primaryPhone ?? undefined,
    raw: person as unknown as Record<string, unknown>,
  };
}

// ─── CRM Provider Factory ───────────────────────────────

export function createPipedriveCRM(apiKey: string): CRMProvider {
  return {
    name: "pipedrive",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      const results: CRMContact[] = [];

      for (const email of emails) {
        try {
          const person = await pipedrive.searchPersonByEmail(apiKey, email);
          if (person) {
            results.push(personToContact(person));
          }
        } catch (err) {
          logger.warn(`[pipedrive-crm] searchContacts failed for ${email}: ${err instanceof Error ? err.message : String(err)}`);
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
      const nameParts: string[] = [];
      if (data.firstName) nameParts.push(data.firstName);
      if (data.lastName) nameParts.push(data.lastName);
      const name = nameParts.length > 0 ? nameParts.join(" ") : data.email;

      const person = await pipedrive.createPerson(apiKey, {
        name,
        email: data.email,
        phone: data.phone,
        orgName: data.company,
        jobTitle: data.jobTitle,
      });

      if (!person) {
        throw new Error(`Pipedrive createContact failed for ${data.email}`);
      }

      return personToContact(person);
    },

    async updateContact(contactId: string, data: Record<string, string>): Promise<CRMContact> {
      const person = await pipedrive.updatePerson(apiKey, parseInt(contactId, 10), data);

      if (!person) {
        throw new Error(`Pipedrive updateContact failed for ${contactId}`);
      }

      return personToContact(person);
    },

    async checkDuplicates(emails: string[]): Promise<{ existing: string[]; new: string[] }> {
      const existingEmails = new Set<string>();

      for (const email of emails) {
        try {
          const person = await pipedrive.searchPersonByEmail(apiKey, email);
          if (person) {
            existingEmails.add(email.toLowerCase());
          }
        } catch (err) {
          logger.warn(`[pipedrive-crm] checkDuplicates failed for ${email}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      return {
        existing: emails.filter((e) => existingEmails.has(e.toLowerCase())),
        new: emails.filter((e) => !existingEmails.has(e.toLowerCase())),
      };
    },
  };
}
