/**
 * HubSpot CRM Provider — wraps the raw HubSpot connector
 * to implement the CRMProvider interface.
 */

import * as hubspot from "./hubspot";
import type { CRMProvider, CRMContact } from "@/server/lib/providers/crm-provider";

export function createHubSpotCRM(workspaceId: string): CRMProvider {
  return {
    name: "hubspot",

    async searchContacts(emails: string[]): Promise<CRMContact[]> {
      const results = await hubspot.searchContacts(workspaceId, emails);
      return results.map((c) => ({
        id: c.id,
        email: c.properties.email ?? undefined,
        firstName: c.properties.firstname ?? undefined,
        lastName: c.properties.lastname ?? undefined,
        company: c.properties.company ?? undefined,
        raw: c.properties,
      }));
    },

    async createContact(data: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      jobTitle?: string;
      phone?: string;
    }): Promise<CRMContact> {
      const props: Record<string, string> = { email: data.email };
      if (data.firstName) props.firstname = data.firstName;
      if (data.lastName) props.lastname = data.lastName;
      if (data.company) props.company = data.company;
      if (data.jobTitle) props.jobtitle = data.jobTitle;
      if (data.phone) props.phone = data.phone;

      const result = await hubspot.createContact(workspaceId, props);
      return {
        id: result.id,
        email: result.properties.email ?? undefined,
        firstName: result.properties.firstname ?? undefined,
        lastName: result.properties.lastname ?? undefined,
        company: result.properties.company ?? undefined,
        raw: result.properties,
      };
    },

    async updateContact(contactId: string, data: Record<string, string>): Promise<CRMContact> {
      const result = await hubspot.updateContact(workspaceId, contactId, data);
      return {
        id: result.id,
        email: result.properties.email ?? undefined,
        firstName: result.properties.firstname ?? undefined,
        lastName: result.properties.lastname ?? undefined,
        company: result.properties.company ?? undefined,
        raw: result.properties,
      };
    },

    async checkDuplicates(emails: string[]): Promise<{ existing: string[]; new: string[] }> {
      const contacts = await hubspot.searchContacts(workspaceId, emails);
      const existingEmails = new Set(
        contacts
          .map((c) => c.properties.email?.toLowerCase())
          .filter((e): e is string => !!e),
      );
      return {
        existing: emails.filter((e) => existingEmails.has(e.toLowerCase())),
        new: emails.filter((e) => !existingEmails.has(e.toLowerCase())),
      };
    },
  };
}
