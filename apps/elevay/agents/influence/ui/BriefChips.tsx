"use client";

import type { CampaignBrief } from '../types';

interface BriefChipsProps {
  brief: Partial<CampaignBrief>;
}

export function BriefChips({ brief }: BriefChipsProps) {
  const chips: string[] = [];
  if (brief.objective) chips.push(brief.objective);
  if (brief.sector) chips.push(brief.sector);
  if (brief.geography) chips.push(brief.geography);
  if (brief.platforms?.length) chips.push(brief.platforms.join(', '));
  if (brief.budgetMax) chips.push(`${brief.budgetMin ?? 0}–${brief.budgetMax}€`);
  if (brief.priority) chips.push(brief.priority);
  if (brief.profileType) chips.push(brief.profileType);

  if (chips.length === 0) return null;

  // matched to left nav header: 41px
  return (
    <div className="flex items-center gap-2 border-b border-border px-3" style={{ height: '48px', minHeight: '48px' }}>
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active brief</span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip}
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: 'rgba(23,195,178,0.1)', color: '#17C3B2' }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}
