import { useEffect, useCallback, useRef, useState } from 'react';
import type { AgentPhase, CampaignBrief, ChatMessage, InfluencerProfile, OnboardingConfig } from '../types';
import { useBriefCollection } from './useBriefCollection';
import { useInfluencerSearch } from './useInfluencerSearch';

const SESSION_KEY = 'elevay-influence-session';
const SESSION_TTL = 24 * 60 * 60 * 1000;

interface SavedSession {
  messages: ChatMessage[];
  brief: Partial<CampaignBrief>;
  briefComplete: boolean;
  lang: 'fr' | 'en';
  influencers: InfluencerProfile[];
  savedAt: string;
}

function loadSession(): SavedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSession;
    const age = Date.now() - new Date(parsed.savedAt).getTime();
    if (age > SESSION_TTL) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useInfluencerAgent(onboardingConfig?: OnboardingConfig) {
  // Start with null — never read localStorage during render
  const briefCollection = useBriefCollection(null);
  const searchState = useInfluencerSearch();
  const [mounted, setMounted] = useState(false);
  const restoredRef = useRef(false);

  // Restore session from localStorage after mount
  useEffect(() => {
    setMounted(true);
    const session = loadSession();
    if (session) {
      restoredRef.current = true;
      briefCollection.restore({
        brief: session.brief,
        messages: session.messages,
        briefComplete: session.briefComplete,
        lang: session.lang,
      });
      if (session.briefComplete) {
        void searchState.search(session.brief, onboardingConfig);
      }
    } else {
      void briefCollection.initialize();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phase: AgentPhase = searchState.influencers.length > 0
    ? 'results'
    : searchState.isSearching
      ? 'searching'
      : 'brief';

  // Sync language to search hook
  useEffect(() => {
    searchState.setLang(briefCollection.lang);
  }, [briefCollection.lang, searchState]);

  // Auto-trigger search when brief completes
  useEffect(() => {
    if (briefCollection.briefComplete && !searchState.isSearching && searchState.allInfluencers.length === 0) {
      void searchState.search(briefCollection.brief, onboardingConfig);
    }
  }, [briefCollection.briefComplete, briefCollection.brief, searchState, onboardingConfig]);

  // Persist session — debounced 500ms
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!mounted || briefCollection.messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const session: SavedSession = {
        messages: briefCollection.messages,
        brief: briefCollection.brief,
        briefComplete: briefCollection.briefComplete,
        lang: briefCollection.lang,
        influencers: searchState.allInfluencers,
        savedAt: new Date().toISOString(),
      };
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch { /* full */ }
    }, 500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [mounted, briefCollection.messages, briefCollection.brief, briefCollection.briefComplete, briefCollection.lang, searchState.allInfluencers]);

  const handleSend = useCallback((input: string) => {
    void briefCollection.processUserMessage(input);
  }, [briefCollection]);

  const resetSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    briefCollection.reset();
    restoredRef.current = false;
    setTimeout(() => void briefCollection.initialize(), 50);
  }, [briefCollection]);

  return {
    phase,
    brief: briefCollection.brief,
    briefComplete: briefCollection.briefComplete,
    messages: briefCollection.messages,
    isLoading: briefCollection.isLoading,
    lang: briefCollection.lang,
    influencers: searchState.influencers,
    allInfluencers: searchState.allInfluencers,
    selected: searchState.selected,
    selectedId: searchState.selectedId,
    isSearching: searchState.isSearching,
    searchError: searchState.searchError,
    isGeneratingBrief: searchState.isGeneratingBrief,
    filter: searchState.filter,
    setFilter: searchState.setFilter,
    setSelectedId: searchState.setSelectedId,
    generateBrief: searchState.generateBrief,
    campaignBrief: searchState.campaignBrief,
    handleSend,
    resetSession,
  };
}
