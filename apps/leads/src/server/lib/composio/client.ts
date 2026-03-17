/**
 * Composio Client — Singleton for the Composio SDK.
 *
 * Used by Composio-backed connectors to execute actions and manage connections.
 * Each workspace maps to a Composio "user" (entity) for multi-tenant isolation.
 */

import { Composio } from "@composio/core";

let _client: Composio | null = null;

export function getComposioClient(): Composio {
  if (!_client) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) {
      throw new Error(
        "COMPOSIO_API_KEY not configured. Set it in .env to enable Composio integrations.",
      );
    }
    _client = new Composio({ apiKey });
  }
  return _client;
}

/** Whether Composio is configured and available */
export function isComposioEnabled(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}
