import { lazy, type ComponentType } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<string, () => Promise<{ default: ComponentType<any> }>> = {
  "lead-table": () =>
    import("@/components/chat/inline/lead-table-card").then((m) => ({
      default: m.LeadTableCard,
    })),
  "email-preview": () =>
    import("@/components/chat/inline/email-preview-card").then((m) => ({
      default: m.EmailPreviewCard,
    })),
  "campaign-summary": () =>
    import("@/components/chat/inline/campaign-summary-card").then((m) => ({
      default: m.CampaignSummaryCard,
    })),
  "progress-bar": () =>
    import("@/components/chat/inline/progress-bar").then((m) => ({
      default: m.ProgressBar,
    })),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getInlineComponent(name: string): ComponentType<any> | null {
  const loader = registry[name];
  if (!loader) return null;
  return lazy(loader);
}

// Tool name → component name mapping
const TOOL_TO_COMPONENT: Record<string, string> = {
  render_lead_table: "lead-table",
  render_email_preview: "email-preview",
  render_campaign_summary: "campaign-summary",
  render_inline_progress: "progress-bar",
};

export function toolNameToComponent(toolName: string): string | null {
  return TOOL_TO_COMPONENT[toolName] ?? null;
}
