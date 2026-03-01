"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ─── Types ──────────────────────────────────────────────

export interface ConversationSummary {
  id: string;
  title: string | null;
  updatedAt: string;
}

interface ConversationContextValue {
  /** Currently active conversation ID (null = new chat) */
  activeId: string | null;
  /** Incremented on every explicit switch to force AgentChat remount */
  chatKey: number;
  /** All conversations for the workspace */
  conversations: ConversationSummary[];
  /** True during initial fetch */
  isLoading: boolean;
  /** Switch to an existing conversation (remounts chat) */
  selectConversation: (id: string) => void;
  /** Start a fresh new chat (remounts chat) */
  startNewChat: () => void;
  /** Refresh the conversation list from the server */
  refreshConversations: () => Promise<void>;
  /** Called by AgentChat after creating a new conversation (updates activeId without remount) */
  registerNewConversation: (id: string) => void;
}

// ─── Context ────────────────────────────────────────────

const ConversationContext = createContext<ConversationContextValue | null>(null);

export function useConversations() {
  const ctx = useContext(ConversationContext);
  if (!ctx)
    throw new Error(
      "useConversations must be used within ConversationProvider",
    );
  return ctx;
}

// ─── Provider ───────────────────────────────────────────

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/trpc/conversation.list");
      const data = await res.json();
      setConversations(data?.result?.data ?? []);
    } catch {
      // Silently fail — sidebar will show empty list
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchConversations();
      setIsLoading(false);
    })();
  }, [fetchConversations]);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    setChatKey((k) => k + 1);
  }, []);

  const startNewChat = useCallback(() => {
    setActiveId(null);
    setChatKey((k) => k + 1);
  }, []);

  const refreshConversations = useCallback(async () => {
    await fetchConversations();
  }, [fetchConversations]);

  const registerNewConversation = useCallback(
    (id: string) => {
      setActiveId(id);
      // No chatKey increment — chat stays mounted
      fetchConversations();
    },
    [fetchConversations],
  );

  return (
    <ConversationContext.Provider
      value={{
        activeId,
        chatKey,
        conversations,
        isLoading,
        selectConversation,
        startNewChat,
        refreshConversations,
        registerNewConversation,
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}
