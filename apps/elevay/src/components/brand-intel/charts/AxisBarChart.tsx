"use client";

import { scoreColor } from '../tokens';
import { DeltaBadge } from '../ui/DeltaBadge';

interface AxisData { label: string; score: number; delta?: number | null }

export function AxisBarChart({ axes }: { axes: AxisData[] }) {
  return (
    <div className="space-y-2.5">
      {axes.map((axis) => (
        <div key={axis.label}>
          <div className="flex items-center justify-between text-[12px] mb-0.5">
            <span style={{ color: '#1a1a1a' }}>{axis.label}</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold" style={{ color: scoreColor(axis.score) }}>{axis.score}/100</span>
              <DeltaBadge delta={axis.delta} />
            </div>
          </div>
          <div className="h-3 w-full rounded-full" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${axis.score}%`, background: scoreColor(axis.score) }} />
          </div>
        </div>
      ))}
    </div>
  );
}
