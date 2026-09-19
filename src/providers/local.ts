import type { Portfolio, RunRequest, ScenarioSpec, StrategyId, StrategyResult } from '../shared/types.js'
import { portableEvaluate } from '../core/portable.js'

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function seedFrom(text: string): number {
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export async function localScenarioProvider(
  _portfolio: Portfolio,
  request: RunRequest,
): Promise<ScenarioSpec> {
  const key = `${request.mode ?? 'live'}:${request.cutoffDate ?? 'now'}`
  return {
    startPriceUsd: 100_000,
    paths: envNumber('MULTIVERSE_PATHS', 10_000),
    days: envNumber('MULTIVERSE_DAYS', 90),
    dailyDrift: 0.00025,
    dailyVol: 0.035,
    seed: seedFrom(key),
    source: 'local',
  }
}

export async function localStrategyExecutor(
  strategyIds: StrategyId[],
  portfolio: Portfolio,
  scenario: ScenarioSpec,
): Promise<StrategyResult[]> {
  const maxLoss = envNumber('MULTIVERSE_MAX_LOSS', 0.25)
  const minSurvivalRate = envNumber('MULTIVERSE_MIN_SURVIVAL', 0.9)

  return strategyIds.map((strategyId) =>
    portableEvaluate({
      strategyId,
      portfolio,
      scenario,
      maxLoss,
      minSurvivalRate,
      transactionCost: 0.001,
    }),
  )
}
