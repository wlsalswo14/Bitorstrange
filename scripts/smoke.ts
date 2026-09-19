import 'dotenv/config'
import { runMultiverse } from '../src/core/orchestrator.js'
import { revealTimeLockBacktest } from '../src/core/timeLock.js'
import { checkDaytona } from '../src/providers/daytona.js'
import { checkNosana } from '../src/providers/nosana.js'

async function smoke() {
  console.log('=== MULTIVERSE SMOKE TEST ===')

  console.log('[1/4] Checking Daytona...')
  const daytonaStatus = await checkDaytona()
  console.log('Daytona:', daytonaStatus)

  console.log('[2/4] Checking Nosana...')
  const nosanaStatus = await checkNosana()
  console.log('Nosana:', nosanaStatus)

  console.log('[3/4] Running Multiverse simulation...')
  const t0 = Date.now()
  const result = await runMultiverse({
    portfolioText: '비트코인 1000만원, 현금 500만원',
    mode: 'time-lock',
    cutoffDate: '2025-12-31',
  })
  console.log(`Simulation finished in ${(Date.now() - t0) / 1000}s`)
  console.log('Portfolio:', result.portfolio)
  console.log('Winner:', result.winner.name, `Survival: ${(result.winner.survivalRate * 100).toFixed(1)}%`)
  console.log('AI Council Regime:', result.aiCouncil.marketRegime)
  console.log('5 Futures:', result.representativeFutures.map((f) => `${f.label}: ${(f.share * 100).toFixed(1)}%`).join(' | '))
  console.log('Seal Hash:', result.timeLockSeal?.hash?.slice(0, 16) + '...')

  console.log('[4/4] Testing 2026 Real Backtest Reveal...')
  const reveal = revealTimeLockBacktest(result.portfolio, result.winner.id, '2025-12-31', 90)
  console.log('Reveal period:', reveal.period)
  console.log('  HODL Worst Drawdown:', (reveal.hodl.worstDrawdown * 100).toFixed(1) + '%', 'Final:', reveal.hodl.finalValue.toLocaleString(), 'Survived:', reveal.hodl.survived)
  console.log('  MULTIVERSE Worst Drawdown:', (reveal.multiverse.worstDrawdown * 100).toFixed(1) + '%', 'Final:', reveal.multiverse.finalValue.toLocaleString(), 'Survived:', reveal.multiverse.survived)

  console.log('=== SMOKE TEST ALL PASSED ===')
}

smoke().catch((err) => {
  console.error('Smoke test failed:', err)
  process.exit(1)
})
