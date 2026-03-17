/**
 * Salesforce CRM Provider (Composio-backed) — Replaces direct HTTP API calls
 * with Composio SDK action execution for Salesforce CRM operations.
 *
 * Actions used:
 * - SALESFORCE_RUN_SOQL_QUERY — search contacts via SOQL (reliable batch lookup)
 * - SALESFORCE_CREATE_CONTACT — create Contact sObject
 * - SALESFORCE_UPDATE_CONTACT — update Contact by contactId
 *
 * Salesforce field mapping:
 *   email → Email, firstName → FirstName, lastName → LastName,
 *   company → Description (Contact has no direct Company field; linked via Account),
 *   jobTitle → Title, phone → Phone
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  CRMProvider,
  CRMContact,
} from "@/server/lib/providers/crm-provider";

// ─── Salesforce Response Types ─────────────────────────

interface SalesforceRecord {
  Id: string;
  Email?: string | null;
  FirstName?: string | null;
  LastName?: string | null;
  Title?: string | null;
  Phone?: string | null;
  Account?: { Name?: string | null } | null;
  [key: string]: unknown;
}

interface SalesforceQueryResponse {
  totalSize: number;
  done: boolean;
  records: SalesforceRecord[];
}

interface SalesforceCreateResponse {
  id: string;
  success: boolean;
  errors: unknown[];
}

// ─── Constants ─────────────────────────────────────────

/**
 * SOQL IN clause limit is 100,000 characters total for the query.
 * We batch at 100 emails to stay well within limits.
 */
const SOQL_BATCH_SIZE = 100;

// ─── Helpers ───────────────────────────────────────────

function toCRMContact(record: SalesforceRecord): CRMContact {
  return {
    id: record.Id,
    email: record.Email ?? undefined,
    firstName: record.FirstName ?? undefined,
    lastName: record.LastName ?? undefined,
    company: record.Account?.Name ?? undefined,
    jobTitle: record.Title ?? undefined,
    phone: record.Phone ?? undefined,
    raw: record as Record<string, unknown>,
  };
}

/**
 * Escape a string for use in SOQL single-quoted literals.
 * Prevents SOQL injection by escaping single quotes and backslashes.
 */
function escapeSOQL(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Build a SOQL query to search contacts by email addresses.
 */
function buildSearchQuery(emails: string[]): string {
  const escaped = emails.map((e) => `'${escapeSOQL(e)}'`);
  return [
    "SELECT Id, Email, FirstName, LastName, Title, Phone, Account.Name",
    "FROM Contact",
    `WHERE Email IN (${escaped.join(",")})`,
  ].join(" ");
}

/**
 * Chunk an array into groups of a specified size.
 */
function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── CRM Provider Factory ──────────────────────────────

export function createSalesforceComposioCRM(workspaceId: string): CRMProvider {
  return {
    name: "salesforce",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      if (emails.length === 0) return [];

      const allContacts: CRMContact[] = [];
      const batches = chunk(emails, SOQL_BATCH_SIZE);

      for (const batch of batches) {
        try {
          const query = buildSearchQuery(batch);
          const response = await executeAction<SalesforceQueryResponse>(
            "SALESFORCE_RUN_SOQL_QUERY",
            workspaceId,
            { query },
          );

          if (response.records && Array.isArray(response.records)) {
            allContacts.push(...response.records.map(toCRMContact));
          }
        } catch (err) {
          logger.warn("[salesforce-composio] searchContacts batch failed", {
            workspaceId,
            batchSize: batch.length,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      return allContacts;
    },

    async createContact(data: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      jobTitle?: string;
      phone?: string;
    }): Promise<CRMContact> {
      const fields: Record<string, string> = { Email: data.email };
      if (data.firstName) fields.FirstName = data.firstName;
      if (data.lastName) fields.LastName = data.lastName;
      if (data.jobTitle) fields.Title = data.jobTitle;
      if (data.phone) fields.Phone = data.phone;
      // Salesforce Contact doesn't have a direct Company field —
      // company is linked via AccountId. Set it as Description fallback.
      if (data.company) fields.Description = `Company: ${data.company}`;

      // LastName is required for Salesforce Contacts
      if (!fields.LastName) {
        fields.LastName = data.email.split("@")[0] ?? "Unknown";
      }

      const result = await executeAction<SalesforceCreateResponse>(
        "SALESFORCE_CREATE_CONTACT",
        workspaceId,
        fields,
      );

      if (!result.success) {
        throw new Error(
          `Salesforce createContact failed: ${JSON.stringify(result.errors)}`,
        );
      }

      logger.info("[salesforce-composio] contact created", {
        workspaceId,
        contactId: result.id,
        email: data.email,
      });

      // Salesforce create returns only the ID — build response from input data
      return {
        id: result.id,
        email: data.email,
        firstName: data.firstName,
        lastName: fields.LastName,
        company: data.company,
        jobTitle: data.jobTitle,
        phone: data.phone,
      };
    },

    async updateContact(
      contactId: string,
      data: Record<string, string>,
    ): Promise<CRMContact> {
      await executeAction<void>(
        "SALESFORCE_UPDATE_CONTACT",
        workspaceId,
        {
          contact_id: contactId,
          ...data,
        },
      );

      logger.info("[salesforce-composio] contact updated", {
        workspaceId,
        contactId,
      });

      // Salesforce PATCH returns 204 — fetch the updated contact
      // If Email is in the update data, search by it; otherwise return minimal
      const emailToSearch = data.Email;
      if (emailToSearch) {
        try {
          const results = await this.searchContacts([emailToSearch]);
          const found = results.find((c) => c.id === contactId);
          if (found) return found;
        } catch {
          // Fall through to minimal response
        }
      }

      return {
        id: contactId,
        email: data.Email ?? undefined,
        firstName: data.FirstName ?? undefined,
        lastName: data.LastName ?? undefined,
        company: undefined,
        jobTitle: data.Title ?? undefined,
        phone: data.Phone ?? undefined,
      };
    },

    async checkDuplicates(
      emails: string[],
    ): Promise<{ existing: string[]; new: string[] }> {
      if (emails.length === 0) return { existing: [], new: [] };

      const contacts = await this.searchContacts(emails);
      const existingEmails = new Set(
        contacts
          .map((c) => c.email?.toLowerCase())
          .filter((e): e is string => !!e),
      );

      return {
        existing: emails.filter((e) => existingEmails.has(e.toLowerCase())),
        new: emails.filter((e) => !existingEmails.has(e.toLowerCase())),
      };
    },
  };
}
