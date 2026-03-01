"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { CaretRight } from "@phosphor-icons/react";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Edge trigger that opens the sidebar when the mouse reaches the left edge.
 * Uses a document-level mousemove listener instead of a thin DOM element,
 * which is far more reliable across browsers and platforms.
 */
export function SidebarEdgeTrigger() {
  const { open, setOpen, isMobile } = useSidebar();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showIndicator, setShowIndicator] = useState(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (open || isMobile) {
      setShowIndicator(false);
      clearTimer();
      return;
    }

    const EDGE_ZONE = 16; // px from left edge

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientX <= EDGE_ZONE) {
        setShowIndicator(true);
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            setOpen(true);
            setShowIndicator(false);
            timerRef.current = null;
          }, 150);
        }
      } else {
        setShowIndicator(false);
        clearTimer();
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      clearTimer();
    };
  }, [open, isMobile, setOpen, clearTimer]);

  if (open || isMobile) return null;

  return (
    <div
      className={`fixed left-0 top-0 bottom-0 z-[100] w-1.5 flex items-center transition-opacity duration-150 pointer-events-none ${
        showIndicator ? "opacity-100" : "opacity-0"
      }`}
    >
      <CaretRight className="size-3.5 text-muted-foreground ml-px" />
    </div>
  );
}
