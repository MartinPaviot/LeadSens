"use client";

import { useState } from 'react';
import { Download, Loader2, Check } from 'lucide-react';
import type { InfluencerProfile, CampaignBrief } from '../types';
import { InfluencerCard } from './InfluencerCard';
import { DetailPanel } from './DetailPanel';
import { BriefChips } from './BriefChips';
import { downloadCSV } from '../core/export';

interface InfluencerListProps {
  influencers: InfluencerProfile[];
  allInfluencers: InfluencerProfile[];
  isSearching: boolean;
  selected: InfluencerProfile | null;
  selectedId: string | null;
  filter: 'all' | 'micro' | 'macro';
  brief: Partial<CampaignBrief>;
  isGeneratingBrief?: boolean;
  onSelect: (id: string | null) => void;
  onFilterChange: (f: 'all' | 'micro' | 'macro') => void;
  onGenerateBrief?: (profile: InfluencerProfile) => Promise<string | null>;
}

const FILTERS: { value: 'all' | 'micro' | 'macro'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'micro', label: 'Micro' },
  { value: 'macro', label: 'Macro' },
];

export function InfluencerList({
  influencers, allInfluencers, isSearching, selected, selectedId, filter, brief, isGeneratingBrief, onSelect, onFilterChange, onGenerateBrief,
}: InfluencerListProps) {
  const [exported, setExported] = useState(false);
  if (isSearching) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 size={28} className="animate-spin" style={{ color: '#17C3B2' }} />
          <p className="text-sm">Searching for influencers...</p>
        </div>
      </div>
    );
  }

  if (influencers.length === 0 && allInfluencers.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Brief chips top bar even when empty */}
        <BriefChips brief={brief} />
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'rgba(23,195,178,0.1)' }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#17C3B2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">No results yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Complete the campaign brief in the chat to start searching</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      {/* Brief recap top bar */}
      <BriefChips brief={brief} />

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-foreground">Qualified influencers</h2>
            <span
              className="flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white"
              style={{ background: '#17C3B2' }}
            >
              {influencers.length}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                style={filter === f.value
                  ? { background: '#17C3B2', color: '#fff' }
                  : { background: 'var(--muted)', color: 'var(--muted-foreground)' }
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => {
            downloadCSV(influencers, brief);
            setExported(true);
            setTimeout(() => setExported(false), 2000);
          }}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--elevay-gradient-btn)' }}
        >
          {exported ? <Check size={12} /> : <Download size={12} />}
          {exported ? 'Exported' : 'Export'}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {influencers.map((profile) => (
          <InfluencerCard
            key={profile.id}
            profile={profile}
            selected={selectedId === profile.id}
            onClick={() => onSelect(selectedId === profile.id ? null : profile.id)}
          />
        ))}
      </div>

      {/* Detail panel */}
      {selected && onGenerateBrief && (
        <DetailPanel
          profile={selected}
          brief={brief}
          isGeneratingBrief={isGeneratingBrief ?? false}
          onGenerateBrief={onGenerateBrief}
          onClose={() => onSelect(null)}
        />
      )}
    </div>
  );
}
