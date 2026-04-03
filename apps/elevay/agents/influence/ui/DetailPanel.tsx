"use client";

import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, RefreshCw } from 'lucide-react';
import { Button } from '@leadsens/ui';
import type { InfluencerProfile, CampaignBrief } from '../types';
import { getScoreColor, SCORING_WEIGHTS } from '../config';
import { generateCollaborationBrief } from '../core/briefGenerator';
import { ScoreRing } from './ScoreRing';

interface DetailPanelProps {
  profile: InfluencerProfile;
  brief: Partial<CampaignBrief>;
  isGeneratingBrief: boolean;
  onGenerateBrief: (profile: InfluencerProfile) => Promise<string | null>;
  onClose: () => void;
}

const SCORE_LABELS: { key: keyof typeof SCORING_WEIGHTS; label: string }[] = [
  { key: 'reachEngagement', label: 'Reach & Engagement' },
  { key: 'thematicAffinity', label: 'Thematic Affinity' },
  { key: 'brandSafety', label: 'Brand Safety' },
  { key: 'contentQuality', label: 'Content Quality' },
  { key: 'credibility', label: 'Credibility' },
];

function BriefSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      <div className="h-3 w-full rounded bg-muted" />
      <div className="h-3 w-[90%] rounded bg-muted" />
      <div className="h-3 w-[75%] rounded bg-muted" />
    </div>
  );
}

export function DetailPanel({ profile, brief, isGeneratingBrief, onGenerateBrief, onClose }: DetailPanelProps) {
  const [briefText, setBriefText] = useState(profile.generatedBrief ?? '');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Auto-generate brief on open if not already generated
  useEffect(() => {
    if (briefText) return;
    setLoading(true);
    onGenerateBrief(profile).then((result) => {
      if (result) setBriefText(result);
      else setBriefText(generateCollaborationBrief(profile, brief));
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Sync if profile.generatedBrief updates externally
  useEffect(() => {
    if (profile.generatedBrief && !briefText) setBriefText(profile.generatedBrief);
  }, [profile.generatedBrief, briefText]);

  const handleRegenerate = useCallback(async () => {
    setLoading(true);
    const result = await onGenerateBrief(profile);
    if (result) setBriefText(result);
    setLoading(false);
  }, [profile, onGenerateBrief]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(briefText);
    } catch {
      // Fallback: select textarea
      const ta = document.querySelector<HTMLTextAreaElement>('[data-brief-textarea]');
      if (ta) { ta.select(); document.execCommand('copy'); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [briefText]);

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[280px] flex-col border-l border-border bg-card shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">{profile.name}</h3>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X size={14} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Score overview */}
        <div className="flex items-center gap-3">
          <ScoreRing score={profile.score.total} size={52} />
          <div>
            <p className="text-xs font-medium text-foreground">Compatibility score</p>
            <p className="text-[11px] text-muted-foreground">{profile.niche}</p>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Score breakdown</p>
          {SCORE_LABELS.map(({ key, label }) => {
            const scoreKey = key as keyof typeof profile.score;
            const value = profile.score[scoreKey];
            const color = getScoreColor(value);
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium" style={{ color }}>{value}</span>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-full rounded-full transition-all" style={{ width: `${value}%`, backgroundColor: color }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Collaboration brief */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Collaboration brief</p>
            <button
              onClick={handleRegenerate}
              disabled={loading || isGeneratingBrief}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RefreshCw size={11} className={loading || isGeneratingBrief ? 'animate-spin' : ''} />
              Regenerate
            </button>
          </div>
          {loading || isGeneratingBrief ? (
            <BriefSkeleton />
          ) : (
            <textarea
              data-brief-textarea
              value={briefText}
              onChange={(e) => setBriefText(e.target.value)}
              className="w-full rounded-lg border border-border bg-background p-2.5 text-xs text-foreground leading-relaxed resize-none focus:border-primary focus:outline-none"
              rows={10}
            />
          )}

          {/* CTA buttons */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCopy}
              disabled={loading || isGeneratingBrief}
              className="flex-1 rounded-lg py-2 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: 'var(--elevay-gradient-btn)' }}
            >
              {copied ? 'Copied!' : 'Copy brief'}
            </button>
            <button
              className="flex-1 rounded-lg border border-border py-2 text-xs font-medium text-foreground hover:bg-muted"
            >
              Add to CRM
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
