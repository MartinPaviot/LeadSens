"use client";

import { getScoreColor } from '../config';

interface ScoreRingProps {
  score: number;
  size?: number;
}

export function ScoreRing({ score, size = 42 }: ScoreRingProps) {
  const r = 17;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 42 42" width={size} height={size}>
        <circle cx="21" cy="21" r={r} fill="none" stroke="var(--border)" strokeWidth={3} />
        <circle
          cx="21" cy="21" r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={`${progress} ${circumference - progress}`}
          transform="rotate(-90 21 21)"
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center text-[11px] font-medium"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  );
}
