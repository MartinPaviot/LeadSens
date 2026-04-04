"use client";

import { MetricCard } from '../cards/MetricCard';
import { ActionItem } from '../cards/ActionItem';
import { ScoreBar } from '../ui/ScoreBar';
import { GRADIENTS, COLORS } from '../tokens';
import type { DashboardData } from '../BrandIntelDashboard';

export function CompetitiveTab({ data }: { data: DashboardData }) {
  const cia = data.cia;
  if (!cia) return <EmptyState />;

  const client = cia.competitor_scores.find((c) => c.is_client);
  const competitors = cia.competitor_scores.filter((c) => !c.is_client).sort((a, b) => b.global_score - a.global_score);
  const greenZones = cia.strategic_zones.filter((z) => z.zone === 'green');
  const redZones = cia.strategic_zones.filter((z) => z.zone === 'red');
  const prev = cia.previous;
  const prevClient = prev?.competitor_scores.find((c) => c.entity === client?.entity);

  return (
    <div className="space-y-5">
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
        <MetricCard label="Compétitivité" value={cia.brand_score} delta={prevClient ? client!.global_score - prevClient.global_score : null} suffix="/100" />
        <MetricCard label="Zones vertes" value={greenZones.length} />
        <MetricCard label="Zones rouges" value={redZones.length} />
      </div>

      {/* Competitor ranking */}
      <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Classement concurrentiel</h3>
        <div className="space-y-2">
          {client && <ScoreBar label={`${client.entity} (vous)`} score={client.global_score} delta={prevClient ? client.global_score - prevClient.global_score : null} />}
          {competitors.map((c) => {
            const prevC = prev?.competitor_scores.find((p) => p.entity === c.entity);
            return <ScoreBar key={c.entity} label={c.entity} score={c.global_score} delta={prevC ? c.global_score - prevC.global_score : null} />;
          })}
        </div>
      </div>

      {/* Strategic zones */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2 md:gap-3">
        <div className="rounded-xl border p-3" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <h4 className="text-[11px] font-semibold uppercase mb-2" style={{ color: '#E24B4A' }}>Zones rouges</h4>
          {redZones.length > 0 ? redZones.map((z) => (
            <p key={z.axis} className="text-[12px] mb-1" style={{ color: '#1a1a1a' }}>{z.axis} — <span style={{ color: '#6b6b6b' }}>{z.description}</span></p>
          )) : <p className="text-[12px]" style={{ color: '#6b6b6b' }}>Aucune zone rouge</p>}
        </div>
        <div className="rounded-xl border p-3" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <h4 className="text-[11px] font-semibold uppercase mb-2" style={{ color: COLORS.teal }}>Zones vertes</h4>
          {greenZones.length > 0 ? greenZones.map((z) => (
            <p key={z.axis} className="text-[12px] mb-1" style={{ color: '#1a1a1a' }}>{z.axis} — <span style={{ color: '#6b6b6b' }}>{z.description}</span></p>
          )) : <p className="text-[12px]" style={{ color: '#6b6b6b' }}>Aucune zone verte</p>}
        </div>
      </div>

      {/* 60-day action plan */}
      {cia.action_plan_60d.length > 0 && (
        <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Plan d&apos;action 60 jours</h3>
          <div className="space-y-3">
            {cia.action_plan_60d.map((phase, i) => (
              <div key={i} className="rounded-lg border-l-[3px] pl-3 py-1" style={{ borderColor: phase.phase === 1 ? COLORS.teal : COLORS.orange }}>
                <p className="text-[11px] font-semibold mb-1" style={{ color: phase.phase === 1 ? COLORS.teal : COLORS.orange }}>
                  Phase {phase.phase} — {phase.label}
                </p>
                <p className="text-[12px]" style={{ color: '#6b6b6b' }}>{phase.objective}</p>
                <div className="mt-1 space-y-0.5">
                  {phase.actions.map((a, j) => (
                    <p key={j} className="text-[12px]" style={{ color: '#1a1a1a' }}>• {a}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <button
        className="w-full md:w-auto rounded-lg px-4 py-2.5 text-sm font-medium text-white"
        style={{ background: GRADIENTS.cta }}
      >
        Générer le plan hebdomadaire détaillé ↗
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium" style={{ color: '#1a1a1a' }}>Aucune veille concurrentielle disponible</p>
      <p className="mt-1 text-[12px]" style={{ color: '#6b6b6b' }}>Lancez votre première analyse pour voir les résultats</p>
    </div>
  );
}
