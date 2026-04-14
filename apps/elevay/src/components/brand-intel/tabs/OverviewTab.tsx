'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { Badge } from '@/components/ui-brand-intel/badge'
import { getScoreColorClass, AGENT_TOKENS } from '../tokens'
import type { AgentOutput } from '@/agents/_shared/types'
import type { BpiOutput } from '@/agents/bpi-01/types'
import type { MtsOutput } from '@/agents/mts-02/types'
import type { CiaOutput } from '@/agents/cia-03/types'

/** Normalize any residual French from agent outputs */
function normalizeText(text: string): string {
  return text
    .replace(/Capitaliser sur/gi, 'Capitalize on')
    .replace(/Investir massivement/gi, 'Invest heavily in')
    .replace(/Contenu autour de\s+"([^"]+)"/gi, 'Create content around "$1"')
    .replace(/Approche\s+(\S+)\s+sur\s+"([^"]+)"/gi, 'Leverage "$2" keyword opportunity')
    .replace(/concurrent\(s\)/gi, 'competitor(s)')
    .replace(/(\d+)-(\d+)\s*mois/gi, '$1-$2 months')
}

interface OverviewTabProps {
  runs: {
    bpi: AgentOutput<BpiOutput> | null
    mts: AgentOutput<MtsOutput> | null
    cia: AgentOutput<CiaOutput> | null
  }
}

interface CrossSignal {
  type: 'danger' | 'opportunity' | 'action'
  message: string
}

const SIGNAL_STYLES: Record<CrossSignal['type'], string> = {
  danger: 'bg-red-100 text-red-800 border-red-200',
  opportunity: 'bg-green-100 text-green-800 border-green-200',
  action: 'bg-blue-100 text-blue-800 border-blue-200',
}

const SIGNAL_LABELS: Record<CrossSignal['type'], string> = {
  danger: 'Danger',
  opportunity: 'Opportunity',
  action: 'Action',
}

function detectCrossSignals(runs: OverviewTabProps['runs']): CrossSignal[] {
  const signals: (CrossSignal | null)[] = [
    // BPI + CIA: social faible + zone rouge
    runs.bpi && runs.cia &&
    runs.bpi.payload.scores.social < 40 &&
    runs.cia.payload.strategic_zones.find((z) => z.axis === 'social' && z.zone === 'red')
      ? { type: 'danger', message: 'Social: weak presence + competitive red zone — urgent action needed' }
      : null,

    // MTS + CIA: strong_trend + content green
    runs.mts && runs.cia &&
    runs.mts.payload.trending_topics.some((t) => t.classification === 'strong_trend') &&
    runs.cia.payload.strategic_zones.find((z) => z.axis === 'content' && z.zone === 'green')
      ? { type: 'opportunity', message: 'Strong trend + green content zone — opportunity window open' }
      : null,

    // BPI + MTS: SEO fort + content gaps
    runs.bpi && runs.mts &&
    runs.bpi.payload.scores.seo > 70 &&
    runs.mts.payload.content_gap_map.length > 0
      ? { type: 'action', message: 'Strong SEO + content gaps identified — leverage existing authority' }
      : null,
  ]

  return signals.filter((s): s is CrossSignal => s !== null)
}

export function OverviewTab({ runs }: OverviewTabProps) {
  const crossSignals = detectCrossSignals(runs)

  // Top 3 actions — one from each agent
  const topActions: string[] = []
  if (runs.bpi?.payload.priorities_90d[0]) {
    topActions.push(normalizeText(runs.bpi.payload.priorities_90d[0].action))
  }
  if (runs.mts?.payload.trending_topics[0]) {
    topActions.push(normalizeText(runs.mts.payload.trending_topics[0].suggested_angle))
  }
  if (runs.cia?.payload.opportunities[0]) {
    topActions.push(normalizeText(runs.cia.payload.opportunities[0].description))
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Trilogy Card */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        {/* BPI Card */}
        <Card className={runs.bpi ? '' : 'opacity-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AGENT_TOKENS['BPI-01'].dot }} />
              {AGENT_TOKENS['BPI-01'].label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.bpi ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl sm:text-4xl font-bold ${getScoreColorClass(runs.bpi.payload.scores.global)}`}>
                    {runs.bpi.payload.scores.global}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                {runs.bpi.payload.scores.previous && (
                  <p className={`text-xs font-semibold mt-1 ${runs.bpi.payload.scores.global - runs.bpi.payload.scores.previous.global >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {runs.bpi.payload.scores.global - runs.bpi.payload.scores.previous.global >= 0 ? '+' : ''}
                    {runs.bpi.payload.scores.global - runs.bpi.payload.scores.previous.global} vs previous
                  </p>
                )}
                {runs.bpi.payload.priorities_90d[0] && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    Top priority: {normalizeText(runs.bpi.payload.priorities_90d[0].action)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not run yet</p>
            )}
          </CardContent>
        </Card>

        {/* MTS Card */}
        <Card className={runs.mts ? '' : 'opacity-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AGENT_TOKENS['MTS-02'].dot }} />
              {AGENT_TOKENS['MTS-02'].label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.mts ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl sm:text-4xl font-bold ${getScoreColorClass(runs.mts.payload.global_score)}`}>
                    {runs.mts.payload.global_score}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                {runs.mts.payload.previous && (
                  <p className={`text-xs font-semibold mt-1 ${runs.mts.payload.global_score - runs.mts.payload.previous.global_score >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {runs.mts.payload.global_score - runs.mts.payload.previous.global_score >= 0 ? '+' : ''}
                    {runs.mts.payload.global_score - runs.mts.payload.previous.global_score} vs previous
                  </p>
                )}
                {runs.mts.payload.trending_topics[0] && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    Top trend:{runs.mts.payload.trending_topics[0].topic}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not run yet</p>
            )}
          </CardContent>
        </Card>

        {/* CIA Card */}
        <Card className={runs.cia ? '' : 'opacity-50'}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: AGENT_TOKENS['CIA-03'].dot }} />
              {AGENT_TOKENS['CIA-03'].label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {runs.cia ? (
              <>
                <div className="flex items-baseline gap-1">
                  <span className={`text-3xl sm:text-4xl font-bold ${getScoreColorClass(runs.cia.payload.brand_score)}`}>
                    {runs.cia.payload.brand_score}
                  </span>
                  <span className="text-lg text-muted-foreground">/100</span>
                </div>
                {runs.cia.payload.previous && (
                  <p className={`text-xs font-semibold mt-1 ${runs.cia.payload.brand_score - runs.cia.payload.previous.brand_score >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {runs.cia.payload.brand_score - runs.cia.payload.previous.brand_score >= 0 ? '+' : ''}
                    {runs.cia.payload.brand_score - runs.cia.payload.previous.brand_score} vs previous
                  </p>
                )}
                {runs.cia.payload.threats[0] && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    Top threat: {normalizeText(runs.cia.payload.threats[0].description)}
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Not run yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cross-Signals */}
      {crossSignals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cross-Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {crossSignals.map((signal, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 flex items-start gap-2 ${SIGNAL_STYLES[signal.type]}`}
                >
                  <Badge className={SIGNAL_STYLES[signal.type]} variant="outline">
                    {SIGNAL_LABELS[signal.type]}
                  </Badge>
                  <p className="text-sm leading-snug">{signal.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Actions Rollup */}
      {topActions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Priority Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {topActions.slice(0, 3).map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded-full bg-muted w-5 h-5 flex items-center justify-center text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{action}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
