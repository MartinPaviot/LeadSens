/**
 * SchedulingProvider — Abstraction for meeting scheduling services.
 *
 * Future implementations: Calendly, Cal.com, SavvyCal, etc.
 */

export interface SchedulingLink {
  url: string;
  name: string;
  duration?: number;
}

export interface SchedulingProvider {
  readonly name: string;

  /** Get available scheduling links */
  getLinks(): Promise<SchedulingLink[]>;

  /** Get a specific scheduling link by ID or slug */
  getLink(idOrSlug: string): Promise<SchedulingLink | null>;
}
