"use client";

import { ThinkingBlock as SharedThinkingBlock } from "@leadsens/ui";

const avatar = (
  <div className="size-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
    <span className="text-white text-xs font-bold">E</span>
  </div>
);

export function ThinkingBlock() {
  return <SharedThinkingBlock avatar={avatar} appName="Elevay" />;
}
