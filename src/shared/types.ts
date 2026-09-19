export type Portfolio = {
  btcKrw: number
  cashKrw: number
  totalKrw: number
}

export type AICouncilResult = {
  marketRegime: string
  trendStrength: number // 0 ~ 100
  marketInstability: number // 0 ~ 100
  newsImpact: number // -100 ~ 100
  liquidityState: number // 0 ~ 100
  tailRisk: number // 0 ~ 100
  annualDrift: number
  annualVolatility: number
  agents: {
    market: { title: string; status: 'completed' | 'analyzing'; summary: string }
    news: { title: string; status: 'completed' | 'analyzing'; summary: string }
    macro: { title: string; status: 'completed' | 'analyzing'; summary: string }
    risk: { title: string; status: 'completed' | 'analyzing'; summary: string }
  }
}

export type ScenarioSpec = {
  startPriceUsd: number
  paths: number
  days: number
  dailyDrift: number
  dailyVol: number
  seed: number
  source: 'local' | 'nosana'
}

export type StrategyId =
  | 'dca'
  | 'btc80'
  | 'btc60'
  | 'buy-dip'
  | 'trend'
  | 'risk-control'
  | 'momentum'
  | 'vol-breakout'

export type StrategyResult = {
  id: StrategyId
  name: string
  description: string
  survivalRate: number
  medianFinalValue: number
  p05FinalValue: number
  worstLoss: number
  maxDrawdown: number
  medianReturn: number
  eligible: boolean
}

export type RepresentativeFuture = {
  label: string
  share: number
  avgChange: number
  color: string
}

export type TimeLockSeal = {
  sealedAt: string
  cutoffDate: string
  hash: string
  winnerId: StrategyId
  winnerName: string
  survivalCount: number
  totalFutures: number
}

export type BacktestComparison = {
  period: string
  startDate: string
  endDate: string
  maxLossThreshold: number
  hodl: {
    worstDrawdown: number
    finalValue: number
    totalReturn: number
    survived: boolean
  }
  multiverse: {
    strategyId: StrategyId
    strategyName: string
    worstDrawdown: number
    finalValue: number
    totalReturn: number
    survived: boolean
  }
  priceHistory: Array<{
    date: string
    priceUsd: number
    hodlValue: number
    multiverseValue: number
  }>
}

export type RunRequest = {
  portfolioText: string
  mode?: 'live' | 'time-lock'
  cutoffDate?: string
}

export type RunResult = {
  portfolio: Portfolio
  scenario: ScenarioSpec
  aiCouncil: AICouncilResult
  representativeFutures: RepresentativeFuture[]
  strategies: StrategyResult[]
  winner: StrategyResult
  hodlBaseline: {
    name: string
    survivalRate: number
  }
  timeLockSeal?: TimeLockSeal
  engines: {
    scenarioProvider: string
    strategyExecutor: string
  }
  disclaimer: string
}
