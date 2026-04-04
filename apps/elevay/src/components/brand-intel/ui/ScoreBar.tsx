"use client";

import { scoreColor } from '../tokens';

export function ScoreBar({ score, label, delta }: { score: number; label: string; delta?: number | null }) {
  const color = scoreColor(score);
  const deltaColor = delta && delta > 0 ? '#17c3b2' : delta && delta < 0 ? '#E24B4A' : '#6b6b6b';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[12px]">
        <span style={{ color: '#1a1a1a' }}>{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="font-semibold" style={{ color }}>{score}</span>
          {delta != null && <span className="text-[10px]" style={{ color: deltaColor }}>{delta > 0 ? '+' : ''}{delta}</span>}
        </div>
      </div>
      <div className="h-2 w-full rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(score, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
