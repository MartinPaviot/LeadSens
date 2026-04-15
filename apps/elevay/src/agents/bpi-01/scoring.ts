import type {
  SerpData,
  PressData,
  YoutubeData,
  SocialData,
  SeoData,
  BenchmarkData,
  BpiScores,
} from "./types"

const WEIGHTS = {
  serp: 0.2,
  press: 0.15,
  youtube: 0.15,
  social: 0.15,
  seo: 0.2,
  benchmark: 0.15,
} as const

type WeightKey = keyof typeof WEIGHTS

const PRESS_SCORE_PER_ARTICLE = 5
const PRESS_SENTIMENT_BONUS: Record<string, number> = {
  positive: 20,
  neutral: 10,
  mixed: 5,
  negative: 0,
}

function derivePressScore(press: PressData | null): number {
  if (!press) return 0
  const base = Math.min(100, press.article_count * PRESS_SCORE_PER_ARTICLE)
  const sentimentBonus = PRESS_SENTIMENT_BONUS[press.sentiment] ?? 0
  return Math.min(100, base + sentimentBonus)
}

export function calculateBpiScores(modules: {
  serp: SerpData | null
  press: PressData | null
  youtube: YoutubeData | null
  social: SocialData | null
  seo: SeoData | null
  benchmark: BenchmarkData | null
}): Omit<BpiScores, "previous"> {
  const entries = Object.entries(modules) as Array<
    [
      WeightKey,
      | SerpData
      | PressData
      | YoutubeData
      | SocialData
      | SeoData
      | BenchmarkData
      | null,
    ]
  >
  const available = entries.filter(([, v]) => v !== null)

  if (available.length === 0) {
    return {
      global: 0,
      serp: 0,
      press: 0,
      youtube: 0,
      social: 0,
      seo: 0,
      benchmark: 0,
      completeness: 0,
    }
  }

  const totalWeight = available.reduce((s, [k]) => s + WEIGHTS[k], 0)
  const completeness = Math.round((available.length / 6) * 100)

  const axisScores: Record<WeightKey, number> = {
    serp: modules.serp?.visibility_score ?? 0,
    press: derivePressScore(modules.press),
    youtube: modules.youtube?.reputation_score ?? 0,
    social: modules.social?.social_score ?? 0,
    seo: modules.seo?.seo_score ?? 0,
    benchmark: modules.benchmark?.benchmark_score ?? 0,
  }

  const global = Math.round(
    available.reduce((sum, [k]) => {
      const normalizedWeight = WEIGHTS[k] / totalWeight
      return sum + axisScores[k] * normalizedWeight
    }, 0),
  )

  return {
    global,
    serp: axisScores.serp,
    press: axisScores.press,
    youtube: axisScores.youtube,
    social: axisScores.social,
    seo: axisScores.seo,
    benchmark: axisScores.benchmark,
    completeness,
  }
}
