"use client";

import type { OnboardingData } from "@/lib/onboarding-store";

interface StepBusinessProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

export function StepBusiness({ data, onChange }: StepBusinessProps) {
  return (
    <div className="space-y-5">
      {/* Brand name + Sector (2 cols) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Brand name" helper="Used in content and meta descriptions">
          <input
            type="text"
            value={data.brandName}
            onChange={(e) => onChange({ brandName: e.target.value })}
            placeholder="e.g. Louis Pion, Elevay"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </Field>
        <Field label="Industry / Sector" helper="Helps agents use the right vocabulary">
          <input
            type="text"
            value={data.sector}
            onChange={(e) => onChange({ sector: e.target.value })}
            placeholder="e.g. B2B SaaS, e-commerce"
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
        </Field>
      </div>

      {/* Tone + Language (2 cols) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Tone of voice" helper="Applied to all generated content">
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
        </Field>
        <Field label="Primary language" helper="Language for all generated content">
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
        </Field>
      </div>

      {/* Website URL (full width) */}
      <Field label="Website URL" helper="We'll crawl your site to analyse your current SEO performance">
        <input
          type="url"
          value={data.siteUrl}
          onChange={(e) => onChange({ siteUrl: e.target.value })}
          placeholder="https://yoursite.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </Field>
    </div>
  );
}

function Field({ label, helper, children }: { label: string; helper?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{label}</label>
      {helper && <p className="mb-1.5 text-[11px] text-muted-foreground/70">{helper}</p>}
      {children}
    </div>
  );
}
