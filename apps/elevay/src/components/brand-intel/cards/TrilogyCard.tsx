"use client";

import { DeltaBadge } from '../ui/DeltaBadge';
import { scoreColor, AGENT_COLORS } from '../tokens';

type AgentId = 'bpi01' | 'mts02' | 'cia03';

export function TrilogyCard({ agentId, name, score, delta, onClick }: {
  agentId: AgentId;
  name: string;
  score: number | null;
  delta?: number | null;
  onClick: () => void;
}) {
  const accentColor = AGENT_COLORS[agentId];
  const barColor = score != null ? scoreColor(score) : 'rgba(0,0,0,0.1)';

  return (
    <button
      onClick={onClick}
      className="flex-1 rounded-xl border p-4 text-left transition-all hover:shadow-sm"
      style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2 w-2 rounded-full" style={{ background: accentColor }} />
        <p className="text-[12px] font-medium" style={{ color: '#6b6b6b' }}>{name}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold" style={{ color: score != null ? scoreColor(score) : '#ccc' }}>
          {score ?? '—'}
        </span>
        <span className="text-[11px]" style={{ color: '#6b6b6b' }}>/100</span>
        <DeltaBadge delta={delta} />
      </div>
      <div className="mt-2 h-1.5 w-full rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${score ?? 0}%`, background: barColor }} />
      </div>
    </button>
  );
}
