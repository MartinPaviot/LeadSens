"use client";

import { URGENCY } from '../tokens';

type UrgencyLevel = 'urgent' | 'moyen' | 'quickwin';

export function UrgencyTag({ level }: { level: UrgencyLevel }) {
  const cfg = URGENCY[level];
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}
