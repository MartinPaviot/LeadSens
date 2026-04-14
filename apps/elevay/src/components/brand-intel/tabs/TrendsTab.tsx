'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import { getScoreColorClass } from '../tokens'
import type { MtsOutput, TrendingTopic, RoadmapEntry } from '@/agents/mts-02/types'

interface TrendsTabProps {
  output: MtsOutput
}

/** Normalize any residual French from LLM/synthesis output */
function normalize(text: string): string {
  return text
    .replace(/(\d+)-(\d+)\s*mois/gi, '$1-$2 months')
    .replace(/(\d+)\s*mois/gi, '$1 months')
    .replace(/<\s*2\s*semaines/gi, '< 2 weeks')
    .replace(/(\d+)\s*semaines?/gi, '$1 weeks')
    .replace(/Approche\s+(\S+)\s+sur\s+"([^"]+)"/gi, '$1 approach on "$2"')
    .replace(/Contenu autour de\s+"([^"]+)"/gi, 'Content around "$1"')
}

const CLASSIFICATION_STYLES: Record<TrendingTopic['classification'], string> = {
  strong_trend: 'bg-green-100 text-green-800',
  buzz: 'bg-blue-100 text-blue-800',
  weak_signal: 'bg-gray-100 text-gray-700',
  saturation: 'bg-red-100 text-red-700',
}

const CLASSIFICATION_LABELS: Record<TrendingTopic['classification'], string> = {
  strong_trend: 'Strong Trend',
  buzz: 'Buzz',
  weak_signal: 'Weak Signal',
  saturation: 'Saturated',
}

const PRIORITY_STYLES: Record<RoadmapEntry['priority'], string> = {
  high: 'bg-card border-teal/30',
  medium: 'bg-card border-border',
  low: 'bg-muted border-border',
}

const OBJECTIVE_LABELS: Record<RoadmapEntry['objective'], string> = {
  SEO: '🔍 SEO',
  lead_gen: '🎯 Lead Gen',
  branding: '✨ Branding',
  activation: '⚡ Activation',
}

const WEEKS = [1, 2, 3, 4] as const

export function TrendsTab({ output }: TrendsTabProps) {
  const {
    global_score,
    trending_topics,
    saturated_topics,
    roadmap_30d,
    differentiating_angles,
    previous,
  } = output

  const sorted = [...trending_topics].sort(
    (a, b) => b.opportunity_score - a.opportunity_score,
  )

  const marketLabel =
    global_score >= 70
      ? 'Highly promising market'
      : global_score >= 40
        ? 'Moderately promising market'
        : 'Saturated or low-dynamic market'

  const delta = previous ? global_score - previous.global_score : null

  // Group roadmap by week
  const roadmapByWeek = WEEKS.map((week) => ({
    week,
    entries: roadmap_30d.filter((e) => e.week === week),
  }))

  // New trending topics vs previous
  const newTopics = previous
    ? trending_topics.filter((t) => !previous.trending_topics.includes(t.topic))
    : []

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Score header */}
      <Card>
        <CardHeader>
          <CardTitle>Market Opportunity Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className={`text-4xl sm:text-5xl font-bold ${getScoreColorClass(global_score)}`}>
              {global_score}
              <span className="text-xl sm:text-2xl text-muted-foreground">/100</span>
            </span>
            <div>
              <p className="font-medium">{marketLabel}</p>
              {delta !== null && (
                <p
                  className={`text-sm font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta} vs previous run
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison banner */}
      {previous && newTopics.length > 0 && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          {newTopics.length} new trend{newTopics.length > 1 ? 's' : ''} since{' '}
          {new Date(previous.date).toLocaleDateString('fr-FR')} :{' '}
          {newTopics
            .slice(0, 3)
            .map((t) => t.topic)
            .join(', ')}
        </div>
      )}

      {/* Trending topics */}
      <Card>
        <CardHeader>
          <CardTitle>Trends &amp; Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No topics detected — run the analysis again.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {sorted.map((topic) => (
                <div
                  key={topic.topic}
                  className="rounded-lg border bg-card p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-snug">{topic.topic}</p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${CLASSIFICATION_STYLES[topic.classification]}`}
                    >
                      {CLASSIFICATION_LABELS[topic.classification]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${topic.opportunity_score}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-blue-700 w-8 text-right">
                      {topic.opportunity_score}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {normalize(topic.suggested_angle)}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {topic.best_channel}
                    </span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {normalize(topic.estimated_horizon)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saturated topics */}
      {saturated_topics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Saturated Topics — Avoid</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {saturated_topics.map((t) => (
                <li key={t.topic} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                    Saturated
                  </span>
                  <div>
                    <span className="font-medium">{t.topic}</span>
                    <span className="text-muted-foreground"> — {t.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Differentiating angles */}
      {differentiating_angles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Differentiating Angles</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {differentiating_angles.map((angle, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-blue-500 font-bold">→</span>
                  {angle}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Roadmap 30 days */}
      <Card>
        <CardHeader>
          <CardTitle>Content Roadmap — 30 Days</CardTitle>
        </CardHeader>
        <CardContent>
          {roadmap_30d.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No roadmap entries — run the analysis again.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {roadmapByWeek.map(({ week, entries }) => (
                <div key={week} className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Week {week}
                  </h3>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No entries</p>
                  ) : (
                    entries.map((entry, i) => (
                      <div
                        key={i}
                        className={`rounded-lg border p-3 space-y-1 ${PRIORITY_STYLES[entry.priority]}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="rounded bg-card/70 px-1.5 py-0.5 text-xs font-medium border">
                            {entry.canal}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {OBJECTIVE_LABELS[entry.objective]}
                          </span>
                        </div>
                        <p className="text-xs font-semibold leading-snug line-clamp-2">
                          {entry.suggested_title}
                        </p>
                        <p className="text-xs text-muted-foreground">{entry.format}</p>
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
