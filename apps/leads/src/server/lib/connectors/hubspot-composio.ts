/**
 * HubSpot CRM Provider (Composio-backed) — Replaces direct HTTP API calls
 * with Composio SDK action execution for HubSpot CRM operations.
 *
 * Actions used:
 * - HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA — batch search by email (groups of 50)
 * - HUBSPOT_CREATE_CONTACT — create contact with properties
 * - HUBSPOT_UPDATE_CONTACT — update contact by contactId
 *
 * HubSpot property mapping:
 *   email → email, firstName → firstname, lastName → lastname,
 *   company → company, jobTitle → jobtitle, phone → phone
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  CRMProvider,
  CRMContact,
} from "@/server/lib/providers/crm-provider";

// ─── HubSpot Response Types ────────────────────────────

interface HubSpotContactProperties {
  email?: string | null;
  firstname?: string | null;
  lastname?: string | null;
  company?: string | null;
  jobtitle?: string | null;
  phone?: string | null;
  [key: string]: string | null | undefined;
}

interface HubSpotContactResult {
  id: string;
  properties: HubSpotContactProperties;
}

interface HubSpotSearchResponse {
  total: number;
  results: HubSpotContactResult[];
}

// ─── Constants ─────────────────────────────────────────

/** HubSpot limits IN filters to 50 values per group */
const HUBSPOT_BATCH_SIZE = 50;

// ─── Helpers ───────────────────────────────────────────

function toPropertyMap(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
}): Record<string, string> {
  const props: Record<string, string> = { email: data.email };
  if (data.firstName) props.firstname = data.firstName;
  if (data.lastName) props.lastname = data.lastName;
  if (data.company) props.company = data.company;
  if (data.jobTitle) props.jobtitle = data.jobTitle;
  if (data.phone) props.phone = data.phone;
  return props;
}

function toCRMContact(result: HubSpotContactResult): CRMContact {
  return {
    id: result.id,
    email: result.properties.email ?? undefined,
    firstName: result.properties.firstname ?? undefined,
    lastName: result.properties.lastname ?? undefined,
    company: result.properties.company ?? undefined,
    jobTitle: result.properties.jobtitle ?? undefined,
    phone: result.properties.phone ?? undefined,
    raw: result.properties as Record<string, unknown>,
  };
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

export function createHubSpotComposioCRM(workspaceId: string): CRMProvider {
  return {
    name: "hubspot",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      if (emails.length === 0) return [];

      const allContacts: CRMContact[] = [];
      const batches = chunk(emails, HUBSPOT_BATCH_SIZE);

      for (const batch of batches) {
        try {
          const response = await executeAction<HubSpotSearchResponse>(
            "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA",
            workspaceId,
            {
              filterGroups: [
                {
                  filters: [
                    {
                      propertyName: "email",
                      operator: "IN",
                      values: batch,
                    },
                  ],
                },
              ],
              properties: [
                "email",
                "firstname",
                "lastname",
                "company",
                "jobtitle",
                "phone",
              ],
              limit: HUBSPOT_BATCH_SIZE,
            },
          );

          if (response.results && Array.isArray(response.results)) {
            allContacts.push(...response.results.map(toCRMContact));
          }
        } catch (err) {
          logger.warn("[hubspot-composio] searchContacts batch failed", {
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
      const properties = toPropertyMap(data);

      const result = await executeAction<HubSpotContactResult>(
        "HUBSPOT_CREATE_CONTACT",
        workspaceId,
        { properties },
      );

      logger.info("[hubspot-composio] contact created", {
        workspaceId,
        contactId: result.id,
        email: data.email,
      });

      return toCRMContact(result);
    },

    async updateContact(
      contactId: string,
      data: Record<string, string>,
    ): Promise<CRMContact> {
      const result = await executeAction<HubSpotContactResult>(
        "HUBSPOT_UPDATE_CONTACT",
        workspaceId,
        {
          contactId,
          properties: data,
        },
      );

      logger.info("[hubspot-composio] contact updated", {
        workspaceId,
        contactId,
      });

      return toCRMContact(result);
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
