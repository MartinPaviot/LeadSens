export interface BpiInput {
  brand: string;
  competitors?: string[];
  market?: string;
}

export interface SerpData {
  query: string;
  results: { title: string; url: string; snippet: string }[];
}

export interface PressData {
  articles: { title: string; source: string; date: string; url: string }[];
}

export interface YoutubeData {
  videos: { title: string; channel: string; views: number; url: string }[];
}

export interface SocialData {
  platform: string;
  mentions: number;
  sentiment: "positive" | "neutral" | "negative";
}

export interface SeoData {
  domainAuthority: number;
  organicKeywords: number;
  backlinks: number;
}

export interface BenchmarkData {
  competitors: { name: string; score: number }[];
  category: string;
}

export interface BpiOutput {
  serp: SerpData;
  press: PressData;
  youtube: YoutubeData;
  social: SocialData[];
  seo: SeoData;
  benchmark: BenchmarkData;
}
