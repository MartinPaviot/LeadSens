// TODO: configure Composio MCP — https://docs.composio.dev/mcp
// Requires: pnpm --filter @leadsens/elevay add composio-core

export interface ComposioTool {
  name: string;
  description: string;
}

export interface ComposioClient {
  executeTool(toolName: string, params: Record<string, unknown>): Promise<unknown>;
  listTools(): Promise<ComposioTool[]>;
}

/** Stub — replace with real Composio MCP client once configured */
export function createComposioClient(): ComposioClient {
  return {
    async executeTool(toolName: string, _params: Record<string, unknown>): Promise<unknown> {
      throw new Error(`Composio not configured. Cannot execute tool: ${toolName}`);
    },
    async listTools(): Promise<ComposioTool[]> {
      return [];
    },
  };
}
