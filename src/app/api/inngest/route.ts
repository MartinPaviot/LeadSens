import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import {
  analyticsSyncCron,
  enrichLeadsBatch,
  draftEmailsBatch,
} from "@/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [analyticsSyncCron, enrichLeadsBatch, draftEmailsBatch],
});
