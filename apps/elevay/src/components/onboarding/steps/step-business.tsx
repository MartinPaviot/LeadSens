"use client";

import type { OnboardingData } from "@/lib/onboarding-store";

interface StepBusinessProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

export function StepBusiness({ data, onChange }: StepBusinessProps) {
  return (
    <div className="space-y-5">
      {/* Website URL */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Website URL</label>
        <input
          type="url"
          value={data.siteUrl}
          onChange={(e) => onChange({ siteUrl: e.target.value })}
          placeholder="https://yoursite.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Industry + Language (2 cols) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Industry / Sector</label>
          <input
            type="text"
            value={data.sector}
            onChange={(e) => onChange({ sector: e.target.value })}
            placeholder="e.g. B2B SaaS, e-commerce, consulting"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Primary language</label>
          <select
            value={data.language}
            onChange={(e) => onChange({ language: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="en">English</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="it">Italian</option>
            <option value="nl">Dutch</option>
          </select>
        </div>
      </div>

      {/* Target audience */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Target audience</label>
        <input
          type="text"
          value={data.targetAudience}
          onChange={(e) => onChange({ targetAudience: e.target.value })}
          placeholder="e.g. Marketing managers at mid-size companies"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Tone + CTA (2 cols) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Tone of voice</label>
          <select
            value={data.toneOfVoice}
            onChange={(e) => onChange({ toneOfVoice: e.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="technical">Technical</option>
            <option value="friendly">Friendly</option>
            <option value="authoritative">Authoritative</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-[11px] font-medium text-muted-foreground">Primary CTA</label>
          <input
            type="text"
            value={data.primaryCta}
            onChange={(e) => onChange({ primaryCta: e.target.value })}
            placeholder="e.g. Book a demo, Start free trial"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </div>
      </div>
    </div>
  );
}
