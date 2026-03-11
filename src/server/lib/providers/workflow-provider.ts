/**
 * WorkflowProvider — Abstraction for workflow automation services.
 *
 * Future implementations: Zapier, Make, n8n, etc.
 */

export interface WorkflowTriggerPayload {
  event: string;
  data: Record<string, unknown>;
}

export interface WorkflowProvider {
  readonly name: string;

  /** Trigger a workflow with a payload */
  trigger(payload: WorkflowTriggerPayload): Promise<{ ok: boolean; error?: string }>;
}
