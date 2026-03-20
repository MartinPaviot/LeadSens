"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@leadsens/ui";
import { X, NotePencil } from "@phosphor-icons/react";
import { useAgentPanel } from "./agent-panel-context";
import { useConversations } from "@/components/conversation-provider";
import AgentChat from "@/components/chat/agent-chat";

export function AgentPanel() {
  const { isOpen, close } = useAgentPanel();
  const {
    activeId,
    conversations,
    selectConversation,
    startNewChat,
  } = useConversations();

  // Local state to track conversation selector
  const [selectorKey, setSelectorKey] = useState(0);

  const handleConversationChange = useCallback(
    (value: string) => {
      if (value === "__new__") {
        startNewChat();
        setSelectorKey((k) => k + 1);
      } else {
        selectConversation(value);
      }
    },
    [selectConversation, startNewChat],
  );

  const handleNewChat = useCallback(() => {
    startNewChat();
    setSelectorKey((k) => k + 1);
  }, [startNewChat]);

  // Sorted conversations (most recent first)
  const sortedConversations = useMemo(
    () =>
      [...conversations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [conversations],
  );

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[420px] sm:w-[420px] p-0 flex flex-col gap-0 sm:max-w-[420px]"
        // Prevent closing on outside click so panel persists across navigation
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <SheetHeader className="px-3 py-2 border-b shrink-0 space-y-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-sm font-semibold">
                Ask LeadSens
              </SheetTitle>
              <SheetDescription className="sr-only">
                AI agent assistant
              </SheetDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleNewChat}
                title="New conversation"
              >
                <NotePencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={close}
                title="Close panel"
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Conversation selector */}
          {conversations.length > 0 && (
            <Select
              key={selectorKey}
              value={activeId ?? undefined}
              onValueChange={handleConversationChange}
            >
              <SelectTrigger className="h-7 text-xs mt-1.5">
                <SelectValue placeholder="New conversation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__new__">
                  <span className="text-muted-foreground">+ New conversation</span>
                </SelectItem>
                {sortedConversations.map((conv) => (
                  <SelectItem key={conv.id} value={conv.id}>
                    {conv.title || "Untitled"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </SheetHeader>

        {/* Chat body */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <AgentChat compact />
        </div>
      </SheetContent>
    </Sheet>
  );
}
