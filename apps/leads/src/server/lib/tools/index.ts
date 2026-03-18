import type { ToolDefinition, ToolContext, WorkspaceWithIntegrations } from "./types";
import { createSourcingTools } from "./sourcing-tools";
import { createESPTools } from "./esp-tools";
import { createEnrichmentTools } from "./enrichment-tools";
import { createEmailTools } from "./email-tools";
import { createCrmTools } from "./crm-tools";
import { createMemoryTools } from "./memory-tools";
import { createCompanyTools } from "./company-tools";
import { createVerificationTools } from "./verification-tools";
import { createAnalyticsTools } from "./analytics-tools";
import { createPipelineTools } from "./pipeline-tools";
import { createExportTools } from "./export-tools";
import { createSchedulingTools } from "./scheduling-tools";
import { createNotificationTools } from "./notification-tools";
import { createDemoTools } from "./demo-tools";

function hasIntegration(workspace: WorkspaceWithIntegrations, type: string): boolean {
  return workspace.integrations.some((i) => i.type === type && i.status === "ACTIVE");
}

function hasAnyIntegration(workspace: WorkspaceWithIntegrations, types: string[]): boolean {
  return types.some((type) => hasIntegration(workspace, type));
}

// All ESP connector IDs that have implementations
const ESP_IDS = [
  "INSTANTLY", "SMARTLEAD", "LEMLIST", "SALESHANDY", "WOODPECKER",
  "MAILSHAKE", "QUICKMAIL", "REPLY_IO", "KLENTY", "SALESLOFT",
  "GMASS", "SNOV_IO", "OUTREACH",
];

// All CRM connector IDs that have implementations
const CRM_IDS = ["HUBSPOT", "SALESFORCE", "PIPEDRIVE"];

// All verifier connector IDs that have implementations
const VERIFIER_IDS = ["ZEROBOUNCE", "NEVERBOUNCE", "DEBOUNCE", "MILLIONVERIFIER"];

// All export connector IDs
const EXPORT_IDS = ["AIRTABLE", "NOTION"];

// All scheduling connector IDs
const SCHEDULING_IDS = ["CALENDLY"];

// All notification connector IDs
const NOTIFICATION_IDS = ["SLACK"];

export function buildToolSet(
  workspace: WorkspaceWithIntegrations,
  ctx: ToolContext,
): Record<string, ToolDefinition> {
  const hasESP = hasAnyIntegration(workspace, ESP_IDS);
  const hasCRM = hasAnyIntegration(workspace, CRM_IDS);
  const hasVerifier = hasAnyIntegration(workspace, VERIFIER_IDS);
  const hasExport = hasAnyIntegration(workspace, EXPORT_IDS);
  const hasScheduling = hasAnyIntegration(workspace, SCHEDULING_IDS);
  const hasNotification = hasAnyIntegration(workspace, NOTIFICATION_IDS);
  const hasLeadSourcing = hasIntegration(workspace, "INSTANTLY") || hasIntegration(workspace, "APOLLO");

  return {
    ...createMemoryTools(ctx),
    ...createCompanyTools(ctx),
    // ESP-generic tools (works with any connected ESP)
    ...(hasESP ? createESPTools(ctx) : {}),
    // Sourcing tools (Instantly SuperSearch only)
    ...(hasIntegration(workspace, "INSTANTLY") ? createSourcingTools(ctx) : {}),
    ...(hasCRM ? createCrmTools(ctx) : {}),
    ...(hasVerifier ? createVerificationTools(ctx) : {}),
    // Analytics tools — most require ESP, but learning_summary always available
    ...createAnalyticsTools(ctx),
    ...createEnrichmentTools(ctx),
    ...createEmailTools(ctx),
    ...createPipelineTools(ctx),
    // New tool categories (conditionally loaded)
    ...(hasExport ? createExportTools(ctx) : {}),
    ...(hasScheduling ? createSchedulingTools(ctx) : {}),
    ...(hasNotification ? createNotificationTools(ctx) : {}),
    // Demo tools — available only when no lead sourcing tool is connected
    ...(!hasLeadSourcing ? createDemoTools(ctx) : {}),
  };
}

