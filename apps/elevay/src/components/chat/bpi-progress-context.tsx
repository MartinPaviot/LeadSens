"use client";

import { createContext, useContext } from "react";

export type ModuleItem = {
  label: string;
  status: "idle" | "running" | "done" | "failed";
};

export type ExportButton = {
  assistantId: string;
  label: string;
  onClick: () => void;
};

type BpiProgressContextValue = {
  modules: ModuleItem[] | null;
  isExpanded: boolean;
  toggle: () => void;
  exportButton: ExportButton | null;
};

export const BpiProgressContext = createContext<BpiProgressContextValue>({
  modules: null,
  isExpanded: false,
  toggle: () => {},
  exportButton: null,
});

export function useBpiProgress() {
  return useContext(BpiProgressContext);
}
