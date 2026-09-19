import crypto from 'crypto'
import type {
  BacktestComparison,
  Portfolio,
  StrategyId,
  StrategyResult,
  TimeLockSeal,
} from '../shared/types.js'
import { getFutureCandles } from './marketData.js'
import { STRATEGIES } from './strategies.js'

export function createTimeLockSeal(
  winner: StrategyResult,
  totalFutures: number,
  cutoffDate = '2025-12-31',
): TimeLockSeal {
  const sealedAt = new Date().toISOString()
  const payload = JSON.stringify({
    sealedAt,
    cutoffDate,
    winnerId: winner.id,
    survivalRate: winner.survivalRate,
    totalFutures,
  })

  const hash = crypto.createHash('sha256').update(payload).digest('hex')
  const survivalCount = Math.round(winner.survivalRate * totalFutures)

  return {
    sealedAt,
    cutoffDate,
    hash,
    winnerId: winner.id,
    winnerName: winner.name,
    survivalCount,
    totalFutures,
  }
}

export function evaluateOnRealCandles(
  strategyId: StrategyId | 'hodl',
  portfolio: Portfolio,
  candles: Array<{ date: string; close: number }>,
  maxLoss = 0.25,
  transactionCost = 0.001,
) {
  const strategy =
    strategyId === 'hodl'
      ? { id: 'hodl', name: '단순 시장 보유 (벤치마크)', targetBtcRatio: () => null }
      : STRATEGIES.find((s) => s.id === strategyId)

  if (!strategy) throw new Error(`Strategy not found: ${strategyId}`)

  const prices = new Float64Array(candles.map((c) => c.close))
  let btcUnits = portfolio.btcKrw / prices[0]
  let cash = portfolio.cashKrw
  const initialValue = portfolio.totalKrw
  let minimumValue = initialValue
  let peakValue = initialValue
  let worstDrawdown = 0

  const valueHistory: number[] = [initialValue]

  for (let day = 1; day < prices.length; day += 1) {
    const price = prices[day]
    const total = btcUnits * price + cash
    const currentRatio = total <= 0 ? 0 : (btcUnits * price) / total
    const target = strategy.targetBtcRatio({ day, prices, currentRatio })

    if (target !== null) {
      const desiredBtcValue = total * Math.max(0, Math.min(1, target))
      const currentBtcValue = btcUnits * price
      const delta = desiredBtcValue - currentBtcValue
      const fee = Math.abs(delta) * transactionCost

      btcUnits = desiredBtcValue / price
      cash = Math.max(0, total - desiredBtcValue - fee)
    }

    const marked = btcUnits * price + cash
    valueHistory.push(marked)
    minimumValue = Math.min(minimumValue, marked)
    peakValue = Math.max(peakValue, marked)
    const dd = peakValue > 0 ? (marked - peakValue) / peakValue : 0
    worstDrawdown = Math.min(worstDrawdown, dd)
  }

  const finalValue = valueHistory[valueHistory.length - 1]
  const totalReturn = initialValue === 0 ? 0 : finalValue / initialValue - 1
  const minLoss = minimumValue / initialValue - 1
  const survived = minLoss >= -maxLoss

  return {
    finalValue,
    worstDrawdown,
    totalReturn,
    survived,
    valueHistory,
  }
}

export function revealTimeLockBacktest(
  portfolio: Portfolio,
  winnerId: StrategyId,
  cutoffDate = '2025-12-31',
  days = 90,
  maxLoss = 0.25,
): BacktestComparison {
  const candles = getFutureCandles(cutoffDate, days)
  if (candles.length < 2) {
    throw new Error(`Insufficient future candles after ${cutoffDate}`)
  }

  const startDate = candles[0].date
  const endDate = candles[candles.length - 1].date

  const hodlResult = evaluateOnRealCandles('hodl', portfolio, candles, maxLoss)
  const mvResult = evaluateOnRealCandles(winnerId, portfolio, candles, maxLoss)
  const winnerStrategy = STRATEGIES.find((s) => s.id === winnerId)

  const priceHistory = candles.map((candle, idx) => ({
    date: candle.date,
    priceUsd: candle.close,
    hodlValue: hodlResult.valueHistory[idx],
    multiverseValue: mvResult.valueHistory[idx],
  }))

  return {
    period: `${startDate} ~ ${endDate} (90일)`,
    startDate,
    endDate,
    maxLossThreshold: maxLoss,
    hodl: {
      worstDrawdown: hodlResult.worstDrawdown,
      finalValue: Math.round(hodlResult.finalValue),
      totalReturn: hodlResult.totalReturn,
      survived: hodlResult.survived,
    },
    multiverse: {
      strategyId: winnerId,
      strategyName: winnerStrategy?.name || winnerId,
      worstDrawdown: mvResult.worstDrawdown,
      finalValue: Math.round(mvResult.finalValue),
      totalReturn: mvResult.totalReturn,
      survived: mvResult.survived,
    },
    priceHistory,
  }
}
