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
  "pipeline-progress": () =>
    import("@/components/chat/inline/pipeline-progress").then((m) => ({
      default: m.PipelineProgress,
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
  "analytics-report": () =>
    import("@/components/chat/inline/analytics-report-card").then((m) => ({
      default: m.AnalyticsReportCard,
    })),
  "campaign-launch-preview": () =>
    import("@/components/chat/inline/campaign-launch-preview-card").then((m) => ({
      default: m.CampaignLaunchPreviewCard,
    })),
  "email-sequence": () =>
    import("@/components/chat/inline/email-sequence-card").then((m) => ({
      default: m.EmailSequenceCard,
    })),
  "job-progress": () =>
    import("@/components/chat/inline/job-progress").then((m) => ({
      default: m.JobProgress,
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
  list_accounts: "account-picker",
  campaign_sending_status: "campaign-status",
  campaign_analytics: "campaign-analytics",
  campaign_performance_report: "analytics-report",
  preview_campaign_launch: "campaign-launch-preview",
};

export function toolNameToComponent(toolName: string): string | null {
  return TOOL_TO_COMPONENT[toolName] ?? null;
}
