import type { Portfolio } from '../shared/types.js'

function parseKrwAmount(fragment: string): number {
  const normalized = fragment.replace(/,/g, '').trim()
  const eok = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*억/)
  if (eok) return Number(eok[1]) * 100_000_000

  const man = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*만/)
  if (man) return Number(man[1]) * 10_000

  const won = normalized.match(/([0-9]+(?:\.[0-9]+)?)\s*원?/)
  if (won) return Number(won[1])

  return 0
}

function extractNear(text: string, keyword: RegExp): number {
  const parts = text
    .split(/[,+/]/)
    .map((part) => part.trim())
    .filter(Boolean)

  const hit = parts.find((part) => keyword.test(part))
  return hit ? parseKrwAmount(hit) : 0
}

export function parsePortfolio(text: string): Portfolio {
  const btcKrw = extractNear(text, /(비트코인|bitcoin|btc)/i)
  const cashKrw = extractNear(text, /(현금|cash|krw)/i)

  if (btcKrw <= 0 && cashKrw <= 0) {
    throw new Error('예: "비트코인 1000만원, 현금 500만원"처럼 입력하세요.')
  }

  return {
    btcKrw,
    cashKrw,
    totalKrw: btcKrw + cashKrw,
  }
}
