/**
 * Calendly Composio Connector — SchedulingProvider backed by Composio actions.
 *
 * Replaces direct Calendly HTTP API calls with Composio SDK execution.
 * Uses CALENDLY_GET_USER, CALENDLY_LIST_EVENT_TYPES, CALENDLY_GET_EVENT_TYPE.
 *
 * The user URI is fetched once via CALENDLY_GET_USER and cached for the
 * lifetime of the provider instance (needed for listing event types).
 */

import { executeAction } from "@/server/lib/composio/execute";
import { logger } from "@/lib/logger";
import type {
  SchedulingProvider,
  SchedulingLink,
} from "@/server/lib/providers/scheduling-provider";

// ─── Composio Response Types ────────────────────────────

interface CalendlyUserResponse {
  resource?: {
    uri: string;
    name?: string;
    email?: string;
  };
}

interface CalendlyEventType {
  uri: string;
  name: string;
  slug?: string;
  scheduling_url: string;
  duration?: number;
  active?: boolean;
}

interface CalendlyEventTypesResponse {
  collection?: CalendlyEventType[];
}

interface CalendlyEventTypeResponse {
  resource?: CalendlyEventType;
}

// ─── SchedulingProvider Implementation ──────────────────

class CalendlyComposioScheduling implements SchedulingProvider {
  readonly name = "Calendly";

  private readonly workspaceId: string;
  /** Cached user URI — resolved on first API call that needs it. */
  private userUri: string | null = null;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  /**
   * Resolve the current user's URI from Calendly.
   * Cached after the first successful call.
   */
  private async getUserUri(): Promise<string> {
    if (this.userUri) return this.userUri;

    const result = await executeAction<CalendlyUserResponse>(
      "CALENDLY_GET_USER",
      this.workspaceId,
      {},
    );

    const uri = result.resource?.uri;
    if (!uri) {
      throw new Error("Calendly GET_USER did not return a user URI");
    }

    this.userUri = uri;
    return uri;
  }

  async getLinks(): Promise<SchedulingLink[]> {
    try {
      const userUri = await this.getUserUri();

      const result = await executeAction<CalendlyEventTypesResponse>(
        "CALENDLY_LIST_EVENT_TYPES",
        this.workspaceId,
        { user: userUri },
      );

      const collection = result.collection;
      if (!collection || collection.length === 0) {
        return [];
      }

      return collection
        .filter((et) => et.active !== false)
        .map((et) => ({
          url: et.scheduling_url,
          name: et.name,
          duration: et.duration,
        }));
    } catch (err) {
      logger.error("[calendly-composio] getLinks failed", {
        workspaceId: this.workspaceId,
        error: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  }

  async getLink(idOrSlug: string): Promise<SchedulingLink | null> {
    try {
      // First try direct lookup via GET_EVENT_TYPE if idOrSlug looks like a UUID
      const uuidPattern = /^[0-9a-f-]{36}$/i;
      if (uuidPattern.test(idOrSlug)) {
        try {
          const result = await executeAction<CalendlyEventTypeResponse>(
            "CALENDLY_GET_EVENT_TYPE",
            this.workspaceId,
            { uuid: idOrSlug },
          );

          const et = result.resource;
          if (et) {
            return {
              url: et.scheduling_url,
              name: et.name,
              duration: et.duration,
            };
          }
        } catch {
          // Fall through to search-based lookup
        }
      }

      // Fallback: search through all links
      const links = await this.getLinks();
      const needle = idOrSlug.toLowerCase();

      return (
        links.find(
          (link) =>
            link.url.toLowerCase().includes(needle) ||
            link.name.toLowerCase() === needle,
        ) ?? null
      );
    } catch (err) {
      logger.error("[calendly-composio] getLink failed", {
        workspaceId: this.workspaceId,
        idOrSlug,
        error: err instanceof Error ? err.message : "unknown",
      });
      throw err;
    }
  }
}

// ─── Factory ────────────────────────────────────────────

/**
 * Create a Calendly SchedulingProvider backed by Composio actions.
 * The user URI is lazily fetched and cached on first use.
 */
export function createCalendlyComposioScheduling(
  workspaceId: string,
): SchedulingProvider {
  return new CalendlyComposioScheduling(workspaceId);
}
