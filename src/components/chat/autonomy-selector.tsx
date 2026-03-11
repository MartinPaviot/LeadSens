"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Robot, Hand } from "@phosphor-icons/react";

type AutonomyLevel = "MANUAL" | "SUPERVISED" | "AUTO";

const LEVELS: Array<{ value: AutonomyLevel; label: string; icon: typeof Hand; description: string }> = [
  { value: "MANUAL", label: "Manual", icon: Hand, description: "Confirm every action" },
  { value: "SUPERVISED", label: "Supervised", icon: ShieldCheck, description: "Confirm side effects only" },
  { value: "AUTO", label: "Full auto", icon: Robot, description: "Execute everything" },
];

export function AutonomySelector() {
  const [level, setLevel] = useState<AutonomyLevel>("SUPERVISED");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/trpc/workspace.getAutonomyLevel")
      .then((r) => r.json())
      .then((data) => {
        const val = data?.result?.data?.autonomyLevel;
        if (val) setLevel(val);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const handleChange = async (newLevel: AutonomyLevel) => {
    const prev = level;
    setLevel(newLevel);
    try {
      await fetch("/api/trpc/workspace.setAutonomyLevel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: newLevel }),
      });
    } catch {
      setLevel(prev);
    }
  };

  if (isLoading) return null;

  const current = LEVELS.find((l) => l.value === level) ?? LEVELS[1];

  return (
    <div className="relative group">
      <button
        type="button"
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/50"
        title={current.description}
      >
        <current.icon className="size-3.5" weight="bold" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50">
        <div className="bg-popover/100 border rounded-lg shadow-lg p-1 min-w-[160px] backdrop-blur-none">
          {LEVELS.map((l) => (
            <button
              key={l.value}
              type="button"
              onClick={() => handleChange(l.value)}
              className={`flex items-center gap-2 w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors ${
                l.value === level
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <l.icon className="size-3.5" weight={l.value === level ? "fill" : "regular"} />
              <div>
                <div>{l.label}</div>
                <div className="text-[10px] opacity-60">{l.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
