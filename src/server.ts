import 'dotenv/config'
import express from 'express'
import { z } from 'zod'
import { runMultiverse } from './core/orchestrator.js'
import { revealTimeLockBacktest } from './core/timeLock.js'
import { checkDaytona } from './providers/daytona.js'
import { checkNosana } from './providers/nosana.js'
import type { StrategyId } from './shared/types.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

const requestSchema = z.object({
  portfolioText: z.string().min(1),
  mode: z.enum(['live', 'time-lock']).default('time-lock'),
  cutoffDate: z.string().optional(),
})

const revealSchema = z.object({
  portfolio: z.object({
    btcKrw: z.number(),
    cashKrw: z.number(),
    totalKrw: z.number(),
  }),
  winnerId: z.string(),
  cutoffDate: z.string().default('2025-12-31'),
})

app.get('/api/health', async (_req, res) => {
  const [daytona, nosana] = await Promise.all([checkDaytona(), checkNosana()])
  res.json({
    ok: true,
    providers: {
      configured: {
        scenario: process.env.SCENARIO_PROVIDER ?? 'nosana',
        strategy: process.env.STRATEGY_EXECUTOR ?? 'daytona',
      },
      daytona,
      nosana,
    },
  })
})

app.post('/api/run', async (req, res) => {
  try {
    const input = requestSchema.parse(req.body)
    const result = await runMultiverse(input)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Run error:', error)
    res.status(400).json({ error: message })
  }
})

app.post('/api/timelock/reveal', async (req, res) => {
  try {
    const input = revealSchema.parse(req.body)
    const result = revealTimeLockBacktest(
      input.portfolio,
      input.winnerId as StrategyId,
      input.cutoffDate,
      90,
      0.25,
    )
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('Reveal error:', error)
    res.status(400).json({ error: message })
  }
})

const port = Number(process.env.PORT || 8787)
app.listen(port, '127.0.0.1', () => {
  console.log(`MULTIVERSE API listening on http://127.0.0.1:${port}`)
})
