import type { ElevayAgentProfile } from "../_shared/types";

export interface CiaInput {
  brand_profile: ElevayAgentProfile;
  company: string;
  product: string;
  targetAudience?: string;
  goals?: string[];
}

export interface ProductMessagingData {
  valueProposition: string;
  differentiators: string[];
  messagingPillars: string[];
}

export interface SeoAcquisitionData {
  targetKeywords: { keyword: string; volume: number; difficulty: number }[];
  contentStrategy: string[];
  technicalGaps: string[];
}

export interface SocialMediaData {
  channels: { name: string; priority: "high" | "medium" | "low"; rationale: string }[];
  contentMix: { type: string; percentage: number }[];
}

export interface ContentData {
  formats: string[];
  editorialCalendar: { theme: string; week: number }[];
  toneOfVoice: string;
}

export interface BenchmarkData {
  competitors: { name: string; positioning: string; score: number }[];
  industryAvgScore: number;
}

export interface RecommendationsData {
  quickWins: string[];
  strategicInitiatives: string[];
  kpis: string[];
}

export interface CiaOutput {
  productMessaging: ProductMessagingData | null;
  seoAcquisition: SeoAcquisitionData | null;
  socialMedia: SocialMediaData | null;
  content: ContentData | null;
  benchmark: BenchmarkData | null;
  recommendations: RecommendationsData | null;
}
