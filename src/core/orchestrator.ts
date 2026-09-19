import type { RunRequest, RunResult, StrategyId } from '../shared/types.js'
import { parsePortfolio } from './portfolio.js'
import { generatePaths, summarizeRepresentativeFutures } from './scenarios.js'
import { runAICouncil } from './aiCouncil.js'
import { createTimeLockSeal } from './timeLock.js'
import { pickWinner } from './evaluate.js'
import { localScenarioProvider, localStrategyExecutor } from '../providers/local.js'
import { nosanaScenarioProvider } from '../providers/nosana.js'
import { daytonaStrategyExecutor } from '../providers/daytona.js'

const STRATEGY_IDS: StrategyId[] = [
  'dca',
  'btc80',
  'btc60',
  'buy-dip',
  'trend',
  'risk-control',
  'momentum',
  'vol-breakout',
]

export async function runMultiverse(request: RunRequest): Promise<RunResult> {
  const portfolio = parsePortfolio(request.portfolioText)
  const isTimeLock = request.mode === 'time-lock'
  const cutoffDate = isTimeLock ? (request.cutoffDate || '2025-12-31') : undefined

  // 1. AI Council Analysis (Nosana Qwen 3.8 27B)
  const aiCouncil = await runAICouncil(portfolio, {
    ...request,
    cutoffDate,
  })

  // 2. Scenario Spec Generation (Nosana or Local)
  const scenarioProviderName = process.env.SCENARIO_PROVIDER === 'nosana' ? 'nosana' : 'local'
  const strategyExecutorName = process.env.STRATEGY_EXECUTOR === 'daytona' ? 'daytona' : 'local'

  const scenario =
    scenarioProviderName === 'nosana'
      ? await nosanaScenarioProvider(portfolio, { ...request, cutoffDate })
      : await localScenarioProvider(portfolio, { ...request, cutoffDate })

  // Incorporate AI Council's calibrated drift & volatility if available
  if (aiCouncil.annualDrift !== undefined && aiCouncil.annualVolatility !== undefined) {
    scenario.dailyDrift = aiCouncil.annualDrift / 365
    scenario.dailyVol = aiCouncil.annualVolatility / Math.sqrt(365)
  }

  // 3. Generate Paths for Representative Clustering
  const pathsForSummary = generatePaths({
    ...scenario,
    paths: Math.min(scenario.paths, 5000),
  })
  const representativeFutures = summarizeRepresentativeFutures(pathsForSummary)

  // 4. Daytona 8 Sandboxes Parallel Strategy Testing
  const strategies =
    strategyExecutorName === 'daytona'
      ? await daytonaStrategyExecutor(STRATEGY_IDS, portfolio, scenario)
      : await localStrategyExecutor(STRATEGY_IDS, portfolio, scenario)

  // 5. Select Winner & Passive Benchmark
  const winner = pickWinner(strategies)

  let passiveSurvived = 0
  for (const path of pathsForSummary) {
    const btcUnits = portfolio.btcKrw / path[0]
    const cash = portfolio.cashKrw
    let minVal = portfolio.totalKrw
    for (let day = 1; day < path.length; day++) {
      const val = btcUnits * path[day] + cash
      if (val < minVal) minVal = val
    }
    if (minVal / portfolio.totalKrw - 1 >= -0.25) passiveSurvived++
  }

  const hodlBaseline = {
    name: '단순 시장 보유 (벤치마크)',
    survivalRate: pathsForSummary.length > 0 ? passiveSurvived / pathsForSummary.length : 0.73,
  }

  // 6. Time Lock Seal (if Time Lock mode)
  const timeLockSeal = isTimeLock
    ? createTimeLockSeal(winner, scenario.paths, cutoffDate)
    : undefined

  return {
    portfolio,
    scenario,
    aiCouncil,
    representativeFutures,
    strategies,
    winner,
    hodlBaseline,
    timeLockSeal,
    engines: {
      scenarioProvider: scenarioProviderName,
      strategyExecutor: strategyExecutorName,
    },
    disclaimer:
      '시뮬레이션 비중은 실제 미래 확률을 보장하지 않습니다. 결과는 투자 조언이 아니라 다양한 미래 시나리오에서의 전략 내구성 스트레스 테스트입니다.',
  }
}
