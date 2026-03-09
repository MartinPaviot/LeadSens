/**
 * CRMProvider — Abstraction for CRM integrations.
 *
 * Implementations: HubSpot, Pipedrive, Salesforce
 */

// ─── Common Types ────────────────────────────────────────

export interface CRMContact {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  jobTitle?: string;
  phone?: string;
  raw?: Record<string, unknown>;
}

export interface CRMDeal {
  id: string;
  title: string;
  value?: number;
  stage?: string;
  contactId?: string;
}

export interface SearchContactsResult {
  contacts: CRMContact[];
  total: number;
}

// ─── Interface ───────────────────────────────────────────

export interface CRMProvider {
  readonly name: "hubspot" | "pipedrive" | "salesforce";

  /** Search contacts by email addresses (batch) */
  searchContacts(emails: string[]): Promise<CRMContact[]>;

  /** Create a new contact */
  createContact(data: {
    email: string;
    firstName?: string;
    lastName?: string;
    company?: string;
    jobTitle?: string;
    phone?: string;
  }): Promise<CRMContact>;

  /** Update an existing contact */
  updateContact(contactId: string, data: Record<string, string>): Promise<CRMContact>;

  /** Check which emails already exist in CRM (for dedup) */
  checkDuplicates(emails: string[]): Promise<{ existing: string[]; new: string[] }>;
}
