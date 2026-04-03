"use client";

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@leadsens/ui';
import type { InfluencerToolId, OnboardingConfig } from '../types';
import { INFLUENCER_TOOLS } from '../types';
import { ToolCard } from './ToolCard';

interface OnboardingModalProps {
  config: OnboardingConfig;
  onConnect: (toolId: InfluencerToolId, apiKey: string) => Promise<{ success: boolean; error?: string }>;
  onComplete: () => void;
}

function GradientButton({ onClick, disabled, children, className }: {
  onClick?: () => void; disabled?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-12 px-6 rounded-xl font-semibold text-white transition-opacity duration-200 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed ${className ?? ''}`}
      style={{ background: 'var(--elevay-gradient-btn)' }}
    >
      {children}
    </button>
  );
}

export function OnboardingModal({ config, onConnect, onComplete }: OnboardingModalProps) {
  const [step, setStep] = useState(0);
  const TOTAL_STEPS = 2;

  const connectedIds = new Set(config.connectedTools.map((t) => t.id));
  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <Dialog open onOpenChange={() => { /* blocked */ }}>
      <DialogContent
        className="w-[90vw] max-w-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto pb-5"
        showCloseButton={false}
      >
        {/* Logo */}
        <div className="flex justify-center mb-1">
          <img src="/logo-elevay.svg" alt="Elevay" className="h-10" />
        </div>

        {/* Header */}
        <DialogHeader className="text-center mb-1">
          <DialogTitle className="text-xl font-semibold text-center">
            {step === 0 ? 'Set up your Influencer Agent' : 'Connect your platforms'}
          </DialogTitle>
          <p className="text-sm text-muted-foreground text-center">
            {step === 0
              ? "Connect your influencer tools to get real data. No tools? We'll use our built-in search."
              : "Connect one or more tools. We'll prioritize them in order."}
          </p>
        </DialogHeader>

        {/* Progress bar */}
        <div className="space-y-1 mb-4">
          <div className="flex justify-end">
            <span className="text-xs text-muted-foreground">Step {step + 1} of {TOTAL_STEPS}</span>
          </div>
          <div className="h-1 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'var(--elevay-gradient-btn)' }}
            />
          </div>
        </div>

        {/* Step content */}
        <div>
          {step === 0 && <StepWelcome />}
          {step === 1 && (
            <StepTools config={config} connectedIds={connectedIds} onConnect={onConnect} />
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-3">
          {step > 0 ? (
            <button
              onClick={() => setStep(0)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step === 0 && (
            <GradientButton onClick={() => setStep(1)}>
              <span className="flex items-center gap-2">Get started <ArrowRight size={14} /></span>
            </GradientButton>
          )}
          {step === 1 && (
            <GradientButton onClick={onComplete}>
              <span className="flex items-center gap-2">Start finding influencers <ArrowRight size={14} /></span>
            </GradientButton>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Step 1: Welcome ─────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center py-2">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#17c3b2]/[0.06]">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#17c3b2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground max-w-sm">
        Connect your influencer platforms for real-time data, or skip and use our built-in search.
      </p>
    </div>
  );
}

// ─── Step 2: Connect tools ───────────────────────────────

function StepTools({ config, connectedIds, onConnect }: {
  config: OnboardingConfig;
  connectedIds: Set<InfluencerToolId>;
  onConnect: (toolId: InfluencerToolId, apiKey: string) => Promise<{ success: boolean; error?: string }>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {INFLUENCER_TOOLS.map((tool) => (
          <ToolCard
            key={tool.id}
            tool={tool}
            connected={connectedIds.has(tool.id)}
            onConnect={(apiKey) => onConnect(tool.id, apiKey)}
          />
        ))}
      </div>

      {config.priority.length > 1 && (
        <div>
          <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-1.5">Search priority</p>
          <div className="flex flex-wrap gap-1.5">
            {config.priority.map((id, i) => {
              const tool = INFLUENCER_TOOLS.find((t) => t.id === id);
              if (!tool) return null;
              const isConnected = connectedIds.has(id) || id === 'builtin';
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-all"
                  style={isConnected
                    ? { borderColor: '#17c3b2', background: 'rgba(23,195,178,0.06)', color: '#17c3b2' }
                    : { borderColor: 'var(--border)', color: 'var(--muted-foreground)' }
                  }
                >
                  <span className="text-[9px] font-bold opacity-50">{i + 1}</span>
                  {tool.name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
