# Bitorstrange (MULTIVERSE)
> **Bitcoin 다중우주 생존 시뮬레이터 (Bitcoin Multiverse Survival Simulator)**  
> "하나의 미래를 맞히지 않습니다. 수많은 미래에서 살아남는 방법을 찾습니다."

---

## 1. 개요 (Overview)

**Bitorstrange (MULTIVERSE)**는 Bitcoin 가격 하나를 점치는 예측기가 아닙니다.  
핵심 질문은:
> **“비트코인이 어디까지 갈까?”** 가 아니라  
> **“무슨 일이 일어나더라도 어떤 전략이 가장 잘 버틸까?”** 입니다.

사용자가 보유한 비트코인과 현금을 자연어로 한 줄 입력하면:
1. **오픈소스 AI Council (Nosana Qwen 3.8 27B)**이 현재 시장 상태, 뉴스, 거시경제, 위험 신호를 다각도로 진단합니다.
2. **Nosana GPU 시뮬레이션 엔진**이 시장 확률 모델을 바탕으로 **100,000개의 가능한 미래 경로**를 생성하고 5대 대표 미래로 클러스터링합니다.
3. **Daytona 클라우드**의 8개 독립 샌드박스에서 동일한 미래 데이터를 바탕으로 8개 투자 전략을 **병렬 스트레스 테스트**합니다.
4. 설정한 손실 한도(-25%)를 가장 많은 미래에서 지켜낸 **최적의 생존 전략**을 도출합니다.
5. **TIME LOCK 모드**를 통해 2025년 12월 31일 시점으로 이동해 2026년 이후 데이터를 차단한 상태에서 의사결정을 봉인(SHA-256 Seal)한 뒤, **실제 2026년 비트코인 가격 궤적**과 대조 검증하는 드라마틱한 데모를 제공합니다.

---

## 2. 시스템 아키텍처 (Architecture)

```text
사용자 자연어 입력 ("비트코인 1000만원, 현금 500만원")
        ↓
포트폴리오 실시간 파싱 (BTC / Cash / Total KRW)
        ↓
시장 데이터 수집 & Time Lock 컷오프 필터링
        ↓
Nosana AI Council (Qwen 3.8 27B) 4대 에이전트 분석
  - 시장 분석 AI: 추세, 모멘텀, 거래량, 30일/90일 실현 변동성
  - 뉴스 분석 AI: ETF 수급, 규제 이슈, 기관 자금 흐름
  - 거시경제 AI: 기준금리, 달러 유동성, 위험선호도
  - 위험 분석 AI: 테일 리스크, 급락 요인, 블랙스완
        ↓
구조화된 시장 상태 벡터 (추세 강도, 시장 불안정도, 유동성, 폭락 위험)
        ↓
Nosana GPU 시뮬레이션 (100,000개 가격 경로 생성 및 5대 대표 미래 요약)
        ↓
Daytona 평행 전략 실험실 (8개 독립 샌드박스 동시 병렬 실행)
  - 1. 그냥 보유하기 (HODL)
  - 2. 일정 금액씩 나눠 사기 (DCA)
  - 3. BTC 80% 유지하기
  - 4. BTC 60% 유지하기
  - 5. 많이 떨어질 때 더 사기 (Buy-the-dip)
  - 6. 하락 추세에서 BTC 줄이기 (Trend-following)
  - 7. 위험할 때 BTC 비중 줄이기 (Volatility-targeting)
  - 8. 현금을 많이 들고 있기 (Cash-heavy)
        ↓
생존율 평가 (평가 기간 90일, 허용 최대 손실 -25%)
        ↓
승자 전략 선정 규칙 (1. 생존율 최고 → 2. 최악 손실 방어 → 3. MDD 최소화)
        ↓
결과 표시 (쉬운 한국어 & 미니멀리즘 UI) & TIME LOCK 2026년 실증 Reveal
```

---

## 3. 스폰서 기술의 역할

- **Nosana**: 미래를 만든다.
  - 오픈소스 AI inference (`qwen/qwen3.8-27b`)
  - GPU 기반 시뮬레이션 파라미터 튜닝
  - 10만 개 비트코인 미래 시나리오 생성 및 5대 대표 미래 클러스터링
- **Daytona**: 미래를 직접 살아본다.
  - 8개 전략별 독립 격리 환경 (Sandbox)
  - 동일한 시뮬레이션 시드를 주입하여 공정하고 엄밀한 병렬 백테스트 수행
  - Time Lock 격리 및 검증 환경 제공

---

## 4. 실행 방법 (Quick Start)

### 사전 요구사항
- Node.js 18+ (Node 20+ 권장)
- npm

### 설치 및 환경설정
```bash
git clone https://github.com/wlsalswo14/Bitorstrange.git
cd Bitorstrange
npm install
cp .env.example .env
```

`.env` 파일에 API 키를 입력합니다:
```env
PORT=8787
SCENARIO_PROVIDER=nosana
STRATEGY_EXECUTOR=daytona

DAYTONA_API_KEY=dtn_...
NOSANA_API_KEY=nos_...
NOSANA_MODEL=qwen/qwen3.8-27b
```

### 진단 및 테스트
```bash
# 환경 및 API 연동 진단
npm run preflight

# E2E 스모크 테스트 (Nosana + Daytona + 10만 미래 + 2026 Reveal)
npm run smoke
```

### 개발 서버 실행
```bash
npm run dev
```
- Web UI: `http://localhost:5173`
- API Server: `http://127.0.0.1:8787`

---

## 5. 라이선스
MIT License
