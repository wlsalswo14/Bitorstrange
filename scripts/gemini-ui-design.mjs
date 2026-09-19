import fs from 'node:fs/promises'

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) throw new Error('GEMINI_API_KEY missing')

const app = await fs.readFile('src/ui/App.tsx', 'utf8')
const types = await fs.readFile('src/shared/types.ts', 'utf8')

const prompt = `
You are the lead product designer for a hackathon demo called MULTIVERSE.

Product:
- User enters one line such as "비트코인 1000만원, 현금 500만원".
- LIVE or TIME LOCK mode.
- System generates many plausible Bitcoin futures.
- 8 fixed strategies are tested in parallel.
- Result shows representative futures, the selected strategy, survival rate, median final value, downside value, and an 8-strategy comparison.
- Korean-first UI.
- The product message is: "미래를 맞히는 대신, 미래를 견디는 방법을 찾습니다."

Design direction from the owner:
- clean minimalism
- sophisticated, calm, trustworthy
- demo must be readable in seconds on a projector
- absolutely avoid crypto-bro visuals, cyberpunk, neon glow, gradients, glassmorphism, excessive cards, dashboard clutter, fake candlestick decoration
- avoid looking like a bank admin dashboard
- generous whitespace, strong typography, restrained color
- desktop-first but responsive
- UI should make TIME LOCK feel meaningful without theatrical gimmicks
- preserve the current functional fields and result data
- prioritize one clear primary action

Give me a concrete design specification I can implement directly.
Return ONLY valid JSON matching exactly this shape:
{
  "concept": "one sentence",
  "theme": {
    "mode": "light or dark",
    "background": "#hex",
    "surface": "#hex",
    "text": "#hex",
    "muted": "#hex",
    "accent": "#hex",
    "border": "#hex"
  },
  "typography": {
    "fontStack": "CSS font-family stack",
    "heroSize": "CSS clamp",
    "bodySize": "CSS value",
    "numberStyle": "short description"
  },
  "layout": {
    "maxWidth": "CSS value",
    "sectionGap": "CSS value",
    "description": "short description"
  },
  "components": {
    "header": "short concrete description",
    "input": "short concrete description",
    "modeToggle": "short concrete description",
    "loading": "short concrete description",
    "futures": "short concrete description",
    "winner": "short concrete description",
    "strategies": "short concrete description",
    "providerStatus": "short concrete description"
  },
  "rules": [
    "6 to 10 specific visual rules"
  ]
}

Current React UI:
--- App.tsx ---
${app}

Current result types:
--- types.ts ---
${types}
`

const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.25,
        maxOutputTokens: 5000,
      },
    }),
  },
)

if (!response.ok) {
  throw new Error(`Gemini API ${response.status}: ${await response.text()}`)
}

const data = await response.json()
const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
console.log(text)
