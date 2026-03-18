"use client";

import { Rocket, PencilSimple, X, EnvelopeSimple, Users, CalendarBlank } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";

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

      {/* Send schedule */}
      <div className="px-4 py-3 border-t">
        <div className="text-[11px] text-muted-foreground mb-2 font-medium">Send schedule</div>
        <div className="space-y-0">
          {timeline.map((step, i) => {
            const sendDate = new Date();
            sendDate.setDate(sendDate.getDate() + step.day);
            const dateStr = sendDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
            return (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className="flex flex-col items-center w-4 shrink-0">
                  <div className={`size-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  {i < timeline.length - 1 && <div className="w-px h-4 bg-border mt-0.5" />}
                </div>
                <span className="text-[11px] font-mono text-muted-foreground w-12 shrink-0">
                  {i === 0 ? "Today" : `D+${step.day}`}
                </span>
                <span className="text-xs font-medium flex-1">{step.framework}</span>
                <span className="text-[10px] text-muted-foreground/60">{dateStr}</span>
              </div>
            );
          })}
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
