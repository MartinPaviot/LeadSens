"use client";

import type { OnboardingData } from "@/lib/onboarding-store";

interface StepCmsProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

const CMS_OPTIONS: {
  value: OnboardingData['cmsType'];
  label: string;
  icon: string;
}[] = [
  { value: 'wordpress', label: 'WordPress', icon: 'W' },
  { value: 'hubspot', label: 'HubSpot', icon: 'H' },
  { value: 'shopify', label: 'Shopify', icon: 'S' },
  { value: 'webflow', label: 'Webflow', icon: 'Wf' },
  { value: 'none', label: 'No CMS', icon: '—' },
  { value: 'other', label: 'Other', icon: '?' },
];

export function StepCms({ data, onChange }: StepCmsProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {CMS_OPTIONS.map((opt) => {
          const selected = data.cmsType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange({ cmsType: opt.value, otherCms: opt.value === 'other' ? data.otherCms : undefined })}
              className="flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-150"
              style={{
                borderColor: selected ? '#17C3B2' : undefined,
                backgroundColor: selected ? 'rgba(23,195,178,0.06)' : undefined,
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold"
                style={{
                  background: selected
                    ? 'linear-gradient(135deg, #17C3B2, #2C6BED)'
                    : 'var(--muted)',
                  color: selected ? '#ffffff' : 'var(--muted-foreground)',
                }}
              >
                {opt.icon}
              </div>
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* "Other" → text input */}
      {data.cmsType === 'other' && (
        <div className="animate-fade-in-up">
          <input
            type="text"
            value={data.otherCms ?? ''}
            onChange={(e) => onChange({ otherCms: e.target.value })}
            placeholder="Which CMS? We'll prioritise adding support for it."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Thank you — this helps shape our roadmap.
          </p>
        </div>
      )}

      {/* Hint for no CMS / other */}
      {(data.cmsType === 'none' || data.cmsType === 'other') && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            All outputs will be exported as CSV or Google Docs.
          </p>
        </div>
      )}
    </div>
  );
}
