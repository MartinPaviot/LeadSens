"use client";

import { ThinkingBlock as SharedThinkingBlock } from "@leadsens/ui";

const avatar = (
  <div className="size-8 rounded-lg overflow-hidden bg-white">
    <img src="/L.svg" alt="LeadSens" className="size-8" />
  </div>
);

export function ThinkingBlock() {
  return <SharedThinkingBlock avatar={avatar} appName="LeadSens" />;
}
