'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-brand-intel/card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { getScoreColorClass, getScoreBg } from '../tokens'
import type { BpiOutput } from '@/agents/bpi-01/types'

interface AuditTabProps {
  output: BpiOutput
}

const AXIS_LABELS: Record<string, string> = {
  serp: 'SERP',
  press: 'Press',
  youtube: 'YouTube',
  social: 'Social',
  seo: 'SEO',
  benchmark: 'Benchmark',
}

function getBarColor(score: number): string {
  if (score >= 70) return '#22c55e'
  if (score >= 40) return '#f97316'
  return '#ef4444'
}

const TAG_VARIANT: Record<string, string> = {
  Urgent: 'bg-red-100 text-red-800',
  'Mid-term': 'bg-orange-100 text-orange-800',
  'Moyen terme': 'bg-orange-100 text-orange-800',
  'Quick win': 'bg-green-100 text-green-800',
}

export function AuditTab({ output }: AuditTabProps) {
  const { scores, priorities_90d, axis_diagnostics, warning } = output

  const axisData = (
    ['serp', 'press', 'youtube', 'social', 'seo', 'benchmark'] as const
  ).map((key) => ({
    name: AXIS_LABELS[key] ?? key,
    score: scores[key],
    fill: getBarColor(scores[key]),
  }))

  const delta = scores.previous
    ? scores.global - scores.previous.global
    : null

  const sorted = [...axisData].sort((a, b) => b.score - a.score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Score header */}
      <Card>
        <CardHeader>
          <CardTitle>Online Presence Score</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className={`text-4xl sm:text-5xl font-bold ${getScoreColorClass(scores.global)}`}>
              {scores.global}
              <span className="text-xl sm:text-2xl text-muted-foreground">/100</span>
            </span>
            {delta !== null && (
              <span
                className={`text-base sm:text-lg font-semibold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}
              >
                {delta >= 0 ? '+' : ''}
                {delta} vs previous
              </span>
            )}
            {scores.completeness < 100 && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                Completeness: {scores.completeness}%
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Degraded warning — C10 */}
      {scores.completeness < 80 && (
        <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
          Incomplete data ({scores.completeness}% of sources available). Scores are calculated from accessible sources only.
        </div>
      )}

      {/* Warning banner removed — graceful degradation instead */}

      {/* Bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Scores by Axis</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={axisData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
              <Tooltip formatter={(v) => [`${String(v)}/100`, 'Score']} />
              <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                {axisData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Best / worst */}
          {best && worst && best.name !== worst.name && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-4 text-sm">
              <span className="text-green-600">
                Best: <strong>{best.name}</strong> ({best.score})
              </span>
              <span className="text-red-500">
                Weakest: <strong>{worst.name}</strong> ({worst.score})
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Axis diagnostics */}
      {axis_diagnostics.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Axis Diagnostics</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {axis_diagnostics.map((d) => (
                <li key={d.axis} className="flex flex-col sm:flex-row gap-1 sm:gap-2 text-sm">
                  <span className="sm:w-24 shrink-0 font-medium text-muted-foreground">
                    {AXIS_LABELS[d.axis] ?? d.axis}
                  </span>
                  <span>{d.diagnostic}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Priorities */}
      <Card>
        <CardHeader>
          <CardTitle>90-Day Priorities</CardTitle>
        </CardHeader>
        <CardContent>
          {priorities_90d.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No priorities generated — run the analysis again.
            </p>
          ) : (
            <ul className="space-y-3">
              {priorities_90d.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${TAG_VARIANT[p.tag] ?? 'bg-muted text-muted-foreground'}`}
                  >
                    {p.tag}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{p.action}</p>
                    <p className="text-xs text-muted-foreground">{p.source_problem}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
