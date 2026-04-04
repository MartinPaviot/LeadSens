"use client";

import { AGENT_COLORS, AGENT_NAMES } from '../tokens';

interface DataPoint { month: string; bpi01: number | null; mts02: number | null; cia03: number | null }

export function ScoreLineChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return <p className="text-sm text-center py-8" style={{ color: '#6b6b6b' }}>No historical data yet</p>;

  const W = 500, H = 200, PX = 40, PY = 20;
  const plotW = W - PX * 2, plotH = H - PY * 2;
  const maxScore = 100;

  function x(i: number) { return PX + (i / Math.max(data.length - 1, 1)) * plotW; }
  function y(v: number) { return PY + plotH - (v / maxScore) * plotH; }

  function line(key: 'bpi01' | 'mts02' | 'cia03'): string {
    const points = data.map((d, i) => d[key] != null ? `${x(i)},${y(d[key]!)}` : null).filter(Boolean);
    return points.join(' ');
  }

  const agents: { key: 'bpi01' | 'mts02' | 'cia03'; name: string; color: string }[] = [
    { key: 'bpi01', name: AGENT_NAMES.bpi01, color: AGENT_COLORS.bpi01 },
    { key: 'mts02', name: AGENT_NAMES.mts02, color: AGENT_COLORS.mts02 },
    { key: 'cia03', name: AGENT_NAMES.cia03, color: AGENT_COLORS.cia03 },
  ];

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-2">
        {agents.map((a) => (
          <div key={a.key} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: a.color }} />
            <span className="text-[11px]" style={{ color: '#6b6b6b' }}>{a.name}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 200 }}>
        {/* Grid */}
        {[0, 25, 50, 75, 100].map((v) => (
          <g key={v}>
            <line x1={PX} y1={y(v)} x2={W - PX} y2={y(v)} stroke="rgba(0,0,0,0.06)" strokeWidth={1} />
            <text x={PX - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="#6b6b6b">{v}</text>
          </g>
        ))}
        {/* X labels */}
        {data.map((d, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize={10} fill="#6b6b6b">{d.month}</text>
        ))}
        {/* Lines */}
        {agents.map((a) => (
          <polyline key={a.key} fill="none" stroke={a.color} strokeWidth={2} strokeLinejoin="round" points={line(a.key)} />
        ))}
        {/* Dots */}
        {agents.map((a) =>
          data.map((d, i) => d[a.key] != null ? (
            <circle key={`${a.key}-${i}`} cx={x(i)} cy={y(d[a.key]!)} r={3} fill={a.color} />
          ) : null),
        )}
      </svg>
    </div>
  );
}
