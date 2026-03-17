/**
 * Typed Inngest Event Schemas.
 *
 * Every event dispatched via inngest.send() must match one of these types.
 * Eliminates `event.data as { ... }` casts in function handlers.
 */

import { EventSchemas } from "inngest";

export type Events = {
  "leadsens/leads.enrich": {
    data: {
      leadIds: string[];
      workspaceId: string;
      campaignId: string;
      jobId: string;
      conversationId?: string;
    };
  };
  "leadsens/emails.draft": {
    data: {
      leadIds: string[];
      workspaceId: string;
      campaignId: string;
      jobId: string;
      conversationId?: string;
    };
  };
  "leadsens/campaign.push": {
    data: {
      campaignId: string;
      workspaceId: string;
      leadIds: string[];
      espCampaignId: string;
      jobId: string;
    };
  };
  "leadsens/csv.import": {
    data: {
      csvContent: string;
      workspaceId: string;
      campaignId?: string;
      jobId: string;
    };
  };
  "leadsens/analytics.sync": {
    data: {
      campaignId: string;
      workspaceId: string;
    };
  };
};

export const schemas = new EventSchemas().fromRecord<Events>();
