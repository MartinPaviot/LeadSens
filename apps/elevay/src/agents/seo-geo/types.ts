// SEO-GEO specific profile — does NOT extend ElevayAgentProfile (different domain)

export type SeoAutomationLevel = 'audit' | 'semi-auto' | 'full-auto';
export type SeoCmsType = 'wordpress' | 'hubspot' | 'shopify' | 'webflow' | 'other';
export type SeoGeoLevel = 'national' | 'regional' | 'city' | 'multi-geo';
export type SeoAlertChannel = 'slack' | 'email' | 'report';

export interface SeoAgentProfile {
  siteUrl: string;
  cmsType: SeoCmsType;
  automationLevel: SeoAutomationLevel;
  geoLevel: SeoGeoLevel;
  targetGeos: string[];
  priorityPages: string[];
  alertChannels: SeoAlertChannel[];
  connectedTools: {
    gsc: boolean;
    ga: boolean;
    ahrefs: boolean;
    semrush: boolean;
  };
}

export interface SeoAgentOutput<T> {
  agent_code:
    | 'PIO-05' | 'OPT-06' | 'TSI-07' | 'KGA-08'
    | 'WPW-09' | 'BSW-10' | 'MDG-11' | 'ALT-12';
  analysis_date: string;
  seo_profile: SeoAgentProfile;
  payload: T;
  degraded_sources: string[];
  version: '1.0';
}

// Onboarding state — mirrors core/onboarding/types.ts for use inside src/
export interface SeoOnboardingState {
  step:
    | 'site_url' | 'cms' | 'tools_connection'
    | 'automation_level' | 'geo' | 'priority_pages'
    | 'alert_channel' | 'confirmation' | 'complete';
  collected: Partial<SeoAgentProfile>;
  missingTools: string[];
}
