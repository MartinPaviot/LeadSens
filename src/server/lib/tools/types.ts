// Re-export from llm/types for convenience
export type { ToolDefinition, ToolContext } from "@/server/lib/llm/types";

export interface WorkspaceWithIntegrations {
  id: string;
  name: string;
  companyDna: unknown;
  integrations: Array<{
    type: string;
    status: string;
  }>;
}
