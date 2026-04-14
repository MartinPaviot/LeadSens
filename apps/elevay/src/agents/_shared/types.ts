// Agent profile (built from ElevayBrandProfile DB row)
export interface AgentProfile {
  workspaceId: string
  brand_name: string
  brand_url: string
  country: string
  language: string // "fr" | "en" | ...
  competitors: Array<{ name: string; url: string }>
  primary_keyword: string
  secondary_keyword: string
  sector?: string
  priority_channels?: string[]
  objective?: string
  // Social OAuth (Composio connected accounts)
  facebookConnected?: boolean
  facebookComposioAccountId?: string
  instagramConnected?: boolean
  instagramComposioAccountId?: string
}

// Standardized result from each module
export interface ModuleResult<T> {
  success: boolean
  data: T | null
  source: string // e.g. "serp", "gnews"
  error?: { code: string; message: string }
  degraded?: boolean // true = partial but usable
}

// Final envelope persisted in DB
export interface AgentOutput<T> {
  agent_code:
    | "BPI-01"
    | "MTS-02"
    | "CIA-03"
    // Future Elevay agents (SEO/GEO family)
    | "PIO-05"
    | "OPT-06"
    | "TSI-07"
    | "KGA-08"
    | "WPW-09"
    | "BSW-10"
    | "MDG-11"
    | "ALT-12"
  analysis_date: string // ISO 8601
  brand_profile: AgentProfile
  payload: T
  degraded_sources: string[]
  version: "1.0"
}

// LLM request
export interface LLMRequest {
  system: string
  user: string
  maxTokens?: number // default: 4096
  temperature?: number // default: 0.3
}

// LLM response
export interface LLMResponse {
  content: string // raw text
  parsed: unknown // JSON.parse(content) or null
  tokens: { input: number; output: number }
  latencyMs: number
  model: string
}
