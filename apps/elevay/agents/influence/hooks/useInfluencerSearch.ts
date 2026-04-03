import { useState, useCallback, useRef } from 'react';
import type { CampaignBrief, InfluencerProfile, OnboardingConfig } from '../types';
import { searchInfluencers } from '../core/searchEngine';

export function useInfluencerSearch() {
  const [influencers, setInfluencers] = useState<InfluencerProfile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'micro' | 'macro'>('all');
  const [isGeneratingBrief, setIsGeneratingBrief] = useState(false);
  const briefRef = useRef<Partial<CampaignBrief>>({});
  const langRef = useRef<'fr' | 'en'>('en');
  const configRef = useRef<OnboardingConfig | undefined>(undefined);

  const search = useCallback(async (brief: Partial<CampaignBrief>, config?: OnboardingConfig) => {
    setIsSearching(true);
    briefRef.current = brief;
    if (config) configRef.current = config;
    try {
      const results = await searchInfluencers(brief, configRef.current);
      setInfluencers(results);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const generateBrief = useCallback(async (influencer: InfluencerProfile): Promise<string | null> => {
    setIsGeneratingBrief(true);
    try {
      const res = await fetch('/api/agents/influence/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencer, brief: briefRef.current, lang: langRef.current }),
      });
      if (!res.ok) return null;
      const data = await res.json() as { brief: string | null };
      if (data.brief) {
        // Store in the profile
        setInfluencers((prev) =>
          prev.map((p) => p.id === influencer.id ? { ...p, generatedBrief: data.brief! } : p),
        );
      }
      return data.brief;
    } catch {
      return null;
    } finally {
      setIsGeneratingBrief(false);
    }
  }, []);

  const filtered = filter === 'all'
    ? influencers
    : influencers.filter((p) => p.type === filter);

  const selected = selectedId
    ? influencers.find((p) => p.id === selectedId) ?? null
    : null;

  return {
    influencers: filtered,
    allInfluencers: influencers,
    isSearching,
    selected,
    selectedId,
    filter,
    isGeneratingBrief,
    setFilter,
    setSelectedId,
    search,
    generateBrief,
    campaignBrief: briefRef.current,
    setLang: (l: 'fr' | 'en') => { langRef.current = l; },
  };
}
