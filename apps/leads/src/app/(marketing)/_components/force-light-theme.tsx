"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/**
 * Forces light theme on marketing pages and restores
 * the previous theme when navigating away.
 */
export function ForceLightTheme() {
  const { theme, setTheme } = useTheme();
  const prevTheme = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (theme !== "light") {
      prevTheme.current = theme;
      setTheme("light");
    }

    return () => {
      if (prevTheme.current && prevTheme.current !== "light") {
        setTheme(prevTheme.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
