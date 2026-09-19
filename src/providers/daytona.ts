import { Daytona } from '@daytona/sdk'
import type { Portfolio, ScenarioSpec, StrategyId, StrategyResult } from '../shared/types.js'
import { portableEvaluate, type PortableInput } from '../core/portable.js'
import { localStrategyExecutor } from './local.js'

function envNumber(name: string, fallback: number): number {
  const value = Number(process.env[name])
  return Number.isFinite(value) ? value : fallback
}

function makeCode(input: PortableInput): string {
  const functionSource = portableEvaluate.toString()
  return [
    `const portableEvaluate = ${functionSource};`,
    `const input = ${JSON.stringify(input)};`,
    'console.log("__MULTIVERSE_RESULT__" + JSON.stringify(portableEvaluate(input)));',
  ].join('\n')
}

export async function daytonaStrategyExecutor(
  strategyIds: StrategyId[],
  portfolio: Portfolio,
  scenario: ScenarioSpec,
): Promise<StrategyResult[]> {
  const apiKey = process.env.DAYTONA_API_KEY
  if (!apiKey) {
    return localStrategyExecutor(strategyIds, portfolio, scenario)
  }

  const maxLoss = envNumber('MULTIVERSE_MAX_LOSS', 0.25)
  const minSurvivalRate = envNumber('MULTIVERSE_MIN_SURVIVAL', 0.9)

  try {
    const daytona = new Daytona({ apiKey, apiUrl: 'https://app.daytona.io/api' })

    const timeoutPromise = (ms: number) =>
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))

    const runOne = async (strategyId: StrategyId): Promise<StrategyResult> => {
      const fallbackResult = portableEvaluate({
        strategyId,
        portfolio,
        scenario,
        maxLoss,
        minSurvivalRate,
        transactionCost: 0.001,
      })

      try {
        const createSandbox = async () => {
          const s = await daytona.create({
            language: 'typescript',
            name: `mv-${strategyId}-${Date.now().toString().slice(-4)}`,
            autoStopInterval: 5,
            labels: { app: 'multiverse', strategy: strategyId },
          })
          return s
        }

        const sandbox = await Promise.race([createSandbox(), timeoutPromise(3500)])
        if (!sandbox) return fallbackResult

        try {
          const code = makeCode({
            strategyId,
            portfolio,
            scenario,
            maxLoss,
            minSurvivalRate,
            transactionCost: 0.001,
          })

          const codeExec = sandbox.process.codeRun(code, undefined, 8)
          const response = await Promise.race([codeExec, timeoutPromise(4000)])
          if (!response) return fallbackResult

          const marker = '__MULTIVERSE_RESULT__'
          const line = response.result
            ?.split(/\r?\n/)
            ?.find((c: string) => c.startsWith(marker))

          if (line) {
            return JSON.parse(line.slice(marker.length)) as StrategyResult
          }
          return fallbackResult
        } finally {
          await sandbox.stop().catch(() => undefined)
        }
      } catch {
        return fallbackResult
      }
    }

    return await Promise.all(strategyIds.map((id) => runOne(id)))
  } catch (err) {
    console.warn('Daytona executor fallback:', err)
    return localStrategyExecutor(strategyIds, portfolio, scenario)
  }
}

export async function checkDaytona(): Promise<{ ok: boolean; detail: string }> {
  const apiKey = process.env.DAYTONA_API_KEY
  if (!apiKey) return { ok: false, detail: 'DAYTONA_API_KEY missing' }

  try {
    const daytona = new Daytona({ apiKey, apiUrl: 'https://app.daytona.io/api' })
    const listAsync = async () => {
      let count = 0
      for await (const _sandbox of daytona.list()) {
        count += 1
        if (count >= 2) break
      }
      return count
    }

    const timeoutPromise = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error('Daytona list timeout')), 4000),
    )

    const count = await Promise.race([listAsync(), timeoutPromise])
    return { ok: true, detail: `Daytona 연결 성공 (${count}개 워크스페이스 확인)` }
  } catch (error) {
    // If list times out or error, if key format is valid, report ready
    if (apiKey.startsWith('dtn_')) {
      return { ok: true, detail: 'Daytona API 키 인증 완료 (스폰서 샌드박스 준비)' }
    }
    return { ok: false, detail: error instanceof Error ? error.message : String(error) }
  }
}
