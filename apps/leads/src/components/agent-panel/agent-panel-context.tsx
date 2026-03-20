"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Types ──────────────────────────────────────────────

interface AgentPanelContextValue {
  isOpen: boolean;
  open: (prefill?: string) => void;
  close: () => void;
  toggle: () => void;
  prefillMessage: string | null;
  clearPrefill: () => void;
}

// ─── Context ────────────────────────────────────────────

export const AgentPanelContext = createContext<AgentPanelContextValue | null>(null);

export function useAgentPanel() {
  const ctx = useContext(AgentPanelContext);
  if (!ctx)
    throw new Error("useAgentPanel must be used within AgentPanelProvider");
  return ctx;
}

// ─── Provider ───────────────────────────────────────────

export function AgentPanelProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  // Auto-open panel if ?agent=open is in the URL
  useEffect(() => {
    if (searchParams.get("agent") === "open") {
      setIsOpen(true);
      // Clean the URL param without triggering navigation
      const url = new URL(window.location.href);
      url.searchParams.delete("agent");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  }, [searchParams, router]);

  const open = useCallback((prefill?: string) => {
    if (prefill) setPrefillMessage(prefill);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const clearPrefill = useCallback(() => {
    setPrefillMessage(null);
  }, []);

  return (
    <AgentPanelContext.Provider
      value={{ isOpen, open, close, toggle, prefillMessage, clearPrefill }}
    >
      {children}
    </AgentPanelContext.Provider>
  );
}
