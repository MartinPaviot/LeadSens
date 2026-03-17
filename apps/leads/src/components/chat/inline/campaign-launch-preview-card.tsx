"use client";

import { Rocket, PencilSimple, X, EnvelopeSimple, Users, CalendarBlank } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface TimelineStep {
  day: number;
  framework: string;
}

interface SampleEmail {
  subject: string;
  bodySnippet: string;
  leadName: string;
  company: string;
  variantCount: number;
}

interface CampaignLaunchPreviewProps {
  campaignName: string;
  leadCount: number;
  emailCount: number;
  stepsCount: number;
  timeline: TimelineStep[];
  sampleEmail: SampleEmail | null;
}

export function CampaignLaunchPreviewCard({
  campaignName,
  leadCount,
  emailCount,
  stepsCount,
  timeline,
  sampleEmail,
}: CampaignLaunchPreviewProps) {
  const handleAction = (action: "launch" | "edit" | "cancel") => {
    const messages: Record<string, string> = {
      launch: "Launch the campaign",
      edit: "I want to edit the campaign before launching",
      cancel: "Cancel, don't launch yet",
    };
    window.dispatchEvent(
      new CustomEvent("leadsens:campaign-launch", {
        detail: { action, message: messages[action] },
      }),
    );
  };

  return (
    <div className="rounded-xl border bg-card/90 backdrop-blur-sm shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-primary/5">
        <div className="flex items-center gap-2">
          <Rocket className="size-4 text-primary" weight="bold" />
          <span className="text-sm font-semibold">Campaign Ready</span>
          <span className="text-xs text-muted-foreground ml-1">— {campaignName}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-px bg-border/30">
        <div className="bg-card px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <Users className="size-3.5" />
            <span className="text-[11px]">Leads</span>
          </div>
          <span className="text-lg font-semibold">{leadCount}</span>
        </div>
        <div className="bg-card px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <EnvelopeSimple className="size-3.5" />
            <span className="text-[11px]">Emails</span>
          </div>
          <span className="text-lg font-semibold">{emailCount}</span>
        </div>
        <div className="bg-card px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
            <CalendarBlank className="size-3.5" />
            <span className="text-[11px]">Steps</span>
          </div>
          <span className="text-lg font-semibold">{stepsCount}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="px-4 py-3 border-t">
        <div className="text-[11px] text-muted-foreground mb-2 font-medium">Sequence timeline</div>
        <div className="flex items-center gap-1 overflow-x-auto">
          {timeline.map((step, i) => (
            <div
              key={i}
              className="flex-shrink-0 flex flex-col items-center"
            >
              <div className="text-[10px] text-muted-foreground mb-0.5">J+{step.day}</div>
              <div className="px-2 py-1 rounded-md bg-primary/8 border border-primary/15 text-[11px] font-medium text-primary whitespace-nowrap">
                {step.framework}
              </div>
              {i < timeline.length - 1 && (
                <div className="text-[10px] text-muted-foreground/40 mt-0.5">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Sample email */}
      {sampleEmail && (
        <div className="px-4 py-3 border-t">
          <div className="text-[11px] text-muted-foreground mb-1.5 font-medium">
            Sample email (Step 0 → {sampleEmail.leadName} at {sampleEmail.company})
          </div>
          <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
            <div className="text-xs font-medium mb-1">
              Subject: {sampleEmail.subject}
              {sampleEmail.variantCount > 0 && (
                <span className="text-muted-foreground ml-1">
                  (+{sampleEmail.variantCount} A/B variants)
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              {sampleEmail.bodySnippet}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t flex items-center gap-2">
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => handleAction("launch")}
        >
          <Rocket className="size-3.5" weight="bold" />
          Launch
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => handleAction("edit")}
        >
          <PencilSimple className="size-3.5" />
          Edit
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="gap-1.5 text-muted-foreground"
          onClick={() => handleAction("cancel")}
        >
          <X className="size-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
