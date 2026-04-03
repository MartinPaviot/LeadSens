"use client";

import type { InfluencerProfile } from '../types';
import { PLATFORM_COLORS, getScoreLabel } from '../config';
import { ScoreRing } from './ScoreRing';

interface InfluencerCardProps {
  profile: InfluencerProfile;
  selected: boolean;
  onClick: () => void;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function nameColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 55%)`;
}

const TYPE_BADGE = {
  micro: { bg: 'rgba(23,195,178,0.1)', color: '#17C3B2', label: 'Micro' },
  macro: { bg: 'rgba(55,138,221,0.1)', color: '#378ADD', label: 'Macro' },
  mix: { bg: 'rgba(239,159,39,0.1)', color: '#EF9F27', label: 'Mix' },
};

export function InfluencerCard({ profile, selected, onClick }: InfluencerCardProps) {
  const initials = profile.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const label = getScoreLabel(profile.score.total);
  const typeBadge = TYPE_BADGE[profile.type];

  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:shadow-sm"
      style={{ borderColor: selected ? '#17C3B2' : undefined, borderWidth: selected ? '1.5px' : undefined }}
    >
      {/* Avatar */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: nameColor(profile.name) }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{profile.name}</p>
          <span className="text-[10px] text-muted-foreground">{profile.handle}</span>
          <span
            className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ backgroundColor: typeBadge.bg, color: typeBadge.color }}
          >
            {typeBadge.label}
          </span>
        </div>

        {/* Platform pills + niche */}
        <div className="mt-1 flex items-center gap-1.5">
          {profile.platforms.map((p) => {
            const cfg = PLATFORM_COLORS[p];
            return (
              <span
                key={p}
                className="rounded px-1.5 py-0.5 text-[9px] font-bold"
                style={{ backgroundColor: cfg?.bg ?? '#888', color: cfg?.text ?? '#fff' }}
              >
                {cfg?.label ?? p}
              </span>
            );
          })}
          <span className="text-[10px] text-muted-foreground">{profile.niche}</span>
        </div>

        {/* 3 stat boxes */}
        <div className="mt-2 flex gap-2">
          <StatBox label="Followers" value={formatFollowers(profile.followers)} />
          <StatBox label="Engagement" value={`${profile.engagementRate}%`} />
          <StatBox label="Budget" value={`${profile.estimatedBudgetMin}–${profile.estimatedBudgetMax}€`} />
        </div>
      </div>

      {/* Score ring */}
      <div className="flex flex-col items-center gap-0.5 pt-1">
        <ScoreRing score={profile.score.total} />
        <span className="text-[9px] text-muted-foreground">{label}</span>
      </div>
    </button>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/30 px-2 py-1">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-[11px] font-semibold text-foreground">{value}</p>
    </div>
  );
}
