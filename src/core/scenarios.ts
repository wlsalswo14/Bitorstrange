import type { RepresentativeFuture, ScenarioSpec } from '../shared/types.js'
import { mulberry32, normal } from './random.js'

export type ScenarioPath = Float64Array

export function generatePaths(spec: ScenarioSpec): ScenarioPath[] {
  const rng = mulberry32(spec.seed)
  const result: ScenarioPath[] = new Array(spec.paths)

  for (let p = 0; p < spec.paths; p += 1) {
    const path = new Float64Array(spec.days + 1)
    path[0] = spec.startPriceUsd

    for (let day = 1; day <= spec.days; day += 1) {
      const shock = normal(rng)
      const logReturn =
        spec.dailyDrift - 0.5 * spec.dailyVol ** 2 + spec.dailyVol * shock
      path[day] = path[day - 1] * Math.exp(logReturn)
    }

    result[p] = path
  }

  return result
}

export function summarizeRepresentativeFutures(
  paths: ScenarioPath[],
): RepresentativeFuture[] {
  // 5 bins:
  // 1. 크게 오른다 (>= +20%)
  // 2. 천천히 오른다 (+5% ~ +20%)
  // 3. 비슷하게 움직인다 (-5% ~ +5%)
  // 4. 꽤 떨어진다 (-20% ~ -5%)
  // 5. 크게 떨어진다 (< -20%)
  const counts = [0, 0, 0, 0, 0]
  const returnsSum = [0, 0, 0, 0, 0]

  for (const path of paths) {
    const change = path[path.length - 1] / path[0] - 1
    if (change >= 0.20) {
      counts[0] += 1
      returnsSum[0] += change
    } else if (change >= 0.05) {
      counts[1] += 1
      returnsSum[1] += change
    } else if (change > -0.05) {
      counts[2] += 1
      returnsSum[2] += change
    } else if (change > -0.20) {
      counts[3] += 1
      returnsSum[3] += change
    } else {
      counts[4] += 1
      returnsSum[4] += change
    }
  }

  const labels = [
    '크게 오른다',
    '천천히 오른다',
    '비슷하게 움직인다',
    '꽤 떨어진다',
    '크게 떨어진다',
  ]

  const colors = [
    '#10b981', // green
    '#34d399', // light green
    '#94a3b8', // slate/gray
    '#fb923c', // orange
    '#ef4444', // red
  ]

  const total = paths.length || 1

  return labels.map((label, idx) => ({
    label,
    share: counts[idx] / total,
    avgChange: counts[idx] > 0 ? returnsSum[idx] / counts[idx] : 0,
    color: colors[idx],
  }))
}
