"use client";

import { useRef, useCallback } from "react";
import { ComposerPrimitive, useThreadRuntime } from "@assistant-ui/react";
import { PaperPlaneRight, Stop } from "@phosphor-icons/react/dist/ssr";
import { Plus, FileText } from "@phosphor-icons/react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, cn, useAgentActivity } from "@leadsens/ui";
import { toast } from "sonner";

export function LeadSensComposer() {
  const { isStreaming } = useAgentActivity();
  const threadRuntime = useThreadRuntime();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size > maxSize) {
        toast.error("File too large (max 10MB)");
        return;
      }

      const text = await file.text();
      const preview = text.slice(0, 500);
      const lineCount = text.split("\n").length;

      threadRuntime.composer.setText(
        `I'm uploading a CSV file "${file.name}" (${lineCount} rows). Here's a preview:\n\n\`\`\`\n${preview}\n\`\`\`\n\nPlease parse this file and import the leads.`
      );
      toast.success(`File loaded: ${file.name}`);
    },
    [threadRuntime],
  );

  return (
    <div className="px-6 pb-4 pt-2 shrink-0">
      <div className="max-w-[720px] mx-auto">
        <ComposerPrimitive.Root className="flex items-center gap-2 rounded-xl border border-border/50 bg-card/90 backdrop-blur-sm p-3 transition-all focus-within:border-primary/30">
          {/* "+" menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                aria-label="Attach"
              >
                <Plus className="size-4" weight="bold" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <FileText className="size-4 mr-2" />
                Upload CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleFileChange}
            className="hidden"
          />

          <ComposerPrimitive.Input
            autoFocus
            placeholder="Message LeadSens..."
            rows={1}
            className={cn(
              "min-h-0 max-h-32 flex-1 resize-none border-0 bg-transparent shadow-none",
              "focus:outline-none focus-visible:ring-0 p-0 text-[14px]",
            )}
          />

          {isStreaming ? (
            <Button
              size="icon"
              className="size-8 rounded-lg shrink-0"
              onClick={() => threadRuntime.cancelRun()}
            >
              <Stop className="size-4" weight="fill" />
              <span className="sr-only">Stop</span>
            </Button>
          ) : (
            <ComposerPrimitive.Send asChild>
              <Button size="icon" className="size-8 rounded-lg shrink-0">
                <PaperPlaneRight className="size-4" weight="fill" />
                <span className="sr-only">Send</span>
              </Button>
            </ComposerPrimitive.Send>
          )}
        </ComposerPrimitive.Root>
      </div>
    </div>
  );
}
