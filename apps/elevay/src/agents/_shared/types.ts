// AgentProfile — profil mutualisé aux 3 agents BMI
export interface ElevayAgentProfile {
  organisationId: string
  brand_name: string
  brand_url: string
  country: string
  language: string
  competitors: { name: string; url: string }[]
  primary_keyword: string
  secondary_keyword: string
}

// ModuleResult — contrat de retour de chaque module (jamais de throw)
export interface ModuleResult<T> {
  success: boolean
  data: T | null
  source: string
  error?: { code: string; message: string }
  degraded?: boolean
}

// AgentOutput — contrat inter-agents V2-ready
export interface AgentOutput<T> {
  agent_code: 'BPI-01' | 'MTS-02' | 'CIA-03'
  analysis_date: string       // ISO 8601
  brand_profile: ElevayAgentProfile
  payload: T
  degraded_sources: string[]
  version: '1.0'
}
