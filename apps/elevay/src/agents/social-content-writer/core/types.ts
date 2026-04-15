// ── Platforms & Formats ──────────────────────────────────

export type Platform =
  | "instagram"
  | "facebook"
  | "tiktok"
  | "linkedin"
  | "pinterest"
  | "threads"
  | "youtube"
  | "x"
  | "reddit"

export type ContentFormat =
  | "caption" // Short: 50–500 words
  | "long-form" // Long: 300–3000 words (LinkedIn post, article)
  | "thread" // X thread: 5–10 tweets
  | "reddit-ama" // Reddit discussion/AMA post
  | "article" // LinkedIn Pulse article

export type PostObjective =
  | "engagement"
  | "awareness"
  | "traffic"
  | "conversion"
  | "thought-leadership"
  | "recruitment"
  | "activation"

// ── Brand Voice ─────────────────────────────────────────

export type BrandPositioning =
  | "thought-leader"
  | "brand-expert"
  | "personal-brand"
  | "corporate"

export interface PlatformOverride {
  preferredLength?: number
  tone?: string
  hashtagCount?: number
  ctaType?: string
}

export interface BrandVoiceProfile {
  style: string // e.g. "data-driven, short storytelling"
  register: string // e.g. "professional but human"
  forbiddenWords: string[]
  keyPhrases: string[]
  positioning: BrandPositioning
  platformOverrides?: Partial<Record<Platform, PlatformOverride>>
  examplePosts?: string[]
  calibratedAt?: string // ISO 8601
}

// ── Brief ───────────────────────────────────────────────

export interface ContentBrief {
  format: ContentFormat
  platforms: Platform[]
  objective: PostObjective
  sourceContent: string // Raw text, idea, angle, link
  tone?: string // Override of global tone
  hashtags?: string[] // Provided by client
  mentions?: string[] // Accounts to cite
  cta?: string // Specific CTA
  crossPlatform: boolean // Enable cross-platform mode
  variationsCount: 1 | 2 | 3
}

// ── Generation Output ───────────────────────────────────

export interface GeneratedVariation {
  platform: Platform
  format: ContentFormat
  variationIndex: number // 0, 1, 2
  content: string
  hashtags: string[]
  cta: string
  characterCount: number
  characterLimit: number
  mediaSuggestions?: string[]
}

export interface ThreadTweet {
  index: number // 1, 2, 3...
  content: string
  characterCount: number
  hook?: string // Transition hook to next tweet
}

export interface GenerationOutput {
  brief: ContentBrief
  variations: GeneratedVariation[]
  threads?: Record<string, ThreadTweet[]> // Key = variationId
  crossPlatformSource?: string // Source post if cross-platform mode
  hashtagsUsed: string[]
  benchmarkInsights?: string // BuzzSumo summary
  generatedAt: string // ISO 8601
}

// ── Analyzer ────────────────────────────────────────────

export interface AnalyzerInsights {
  hashtags: string[]
  trendingTopics: string[]
  competitorHooks: string[]
  bestPerformingFormats: string[]
}

// ── Export ───────────────────────────────────────────────

export type ExportFormat = "csv" | "sheets" | "hootsuite" | "buffer" | "loomly"

export interface ExportResult {
  format: ExportFormat
  url?: string // Download URL or sheet URL
  itemCount: number
  exportedAt: string
}
