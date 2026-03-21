import type { ElevayAgentProfile } from "../_shared/types";

export interface MtsInput {
  brand_profile: ElevayAgentProfile;
  topic: string;
  industry?: string;
  region?: string;
  timeframe?: "7d" | "30d" | "90d";
}

export interface TrendData {
  keyword: string;
  volume: number;
  growth: number;
  relatedTopics: string[];
}

export interface ContentData {
  topPerforming: { title: string; url: string; engagement: number }[];
  contentGaps: string[];
}

export interface CompetitiveData {
  competitors: { name: string; strengths: string[]; weaknesses: string[] }[];
}

export interface SocialListeningData {
  hashtags: { tag: string; volume: number }[];
  influencers: { handle: string; followers: number; relevance: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
}

export interface SynthesisData {
  opportunities: string[];
  threats: string[];
  recommendations: string[];
}

export interface MtsOutput {
  trends: TrendData[] | null;
  content: ContentData | null;
  competitive: CompetitiveData | null;
  socialListening: SocialListeningData | null;
  synthesis: SynthesisData | null;
}
