"use client";

import type { OnboardingData } from "@/lib/onboarding-store";

interface StepNotificationsProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
  slackConnected: boolean;
}

const CHANNELS: {
  value: OnboardingData['alertChannel'];
  title: string;
  description: string;
  icon: string;
  requiresSlack?: boolean;
}[] = [
  {
    value: 'email',
    title: 'Email',
    description: 'Notifications to your account email with one-click approve / reject links.',
    icon: '✉',
  },
  {
    value: 'slack',
    title: 'Slack',
    description: 'Messages to a channel of your choice with action buttons.',
    icon: '#',
    requiresSlack: true,
  },
  {
    value: 'digest',
    title: 'Weekly digest only',
    description: 'No real-time alerts. A summary every Monday with everything that happened.',
    icon: '📋',
  },
];

export function StepNotifications({ data, onChange, slackConnected }: StepNotificationsProps) {
  return (
    <div className="space-y-3">
      {CHANNELS.map((ch) => {
        const selected = data.alertChannel === ch.value;
        const disabled = ch.requiresSlack && !slackConnected;
        return (
          <button
            key={ch.value}
            onClick={() => !disabled && onChange({ alertChannel: ch.value })}
            disabled={disabled}
            className="w-full rounded-xl border p-4 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50"
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
                  <span className="text-base">{ch.icon}</span>
                  <p className="text-sm font-medium text-foreground">{ch.title}</p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{ch.description}</p>
                {disabled && (
                  <p className="mt-1.5 text-[11px] text-secondary">
                    Requires Slack connected in step 3.
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
