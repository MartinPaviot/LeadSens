"use client";

import { DeltaBadge } from '../ui/DeltaBadge';
import { scoreColor } from '../tokens';

export function MetricCard({ label, value, delta, suffix }: {
  label: string;
  value: number | string;
  delta?: number | null;
  suffix?: string;
}) {
  const numVal = typeof value === 'number' ? value : null;
  const color = numVal != null ? scoreColor(numVal) : '#1a1a1a';

  return (
    <div className="rounded-lg p-2.5 md:p-3" style={{ background: '#FFF7ED' }}>
      <p className="text-[11px] font-medium" style={{ color: '#6b6b6b' }}>{label}</p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-lg md:text-xl font-semibold" style={{ color }}>{value}{suffix}</span>
        <DeltaBadge delta={delta} />
      </div>
    </div>
  );
}
