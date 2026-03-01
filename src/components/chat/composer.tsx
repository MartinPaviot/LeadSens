"use client";

import { ComposerPrimitive } from "@assistant-ui/react";
import { PaperPlaneRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LeadSensComposer() {
  return (
    <div className="px-6 pb-4 pt-2 shrink-0">
      <div className="max-w-[720px] mx-auto">
        <ComposerPrimitive.Root className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-3 transition-all focus-within:border-primary/30">
          <ComposerPrimitive.Input
            autoFocus
            placeholder="Message LeadSens..."
            rows={1}
            className={cn(
              "min-h-0 max-h-32 flex-1 resize-none border-0 bg-transparent shadow-none",
              "focus:outline-none focus-visible:ring-0 p-0 text-[14px]",
            )}
          />

          {/* Send button */}
          <ComposerPrimitive.Send asChild>
            <Button size="icon" className="size-8 rounded-lg shrink-0">
              <PaperPlaneRight className="size-4" weight="fill" />
              <span className="sr-only">Send</span>
            </Button>
          </ComposerPrimitive.Send>
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
