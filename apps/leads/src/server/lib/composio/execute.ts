/**
 * Composio Action Executor — Typed wrapper for executing Composio actions.
 *
 * All Composio-backed connectors route through this module for:
 * - Consistent error handling
 * - Logging (action, workspace, latency)
 * - Type safety on results
 */

import { logger } from "@/lib/logger";
import { getComposioClient } from "./client";

export interface ExecuteOptions {
  /** Timeout in ms (default: 30000) */
  timeout?: number;
}

/**
 * Execute a Composio action for a workspace.
 *
 * @param action - Composio action slug (e.g. "HUBSPOT_SEARCH_CONTACTS_BY_CRITERIA")
 * @param workspaceId - LeadSens workspace ID (maps to Composio userId/entity)
 * @param args - Action parameters
 * @param options - Execution options
 * @returns Action result (typed by caller)
 */
export async function executeAction<T = unknown>(
  action: string,
  workspaceId: string,
  args: Record<string, unknown>,
  options: ExecuteOptions = {},
): Promise<T> {
  const client = getComposioClient();
  const start = Date.now();

  try {
    const result = await client.tools.execute(action, {
      userId: workspaceId,
      arguments: args,
      dangerouslySkipVersionCheck: true,
    });

    const latency = Date.now() - start;
    logger.info("[composio] action executed", {
      action,
      workspaceId,
      latencyMs: latency,
    });

    return result as T;
  } catch (error) {
    const latency = Date.now() - start;
    logger.error("[composio] action failed", {
      action,
      workspaceId,
      latencyMs: latency,
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error(
      `Composio action ${action} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