// ─── Phase-aware tool filtering ──────────────────────────
// Only expose tools relevant to the current pipeline phase.

const ALWAYS_AVAILABLE = new Set([
  "save_memory", "get_memories", "delete_memory",
  "analyze_company_site", "update_company_dna",
  "search_leads", "render_lead_table",
  "show_drafted_emails", "render_email_preview",
  "render_campaign_summary",
  "performance_insights",
  "icp_performance_analysis",
  "learning_summary",
  "import_leads_csv",
  // Export/scheduling/notification available in all phases
  "export_leads",
  "get_scheduling_links",
  "send_notification",
  // Demo tools always available (gated by buildToolSet, not phase)
  "demo_search_leads",
]);

const PHASE_TOOLS: Record<string, Set<string>> = {
  // No campaign or just created: discovery phase — ICP tools + sourcing only
  NONE: new Set([
    "parse_icp", "count_leads", "preview_leads",
    "source_leads",
    "find_decision_makers",
  ]),
  DRAFT: new Set([
    "parse_icp", "count_leads", "preview_leads",
    "source_leads", "score_leads_batch",
    "find_decision_makers",
  ]),
  // Post-sourcing: dedup + score + start enrichment
  SOURCING: new Set([
    "crm_check_duplicates",
    "score_leads_batch",
    "enrich_leads_batch", "enrich_single_lead",
    "find_decision_makers",
  ]),
  SCORING: new Set([
    "score_leads_batch",
    "enrich_leads_batch", "enrich_single_lead",
    "find_decision_makers",
  ]),
  // Enriching/Drafting: enrich + angle + draft + verify
  // score_leads_batch included: leads may reach ENRICHING phase before scoring completes
  ENRICHING: new Set([
    "score_leads_batch",
    "enrich_leads_batch", "enrich_single_lead",
    "generate_campaign_angle",
    "draft_emails_batch", "draft_single_email",
    "verify_emails",
  ]),
  DRAFTING: new Set([
    "generate_campaign_angle",
    "draft_emails_batch", "draft_single_email",
    "verify_emails",
    "preview_campaign_launch",
    "send_test_email",
    "list_accounts", "create_campaign",
    "add_leads_to_campaign",
  ]),
  // Ready/Pushed: campaign management + activation
  READY: new Set([
    "generate_campaign_angle",
    "verify_emails",
    "preview_campaign_launch",
    "send_test_email",
    "list_accounts", "create_campaign",
    "add_leads_to_campaign", "activate_campaign",
  ]),
  PUSHED: new Set([
    "generate_campaign_angle",
    "activate_campaign",
    // Monitoring
    "campaign_sending_status", "pause_campaign",
    "campaign_analytics", "get_replies",
    // Analytics
    "sync_campaign_analytics", "campaign_performance_report", "campaign_insights",
    // Reply management
    "classify_reply", "draft_reply", "reply_to_email",
    // CRM handoff
    "crm_create_contact", "crm_create_deal",
    // Allow starting new pipeline
    "parse_icp", "count_leads", "preview_leads",
    "source_leads",
  ]),
  // Active: monitoring + reply management + analytics + new pipeline
  ACTIVE: new Set([
    "campaign_sending_status", "pause_campaign",
    "campaign_analytics", "get_replies",
    // Analytics
    "sync_campaign_analytics", "campaign_performance_report", "campaign_insights",
    // Reply management
    "classify_reply", "draft_reply", "reply_to_email",
    // CRM handoff
    "crm_create_contact", "crm_create_deal",
    // New pipeline
    "parse_icp", "count_leads", "preview_leads",
    "source_leads",
  ]),
  // Monitoring: same tools as ACTIVE (campaign sending complete, still managing replies + analytics)
  MONITORING: new Set([
    "campaign_sending_status", "pause_campaign",
    "campaign_analytics", "get_replies",
    // Analytics
    "sync_campaign_analytics", "campaign_performance_report", "campaign_insights",
    // Reply management
    "classify_reply", "draft_reply", "reply_to_email",
    // CRM handoff
    "crm_create_contact", "crm_create_deal",
    // New pipeline
    "parse_icp", "count_leads", "preview_leads",
    "source_leads",
  ]),
};

