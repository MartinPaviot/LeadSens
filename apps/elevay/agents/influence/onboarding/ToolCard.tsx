"use client";

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type { InfluencerToolDef } from '../types';

interface ToolCardProps {
  tool: InfluencerToolDef;
  connected: boolean;
  onConnect: (apiKey: string) => Promise<{ success: boolean; error?: string }>;
}

const TOOL_LOGOS: Record<string, string> = {
  upfluence: 'https://cdn.brandfetch.io/upfluence.com/w/400/h/400',
  klear: 'https://cdn.brandfetch.io/klear.com/w/400/h/400',
  kolsquare: 'https://cdn.brandfetch.io/kolsquare.com/w/400/h/400',
  hypeauditor: 'https://cdn.brandfetch.io/hypeauditor.com/w/400/h/400',
  modash: 'https://cdn.brandfetch.io/modash.io/w/400/h/400',
};

export function ToolCard({ tool, connected, onConnect }: ToolCardProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<'idle' | 'verifying' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);

  const isFallback = tool.tier === 'fallback';
  const logoUrl = TOOL_LOGOS[tool.id];

  const handleConnect = async () => {
    if (!apiKey.trim()) return;
    setStatus('verifying');
    setErrorMsg('');
    const result = await onConnect(apiKey.trim());
    if (result.success) {
      setStatus('idle');
      setApiKey('');
    } else {
      setStatus('error');
      setErrorMsg(result.error ?? 'Invalid key');
    }
  };

  return (
    <div
      className="rounded-xl border p-3 transition-all"
      style={{
        borderColor: connected ? '#17c3b2' : undefined,
        background: connected ? 'rgba(23,195,178,0.06)' : 'var(--background)',
      }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5">
        {/* Logo: real image for primary tools, colored square for builtin */}
        {logoUrl && !logoFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={tool.name}
            width={28}
            height={28}
            style={{ borderRadius: 6, objectFit: 'contain' }}
            className="shrink-0"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div
            className="flex shrink-0 items-center justify-center text-[10px] font-bold text-white"
            style={{ width: 28, height: 28, backgroundColor: tool.color, borderRadius: 6 }}
          >
            {tool.abbr}
          </div>
        )}
        <p className="text-sm font-medium text-foreground">{tool.name}</p>
      </div>

      {/* Status + input */}
      <div className="mt-2">
        {connected ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            &#10003; Connected
          </span>
        ) : isFallback ? (
          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium" style={{ borderColor: '#17c3b2', background: 'rgba(23,195,178,0.06)', color: '#17c3b2' }}>
            Always available
          </span>
        ) : status === 'verifying' ? (
          <div className="flex items-center gap-2">
            <span className="size-3.5 border-2 border-primary border-r-transparent rounded-full animate-spin inline-block" />
            <span className="text-xs text-muted-foreground">Verifying...</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); if (status === 'error') setStatus('idle'); }}
                  placeholder="Paste your API key"
                  className="w-full rounded-lg border border-border bg-background pr-8 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  style={{ fontSize: 12, padding: '4px 8px', paddingRight: 28 }}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>
              <button
                onClick={handleConnect}
                disabled={!apiKey.trim()}
                className="shrink-0 rounded-xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: 'var(--elevay-gradient-btn)', padding: '2px 10px', fontSize: 12, lineHeight: 1.5 }}
              >
                Connect
              </button>
            </div>
            {status === 'error' && (
              <p className="text-xs text-destructive">{errorMsg}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
