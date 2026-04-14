'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { Badge } from '@/components/ui-brand-intel/badge'
import { getScoreColorClass, getScoreBg, ZONE_TOKENS } from '../tokens'
import type {
  CiaOutput,
  CompetitorScore,
  StrategicZone,
  Threat,
  Opportunity,
  ActionPhase,
} from '@/agents/cia-03/types'

interface CompetitiveTabProps {
  output: CiaOutput
}

const LEVEL_STYLES: Record<CompetitorScore['level'], string> = {
  dominant: 'bg-red-100 text-red-800',
  strong: 'bg-orange-100 text-orange-800',
  competitive: 'bg-blue-100 text-blue-800',
  weak: 'bg-gray-100 text-gray-700',
  vulnerable: 'bg-green-100 text-green-800',
}

const LEVEL_LABELS: Record<CompetitorScore['level'], string> = {
  dominant: 'Dominant',
  strong: 'Strong',
  competitive: 'Competitive',
  weak: 'Weak',
  vulnerable: 'Vulnerable',
}

const URGENCY_STYLES: Record<Threat['urgency'], string> = {
  high: 'bg-red-100 text-red-800 border-red-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  low: 'bg-gray-100 text-gray-700 border-gray-200',
}

const URGENCY_LABELS: Record<Threat['urgency'], string> = {
  high: 'Urgent',
  medium: 'Medium',
  low: 'Low',
}

const EFFORT_STYLES: Record<Opportunity['effort'], string> = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-orange-100 text-orange-800',
  high: 'bg-red-100 text-red-800',
}

function DimensionBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-1" title={`${label}: ${value}/100`}>
      <span className="w-8 sm:w-10 text-[10px] sm:text-xs text-muted-foreground text-right">{label}</span>
      <div className="h-1.5 sm:h-2 w-12 sm:w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${getScoreBg(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-5 sm:w-6 text-[10px] sm:text-xs font-medium text-right">{value}</span>
    </div>
  )
}

function BrandScoreVsField({ output }: { output: CiaOutput }) {
  const brand = output.competitor_scores.find((s) => s.is_client)
  const competitors = output.competitor_scores.filter((s) => !s.is_client)
  const avgCompScore =
    competitors.length > 0
      ? Math.round(competitors.reduce((s, c) => s + c.global_score, 0) / competitors.length)
      : 0

  const delta = output.previous
    ? output.brand_score - output.previous.brand_score
    : null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Brand Score vs Competitors</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <span className={`text-4xl sm:text-5xl font-bold ${getScoreColorClass(output.brand_score)}`}>
              {output.brand_score}
              <span className="text-xl sm:text-2xl text-muted-foreground">/100</span>
            </span>
            <p className="text-sm text-muted-foreground mt-1">
              {brand?.level ? LEVEL_LABELS[brand.level] : ''}
            </p>
            {delta !== null && (
              <p className={`text-sm font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                {delta >= 0 ? '+' : ''}{delta} vs previous run
              </p>
            )}
          </div>
          <div className="text-center">
            <span className="text-3xl font-semibold text-muted-foreground">
              {avgCompScore}
              <span className="text-lg">/100</span>
            </span>
            <p className="text-xs text-muted-foreground">Competitor average</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function CompetitorScoreboard({ scores }: { scores: CompetitorScore[] }) {
  const sorted = [...scores].sort((a, b) => b.global_score - a.global_score)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Competitive Ranking</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitors analyzed.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((s, i) => (
              <div
                key={s.entity}
                className={`rounded-lg border p-3 ${s.is_client ? 'border-blue-300 bg-blue-50/50' : 'bg-card'}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground w-5">
                      #{i + 1}
                    </span>
                    <span className="font-medium text-sm">
                      {s.entity}
                      {s.is_client && (
                        <span className="ml-1.5 text-xs text-blue-600">(you)</span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={LEVEL_STYLES[s.level]} variant="outline">
                      {LEVEL_LABELS[s.level]}
                    </Badge>
                    <span className={`text-lg font-bold ${getScoreColorClass(s.global_score)}`}>
                      {s.global_score}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <DimensionBar value={s.seo_score} label="SEO" />
                  <DimensionBar value={s.product_score} label="Prod" />
                  <DimensionBar value={s.social_score} label="Social" />
                  <DimensionBar value={s.content_score} label="Content" />
                  <DimensionBar value={s.positioning_score} label="Posit." />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StrategicZonesMatrix({ zones }: { zones: StrategicZone[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Strategic Zones</CardTitle>
      </CardHeader>
      <CardContent>
        {zones.length === 0 ? (
          <p className="text-sm text-muted-foreground">No zones calculated.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {zones.map((z) => {
              const token = ZONE_TOKENS[z.zone]
              return (
                <div
                  key={z.axis}
                  className={`rounded-lg border p-3 ${token.bg}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold uppercase">{z.axis}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${token.text}`}>
                      {token.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug mb-1">
                    {z.description}
                  </p>
                  <p className={`text-xs font-medium leading-snug ${token.text}`}>
                    {z.directive}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ThreatsVsOpportunities({
  threats,
  opportunities,
}: {
  threats: Threat[]
  opportunities: Opportunity[]
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Threats &amp; Opportunities</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Threats */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-red-700 uppercase tracking-wide">
              Threats
            </h3>
            {threats.length === 0 ? (
              <p className="text-xs text-muted-foreground">No threats detected.</p>
            ) : (
              threats.map((t, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 ${URGENCY_STYLES[t.urgency]}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <Badge className={URGENCY_STYLES[t.urgency]} variant="outline">
                      {URGENCY_LABELS[t.urgency]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{t.source}</span>
                  </div>
                  <p className="text-xs leading-snug">{t.description}</p>
                </div>
              ))
            )}
          </div>

          {/* Opportunities */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide">
              Opportunities
            </h3>
            {opportunities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No opportunities detected.</p>
            ) : (
              opportunities.map((o, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
                  <p className="text-xs leading-snug font-medium">{o.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge className={EFFORT_STYLES[o.effort]} variant="outline">
                      Effort: {o.effort}
                    </Badge>
                    <Badge variant="outline">
                      Impact: {o.impact}
                    </Badge>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {o.timeframe}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function ActionPlan60d({ phases }: { phases: ActionPhase[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>60-Day Action Plan</CardTitle>
      </CardHeader>
      <CardContent>
        {phases.length === 0 ? (
          <p className="text-sm text-muted-foreground">No action plan generated.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {phases.map((phase) => (
              <div key={phase.phase} className="space-y-2">
                <div>
                  <h3 className="text-sm font-bold">{phase.label}</h3>
                  <p className="text-xs text-muted-foreground">{phase.objective}</p>
                </div>
                <ol className="space-y-1.5">
                  {phase.actions.map((action, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="mt-0.5 shrink-0 rounded-full bg-muted w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{action}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CompetitiveTab({ output }: CompetitiveTabProps) {
  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      <BrandScoreVsField output={output} />
      <CompetitorScoreboard scores={output.competitor_scores} />
      <StrategicZonesMatrix zones={output.strategic_zones} />
      <ThreatsVsOpportunities
        threats={output.threats}
        opportunities={output.opportunities}
      />
      <ActionPlan60d phases={output.action_plan_60d} />
    </div>
  )
}
