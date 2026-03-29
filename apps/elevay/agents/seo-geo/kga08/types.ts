import { KwScore } from '../../../core/types';

export interface Kga08Inputs {
  siteUrl: string;
  targetPages: string[];
  businessObjective: 'traffic' | 'lead-gen' | 'sales' | 'local-awareness';
  geoLevel: 'national' | 'regional' | 'city' | 'multi-geo';
  targetGeos: string[];
  competitors: string[];
  monthlyContentCapacity: number;
  seoMaturity: 'beginner' | 'intermediate' | 'advanced';
  prioritization: 'volume' | 'conversion';
  gscConnected: boolean;
  gbpId?: string;
  multiCountry: boolean;
}

export interface GeoMarketScore {
  geo: string;
  volume: number;
  commercialPotential: number;
  competition: number;
  entryEase: number;
  totalScore: number;
}

export interface CityLandingPage {
  city: string;
  keyword: string;
  monthlyVolume: number;
  keywordDifficulty: number;
  recommendedUrl: string;
  targetAgent: 'WPW-09';
}

export interface ActionPlan90d {
  month1: KwScore[];
  month2: KwScore[];
  month3: KwScore[];
}

export interface GbpAudit {
  profileId: string;
  missingFields: string[];
  recommendations: string[];
}

export interface HreflangPlan {
  needed: boolean;
  architecture: string;
  errors: string[];
  recommendations: string[];
}

export interface Kga08Output {
  kwScores: KwScore[];
  geoMarketScores: GeoMarketScore[];
  cityLandingPages: CityLandingPage[];
  actionPlan: ActionPlan90d;
  clusterMap: Record<string, KwScore[]>;
  gbpAudit?: GbpAudit;
  hreflangPlan?: HreflangPlan;
}
