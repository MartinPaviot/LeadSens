export const maxDuration = 300;

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import {
  agentScheduleNextRun,
  agentRunScheduled,
} from '@/inngest/functions';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [agentScheduleNextRun, agentRunScheduled],
});
