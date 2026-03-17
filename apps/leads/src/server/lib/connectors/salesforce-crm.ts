/**
 * Salesforce CRM Provider — wraps the raw Salesforce connector
 * to implement the CRMProvider interface.
 *
 * Pattern: mirrors hubspot-crm.ts (workspace-scoped, auto-refresh)
 */

import * as salesforce from "./salesforce";
import { logger } from "@/lib/logger";
import type {
  CRMProvider,
  CRMContact,
} from "@/server/lib/providers/crm-provider";

/** Map CRMContact field names to Salesforce Contact field names */
function toCRMContact(sf: salesforce.SalesforceContact): CRMContact {
  return {
    id: sf.id,
    email: sf.email,
    firstName: sf.firstName,
    lastName: sf.lastName,
    company: sf.company,
    jobTitle: sf.jobTitle,
    phone: sf.phone,
  };
}

export function createSalesforceCRM(workspaceId: string): CRMProvider {
  /** Resolve accessToken + instanceUrl with auto-refresh */
  async function getCredentials(): Promise<{
    accessToken: string;
    instanceUrl: string;
  }> {
    return salesforce.getAccessTokenAndInstance(workspaceId);
  }

  return {
    name: "salesforce",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      try {
        const { accessToken, instanceUrl } = await getCredentials();
        const results = await salesforce.searchContacts(
          instanceUrl,
          accessToken,
          emails,
        );
        return results.map(toCRMContact);
      } catch (err) {
        logger.error("Salesforce searchContacts failed", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },

    async createContact(data: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      jobTitle?: string;
      phone?: string;
    }): Promise<CRMContact> {
      try {
        const { accessToken, instanceUrl } = await getCredentials();

        const props: Record<string, string> = { Email: data.email };
        if (data.firstName) props.FirstName = data.firstName;
        if (data.lastName) props.LastName = data.lastName;
        if (data.jobTitle) props.Title = data.jobTitle;
        if (data.phone) props.Phone = data.phone;
        // Salesforce Contact doesn't have a direct Company field —
        // company is linked via AccountId. Set it as Description fallback.
        if (data.company) props.Description = `Company: ${data.company}`;

        const result = await salesforce.createContact(
          instanceUrl,
          accessToken,
          props,
        );
        return toCRMContact(result);
      } catch (err) {
        logger.error("Salesforce createContact failed", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },

    async updateContact(
      contactId: string,
      data: Record<string, string>,
    ): Promise<CRMContact> {
      try {
        const { accessToken, instanceUrl } = await getCredentials();

        await salesforce.updateContact(
          instanceUrl,
          accessToken,
          contactId,
          data,
        );

        // Fetch updated contact via search (Salesforce PATCH returns 204)
        // Use SOQL to get the updated record
        const results = await salesforce.searchContacts(
          instanceUrl,
          accessToken,
          [data.Email ?? ""],
        );

        // If we can't find by email, return minimal contact
        const found = results.find((c) => c.id === contactId);
        if (found) return toCRMContact(found);

        return {
          id: contactId,
          email: data.Email ?? undefined,
          firstName: data.FirstName ?? undefined,
          lastName: data.LastName ?? undefined,
        };
      } catch (err) {
        logger.error("Salesforce updateContact failed", {
          workspaceId,
          contactId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },

    async checkDuplicates(
      emails: string[],
    ): Promise<{ existing: string[]; new: string[] }> {
      try {
        const { accessToken, instanceUrl } = await getCredentials();
        const contacts = await salesforce.searchContacts(
          instanceUrl,
          accessToken,
          emails,
        );

        const existingEmails = new Set(
          contacts
            .map((c) => c.email?.toLowerCase())
            .filter((e): e is string => !!e),
        );

        return {
          existing: emails.filter((e) => existingEmails.has(e.toLowerCase())),
          new: emails.filter((e) => !existingEmails.has(e.toLowerCase())),
        };
      } catch (err) {
        logger.error("Salesforce checkDuplicates failed", {
          workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}
