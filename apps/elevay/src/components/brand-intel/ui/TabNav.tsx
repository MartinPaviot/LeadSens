"use client";

import { useRef, useEffect } from 'react';
import { GRADIENTS } from '../tokens';

export type TabId = 'overview' | 'audit' | 'trends' | 'competitive';

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'audit', label: 'Brand Audit' },
  { id: 'trends', label: 'Market Trends' },
  { id: 'competitive', label: 'Competitive Intelligence' },
];

export function TabNav({ active, onChange }: { active: TabId; onChange: (id: TabId) => void }) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [active]);

  return (
    <nav
      className="flex gap-1 border-b overflow-x-auto scrollbar-none"
      style={{ borderColor: 'rgba(0,0,0,0.08)', WebkitOverflowScrolling: 'touch' }}
    >
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={isActive ? activeRef : undefined}
            onClick={() => onChange(tab.id)}
            className="relative shrink-0 px-3 py-2.5 text-xs md:text-sm transition-colors md:px-4"
            style={{ fontWeight: isActive ? 600 : 400, color: isActive ? '#1a1a1a' : '#6b6b6b', minHeight: 44 }}
          >
            {tab.label}
            {isActive && (
              <div className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full" style={{ background: GRADIENTS.cta }} />
            )}
          </button>
        );
      })}
    </nav>
  );
}
