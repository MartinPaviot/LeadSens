"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { Button } from "@leadsens/ui";
import { SeoAgentChat } from "@/components/seo-chat/seo-agent-chat";

interface ChatOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function ChatOverlay({ open, onClose }: ChatOverlayProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-300 ${
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Chat panel */}
      <div
        className={`absolute inset-x-0 bottom-0 top-0 mx-auto flex w-full max-w-[700px] flex-col overflow-hidden border-x border-border/30 bg-background shadow-2xl transition-transform duration-300 sm:inset-y-4 sm:rounded-2xl sm:border ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header with gradient accent */}
        <div className="relative flex items-center justify-between px-4 py-3 shrink-0">
          <div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: 'var(--elevay-gradient)' }}
          />
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-md"
              style={{ background: 'var(--elevay-gradient-btn)' }}
            >
              <span className="text-[9px] font-bold text-white">E</span>
            </div>
            <h2 className="text-sm font-semibold text-foreground">New SEO action</h2>
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X size={18} />
          </Button>
        </div>

        {/* Chat body — renders real SEO chat */}
        <div className="flex-1 overflow-hidden">
          {open && <SeoAgentChat embedded />}
        </div>
      </div>
    </div>,
    document.body,
  );
}
