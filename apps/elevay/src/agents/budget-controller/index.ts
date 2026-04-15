import type {
  BudgetConfig,
  ChannelMetrics,
  HealthScore,
  Alert,
  AnnualProjection,
  BudgetDashboardData,
} from "./core/types"
import { BDG_AGENT_CODE, BDG_VERSION } from "./core/constants"
import { calculateHealthScore } from "./modules/health-scorer"
import { detectAnomalies } from "./modules/anomaly-detector"
import { projectAnnual } from "./modules/projector"

export interface BDGRunResult {
  agentCode: typeof BDG_AGENT_CODE
  version: typeof BDG_VERSION
  dashboard: BudgetDashboardData
  durationMs: number
}

/**
 * Main orchestrator for the Budget Controller agent.
 *
 * Flow: Collect Data → Health Score → Anomaly Detection → Projection → Dashboard
 */
export async function runBDG(
  config: BudgetConfig,
  channelMetrics: ChannelMetrics[],
  previousHealthScore?: number,
): Promise<BDGRunResult> {
  const startedAt = Date.now()

  // 1. Calculate health score
  const healthScore = calculateHealthScore(
    config,
    channelMetrics,
    previousHealthScore,
  )

  // 2. Detect anomalies
  const alerts = detectAnomalies(config, channelMetrics)

  // 3. Project annual
  const currentMonth = new Date().getMonth() + 1
  const monthsElapsed =
    currentMonth >= config.fiscalYearStart
      ? currentMonth - config.fiscalYearStart
      : 12 - config.fiscalYearStart + currentMonth
  const projection = projectAnnual(config, channelMetrics, monthsElapsed)

  return {
    agentCode: BDG_AGENT_CODE,
    version: BDG_VERSION,
    dashboard: {
      healthScore,
      channelMetrics,
      activeAlerts: alerts,
      lastProjection: projection,
      lastSyncAt: new Date().toISOString(),
    },
    durationMs: Date.now() - startedAt,
  }
}
