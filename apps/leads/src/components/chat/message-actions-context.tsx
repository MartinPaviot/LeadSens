"use client";

import { createContext, useContext } from "react";

export interface MessageActions {
  onEdit: (messageId: string, newContent: string) => void;
  onRegenerate: (messageId: string) => void;
  onFeedback: (messageId: string, type: "THUMBS_UP" | "THUMBS_DOWN") => void;
}

const MessageActionsContext = createContext<MessageActions | null>(null);

export function MessageActionsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MessageActions;
}) {
  return (
    <MessageActionsContext.Provider value={value}>
      {children}
    </MessageActionsContext.Provider>
  );
}

export function useMessageActions(): MessageActions {
  const ctx = useContext(MessageActionsContext);
  if (!ctx) {
    throw new Error("useMessageActions must be used within MessageActionsProvider");
  }
  return ctx;
}
