"use client";

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessage, CampaignBrief } from '../types';

interface AgentSidebarProps {
  messages: ChatMessage[];
  brief: Partial<CampaignBrief>;
  onSend: (message: string) => void;
  isSearching: boolean;
  isLoading?: boolean;
  lang?: 'fr' | 'en';
  onReset?: () => void;
  onOpenSettings?: () => void;
}

function BriefSummaryCard({ data }: { data: Partial<CampaignBrief> }) {
  const fields: { label: string; value: string | undefined }[] = [
    { label: 'Objective', value: data.objective },
    { label: 'Sector', value: data.sector },
    { label: 'Geography', value: data.geography },
    { label: 'Platforms', value: data.platforms?.join(', ') },
    { label: 'Content style', value: data.contentStyle },
    { label: 'Budget', value: data.budgetMin || data.budgetMax ? `${data.budgetMin ?? '?'}–${data.budgetMax ?? '?'}€` : undefined },
    { label: 'Priority', value: data.priority },
    { label: 'Profile type', value: data.profileType },
  ].filter((f) => f.value);

  return (
    <div className="rounded-lg border border-border/60 bg-white/80 px-3 py-2.5 space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Campaign brief</p>
      {fields.map((f) => (
        <div key={f.label} className="flex items-baseline gap-1.5">
          <span className="text-[11px] text-muted-foreground">{f.label}:</span>
          <span className="text-[12px] font-medium text-foreground capitalize">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function renderMessageContent(content: string) {
  return content.split(/(\*\*[^*]+\*\*)/).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

export function AgentSidebar({ messages, onSend, isSearching, isLoading, lang = 'en', onReset, onOpenSettings }: AgentSidebarProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSearching || isLoading) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div className="flex h-full w-full flex-col border-l border-border">
      {/* Header — matches nav bar height (px-3 py-1.5) */}
      {/* matched to left nav header: 41px */}
      <div className="flex items-center gap-2 border-b border-border bg-[#FFF7ED] px-3" style={{ height: '48px', minHeight: '48px' }}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md" style={{ background: 'var(--elevay-gradient-btn)' }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-foreground">Chief Influencer Officer</p>
        <div className="ml-auto flex items-center gap-2">
          {onOpenSettings && (
            <button onClick={onOpenSettings} className="text-muted-foreground hover:text-foreground" title="Settings">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" />
              </svg>
            </button>
          )}
          {onReset && (
            <button
              onClick={() => {
                // eslint-disable-next-line no-alert
                const msg = lang === 'fr'
                  ? 'Nouvelle campagne ? Votre session actuelle sera effacée.'
                  : 'Start a new campaign? Your current session will be cleared.';
                if (window.confirm(msg)) onReset();
              }}
              className="shrink-0 text-[10px] font-medium text-muted-foreground hover:text-foreground"
            >
              {lang === 'fr' ? 'Nouvelle campagne' : 'New campaign'}
            </button>
          )}
        </div>
      </div>

      {/* Messages — warm beige background with subtle gradients */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3"
        style={{
          background: 'radial-gradient(ellipse at top right, rgba(23,195,178,0.07) 0%, transparent 60%), radial-gradient(ellipse at bottom left, rgba(255,122,61,0.06) 0%, transparent 55%), #FFF7ED',
        }}
      >
        {messages.map((msg, idx) => {
          // Only render the first brief-summary card
          const isBriefSummary = msg.type === 'brief-summary' && msg.briefData;
          const isFirstBriefSummary = isBriefSummary && messages.findIndex((m) => m.type === 'brief-summary') === idx;

          return (
          <div key={msg.id} className={msg.role === 'agent' ? 'flex justify-start' : 'flex justify-end'}>
            {isFirstBriefSummary && msg.briefData ? (
              <div className="max-w-[90%] space-y-2">
                <BriefSummaryCard data={msg.briefData} />
                {/* Render any text after the brief data (e.g. confirmation question) */}
                {msg.content.includes('Shall I') && (
                  <div
                    className="rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
                    style={{ background: 'white', border: '1px solid var(--border)', borderLeft: '2.5px solid #17C3B2' }}
                  >
                    {renderMessageContent(msg.content.slice(msg.content.indexOf('I recommend')))}
                  </div>
                )}
              </div>
            ) : (
              <div
                className="max-w-[90%] rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap"
                style={
                  msg.role === 'agent'
                    ? { background: 'white', border: '1px solid var(--border)', borderLeft: '2.5px solid #17C3B2' }
                    : { background: '#17C3B2', color: '#fff' }
                }
              >
                {renderMessageContent(msg.content)}
              </div>
            )}
          </div>
          );
        })}
        {isLoading && !isSearching && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white px-3 py-2 text-[13px] text-muted-foreground" style={{ border: '1px solid var(--border)', borderLeft: '2.5px solid #17C3B2' }}>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: '#17C3B2', animationDelay: '0ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: '#17C3B2', animationDelay: '150ms' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ background: '#17C3B2', animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        {isSearching && (
          <div className="flex justify-start">
            <div className="rounded-xl bg-white px-3 py-2 text-[13px] text-muted-foreground" style={{ border: '1px solid var(--border)', borderLeft: '2.5px solid #17C3B2' }}>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full mr-1.5" style={{ background: '#17C3B2' }} />
              Searching influencers...
            </div>
          </div>
        )}
      </div>

      {/* Input — plain warm beige */}
      <form onSubmit={handleSubmit} className="border-t border-border px-3 py-2.5" style={{ background: '#FFF7ED' }}>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your answer..."
            disabled={isSearching || isLoading}
            className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSearching || isLoading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
            style={{ background: 'var(--elevay-gradient-btn)' }}
          >
            <Send size={14} />
          </button>
        </div>
      </form>
    </div>
  );
}
