"use client";

import type { OnboardingData } from "@/lib/onboarding-store";

interface StepAutomationProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

const LEVELS: {
  value: OnboardingData['automationLevel'];
  title: string;
  description: string;
  example: string;
  recommended?: boolean;
}[] = [
  {
    value: 'audit',
    title: 'Audit only',
    description: 'I want to see what needs fixing. I\'ll decide what to apply and do it myself.',
    example: 'Good for: agencies, developers, teams with existing workflows.',
  },
  {
    value: 'semi-auto',
    title: 'Semi-automatic',
    description: 'Elevay applies nothing without my approval. Every correction, meta tag, and draft is shown to me first — I approve or reject each one.',
    example: 'Good for: business owners who want control without doing the work.',
    recommended: true,
  },
  {
    value: 'full-auto',
    title: 'Full automatic',
    description: 'Elevay silently fixes technical issues (broken metas, missing alt texts, canonicals) without asking. I only approve content before it\'s published.',
    example: 'Good for: users who trust the system and want zero manual steps on technical SEO.',
  },
];

export function StepAutomation({ data, onChange }: StepAutomationProps) {
  return (
    <div className="space-y-3">
      {LEVELS.map((level) => {
        const selected = data.automationLevel === level.value;
        return (
          <button
            key={level.value}
            onClick={() => onChange({ automationLevel: level.value })}
            className="w-full rounded-xl border p-4 text-left transition-all duration-150"
            style={{
              borderColor: selected ? '#17C3B2' : undefined,
              backgroundColor: selected ? 'rgba(23,195,178,0.06)' : undefined,
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors"
                style={{
                  borderColor: selected ? '#17C3B2' : 'var(--border)',
                }}
              >
                {selected && (
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: '#17C3B2' }} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{level.title}</p>
                  {level.recommended && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: 'rgba(23,195,178,0.1)', color: '#17C3B2' }}>
                      recommended
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{level.description}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/70 italic">{level.example}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
