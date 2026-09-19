import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export type Candle = {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

let cachedCandles: Candle[] | null = null

export function loadAllCandles(): Candle[] {
  if (cachedCandles) return cachedCandles
  const jsonPath = path.resolve(__dirname, '../data/btc-candles.json')
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    cachedCandles = JSON.parse(raw) as Candle[]
    return cachedCandles
  }
  return []
}

export type MarketSnapshot = {
  currentPriceUsd: number
  date: string
  recentPrices: number[]
  dailyVol30: number
  dailyVol90: number
  return30d: number
  return90d: number
  recentTrend: 'bullish' | 'bearish' | 'neutral'
}

export function getMarketSnapshot(cutoffDate?: string): MarketSnapshot {
  const candles = loadAllCandles()
  const filtered = cutoffDate
    ? candles.filter((c) => c.date <= cutoffDate)
    : candles

  if (filtered.length === 0) {
    return {
      currentPriceUsd: 87648,
      date: cutoffDate ?? '2025-12-31',
      recentPrices: [87648],
      dailyVol30: 0.55 / Math.sqrt(365),
      dailyVol90: 0.60 / Math.sqrt(365),
      return30d: 0.05,
      return90d: 0.12,
      recentTrend: 'bullish',
    }
  }

  const lastCandle = filtered[filtered.length - 1]
  const recent30 = filtered.slice(-30)
  const recent90 = filtered.slice(-90)

  function calcVol(series: Candle[]): number {
    if (series.length < 2) return 0.55 / Math.sqrt(365)
    const logReturns: number[] = []
    for (let i = 1; i < series.length; i++) {
      logReturns.push(Math.log(series[i].close / series[i - 1].close))
    }
    const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length
    const variance = logReturns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / logReturns.length
    return Math.sqrt(variance)
  }

  const p0 = recent30[0]?.close ?? lastCandle.close
  const p0_90 = recent90[0]?.close ?? lastCandle.close
  const return30d = lastCandle.close / p0 - 1
  const return90d = lastCandle.close / p0_90 - 1

  const trend: 'bullish' | 'bearish' | 'neutral' =
    return30d > 0.04 ? 'bullish' : return30d < -0.04 ? 'bearish' : 'neutral'

  return {
    currentPriceUsd: lastCandle.close,
    date: lastCandle.date,
    recentPrices: filtered.slice(-30).map((c) => c.close),
    dailyVol30: calcVol(recent30),
    dailyVol90: calcVol(recent90),
    return30d,
    return90d,
    recentTrend: trend,
  }
}

export function getFutureCandles(startDate: string, days: number): Candle[] {
  const candles = loadAllCandles()
  const startIndex = candles.findIndex((c) => c.date >= startDate)
  if (startIndex === -1) return []
  return candles.slice(startIndex, startIndex + days + 1)
}
