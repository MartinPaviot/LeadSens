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
  "account-picker": () =>
    import("@/components/chat/inline/account-picker-card").then((m) => ({
      default: m.AccountPickerCard,
    })),
  "enrichment": () =>
    import("@/components/chat/inline/enrichment-card").then((m) => ({
      default: m.EnrichmentCard,
    })),
  "campaign-status": () =>
    import("@/components/chat/inline/campaign-status-card").then((m) => ({
      default: m.CampaignStatusCard,
    })),
  "campaign-analytics": () =>
    import("@/components/chat/inline/campaign-analytics-card").then((m) => ({
      default: m.CampaignAnalyticsCard,
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
  instantly_list_accounts: "account-picker",
  instantly_campaign_sending_status: "campaign-status",
  instantly_campaign_analytics: "campaign-analytics",
};

export function toolNameToComponent(toolName: string): string | null {
  return TOOL_TO_COMPONENT[toolName] ?? null;
}
