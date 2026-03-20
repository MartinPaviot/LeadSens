"use client";

import { useContext } from "react";
import { AgentPanelContext } from "./agent-panel-context";

/**
 * Same as useAgentPanel but returns null when outside AgentPanelProvider
 * instead of throwing. Used by AgentChat which may render in both contexts.
 */
export function useAgentPanelSafe() {
  return useContext(AgentPanelContext);
}
