"use client";

import { MetricCard } from '../cards/MetricCard';
import { ActionItem } from '../cards/ActionItem';
import { AxisBarChart } from '../charts/AxisBarChart';
import { GRADIENTS } from '../tokens';
import type { DashboardData } from '../BrandIntelDashboard';

export function AuditTab({ data }: { data: DashboardData }) {
  const bpi = data.bpi;
  if (!bpi) return <EmptyState />;

  const prev = bpi.scores.previous;
  const getScore = (obj: Record<string, unknown>, key: string) => typeof obj[key] === 'number' ? obj[key] as number : 0;
  const delta = (key: string) => prev ? getScore(bpi.scores as unknown as Record<string, unknown>, key) - getScore(prev as unknown as Record<string, unknown>, key) : null;

  const axes = [
    { label: 'SERP', score: bpi.scores.serp, delta: delta('serp') },
    { label: 'Presse', score: bpi.scores.press, delta: delta('press') },
    { label: 'YouTube', score: bpi.scores.youtube, delta: delta('youtube') },
    { label: 'Réseaux sociaux', score: bpi.scores.social, delta: delta('social') },
    { label: 'SEO organique', score: bpi.scores.seo, delta: delta('seo') },
    { label: 'Benchmark', score: bpi.scores.benchmark, delta: delta('benchmark') },
  ];

  const bestAxis = [...axes].sort((a, b) => b.score - a.score)[0];
  const worstAxis = [...axes].sort((a, b) => a.score - b.score)[0];

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        <MetricCard label="Score global" value={bpi.scores.global} delta={prev ? bpi.scores.global - prev.global : null} suffix="/100" />
        <MetricCard label="Axe le plus fort" value={`${bestAxis.label} (${bestAxis.score})`} />
        <MetricCard label="Axe critique" value={`${worstAxis.label} (${worstAxis.score})`} />
      </div>

      {/* Axis chart */}
      <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <h3 className="text-[13px] md:text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Score par axe</h3>
        <AxisBarChart axes={axes} />
      </div>

      {/* Priority actions */}
      {bpi.priorities_90d.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>Actions prioritaires</h3>
          <div className="space-y-2">
            {bpi.priorities_90d.slice(0, 3).map((p, i) => (
              <ActionItem
                key={i}
                text={p.action}
                urgency={p.tag === 'Urgent' ? 'urgent' : p.tag === 'Quick win' ? 'quickwin' : 'moyen'}
              />
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="w-full md:w-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white"
        style={{ background: GRADIENTS.cta }}
      >
        Détailler les actions ↗
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Aucun audit de marque disponible</p>
      <p className="mt-1 text-[12px]" style={{ color: '#6b6b6b' }}>Lancez votre premier audit pour voir les résultats</p>
    </div>
  );
}
