"use client";

import { useThreadRuntime } from "@assistant-ui/react";
import { useAgentActivity } from "@leadsens/ui";

interface ChipDef {
  label: string;
  msg: string;
}

const PHASE_CHIPS: Record<string, ChipDef[]> = {
  NONE: [
    { label: "Describe my ICP", msg: "I'm looking for " },
    { label: "Analyze my website", msg: "Analyze my website: " },
  ],
  DRAFT: [
    { label: "Describe my ICP", msg: "I'm looking for " },
  ],
  SOURCING: [
    { label: "Score & enrich", msg: "Score and enrich the leads" },
  ],
  SCORING: [
    { label: "Enrich leads", msg: "Enrich the leads" },
  ],
  ENRICHING: [
    { label: "Draft emails", msg: "Draft the emails" },
  ],
  DRAFTING: [
    { label: "Preview emails", msg: "Show me the emails" },
    { label: "Launch campaign", msg: "Let's set up the campaign" },
  ],
  READY: [
    { label: "Launch campaign", msg: "Let's launch the campaign" },
  ],
  PUSHED: [
    { label: "Campaign stats", msg: "How is the campaign performing?" },
    { label: "Check replies", msg: "Show new replies" },
  ],
  ACTIVE: [
    { label: "Campaign stats", msg: "How is the campaign performing?" },
    { label: "Check replies", msg: "Show new replies" },
    { label: "What's working?", msg: "What patterns are working best?" },
  ],
};

interface SuggestionChipsProps {
  phase: string | null;
}

export function SuggestionChips({ phase }: SuggestionChipsProps) {
  const threadRuntime = useThreadRuntime();
  const { isStreaming } = useAgentActivity();

  // Don't show during streaming
  if (isStreaming) return null;

  const chips = PHASE_CHIPS[phase ?? "NONE"] ?? PHASE_CHIPS.NONE;

  const handleClick = (chip: ChipDef) => {
    // If message ends with a space, set text for user to complete
    if (chip.msg.endsWith(" ")) {
      threadRuntime.composer.setText(chip.msg);
    } else {
      // Complete message — send immediately
      threadRuntime.composer.setText(chip.msg);
      threadRuntime.composer.send();
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={() => handleClick(chip)}
          className="text-xs px-3 py-1.5 rounded-full border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
