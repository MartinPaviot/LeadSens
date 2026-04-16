import { useState, useCallback, useRef } from 'react';
import type { CampaignBrief, ChatMessage, BRIEF_FIELDS } from '../types';
import { detectLanguage } from '../prompts/briefCollection';

const AFFIRMATIVES = ['yes', 'ok', 'oui', 'correct', 'c est bon', "c'est bon", 'looks good', 'perfect', 'go', 'yep', 'sure', 'parfait', 'allons-y', 'lance', 'go ahead'];

function isAffirmative(input: string): boolean {
  const lower = input.toLowerCase().trim();
  return AFFIRMATIVES.some((a) => lower === a || lower.startsWith(a));
}

function isBriefReady(brief: Partial<CampaignBrief>): boolean {
  return Boolean(brief.objective && brief.sector && brief.geography && brief.platforms?.length && brief.budgetMax && brief.priority);
}

function normalizeProfileType(value: unknown): 'micro' | 'macro' | 'mix' | undefined {
  if (typeof value !== 'string') return undefined;
  const lower = value.toLowerCase();
  if (lower.includes('micro')) return 'micro';
  if (lower.includes('macro')) return 'macro';
  if (lower.includes('mix') || lower.includes('both')) return 'mix';
  return 'micro';
}

function normalizeBriefUpdate(update: Partial<CampaignBrief>): Partial<CampaignBrief> {
  const normalized = { ...update };
  if ('profileType' in normalized) {
    normalized.profileType = normalizeProfileType(normalized.profileType);
  }
  return normalized;
}

function cleanResponse(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/^[-•]\s+/, ''))
    .join('\n');
}

function genId(): string {
  return Math.random().toString(36).slice(2, 12);
}

function agentMsg(content: string, extra?: Partial<ChatMessage>): ChatMessage {
  return { id: genId(), role: 'agent', content, timestamp: new Date(), type: 'text', ...extra };
}

function userMsg(content: string): ChatMessage {
  return { id: genId(), role: 'user', content, timestamp: new Date(), type: 'text' };
}

interface ApiResponse {
  response: string | null;
  briefUpdate?: Partial<CampaignBrief> | null;
  briefComplete?: boolean;
  error?: string;
  fallback?: boolean;
}

export interface BriefCollectionState {
  brief: Partial<CampaignBrief>;
  messages: ChatMessage[];
  briefComplete: boolean;
  lang: 'fr' | 'en';
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useBriefCollection(_restored?: BriefCollectionState | null) {
  const [brief, setBrief] = useState<Partial<CampaignBrief>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [briefComplete, setBriefComplete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lang, setLang] = useState<'fr' | 'en'>('en');
  const initializedRef = useRef(false);
  const useFallbackRef = useRef(false);

  const initialize = useCallback(async () => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    setIsLoading(true);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch('/api/agents/influence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Start the brief collection.' }], lang: 'en' }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('API error');
      const data = await res.json() as ApiResponse;

      if (data.fallback || !data.response) {
        useFallbackRef.current = true;
        setMessages([agentMsg("Hi! I'm your Influencer Discovery assistant. Let's build your campaign brief.\n\nWhat's the main objective for this campaign?\n**Branding** : increase brand visibility\n**Conversion** : drive sales or sign-ups\n**Engagement** : build community interaction\n**Awareness** : reach new audiences")]);
      } else {
        setMessages([agentMsg(data.response)]);
        if (data.briefUpdate) setBrief((prev) => ({ ...prev, ...normalizeBriefUpdate(data.briefUpdate as Partial<CampaignBrief>) }));
      }
    } catch {
      useFallbackRef.current = true;
      setMessages([agentMsg("Hi! I'm your Influencer Discovery assistant. Let's build your campaign brief.\n\nWhat's the main objective for this campaign?\n**Branding** : increase brand visibility\n**Conversion** : drive sales or sign-ups\n**Engagement** : build community interaction\n**Awareness** : reach new audiences")]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const processUserMessage = useCallback(async (input: string) => {
    if (isLoading) return;

    // Detect language from user input
    const detectedLang = detectLanguage(input);
    if (detectedLang !== lang) setLang(detectedLang);
    const currentLang = detectedLang;

    const newUserMsg = userMsg(input);
    setMessages((prev) => [...prev, newUserMsg]);

    // Client-side shortcut: if user confirms and brief is ready, skip API call
    if (isAffirmative(input) && isBriefReady(brief)) {
      const confirmMsg = currentLang === 'fr'
        ? 'Parfait ! Je lance la recherche...'
        : 'Perfect! Launching the search...';
      setMessages((prev) => [...prev, agentMsg(confirmMsg, { type: 'results-ready' })]);
      setBriefComplete(true);
      return;
    }

    if (useFallbackRef.current) {
      setMessages((prev) => [...prev, agentMsg("Thanks! Let me process that. (API key not configured — using demo mode)")]);
      return;
    }

    setIsLoading(true);

    try {
      const apiMessages = [...messages, newUserMsg].map((m) => ({
        role: m.role === 'agent' ? 'assistant' as const : 'user' as const,
        content: m.content,
      }));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);

      const res = await fetch('/api/agents/influence/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, brief, lang: currentLang }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error('API error');
      const data = await res.json() as ApiResponse;
      if (!data.response) throw new Error('Empty response');

      const cleaned = cleanResponse(data.response);

      if (data.briefUpdate) {
        const updated = { ...brief, ...normalizeBriefUpdate(data.briefUpdate as Partial<CampaignBrief>) };
        setBrief(updated);

        if (data.briefComplete) {
          // Only add brief-summary if not already shown
          const alreadyShown = messages.some((m) => m.type === 'brief-summary');
          if (!alreadyShown) {
            setMessages((prev) => [...prev, agentMsg(cleaned, { type: 'brief-summary', briefData: updated })]);
          } else {
            setMessages((prev) => [...prev, agentMsg(cleaned)]);
          }
          setBriefComplete(true);
        } else {
          setMessages((prev) => [...prev, agentMsg(cleaned)]);
        }
      } else {
        setMessages((prev) => [...prev, agentMsg(cleaned)]);
      }
    } catch {
      const errorMsg = currentLang === 'fr'
        ? "Une erreur est survenue. Veuillez réessayer."
        : "Something went wrong. Please try again.";
      setMessages((prev) => [...prev, agentMsg(errorMsg)]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, brief, isLoading, lang]);

  const restore = useCallback((state: BriefCollectionState) => {
    setBrief(state.brief);
    setMessages(state.messages);
    setBriefComplete(state.briefComplete);
    setLang(state.lang);
    initializedRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setBrief({});
    setMessages([]);
    setBriefComplete(false);
    setLang('en');
    initializedRef.current = false;
    useFallbackRef.current = false;
  }, []);

  return { brief, messages, briefComplete, isLoading, lang, processUserMessage, initialize, restore, reset };
}
