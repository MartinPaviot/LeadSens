"use client";

import { createContext, useContext } from "react";

export interface ThinkingStep {
  id: string;
  label: string;
  status: "running" | "done" | "error";
  summary?: string;
  startedAt?: number;
  completedAt?: number;
  toolName?: string;
}

export interface AgentActivityContextValue {
  label: string | null;
  steps: ThinkingStep[];
  isThinking: boolean;
  isStreaming: boolean;
  setLabel: (label: string | null) => void;
}

export const AgentActivityContext = createContext<AgentActivityContextValue>({
  label: null,
  steps: [],
  isThinking: false,
  isStreaming: false,
  setLabel: () => {},
});

export function useAgentActivity() {
  return useContext(AgentActivityContext);
}
