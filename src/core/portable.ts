import type { Portfolio, ScenarioSpec, StrategyId, StrategyResult } from '../shared/types.js'

export type PortableInput = {
  strategyId: StrategyId
  portfolio: Portfolio
  scenario: ScenarioSpec
  maxLoss: number
  minSurvivalRate: number
  transactionCost: number
}

export function portableEvaluate(input: PortableInput): StrategyResult {
  function rngFactory(seed: number) {
    let a = seed >>> 0
    return function rng() {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  function gaussian(rng: () => number) {
    let u = 0
    let v = 0
    while (u === 0) u = rng()
    while (v === 0) v = rng()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  function clamp(value: number) {
    return Math.max(0, Math.min(1, value))
  }

  const meta: Record<StrategyId, { name: string; description: string }> = {
    hodl: {
      name: '그냥 보유하기',
      description: '초기 비트코인과 현금을 그대로 유지하며 시장 전체의 변동을 감내하는 기본 방식입니다.',
    },
    dca: {
      name: '일정 금액씩 나눠 사기',
      description: '초기 보유 현금을 30일에 걸쳐 균등하게 전액 분할 매수하여 비트코인 매입 단가를 평단화합니다.',
    },
    btc80: {
      name: 'BTC 80% 유지하기',
      description: '비트코인 가치가 변할 때마다 전체 포트폴리오의 80% 수준으로 적극 재투자하여 리밸런싱합니다.',
    },
    btc60: {
      name: 'BTC 60% 유지하기',
      description: '비트코인 60%, 유동성 40% 비중으로 균형 있게 투자하여 하락 시 완충 효과를 얻습니다.',
    },
    'buy-dip': {
      name: '많이 떨어질 때 더 사기',
      description: '최근 20일 고점 대비 -12% 이상 급락했을 때 저가 매수 기회로 보고 비트코인을 적극 추가 매수합니다.',
    },
    trend: {
      name: '하락 추세에서 BTC 줄이기',
      description: '단기 이동평균이 장기 이동평균을 하향 돌파하면 비트코인 비중을 축소하고, 반등 시 즉시 재투자합니다.',
    },
    'risk-control': {
      name: '위험할 때 BTC 비중 줄이기',
      description: '시장이 크게 흔들리기 시작하면 Bitcoin 일부를 현금으로 바꿔 큰 손실을 줄이고, 안정되면 다시 매수하는 방식입니다.',
    },
    momentum: {
      name: '강한 상승세에 추가 매수하기',
      description: '비트코인이 최근 14일간 강한 상승 모멘텀을 보일 때 비중을 90% 이상으로 확대해 수익을 극대화합니다.',
    },
  }

  function sma(prices: number[], end: number, window: number) {
    const start = Math.max(0, end - window + 1)
    let sum = 0
    for (let i = start; i <= end; i += 1) sum += prices[i]
    return sum / (end - start + 1)
  }

  function annualizedVol(prices: number[], end: number, window: number) {
    const start = Math.max(1, end - window + 1)
    if (end - start < 2) return 0
    const rs: number[] = []
    for (let i = start; i <= end; i += 1) rs.push(Math.log(prices[i] / prices[i - 1]))
    const mean = rs.reduce((a, b) => a + b, 0) / rs.length
    const variance = rs.reduce((sum, x) => sum + (x - mean) ** 2, 0) / rs.length
    return Math.sqrt(variance) * Math.sqrt(365)
  }

  function targetRatio(
    id: StrategyId,
    day: number,
    prices: number[],
    currentRatio: number,
  ): number | null {
    if (id === 'hodl') return null
    if (id === 'dca') {
      return day <= 30 ? clamp(currentRatio + (1 - currentRatio) / Math.max(2, 31 - day)) : null
    }
    if (id === 'btc80') return 0.8
    if (id === 'btc60') return 0.6

    if (id === 'buy-dip') {
      let peak = prices[Math.max(0, day - 20)]
      for (let i = Math.max(0, day - 20); i <= day; i += 1) peak = Math.max(peak, prices[i])
      return prices[day] / peak - 1 <= -0.12 ? clamp(currentRatio + 0.25) : null
    }

    if (id === 'trend') {
      if (day < 14) return null
      return sma(prices, day, 7) < sma(prices, day, 20) ? 0.35 : 0.85
    }

    if (id === 'risk-control') {
      if (day < 7) return null
      const vol = annualizedVol(prices, day, 7)
      if (vol > 0.85) return 0.25
      if (vol > 0.60) return 0.50
      return 0.85
    }

    if (id === 'momentum') {
      if (day < 14) return null
      const ret14 = prices[day] / prices[day - 14] - 1
      return ret14 > 0.08 ? 0.95 : 0.70
    }

    return null
  }

  function percentile(sorted: number[], q: number) {
    if (sorted.length === 0) return 0
    const pos = (sorted.length - 1) * q
    const base = Math.floor(pos)
    const rest = pos - base
    const next = sorted[base + 1]
    return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base])
  }

  const rng = rngFactory(input.scenario.seed)
  const finals: number[] = []
  let survived = 0
  let worstLoss = 0
  let maxDrawdownSum = 0

  for (let p = 0; p < input.scenario.paths; p += 1) {
    const prices = new Array<number>(input.scenario.days + 1)
    prices[0] = input.scenario.startPriceUsd
    for (let day = 1; day <= input.scenario.days; day += 1) {
      const z = gaussian(rng)
      const logReturn =
        input.scenario.dailyDrift -
        0.5 * input.scenario.dailyVol ** 2 +
        input.scenario.dailyVol * z
      prices[day] = prices[day - 1] * Math.exp(logReturn)
    }

    let btcUnits = input.portfolio.btcKrw / prices[0]
    let cash = input.portfolio.cashKrw
    const initial = input.portfolio.totalKrw
    let minimum = initial
    let peak = initial
    let maxDd = 0

    for (let day = 1; day < prices.length; day += 1) {
      const price = prices[day]
      const total = btcUnits * price + cash
      const currentRatio = total <= 0 ? 0 : (btcUnits * price) / total
      const target = targetRatio(input.strategyId, day, prices, currentRatio)

      if (target !== null) {
        const desiredBtcValue = total * clamp(target)
        const delta = desiredBtcValue - btcUnits * price
        const fee = Math.abs(delta) * input.transactionCost
        btcUnits = desiredBtcValue / price
        cash = Math.max(0, total - desiredBtcValue - fee)
      }

      const marked = btcUnits * price + cash
      minimum = Math.min(minimum, marked)
      peak = Math.max(peak, marked)
      const dd = peak > 0 ? (peak - marked) / peak : 0
      maxDd = Math.max(maxDd, dd)
    }

    const finalValue = btcUnits * prices[prices.length - 1] + cash
    const loss = minimum / initial - 1
    finals.push(finalValue)
    worstLoss = Math.min(worstLoss, loss)
    maxDrawdownSum += maxDd
    if (loss >= -input.maxLoss) survived += 1
  }

  finals.sort((a, b) => a - b)
  const survivalRate = input.scenario.paths === 0 ? 0 : survived / input.scenario.paths
  const medianFinalValue = percentile(finals, 0.5)
  const avgMaxDrawdown = input.scenario.paths === 0 ? 0 : maxDrawdownSum / input.scenario.paths

  return {
    id: input.strategyId,
    name: meta[input.strategyId]?.name ?? input.strategyId,
    description: meta[input.strategyId]?.description ?? '',
    survivalRate,
    medianFinalValue,
    p05FinalValue: percentile(finals, 0.05),
    worstLoss,
    maxDrawdown: avgMaxDrawdown,
    medianReturn: input.portfolio.totalKrw === 0 ? 0 : medianFinalValue / input.portfolio.totalKrw - 1,
    eligible: survivalRate >= input.minSurvivalRate,
  }
}
