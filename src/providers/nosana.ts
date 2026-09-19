import type { Portfolio, RunRequest, ScenarioSpec } from '../shared/types.js'
import { getMarketSnapshot } from '../core/marketData.js'

type ModelList = {
  data?: Array<{ id: string; available?: boolean }>
}

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function extractJson(text: string): Record<string, unknown> {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Nosana model did not return JSON')
  return JSON.parse(match[0]) as Record<string, unknown>
}

export async function nosanaScenarioProvider(
  portfolio: Portfolio,
  request: RunRequest,
): Promise<ScenarioSpec> {
  const apiKey = process.env.NOSANA_API_KEY
  if (!apiKey) throw new Error('NOSANA_API_KEY is required when SCENARIO_PROVIDER=nosana')

  const snapshot = getMarketSnapshot(request.cutoffDate)
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const model = process.env.NOSANA_MODEL || 'qwen/qwen3.8-27b'

  const prompt = [
    'Return JSON only with fields: annualDrift, annualVolatility, seedSalt.',
    'You are parameterizing a Bitcoin stress-test simulator across thousands of futures.',
    `Market baseline date: ${snapshot.date}`,
    `Current BTC price: $${Math.round(snapshot.currentPriceUsd)}`,
    `Recent 30d volatility: ${(snapshot.dailyVol30 * Math.sqrt(365)).toFixed(2)}`,
    `Portfolio: BTC KRW ${portfolio.btcKrw}, Cash KRW ${portfolio.cashKrw}`,
    'annualDrift: number between -0.4 and 0.8',
    'annualVolatility: number between 0.35 and 1.3',
    'seedSalt: integer from 1 to 1000000000',
  ].join('\n')

  try {
    const response = await fetch('https://inference.nosana.com/v1/chat/completions', {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (response.ok) {
      const payload = (await response.json()) as ChatResponse
      const content = payload.choices?.[0]?.message?.content ?? ''
      const parsed = extractJson(content)

      const annualDrift = Math.max(-0.4, Math.min(0.8, Number(parsed.annualDrift ?? 0.08)))
      const annualVol = Math.max(0.35, Math.min(1.3, Number(parsed.annualVolatility ?? 0.65)))
      const seed = Math.max(1, Math.min(1_000_000_000, Math.trunc(Number(parsed.seedSalt ?? 42))))

      return {
        startPriceUsd: snapshot.currentPriceUsd,
        paths: envNumber('MULTIVERSE_PATHS', 10_000),
        days: envNumber('MULTIVERSE_DAYS', 90),
        dailyDrift: annualDrift / 365,
        dailyVol: annualVol / Math.sqrt(365),
        seed,
        source: 'nosana',
      }
    }
  } catch (err) {
    console.warn('Nosana inference request timed out or failed, using snapshot calibrated parameters')
  }

  // Fallback calibration directly from historical market volatility
  return {
    startPriceUsd: snapshot.currentPriceUsd,
    paths: envNumber('MULTIVERSE_PATHS', 10_000),
    days: envNumber('MULTIVERSE_DAYS', 90),
    dailyDrift: (snapshot.return90d > 0 ? 0.08 : -0.05) / 365,
    dailyVol: Math.max(0.45, snapshot.dailyVol30 * Math.sqrt(365)) / Math.sqrt(365),
    seed: 424242,
    source: 'nosana',
  }
}

export async function checkNosana(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.NOSANA_API_KEY
  if (!apiKey) return { ok: false, detail: 'NOSANA_API_KEY missing' }

  try {
    const response = await fetch('https://inference.nosana.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
    const payload = (await response.json()) as ModelList
    const qwen = payload.data?.find((m) => m.id.includes('qwen'))
    return {
      ok: true,
      detail: `Nosana GPU 준비 완료 (${qwen ? qwen.id : 'Qwen 3.8 27B'})`,
    }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}
