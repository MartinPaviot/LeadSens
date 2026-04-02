"use client";

import { Ban, HelpCircle } from "lucide-react";
import type { OnboardingData } from "@/lib/onboarding-store";

interface StepCmsProps {
  data: OnboardingData;
  onChange: (partial: Partial<OnboardingData>) => void;
}

interface CmsOption {
  value: OnboardingData['cmsType'];
  label: string;
  logo?: string;
  icon?: 'ban' | 'help';
  iconColor?: string;
}

const CMS_OPTIONS: CmsOption[] = [
  { value: 'wordpress', label: 'WordPress', logo: '/logos/wordpress.png' },
  { value: 'hubspot', label: 'HubSpot', logo: '/logos/hubspot.png' },
  { value: 'shopify', label: 'Shopify', logo: '/logos/shopify.svg' },
  { value: 'webflow', label: 'Webflow', logo: '/logos/webflow.png' },
  { value: 'none', label: 'No CMS', icon: 'ban', iconColor: '#FF7A3D' },
  { value: 'other', label: 'Other', icon: 'help', iconColor: '#17C3B2' },
];

export function StepCms({ data, onChange }: StepCmsProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CMS_OPTIONS.map((opt) => {
          const selected = data.cmsType === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange({ cmsType: opt.value, otherCms: opt.value === 'other' ? data.otherCms : undefined })}
              className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-150"
              style={{
                borderColor: selected ? '#17C3B2' : undefined,
                backgroundColor: selected ? 'rgba(23,195,178,0.06)' : undefined,
              }}
            >
              {opt.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opt.logo} alt={opt.label} className="h-8 w-8 rounded object-contain" />
              ) : opt.icon === 'ban' ? (
                <Ban size={28} style={{ color: opt.iconColor }} />
              ) : (
                <HelpCircle size={28} style={{ color: opt.iconColor }} />
              )}
              <span className="text-xs font-medium text-foreground">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {data.cmsType === 'other' && (
        <div>
          <input
            type="text"
            value={data.otherCms ?? ''}
            onChange={(e) => onChange({ otherCms: e.target.value })}
            placeholder="Which CMS? We'll prioritise adding support for it."
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Thank you — this helps shape our roadmap.</p>
        </div>
      )}

      {(data.cmsType === 'none' || data.cmsType === 'other') && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground">All outputs will be exported as CSV or Google Docs.</p>
        </div>
      )}
    </div>
  );
}
