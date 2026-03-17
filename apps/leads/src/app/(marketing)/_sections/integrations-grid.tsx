/**
 * T3-05: Integration grid with hover tooltips.
 */
"use client";

import { SectionWrapper } from "../_components/section-wrapper";
import { IntegrationLogo } from "../_components/integration-logo";
import {
  INTEGRATIONS,
  CATEGORY_LABELS,
  type IntegrationItem,
} from "../_data/integrations";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@leadsens/ui";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as IntegrationItem["category"][];

const INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  Instantly: "Cold email at scale",
  Smartlead: "Multi-inbox sending",
  Lemlist: "Multichannel outreach",
  HubSpot: "CRM & pipeline",
  Salesforce: "Enterprise CRM",
  Apollo: "B2B data & enrichment",
  LinkedIn: "Professional profiles",
  Jina: "Web content extraction",
  ZeroBounce: "Email verification",
  MillionVerifier: "Bulk email validation",
  Zapier: "Workflow automation",
  Make: "Visual automation",
};

export function IntegrationsGrid() {
  return (
    <SectionWrapper
      id="integrations"
      className="section-alt border-t border-border/40 py-24 md:py-32 px-6"
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-4 text-center text-3xl font-bold tracking-tight md:text-4xl">
          Works with <span className="gradient-text">your stack</span>
        </h2>
        <p className="mx-auto mb-14 max-w-xl text-center text-muted-foreground">
          Bring your own tools. LeadSens connects to your existing accounts and
          orchestrates them seamlessly.
        </p>

        <TooltipProvider delayDuration={200}>
          <div className="space-y-10">
            {CATEGORIES.map((category) => {
              const items = INTEGRATIONS.filter((i) => i.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-4 text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                    {CATEGORY_LABELS[category]}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {items.map((integration) => (
                      <Tooltip key={integration.name}>
                        <TooltipTrigger asChild>
                          <div className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 card-hover cursor-default">
                            <IntegrationLogo
                              name={integration.name}
                              logo={integration.logo}
                              size={28}
                            />
                            <span className="text-sm font-medium">
                              {integration.name}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{INTEGRATION_DESCRIPTIONS[integration.name] ?? integration.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    </SectionWrapper>
  );
}
