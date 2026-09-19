import type { StrategyId } from '../shared/types.js'

export type Strategy = {
  id: StrategyId
  name: string
  description: string
  targetBtcRatio: (ctx: {
    day: number
    prices: Float64Array
    currentRatio: number
  }) => number | null
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function sma(prices: Float64Array, end: number, window: number): number {
  const start = Math.max(0, end - window + 1)
  let sum = 0
  for (let i = start; i <= end; i += 1) sum += prices[i]
  return sum / (end - start + 1)
}

function realizedVol(prices: Float64Array, end: number, window: number): number {
  const start = Math.max(1, end - window + 1)
  if (end - start < 2) return 0
  const returns: number[] = []
  for (let i = start; i <= end; i += 1) {
    returns.push(Math.log(prices[i] / prices[i - 1]))
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length
  const variance = returns.reduce((sum, x) => sum + (x - mean) ** 2, 0) / returns.length
  return Math.sqrt(variance) * Math.sqrt(365)
}

export const STRATEGIES: Strategy[] = [
  {
    id: 'hodl',
    name: '그냥 보유하기',
    description: '초기 비트코인과 현금을 그대로 유지하며 시장 전체의 변동을 감내하는 기본 방식입니다.',
    targetBtcRatio: () => null,
  },
  {
    id: 'dca',
    name: '일정 금액씩 나눠 사기',
    description: '초기 보유 현금을 30일에 걸쳐 균등하게 전액 분할 매수하여 비트코인 매입 단가를 평단화합니다.',
    targetBtcRatio: ({ day, currentRatio }) =>
      day <= 30 ? clamp(currentRatio + (1 - currentRatio) / Math.max(2, 31 - day)) : null,
  },
  {
    id: 'btc80',
    name: 'BTC 80% 유지하기',
    description: '비트코인 가치가 변할 때마다 전체 포트폴리오의 80% 수준으로 적극 재투자하여 리밸런싱합니다.',
    targetBtcRatio: () => 0.8,
  },
  {
    id: 'btc60',
    name: 'BTC 60% 유지하기',
    description: '비트코인 60%, 유동성 40% 비중으로 균형 있게 투자하여 하락 시 완충 효과를 얻습니다.',
    targetBtcRatio: () => 0.6,
  },
  {
    id: 'buy-dip',
    name: '많이 떨어질 때 더 사기',
    description: '최근 20일 고점 대비 -12% 이상 급락했을 때 저가 매수 기회로 보고 비트코인을 적극 추가 매수합니다.',
    targetBtcRatio: ({ day, prices, currentRatio }) => {
      const from = Math.max(0, day - 20)
      let peak = prices[from]
      for (let i = from; i <= day; i += 1) peak = Math.max(peak, prices[i])
      const drawdown = prices[day] / peak - 1
      return drawdown <= -0.12 ? clamp(currentRatio + 0.25) : null
    },
  },
  {
    id: 'trend',
    name: '하락 추세에서 BTC 줄이기',
    description: '단기 이동평균이 장기 이동평균을 하향 돌파하면 비트코인 비중을 축소하고, 반등 시 즉시 재투자합니다.',
    targetBtcRatio: ({ day, prices }) => {
      if (day < 14) return null
      return sma(prices, day, 7) < sma(prices, day, 20) ? 0.35 : 0.85
    },
  },
  {
    id: 'risk-control',
    name: '위험할 때 BTC 비중 줄이기',
    description: '시장이 크게 흔들리기 시작하면 Bitcoin 일부를 현금으로 바꿔 큰 손실을 줄이고, 안정되면 다시 매수하는 방식입니다.',
    targetBtcRatio: ({ day, prices }) => {
      if (day < 7) return null
      const vol = realizedVol(prices, day, 7)
      if (vol > 0.85) return 0.25
      if (vol > 0.60) return 0.50
      return 0.85
    },
  },
  {
    id: 'momentum',
    name: '강한 상승세에 추가 매수하기',
    description: '비트코인이 최근 14일간 강한 상승 모멘텀을 보일 때 비중을 90% 이상으로 확대해 수익을 극대화합니다.',
    targetBtcRatio: ({ day, prices }) => {
      if (day < 14) return null
      const return14d = prices[day] / prices[day - 14] - 1
      return return14d > 0.08 ? 0.95 : 0.70
    },
  },
]
