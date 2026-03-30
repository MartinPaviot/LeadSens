"use client";

interface Scores {
  seoScore: number | null;
  geoScore: number | null;
  llmScore: number | null;
  criticalIssues: number | null;
  seoScoreDelta: number | null;
  geoScoreDelta: number | null;
  llmScoreDelta: number | null;
  issuesDelta: number | null;
}

interface ScoreCardsProps {
  scores: Scores | null;
  isLoading: boolean;
}

const CARDS = [
  { key: 'seoScore', deltaKey: 'seoScoreDelta', label: 'Score SEO global', color: '#17C3B2', hoverTint: 'rgba(23,195,178,0.06)', suffix: '/100' },
  { key: 'geoScore', deltaKey: 'geoScoreDelta', label: 'Score GEO', color: '#2C6BED', hoverTint: 'rgba(44,107,237,0.06)', suffix: '/100' },
  { key: 'llmScore', deltaKey: 'llmScoreDelta', label: 'Citabilité LLM', color: '#FF7A3D', hoverTint: 'rgba(255,122,61,0.06)', suffix: '/100' },
  { key: 'criticalIssues', deltaKey: 'issuesDelta', label: 'Issues critiques', color: '#EF4444', hoverTint: 'rgba(239,68,68,0.04)', suffix: '' },
] as const;

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
        = 0
      </span>
    );
  }
  const isPositive = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
        isPositive
          ? 'bg-primary/10 text-primary'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      {isPositive ? '↑' : '↓'} {Math.abs(delta)}
    </span>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl bg-card p-4 shadow-sm sm:p-5">
          <div className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
          <div className="mb-2 h-8 w-16 animate-pulse rounded bg-muted" />
          <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
        </div>
      ))}
    </div>
  );
}

export function ScoreCards({ scores, isLoading }: ScoreCardsProps) {
  if (isLoading) return <Skeleton />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {CARDS.map((card) => {
        const value = scores?.[card.key as keyof Scores] as number | null;
        const delta = scores?.[card.deltaKey as keyof Scores] as number | null;
        const displayDelta = card.key === 'criticalIssues' && delta != null ? -delta : delta;
        const percentage = card.key === 'criticalIssues'
          ? null
          : value != null ? Math.min(100, Math.max(0, value)) : null;

        return (
          <div
            key={card.key}
            className="group rounded-xl border border-border/40 bg-card/90 p-4 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md sm:p-5"
            style={{ '--card-hover': card.hoverTint } as React.CSSProperties}
          >
            <div
              className="absolute inset-0 rounded-xl opacity-0 transition-opacity duration-200 group-hover:opacity-100"
              style={{ background: `radial-gradient(ellipse at top left, ${card.hoverTint}, transparent 70%)` }}
            />
            <div className="relative">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:text-xs">
                  {card.label}
                </span>
                <DeltaBadge delta={displayDelta} />
              </div>
              <div className="mb-3 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground sm:text-3xl">
                  {value != null ? value : '--'}
                </span>
                {card.suffix && (
                  <span className="text-xs text-muted-foreground sm:text-sm">{card.suffix}</span>
                )}
              </div>
              {percentage != null && (
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${percentage}%`, backgroundColor: card.color }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
