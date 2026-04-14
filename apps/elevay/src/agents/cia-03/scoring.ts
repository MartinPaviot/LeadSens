import type { AgentProfile } from '@/agents/_shared/types'
import type {
  MessagingAnalysis,
  SeoAcquisitionData,
  SocialProfile,
  ContentAnalysisData,
  CompetitorScore,
} from './types'
import { fetchBenchmark } from './modules/benchmark'

export function calculateCompetitorScores(inputs: {
  messaging: MessagingAnalysis[] | null
  seo: SeoAcquisitionData | null
  social: SocialProfile[] | null
  content: ContentAnalysisData | null
  brandSocialScore?: number
  profile: AgentProfile
}): CompetitorScore[] {
  const { scores } = fetchBenchmark(inputs)
  return scores
}
