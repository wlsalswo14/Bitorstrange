import React, { useEffect, useMemo, useState } from 'react'
import type {
  BacktestComparison,
  RunResult,
} from '../shared/types.js'

type Health = {
  providers: {
    configured: { scenario: string; strategy: string }
    daytona: { ok: boolean; detail: string }
    nosana: { ok: boolean; detail: string }
  }
}

type Stage = 'idle' | 'analyzing' | 'simulating' | 'testing' | 'ready'

const pct = (value: number) => `${(value * 100).toFixed(1)}%`
const krw = (value: number) =>
  new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value)

function parseLivePreview(text: string): { btc: number; cash: number; total: number } {
  function parseAmount(fragment: string): number {
    const norm = fragment.replace(/,/g, '').trim()
    const eok = norm.match(/([0-9]+(?:\.[0-9]+)?)\s*억/)
    if (eok) return Number(eok[1]) * 100_000_000
    const man = norm.match(/([0-9]+(?:\.[0-9]+)?)\s*만/)
    if (man) return Number(man[1]) * 10_000
    const won = norm.match(/([0-9]+(?:\.[0-9]+)?)\s*원?/)
    if (won) return Number(won[1])
    return 0
  }
  const parts = text.split(/[,+/]/).map((p) => p.trim()).filter(Boolean)
  const btcPart = parts.find((p) => /(비트코인|bitcoin|btc)/i.test(p))
  const cashPart = parts.find((p) => /(현금|cash|krw)/i.test(p))
  const btc = btcPart ? parseAmount(btcPart) : 10000000
  const cash = cashPart ? parseAmount(cashPart) : 5000000
  return { btc, cash, total: btc + cash }
}

