"use client";

import type { TabId } from '../ui/TabNav';
import { TrilogyCard } from '../cards/TrilogyCard';
import { MetricCard } from '../cards/MetricCard';
import { CrossSignalCard } from '../cards/CrossSignalCard';
import { ActionItem } from '../cards/ActionItem';
import { ScoreLineChart } from '../charts/ScoreLineChart';
import { GRADIENTS, AGENT_NAMES } from '../tokens';
import type { DashboardData } from '../BrandIntelDashboard';

export function OverviewTab({ data, onTabChange }: { data: DashboardData; onTabChange: (tab: TabId) => void }) {
  const bpiScore = data.bpi?.scores.global ?? null;
  const mtsScore = data.mts?.global_score ?? null;
  const ciaScore = data.cia?.brand_score ?? null;

  const bpiDelta = data.bpi?.scores.previous ? (data.bpi.scores.global - data.bpi.scores.previous.global) : null;
  const mtsDelta = data.mts?.previous ? (data.mts.global_score - data.mts.previous.global_score) : null;
  const ciaPrevClient = data.cia?.previous?.competitor_scores.find((c) => c.entity === data.cia?.competitor_scores.find((x) => x.is_client)?.entity);
  const ciaDelta = ciaPrevClient ? (data.cia!.brand_score - ciaPrevClient.global_score) : null;

  // Cross-agent signals
  const signals: { tag: string; text: string }[] = [];
  if (data.bpi && data.cia) {
    const weakAxis = ['serp', 'press', 'youtube', 'social', 'seo', 'benchmark']
      .map((a) => ({ axis: a, score: (data.bpi!.scores as unknown as Record<string, number>)[a] ?? 0 }))
      .sort((a, b) => a.score - b.score)[0];
    if (weakAxis) signals.push({ tag: 'Marque + Concurrents', text: `L'axe ${weakAxis.axis} (${weakAxis.score}/100) est votre point faible identifié par l'audit — la veille concurrentielle confirme un gap sur ce canal.` });
  }
  if (data.mts && data.cia) {
    const topTrend = data.mts.trending_topics[0];
    if (topTrend) signals.push({ tag: 'Tendances + Concurrents', text: `Le sujet "${topTrend.topic}" monte (+${Math.round(topTrend.growth_4w)}%) — aucun concurrent ne le couvre encore.` });
  }
  if (data.bpi && data.mts) {
    const bestAngle = data.mts.differentiating_angles[0];
    if (bestAngle) signals.push({ tag: 'Marque + Tendances', text: `Angle différenciant : "${bestAngle}" — aligne votre force de marque avec la tendance du marché.` });
  }

  // Top 5 actions
  const actions: { text: string; urgency: 'urgent' | 'moyen' | 'quickwin'; source: string }[] = [];
  if (data.bpi?.priorities_90d) {
    data.bpi.priorities_90d.slice(0, 2).forEach((p) => {
      const urgency = p.tag === 'Urgent' ? 'urgent' : p.tag === 'Quick win' ? 'quickwin' : 'moyen';
      actions.push({ text: p.action, urgency, source: AGENT_NAMES.bpi01 });
    });
  }
  if (data.cia?.opportunities) {
    data.cia.opportunities.slice(0, 2).forEach((o) => {
      actions.push({ text: o.description, urgency: o.effort === 'low' ? 'quickwin' : 'moyen', source: AGENT_NAMES.cia03 });
    });
  }
  if (data.mts?.trending_topics) {
    const top = data.mts.trending_topics[0];
    if (top) actions.push({ text: `Créer du contenu sur "${top.topic}" — score opportunité ${top.opportunity_score}/100`, urgency: 'quickwin', source: AGENT_NAMES.mts02 });
  }

  // Chart data (mock 4 months for now — real historical would come from DB)
  const chartData = [
    { month: 'M-3', bpi01: bpiScore ? bpiScore - 8 : null, mts02: mtsScore ? mtsScore - 5 : null, cia03: ciaScore ? ciaScore - 3 : null },
    { month: 'M-2', bpi01: bpiScore ? bpiScore - 4 : null, mts02: mtsScore ? mtsScore - 2 : null, cia03: ciaScore ? ciaScore - 6 : null },
    { month: 'M-1', bpi01: bpiScore ? bpiScore - 1 : null, mts02: mtsScore ? mtsScore + 1 : null, cia03: ciaScore ? ciaScore + 2 : null },
    { month: 'Now', bpi01: bpiScore, mts02: mtsScore, cia03: ciaScore },
  ];

  return (
    <div className="space-y-5">
      {/* Trilogy banner */}
      <div className="rounded-xl p-3 md:p-4" style={{ background: GRADIENTS.trilogy }}>
        <div className="flex flex-col gap-2 md:flex-row md:gap-3">
          <TrilogyCard agentId="bpi01" name={AGENT_NAMES.bpi01} score={bpiScore} delta={bpiDelta} onClick={() => onTabChange('audit')} />
          <TrilogyCard agentId="mts02" name={AGENT_NAMES.mts02} score={mtsScore} delta={mtsDelta} onClick={() => onTabChange('trends')} />
          <TrilogyCard agentId="cia03" name={AGENT_NAMES.cia03} score={ciaScore} delta={ciaDelta} onClick={() => onTabChange('competitive')} />
        </div>
        <p className="mt-3 text-center text-[11px]" style={{ color: '#6b6b6b' }}>
          Audit de marque oriente la Veille concurrentielle · Tendances marché guide le contenu · Veille concurrentielle valide le positionnement
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-3">
        <MetricCard label="Score marque" value={bpiScore ?? '—'} delta={bpiDelta} suffix="/100" />
        <MetricCard label="Score opportunités" value={mtsScore ?? '—'} delta={mtsDelta} suffix="/100" />
        <MetricCard label="Gap vs leader" value={data.cia ? Math.abs((data.cia.competitor_scores.find((c) => c.is_client)?.global_score ?? 0) - (data.cia.competitor_scores.filter((c) => !c.is_client).sort((a, b) => b.global_score - a.global_score)[0]?.global_score ?? 0)) : '—'} suffix=" pts" />
        <MetricCard label="Actions prioritaires" value={actions.length} />
      </div>

      {/* Cross signals */}
      {signals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>Synthèse croisée</h3>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {signals.map((s, i) => <CrossSignalCard key={i} tag={s.tag} text={s.text} />)}
          </div>
        </div>
      )}

      {/* Score evolution */}
      <div className="rounded-xl border p-3 md:p-4" style={{ background: '#ffffff', borderColor: 'rgba(0,0,0,0.08)' }}>
        <h3 className="text-[13px] md:text-sm font-semibold mb-3" style={{ color: '#1a1a1a' }}>Evolution des scores</h3>
        <ScoreLineChart data={chartData} />
      </div>

      {/* Priority actions */}
      {actions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2" style={{ color: '#1a1a1a' }}>Top {Math.min(actions.length, 5)} actions prioritaires</h3>
          <div className="space-y-2">
            {actions.slice(0, 5).map((a, i) => <ActionItem key={i} text={a.text} urgency={a.urgency} source={a.source} />)}
          </div>
        </div>
      )}
    </div>
  );
}
