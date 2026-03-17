/**
 * NotificationProvider — Abstraction for notification/messaging services.
 *
 * Future implementations: Slack, Discord, Microsoft Teams, etc.
 */

export interface NotificationMessage {
  channel?: string;
  text: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationProvider {
  readonly name: string;

  /** Send a notification */
  send(message: NotificationMessage): Promise<{ ok: boolean; error?: string }>;
}