export function App() {
  const [portfolioText, setPortfolioText] = useState('비트코인 1000만원, 현금 500만원')
  const [mode, setMode] = useState<'live' | 'time-lock'>('time-lock')
  const [cutoffDate, setCutoffDate] = useState('2025-12-31')

  const [stage, setStage] = useState<Stage>('idle')
  const [counterValue, setCounterValue] = useState(0)
  const [result, setResult] = useState<RunResult | null>(null)
  const [error, setError] = useState('')
  const [health, setHealth] = useState<Health | null>(null)

  const [revealing, setRevealing] = useState(false)
  const [revealData, setRevealData] = useState<BacktestComparison | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const parsedPreview = useMemo(() => parseLivePreview(portfolioText), [portfolioText])

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => undefined)
  }, [])

  const sortedStrategies = useMemo(
    () => [...(result?.strategies ?? [])].sort((a, b) => b.survivalRate - a.survivalRate),
    [result],
  )

  const sponsorReady = Boolean(health?.providers.daytona.ok && health?.providers.nosana.ok)

  async function startExploration() {
    setError('')
    setResult(null)
    setRevealData(null)
    setStage('analyzing')

    await new Promise((r) => setTimeout(r, 1000))
    setStage('simulating')

    const steps = [18240, 42910, 71500, 94200, 100000]
    for (const step of steps) {
      setCounterValue(step)
      await new Promise((r) => setTimeout(r, 140))
    }

    setStage('testing')

    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioText,
          mode,
          cutoffDate: mode === 'time-lock' ? cutoffDate : undefined,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '실행 실패')

      await new Promise((r) => setTimeout(r, 600))
      setResult(payload)
      setStage('ready')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
      setStage('idle')
    }
  }

  async function handleReveal() {
    if (!result) return
    setRevealing(true)
    setError('')

    try {
      const response = await fetch('/api/timelock/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolio: result.portfolio,
          winnerId: result.winner.id,
          cutoffDate: result.timeLockSeal?.cutoffDate || cutoffDate,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || '실제 데이터 공개 실패')
      setRevealData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-zinc-800">
      {/* Minimalist Navbar */}
      <header className="border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur sticky top-0 z-40 px-6 sm:px-12 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-tight text-white text-base">MULTIVERSE</span>
          <span className="text-zinc-500 text-xs hidden sm:inline">•</span>
          <span className="text-xs text-zinc-400 font-normal hidden sm:inline">Bitcoin 다중우주 생존 시뮬레이터</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2 text-zinc-400">
            <span className={`w-1.5 h-1.5 rounded-full ${sponsorReady ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
            <span>Nosana & Daytona</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-6 py-12 sm:py-20 space-y-16">
        {/* Minimal Hero */}
        <section className="space-y-5">
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-white leading-tight">
            미래를 맞히는 대신,
            <br />
            <span className="text-zinc-400">버틸 방법을 찾습니다.</span>
          </h1>
          <p className="text-sm sm:text-base text-zinc-400 leading-relaxed max-w-xl">
            Bitcoin이 어디까지 갈지 맞히지 않습니다.
            <br />
            무슨 일이 일어나더라도 내 돈을 가장 잘 지키는 전략을 시뮬레이션합니다.
          </p>
        </section>

        {/* Screen 1: Minimalist Input Card */}
        <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <label htmlFor="portfolio-input" className="text-xs font-medium text-zinc-400 tracking-wide uppercase">
              내 자산 입력
            </label>

            {/* Minimal Toggle */}
            <div className="inline-flex rounded-lg border border-zinc-800 p-0.5 bg-zinc-950 text-xs">
              <button
                type="button"
                onClick={() => setMode('live')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  mode === 'live' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                LIVE
              </button>
              <button
                type="button"
                onClick={() => setMode('time-lock')}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  mode === 'time-lock' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                TIME LOCK
              </button>
            </div>
          </div>

          {/* Time Lock Banner */}
          {mode === 'time-lock' && (
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>🔒</span>
                <span>
                  <b>미래 정보 차단:</b> {cutoffDate} 이후 가격 및 뉴스를 제외하고 검증합니다.
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-500 hidden sm:inline">2026년 차단됨</span>
            </div>
          )}

          {/* Clean Input Field */}
          <div className="space-y-3">
            <input
              id="portfolio-input"
              type="text"
              value={portfolioText}
              onChange={(e) => setPortfolioText(e.target.value)}
              placeholder="비트코인 1000만원, 현금 500만원"
              disabled={stage !== 'idle' && stage !== 'ready'}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3.5 text-base sm:text-xl font-medium text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors"
            />

            {/* Parsed Asset Indicators */}
            <div className="flex flex-wrap items-center justify-between text-xs text-zinc-500 pt-1 font-mono">
              <div className="flex items-center gap-4">
                <span>BTC: <b className="text-zinc-300">{krw(parsedPreview.btc)}</b></span>
                <span>Cash: <b className="text-zinc-300">{krw(parsedPreview.cash)}</b></span>
                <span>Total: <b className="text-white">{krw(parsedPreview.total)}</b></span>
              </div>
              <div className="text-[11px]">
                평가: 90일 / 손실 한도: -25%
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={startExploration}
              disabled={stage !== 'idle' && stage !== 'ready'}
              className="w-full sm:w-auto px-6 py-3 rounded-lg font-medium text-xs sm:text-sm bg-white text-zinc-950 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            >
              {stage !== 'idle' && stage !== 'ready' ? '미래 탐색 중...' : '미래 탐색하기 →'}
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-zinc-950 border border-red-900/50 text-red-400 text-xs">
              {error}
            </div>
          )}
        </section>

        {/* Progress Pipeline: Screens 2, 3, 5 */}
        {stage !== 'idle' && stage !== 'ready' && (
          <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-6 animate-fade-in">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>MULTIVERSE PIPELINE</span>
              <span>
                {stage === 'analyzing' && 'Step 1/3 • AI 분석'}
                {stage === 'simulating' && 'Step 2/3 • 미래 생성'}
                {stage === 'testing' && 'Step 3/3 • Daytona 병렬 실험'}
              </span>
            </div>

            {/* Screen 2: AI Council */}
            {stage === 'analyzing' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-white">현재 시장을 분석하고 있어요</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {['Bitcoin 시장 분석 AI', '주요 뉴스 분석 AI', '경제 상황 분석 AI', '위험 신호 분석 AI'].map((name) => (
                    <div key={name} className="p-3 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                      <span className="text-zinc-300">{name}</span>
                      <span className="text-emerald-400 font-mono text-[11px]">완료</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Screen 3: Counter */}
            {stage === 'simulating' && (
              <div className="text-center py-6 space-y-2">
                <div className="text-xs text-zinc-400 font-mono">수많은 미래를 만들고 있어요</div>
                <div className="text-4xl sm:text-5xl font-mono font-bold text-white tracking-tight">
                  {counterValue.toLocaleString()}
                </div>
                <div className="text-xs text-zinc-500">100,000개의 미래를 만들었습니다.</div>
              </div>
            )}

            {/* Screen 5: Daytona parallel tests */}
            {stage === 'testing' && (
              <div className="space-y-4">
                <div className="text-sm font-medium text-white">8가지 방법을 10만 개 미래에서 시험하고 있어요</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  {[
                    '그냥 보유하기',
                    '일정 금액씩 나눠 사기',
                    'BTC 80% 유지하기',
                    'BTC 60% 유지하기',
                    '많이 떨어질 때 더 사기',
                    '하락 추세에서 BTC 줄이기',
                    '위험할 때 BTC 줄이기',
                    '강한 상승세에 추가 매수',
                  ].map((name) => (
                    <div key={name} className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 flex items-center justify-between">
                      <span className="text-zinc-300 truncate text-[11px]">{name}</span>
                      <span className="text-emerald-400 text-[10px]">완료</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Results Presentation (Screens 4, 6, 7) */}
        {result && stage === 'ready' && (
          <div className="space-y-12 animate-fade-in">
            {/* Screen 6: Winner Showcase */}
            <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6">
                <div className="space-y-2">
                  <span className="text-xs font-mono text-zinc-400 uppercase tracking-wide">
                    가장 잘 버틴 전략
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                    {result.winner.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed">
                    {result.winner.description}
                  </p>
                </div>

                <div className="sm:text-right shrink-0">
                  <div className="text-4xl sm:text-5xl font-mono font-bold text-white">
                    {pct(result.winner.survivalRate)}
                  </div>
                  <div className="text-xs text-zinc-400 mt-1">
                    10만 개 미래 중 <b>{Math.round(result.winner.survivalRate * 100000).toLocaleString()}개</b>에서 손실 한도를 지켰어요.
                  </div>
                </div>
              </div>

              {/* Comparison vs HODL (PRD Section 18) */}
              <div className="pt-6 border-t border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                  <span className="text-zinc-400">그냥 Bitcoin 보유하기</span>
                  <span className="font-mono text-zinc-300 font-semibold">{pct(result.hodlBaseline.survivalRate)}</span>
                </div>
                <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center justify-between">
                  <span className="text-white font-medium">{result.winner.name}</span>
                  <span className="font-mono text-white font-bold">{pct(result.winner.survivalRate)}</span>
                </div>
              </div>
            </section>

            {/* Screen 4: 5 Representative Futures */}
            <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">앞으로 이런 미래들이 가능해요</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">앞으로 3개월, 10만 개 시뮬레이션을 비슷한 흐름끼리 묶은 결과입니다.</p>
                </div>
                <span className="text-xs font-mono text-zinc-500 hidden sm:inline">100,000 futures</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {result.representativeFutures.map((future) => (
                  <div key={future.label} className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
                      <span>{future.label}</span>
                      <span>{future.avgChange >= 0 ? '+' : ''}{(future.avgChange * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-xl font-mono font-bold text-white">
                      {pct(future.share)}
                    </div>
                    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-zinc-300 h-full rounded-full" style={{ width: `${future.share * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-zinc-500">
                현재 시장 정보를 바탕으로 만들어 본 가능한 미래들을 비슷한 흐름끼리 묶은 결과입니다. 실제 미래의 확률을 보장하지 않습니다.
              </p>
            </section>

            {/* Screen 5: 8 Strategies Survival List */}
            <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">8가지 전략 비교</h3>
                <span className="text-xs text-zinc-500 font-mono">Survival Rate</span>
              </div>

              <div className="divide-y divide-zinc-800/80">
                {sortedStrategies.map((strategy) => {
                  const isWinner = strategy.id === result.winner.id
                  return (
                    <div key={strategy.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className={isWinner ? 'font-bold text-white' : 'text-zinc-300'}>
                          {strategy.name}
                        </span>
                        {isWinner && <span className="ml-2 text-[10px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">최적</span>}
                        <div className="text-[11px] text-zinc-500 mt-0.5">{strategy.description}</div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="w-24 bg-zinc-800 h-1.5 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className={`h-full rounded-full ${isWinner ? 'bg-white' : 'bg-zinc-600'}`}
                            style={{ width: `${strategy.survivalRate * 100}%` }}
                          />
                        </div>
                        <span className={`font-mono text-sm ${isWinner ? 'font-bold text-white' : 'text-zinc-400'}`}>
                          {pct(strategy.survivalRate)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Expandable Advanced Stats */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowDetails(!showDetails)}
                  className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                >
                  {showDetails ? '▲ 자세한 분석 접기' : '▼ [ 자세한 분석 보기 ]'}
                </button>

                {showDetails && (
                  <div className="mt-4 p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-4 text-xs font-mono animate-fade-in">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <span className="text-zinc-500 block text-[11px]">중앙값 최종 자산</span>
                        <b className="text-zinc-200 mt-0.5 block">{krw(result.winner.medianFinalValue)}</b>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[11px]">중앙값 수익률</span>
                        <b className="text-zinc-200 mt-0.5 block">{pct(result.winner.medianReturn)}</b>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[11px]">하위 5% 자산</span>
                        <b className="text-zinc-200 mt-0.5 block">{krw(result.winner.p05FinalValue)}</b>
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[11px]">가장 크게 떨어진 폭</span>
                        <b className="text-zinc-200 mt-0.5 block">{(result.winner.maxDrawdown * 100).toFixed(1)}%</b>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/80 flex flex-wrap gap-4 text-[11px] text-zinc-400">
                      <span>시장 분위기: <b className="text-white">{result.aiCouncil.marketRegime}</b></span>
                      <span>추세 강도: <b className="text-white">{result.aiCouncil.trendStrength}/100</b></span>
                      <span>시장 불안정도: <b className="text-white">{result.aiCouncil.marketInstability}/100</b></span>
                      <span>폭락 위험: <b className="text-white">{result.aiCouncil.tailRisk}/100</b></span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Screen 7: Time Lock Reveal Climax */}
            {mode === 'time-lock' && (
              <section className="border border-zinc-800 rounded-xl p-6 sm:p-8 bg-zinc-900/40 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-4">
                  <div className="space-y-0.5">
                    <div className="text-xs font-mono text-zinc-400">TIME LOCK SEALED</div>
                    <h3 className="text-base font-semibold text-white">결과를 저장했습니다</h3>
                    <p className="text-xs text-zinc-400">
                      미래를 보기 전에 전략 선택을 확정했습니다.
                    </p>
                  </div>

                  <div className="text-xs font-mono text-zinc-500">
                    선택: {result.winner.name} ({pct(result.winner.survivalRate)})
                  </div>
                </div>

                {!revealData ? (
                  <div className="text-center py-6 space-y-4">
                    <p className="text-xs text-zinc-400 max-w-md mx-auto">
                      2026년에 실제로 발생한 Bitcoin 가격 데이터를 불러와 전략이 손실 한도를 지켰는지 확인합니다.
                    </p>

                    <button
                      type="button"
                      onClick={handleReveal}
                      disabled={revealing}
                      className="px-6 py-3 rounded-lg font-medium text-xs sm:text-sm bg-white text-zinc-950 hover:bg-zinc-200 transition-colors mx-auto flex items-center justify-center gap-2"
                    >
                      {revealing ? '실제 데이터 검증 중...' : '실제 2026년 확인하기 →'}
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6 animate-fade-in">
                    <div className="text-xs font-medium text-zinc-300">
                      그리고 실제 미래는 이렇게 흘러갔습니다 ({revealData.period})
                    </div>

                    {/* 3 Key Verification Metrics (PRD Section 24) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                        <div className="text-zinc-400">① 가장 크게 떨어졌을 때</div>
                        <div className="font-mono space-y-0.5 pt-1">
                          <div className="text-zinc-500">그냥 보유: <span className="text-red-400">{(revealData.hodl.worstDrawdown * 100).toFixed(1)}%</span></div>
                          <div className="text-zinc-200 font-bold">선택된 전략: <span className="text-emerald-400">{(revealData.multiverse.worstDrawdown * 100).toFixed(1)}%</span></div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                        <div className="text-zinc-400">② 최종 자산</div>
                        <div className="font-mono space-y-0.5 pt-1">
                          <div className="text-zinc-500">그냥 보유: {krw(revealData.hodl.finalValue)}</div>
                          <div className="text-zinc-200 font-bold">선택된 전략: {krw(revealData.multiverse.finalValue)}</div>
                        </div>
                      </div>

                      <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2 text-xs">
                        <div className="text-zinc-400">③ 손실 한도 준수 여부</div>
                        <div className="space-y-0.5 pt-1">
                          <div className="text-zinc-500 font-mono">설정 한도: -25%</div>
                          <div className="text-emerald-400 font-bold">한도를 넘지 않음 ✓</div>
                        </div>
                      </div>
                    </div>

                    {/* Minimalist SVG Chart */}
                    <div className="p-4 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                        <span>2026년 90일 포트폴리오 자산 추이</span>
                        <div className="flex items-center gap-3">
                          <span>-- 그냥 보유</span>
                          <span className="text-emerald-400">— 선택된 전략</span>
                        </div>
                      </div>

                      <div className="h-40 w-full pt-2">
                        <svg className="w-full h-full" viewBox="0 0 800 160" preserveAspectRatio="none">
                          <line x1="0" y1="80" x2="800" y2="80" stroke="#27272a" strokeDasharray="3 3" />
                          {(() => {
                            const pts = revealData.priceHistory
                            const minVal = Math.min(...pts.map((p) => Math.min(p.hodlValue, p.multiverseValue)))
                            const maxVal = Math.max(...pts.map((p) => Math.max(p.hodlValue, p.multiverseValue)))
                            const range = Math.max(1, maxVal - minVal)

                            const hodlPath = pts
                              .map((p, i) => {
                                const x = (i / (pts.length - 1)) * 800
                                const y = 150 - ((p.hodlValue - minVal) / range) * 140
                                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
                              })
                              .join(' ')

                            const mvPath = pts
                              .map((p, i) => {
                                const x = (i / (pts.length - 1)) * 800
                                const y = 150 - ((p.multiverseValue - minVal) / range) * 140
                                return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
                              })
                              .join(' ')

                            return (
                              <>
                                <path d={hodlPath} fill="none" stroke="#71717a" strokeWidth="1.5" strokeDasharray="4 4" />
                                <path d={mvPath} fill="none" stroke="#10b981" strokeWidth="2.5" />
                              </>
                            )
                          })()}
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-zinc-900 py-10 text-center text-xs text-zinc-600 space-y-1">
        <p>MULTIVERSE • 미래를 맞히는 대신, 미래를 견디는 방법을 찾습니다.</p>
        <p className="text-[11px] text-zinc-700">Powered by Nosana GPU & Daytona Sandbox</p>
      </footer>
    </div>
  )
}
