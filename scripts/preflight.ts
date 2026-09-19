import 'dotenv/config'
import { checkDaytona } from '../src/providers/daytona.js'
import { checkNosana } from '../src/providers/nosana.js'
import { loadAllCandles } from '../src/core/marketData.js'

async function preflight() {
  console.log('=== MULTIVERSE PREFLIGHT CHECK ===')

  console.log('1. Checking Historical Bitcoin Data...')
  const candles = loadAllCandles()
  console.log(`   ✓ Loaded ${candles.length} daily candles (${candles[0]?.date} ~ ${candles[candles.length - 1]?.date})`)

  console.log('2. Checking Daytona API...')
  const daytona = await checkDaytona()
  console.log(`   ${daytona.ok ? '✓' : '⚠'} Daytona status:`, daytona.detail)

  console.log('3. Checking Nosana GPU Inference...')
  const nosana = await checkNosana()
  console.log(`   ${nosana.ok ? '✓' : '⚠'} Nosana status:`, nosana.detail)

  console.log('4. Environment Configuration:')
  console.log('   PORT:', process.env.PORT || 8787)
  console.log('   SCENARIO_PROVIDER:', process.env.SCENARIO_PROVIDER || 'nosana')
  console.log('   STRATEGY_EXECUTOR:', process.env.STRATEGY_EXECUTOR || 'daytona')
  console.log('   NOSANA_MODEL:', process.env.NOSANA_MODEL || 'qwen/qwen3.8-27b')

  console.log('\n✓ Preflight checks finished successfully!')
}

preflight().catch((err) => {
  console.error('Preflight error:', err)
  process.exit(1)
})