export function filterToolsByPhase(
  tools: Record<string, ToolDefinition>,
  campaignStatus: string | null,
): Record<string, ToolDefinition> {
  const phaseKey = campaignStatus ?? "NONE";
  const phaseTools = PHASE_TOOLS[phaseKey] ?? PHASE_TOOLS.NONE;

  const filtered: Record<string, ToolDefinition> = {};
  for (const [name, def] of Object.entries(tools)) {
    if (ALWAYS_AVAILABLE.has(name) || phaseTools.has(name)) {
      filtered[name] = def;
    }
  }

  return filtered;
}

// Activity labels
const TOOL_LABELS: Record<string, string> = {
  parse_icp: "Parsing ICP filters...",
  count_leads: "Estimating available leads...",
  source_leads: "Sourcing leads via SuperSearch...",
  preview_leads: "Previewing leads...",
  crm_check_duplicates: "Checking duplicates in your CRM...",
  score_leads_batch: "Scoring leads against your ICP...",
  enrich_leads_batch: "Enriching lead profiles via Jina...",
  draft_emails_batch: "Writing personalized emails...",
  create_campaign: "Creating campaign...",
  add_leads_to_campaign: "Adding leads to campaign...",
  activate_campaign: "Activating campaign...",
  save_memory: "Saving to memory...",
  list_accounts: "Listing email accounts...",
  analyze_company_site: "Analyzing your website...",
  update_company_dna: "Updating company profile...",
  generate_campaign_angle: "Generating campaign angle...",
  search_leads: "Searching for lead...",
  draft_single_email: "Writing an email...",
  enrich_single_lead: "Enriching lead profile...",
  show_drafted_emails: "Loading drafted emails...",
  render_email_preview: "Preparing email preview...",
  render_lead_table: "Preparing lead table...",
  render_campaign_summary: "Preparing summary...",
  get_memories: "Checking memory...",
  delete_memory: "Deleting from memory...",
  campaign_sending_status: "Checking sending status...",
  pause_campaign: "Pausing campaign...",
  campaign_analytics: "Fetching campaign analytics...",
  get_replies: "Fetching campaign replies...",
  verify_emails: "Verifying email addresses...",
  sync_campaign_analytics: "Syncing campaign analytics...",
  campaign_performance_report: "Generating performance report...",
  performance_insights: "Analyzing performance patterns...",
  icp_performance_analysis: "Analyzing ICP performance...",
  // Pipeline tools (post-launch)
  classify_reply: "Classifying reply...",
  draft_reply: "Drafting reply...",
  reply_to_email: "Sending reply...",
  import_leads_csv: "Importing leads from CSV...",
  preview_campaign_launch: "Preparing campaign preview...",
  send_test_email: "Sending test email...",
  campaign_insights: "Analyzing campaign patterns...",
  learning_summary: "Reviewing what I've learned...",
  // CRM tools (extended)
  crm_create_contact: "Creating CRM contact...",
  crm_create_deal: "Creating CRM deal...",
  find_decision_makers: "Searching for decision makers...",
  // Export/scheduling/notification tools
  export_leads: "Exporting leads...",
  get_scheduling_links: "Fetching scheduling links...",
  send_notification: "Sending notification...",
  // Demo tools
  demo_search_leads: "Searching for sample leads...",
};

export function getToolLabel(toolName: string): string {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName.startsWith("render_")) return "Preparing response...";
  return "Working...";
}
