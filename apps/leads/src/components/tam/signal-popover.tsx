"use client";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@leadsens/ui";
import type { ReactNode } from "react";

// ─── Types ───────────────────────────────────────────────

interface SignalSource {
  url: string;
  title: string;
  favicon?: string;
}

interface SignalPopoverProps {
  name: string;
  detected: boolean;
  evidence: string;
  reasoning: string;
  sources: SignalSource[];
  points: number;
  children: ReactNode;
}

// ─── Component ───────────────────────────────────────────

export function SignalPopover({
  name,
  detected,
  evidence,
  reasoning,
  sources,
  points,
  children,
}: SignalPopoverProps) {
  if (!detected) return <>{children}</>;

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-80 p-0" side="top">
        <div className="px-3 py-2 border-b">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold">{name}</span>
            <span className="text-[10px] text-emerald-600 font-medium">+{points}pts</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">{evidence}</p>
        </div>

        <Tabs defaultValue="reasoning" className="w-full">
          <TabsList className="w-full h-7 rounded-none border-b bg-transparent px-3">
            <TabsTrigger value="reasoning" className="text-[10px] h-6 px-2">
              Reasoning
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-[10px] h-6 px-2">
              Sources{sources.length > 0 ? ` (${sources.length})` : ""}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reasoning" className="px-3 py-2 mt-0">
            <p className="text-[11px] text-muted-foreground leading-relaxed">{reasoning}</p>
          </TabsContent>

          <TabsContent value="sources" className="px-3 py-2 mt-0">
            {sources.length > 0 ? (
              <ul className="space-y-1.5">
                {sources.map((source, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {source.favicon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={source.favicon} alt="" className="size-3.5 rounded" />
                    ) : (
                      <div className="size-3.5 rounded bg-muted" />
                    )}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline truncate"
                    >
                      {source.title}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted-foreground/60">No external sources</p>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
