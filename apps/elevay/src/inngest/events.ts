/**
 * Typed Inngest Event Schemas for Elevay SEO agents.
 *
 * Every event dispatched via inngest.send() must match one of these types.
 */

import { EventSchemas } from 'inngest';

export type AgentId =
  | 'pio05' | 'opt06' | 'tsi07' | 'kga08' | 'mdg11' | 'alt12'
  | 'wpw09' | 'bsw10'
  | 'bpi01' | 'cia03' | 'mts02'
  | 'scw16' | 'smc19' | 'smi20' | 'crm27' | 'bdg32';
export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly';

export type Events = {
  'elevay/agent.report.schedule': {
    data: {
      clientId: string;
      workspaceId: string;
      agentId: AgentId;
      frequency: ScheduleFrequency;
      nextRunAt: string; // ISO date string
    };
  };
  'elevay/agent.report.run': {
    data: {
      clientId: string;
      workspaceId: string;
      agentId: AgentId;
      scheduledFor: string; // ISO date — used as idempotency key
    };
  };
};

export const schemas = new EventSchemas().fromRecord<Events>();
