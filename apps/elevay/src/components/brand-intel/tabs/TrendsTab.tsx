"use client";

import { MetricCard } from '../cards/MetricCard';
import { COLORS } from '../tokens';
import type { DashboardData } from '../BrandIntelDashboard';

export function TrendsTab({ data }: { data: DashboardData }) {
  const mts = data.mts;
  if (!mts) return <EmptyState />;

  const rising = mts.trending_topics.filter((t) => t.classification !== 'weak_signal');
  const saturated = mts.saturated_topics;
  const prev = mts.previous;

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        <MetricCard label="Score opportunité" value={mts.global_score} delta={prev ? mts.global_score - prev.global_score : null} suffix="/100" />
        <MetricCard label="Sujets en montée" value={rising.length} />
        <MetricCard label="Sujets saturés" value={saturated.length} />
      </div>

      {/* Signals list */}
      <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Signaux marché</h3>
        <div className="space-y-1.5">
          {rising.slice(0, 8).map((t) => (
            <div key={t.topic} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#E6F9F5' }}>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#17c3b2', color: '#fff' }}>+{Math.round(t.growth_4w)}%</span>
              <span className="flex-1 text-sm" style={{ color: '#1a1a1a' }}>{t.topic}</span>
              <span className="text-[11px] font-medium" style={{ color: COLORS.teal }}>Ouvert</span>
              <span className="text-[11px]" style={{ color: '#6b6b6b' }}>{t.opportunity_score}/100</span>
            </div>
          ))}
          {saturated.slice(0, 5).map((s) => (
            <div key={s.topic} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: '#FFECE8' }}>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: '#E24B4A', color: '#fff' }}>Saturé</span>
              <span className="flex-1 text-sm line-through" style={{ color: '#6b6b6b' }}>{s.topic}</span>
              <span className="text-[11px]" style={{ color: '#C0390E' }}>Éviter</span>
            </div>
          ))}
        </div>
      </div>

      {/* 30-day roadmap */}
      {mts.roadmap_30d.length > 0 && (
        <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Roadmap contenu 30 jours</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((week) => {
              const entries = mts.roadmap_30d.filter((e) => e.week === week);
              if (entries.length === 0) return null;
              return (
                <div key={week}>
                  <p className="text-[11px] font-semibold uppercase mb-1" style={{ color: '#6b6b6b' }}>S{week}</p>
                  <div className="space-y-1">
                    {entries.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px]">
                        <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(23,195,178,0.1)', color: '#17c3b2' }}>{e.canal}</span>
                        <span style={{ color: '#1a1a1a' }}>{e.suggested_title}</span>
                        <span className="text-[10px]" style={{ color: '#6b6b6b' }}>{e.format}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Aucune analyse de tendances disponible</p>
      <p className="mt-1 text-[12px]" style={{ color: '#6b6b6b' }}>Lancez votre première analyse pour voir les résultats</p>
    </div>
  );
}
