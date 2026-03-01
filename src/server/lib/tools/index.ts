import type { ToolDefinition, ToolContext, WorkspaceWithIntegrations } from "./types";
import { createInstantlyTools } from "./instantly-tools";
import { createEnrichmentTools } from "./enrichment-tools";
import { createEmailTools } from "./email-tools";
import { createCrmTools } from "./crm-tools";
import { createMemoryTools } from "./memory-tools";
import { createCompanyTools } from "./company-tools";

function hasIntegration(workspace: WorkspaceWithIntegrations, type: string): boolean {
  return workspace.integrations.some((i) => i.type === type && i.status === "ACTIVE");
}

export function buildToolSet(
  workspace: WorkspaceWithIntegrations,
  ctx: ToolContext,
): Record<string, ToolDefinition> {
  return {
    ...createMemoryTools(ctx),
    ...createCompanyTools(ctx),
    ...(hasIntegration(workspace, "INSTANTLY") ? createInstantlyTools(ctx) : {}),
    ...(hasIntegration(workspace, "HUBSPOT") ? createCrmTools(ctx) : {}),
    ...createEnrichmentTools(ctx),
    ...createEmailTools(ctx),
  };
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
};

export function getToolLabel(toolName: string): string {
  if (TOOL_LABELS[toolName]) return TOOL_LABELS[toolName];
  if (toolName.startsWith("render_")) return "Preparing response...";
  return "Working...";
}
