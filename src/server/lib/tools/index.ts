import type { ToolDefinition, ToolContext, WorkspaceWithIntegrations } from "./types";
import { createInstantlyTools } from "./instantly-tools";
import { createEnrichmentTools } from "./enrichment-tools";
import { createEmailTools } from "./email-tools";
import { createCrmTools } from "./crm-tools";
import { createMemoryTools } from "./memory-tools";
import { createCompanyTools } from "./company-tools";
import { createVerificationTools } from "./verification-tools";
import { createAnalyticsTools } from "./analytics-tools";
import { createPipelineTools } from "./pipeline-tools";

function hasIntegration(workspace: WorkspaceWithIntegrations, type: string): boolean {
  return workspace.integrations.some((i) => i.type === type && i.status === "ACTIVE");
}

export function buildToolSet(
  workspace: WorkspaceWithIntegrations,
  ctx: ToolContext,
): Record<string, ToolDefinition> {
  const hasESP = hasIntegration(workspace, "INSTANTLY") || hasIntegration(workspace, "SMARTLEAD") || hasIntegration(workspace, "LEMLIST");
  const hasCRM = hasIntegration(workspace, "HUBSPOT") || hasIntegration(workspace, "SALESFORCE");

  return {
    ...createMemoryTools(ctx),
    ...createCompanyTools(ctx),
    ...(hasESP ? createInstantlyTools(ctx) : {}),
    ...(hasCRM ? createCrmTools(ctx) : {}),
    ...(hasIntegration(workspace, "ZEROBOUNCE") ? createVerificationTools(ctx) : {}),
    ...(hasIntegration(workspace, "INSTANTLY") ? createAnalyticsTools(ctx) : {}),
    ...createEnrichmentTools(ctx),
    ...createEmailTools(ctx),
    ...createPipelineTools(ctx),
  };
}

// ─── Phase-aware tool filtering ──────────────────────────
// Only expose tools relevant to the current pipeline phase.
// Fewer tools = less LLM confusion = better tool calling accuracy.
//
// Always available: memory, company, search_leads, render_lead_table,
//                   show_drafted_emails, render_email_preview

const ALWAYS_AVAILABLE = new Set([
  "save_memory", "get_memories", "delete_memory",
  "analyze_company_site", "update_company_dna",
  "search_leads", "render_lead_table",
  "show_drafted_emails", "render_email_preview",
  "render_campaign_summary",
  "performance_insights",
  "import_leads_csv",
]);

const PHASE_TOOLS: Record<string, Set<string>> = {
  // No campaign or just created: discovery phase — ICP tools + sourcing only
  NONE: new Set([
    "parse_icp", "instantly_count_leads", "instantly_preview_leads",
    "instantly_source_leads",
  ]),
  DRAFT: new Set([
    "parse_icp", "instantly_count_leads", "instantly_preview_leads",
    "instantly_source_leads", "score_leads_batch",
  ]),
  // Post-sourcing: dedup + score + start enrichment (no re-sourcing — dedup would return 0)
  SOURCING: new Set([
    "crm_check_duplicates",
    "score_leads_batch",
    "enrich_leads_batch", "enrich_single_lead",
  ]),
  SCORING: new Set([
    "score_leads_batch",
    "enrich_leads_batch", "enrich_single_lead",
  ]),
  // Enriching/Drafting: enrich + angle + draft + verify
  ENRICHING: new Set([
    "enrich_leads_batch", "enrich_single_lead",
    "generate_campaign_angle",
    "draft_emails_batch", "draft_single_email",
    "verify_emails",
  ]),
  DRAFTING: new Set([
    "generate_campaign_angle",
    "draft_emails_batch", "draft_single_email",
    "verify_emails",
    "instantly_list_accounts", "instantly_create_campaign",
    "instantly_add_leads_to_campaign",
  ]),
  // Ready/Pushed: campaign management + activation + angle regeneration + verify
  READY: new Set([
    "generate_campaign_angle",
    "verify_emails",
    "instantly_list_accounts", "instantly_create_campaign",
    "instantly_add_leads_to_campaign", "instantly_activate_campaign",
  ]),
  PUSHED: new Set([
    "generate_campaign_angle",
    "instantly_activate_campaign",
    // Monitoring
    "instantly_campaign_sending_status", "instantly_pause_campaign",
    "instantly_campaign_analytics", "instantly_get_replies",
    // Analytics
    "sync_campaign_analytics", "campaign_performance_report", "campaign_insights",
    // Reply management
    "classify_reply", "draft_reply", "reply_to_email",
    // CRM handoff
    "crm_create_contact", "crm_create_deal",
    // Allow starting new pipeline
    "parse_icp", "instantly_count_leads", "instantly_preview_leads",
    "instantly_source_leads",
  ]),
  // Active: monitoring + reply management + analytics + new pipeline
  ACTIVE: new Set([
    "instantly_campaign_sending_status", "instantly_pause_campaign",
    "instantly_campaign_analytics", "instantly_get_replies",
    // Analytics
    "sync_campaign_analytics", "campaign_performance_report", "campaign_insights",
    // Reply management
    "classify_reply", "draft_reply", "reply_to_email",
    // CRM handoff
    "crm_create_contact", "crm_create_deal",
    // New pipeline
    "parse_icp", "instantly_count_leads", "instantly_preview_leads",
    "instantly_source_leads",
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

// Activity labels (SPEC-BACKEND.md section 3.3)
const TOOL_LABELS: Record<string, string> = {
  parse_icp: "Parsing ICP filters...",
  instantly_count_leads: "Estimating available leads...",
  instantly_source_leads: "Sourcing leads via SuperSearch...",
  instantly_preview_leads: "Previewing leads...",
  crm_check_duplicates: "Checking duplicates in your CRM...",
  score_leads_batch: "Scoring leads against your ICP...",
  enrich_leads_batch: "Enriching lead profiles via Jina...",
  draft_emails_batch: "Writing personalized emails...",
  instantly_create_campaign: "Creating draft campaign in Instantly...",
  instantly_add_leads_to_campaign: "Adding leads to campaign...",
  instantly_activate_campaign: "Activating campaign...",
  save_memory: "Saving to memory...",
  instantly_list_accounts: "Listing email accounts...",
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
  instantly_campaign_sending_status: "Checking sending status...",
  instantly_pause_campaign: "Pausing campaign...",
  instantly_campaign_analytics: "Fetching campaign analytics...",
  instantly_get_replies: "Fetching campaign replies...",
  verify_emails: "Verifying email addresses...",
  sync_campaign_analytics: "Syncing campaign analytics...",
  campaign_performance_report: "Generating performance report...",
  performance_insights: "Analyzing performance patterns...",
  // Pipeline tools (post-launch)
  classify_reply: "Classifying reply...",
  draft_reply: "Drafting reply...",
  reply_to_email: "Sending reply via Instantly...",
  import_leads_csv: "Importing leads from CSV...",
  campaign_insights: "Analyzing campaign patterns...",
  // CRM tools (extended)
  crm_create_contact: "Creating CRM contact...",
  crm_create_deal: "Creating CRM deal...",
};

export function getToolLabel(toolName: string): string {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName.startsWith("render_")) return "Preparing response...";
  return "Working...";
}
