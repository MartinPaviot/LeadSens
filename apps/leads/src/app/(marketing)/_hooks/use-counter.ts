"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "./use-reduced-motion";

interface UseCounterOptions {
  end: number;
  duration?: number;
  start?: number;
  enabled?: boolean;
}

export function useCounter({
  end,
  duration = 2000,
  start = 0,
  enabled = true,
}: UseCounterOptions) {
  const prefersReducedMotion = useReducedMotion();
  const [value, setValue] = useState(start);

  useEffect(() => {
    if (!enabled) {
      setValue(start);
      return;
    }

    // Skip animation if user prefers reduced motion
    if (prefersReducedMotion) {
      setValue(end);
      return;
    }

    const startTime = performance.now();
    let rafId: number;

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + (end - start) * eased));

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [end, duration, start, enabled, prefersReducedMotion]);

  return value;
}
