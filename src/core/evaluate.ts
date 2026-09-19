import type { Portfolio, StrategyId, StrategyResult } from '../shared/types.js'
import type { ScenarioPath } from './scenarios.js'
import { STRATEGIES } from './strategies.js'

export type EvalConfig = {
  maxLoss: number
  minSurvivalRate: number
  transactionCost: number
}

function percentile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  const next = sorted[base + 1]
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
}

export function evaluateOne(
  strategyId: StrategyId,
  portfolio: Portfolio,
  paths: ScenarioPath[],
  config: EvalConfig,
): StrategyResult {
  const strategy = STRATEGIES.find((candidate) => candidate.id === strategyId)
  if (!strategy) throw new Error(`Unknown strategy: ${strategyId}`)

  const finals: number[] = []
  let survived = 0
  let worstLoss = 0
  let maxDrawdownSum = 0

  for (const prices of paths) {
    let btcUnits = portfolio.btcKrw / prices[0]
    let cash = portfolio.cashKrw
    const initialValue = portfolio.totalKrw
    let minimumValue = initialValue
    let peakValue = initialValue
    let pathMaxDrawdown = 0

    for (let day = 1; day < prices.length; day += 1) {
      const price = prices[day]
      const total = btcUnits * price + cash
      const currentRatio = total <= 0 ? 0 : (btcUnits * price) / total
      const target = strategy.targetBtcRatio({ day, prices, currentRatio })

      if (target !== null) {
        const desiredBtcValue = total * Math.max(0, Math.min(1, target))
        const currentBtcValue = btcUnits * price
        const delta = desiredBtcValue - currentBtcValue
        const fee = Math.abs(delta) * config.transactionCost

        btcUnits = desiredBtcValue / price
        cash = Math.max(0, total - desiredBtcValue - fee)
      }

      const marked = btcUnits * price + cash
      minimumValue = Math.min(minimumValue, marked)
      peakValue = Math.max(peakValue, marked)
      const dd = peakValue > 0 ? (peakValue - marked) / peakValue : 0
      pathMaxDrawdown = Math.max(pathMaxDrawdown, dd)
    }

    const finalValue = btcUnits * prices[prices.length - 1] + cash
    const minLoss = minimumValue / initialValue - 1
    finals.push(finalValue)
    worstLoss = Math.min(worstLoss, minLoss)
    maxDrawdownSum += pathMaxDrawdown
    if (minLoss >= -config.maxLoss) survived += 1
  }

  finals.sort((a, b) => a - b)
  const medianFinalValue = percentile(finals, 0.5)
  const survivalRate = paths.length === 0 ? 0 : survived / paths.length
  const avgMaxDrawdown = paths.length === 0 ? 0 : maxDrawdownSum / paths.length

  return {
    id: strategy.id,
    name: strategy.name,
    description: strategy.description,
    survivalRate,
    medianFinalValue,
    p05FinalValue: percentile(finals, 0.05),
    worstLoss,
    maxDrawdown: avgMaxDrawdown,
    medianReturn: portfolio.totalKrw === 0 ? 0 : medianFinalValue / portfolio.totalKrw - 1,
    eligible: survivalRate >= config.minSurvivalRate,
  }
}

export function pickWinner(results: StrategyResult[]): StrategyResult {
  if (results.length === 0) throw new Error('No strategy results to pick from')

  // Rule priority from PRD Section 17:
  // 1. 가장 많은 미래에서 손실 한도를 지킨 전략 (Survival rate 1위)
  // 2. 최악의 상황에서 손실이 작은 전략 (worstLoss 방어)
  // 3. 가장 크게 떨어진 폭이 작은 전략 (maxDrawdown 방어)
  // 4. 그래도 같으면 중앙값 수익률이 높은 전략 (medianReturn 1위)
  const sorted = [...results].sort((a, b) => {
    if (Math.abs(b.survivalRate - a.survivalRate) > 0.001) {
      return b.survivalRate - a.survivalRate
    }
    if (Math.abs(b.worstLoss - a.worstLoss) > 0.005) {
      return b.worstLoss - a.worstLoss // closer to 0 is better (e.g. -0.20 > -0.35)
    }
    if (Math.abs(a.maxDrawdown - b.maxDrawdown) > 0.005) {
      return a.maxDrawdown - b.maxDrawdown // lower MDD is better
    }
    return b.medianReturn - a.medianReturn
  })

  return sorted[0]
}
