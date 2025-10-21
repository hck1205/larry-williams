// src/lib/indicators.ts
export type Bar = {
  time: number; // unix sec (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
};

/* ───────────────────────────────
 * 내부 유틸: 정렬/중복 제거
 *  - 입력 bars가 뒤섞여 들어오거나 중복 time이 있을 수 있어
 *    지표 계산 전에 정리해 주면 예측 가능성이 올라갑니다.
 * ───────────────────────────────*/
function sortAndDedupe(bars: Bar[]): Bar[] {
  if (!bars?.length) return [];
  // 얕은 복사 후 정렬
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  // 동일 time 중 마지막 값으로 덮어쓰기
  const out: Bar[] = [];
  let lastT = Number.NaN;
  for (const b of sorted) {
    if (!Number.isFinite(b.time)) continue;
    if (b.time === lastT) {
      out[out.length - 1] = b; // 덮어쓰기
    } else {
      out.push(b);
      lastT = b.time;
    }
  }
  return out;
}

/* ───────────────────────────────
 * Williams %R
 *   - 기본 범위: -100(과매도) ~ 0(과매수)
 *   - length 구간 내 high/low가 동일하면 분모 0 방지
 *   - clamp 옵션으로 결과를 보정할 수 있음(기본 true)
 * ───────────────────────────────*/
export function williamsR(
  _bars: Bar[],
  length = 14,
  clampRange = true
): number[] {
  const bars = sortAndDedupe(_bars);
  if (!bars.length || length <= 0) return [];

  const out: number[] = new Array(bars.length).fill(NaN);

  for (let i = length - 1; i < bars.length; i++) {
    let hh = -Infinity;
    let ll = Infinity;
    for (let j = i - length + 1; j <= i; j++) {
      const b = bars[j];
      if (b.high > hh) hh = b.high;
      if (b.low < ll) ll = b.low;
    }
    const denom = hh - ll;
    const val = denom === 0 ? -50 : -100 * ((hh - bars[i].close) / denom);
    out[i] = clampRange ? Math.max(-100, Math.min(0, val)) : val;
  }

  return out;
}

/* ───────────────────────────────
 * Ultimate Oscillator (7, 14, 28 기본)
 *   - 0 ~ 100
 *   - 분모 0 방지
 * ───────────────────────────────*/
export function ultimateOscillator(
  _bars: Bar[],
  s = 7,
  m = 14,
  l = 28
): number[] {
  const bars = sortAndDedupe(_bars);
  if (!bars.length) return [];

  const n = bars.length;
  const bp: number[] = new Array(n);
  const tr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;
    const minLowClose = Math.min(bars[i].low, prevClose);
    const maxHighClose = Math.max(bars[i].high, prevClose);
    bp[i] = bars[i].close - minLowClose;
    tr[i] = Math.max(maxHighClose - minLowClose, 1e-9); // 0 방지
  }

  // 누적합으로 구간 평균 가속 (경미한 최적화)
  const cumBP = new Array(n + 1).fill(0);
  const cumTR = new Array(n + 1).fill(0);
  for (let i = 0; i < n; i++) {
    cumBP[i + 1] = cumBP[i] + bp[i];
    cumTR[i + 1] = cumTR[i] + tr[i];
  }

  const ratio = (i: number, len: number) => {
    const start = Math.max(0, i - len + 1);
    const sumBP = cumBP[i + 1] - cumBP[start];
    const sumTR = cumTR[i + 1] - cumTR[start];
    return sumTR > 0 ? sumBP / sumTR : 0;
  };

  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a1 = ratio(i, s);
    const a2 = ratio(i, m);
    const a3 = ratio(i, l);
    out[i] = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
  }
  return out;
}

/* ───────────────────────────────
 * 전일 고가 돌파 여부 (종가 기준)
 * ───────────────────────────────*/
export function breakoutFlags(_bars: Bar[]): boolean[] {
  const bars = sortAndDedupe(_bars);
  const out: boolean[] = new Array(bars.length).fill(false);
  for (let i = 1; i < bars.length; i++) {
    const yHigh = bars[i - 1].high;
    out[i] = bars[i].close > yHigh;
  }
  return out;
}

/* ───────────────────────────────
 * Finnhub Candle → Bar[]
 * Finnhub: { s: 'ok'|'no_data', t:number[], o:number[], h:number[], l:number[], c:number[] }
 *  - 길이 불일치/NaN 방어
 * ───────────────────────────────*/
export function toBarsFromFinnhubCandles(json: any): Bar[] {
  if (!json || json.s !== "ok" || !Array.isArray(json.t)) return [];
  const T: number[] = json.t || [];
  const O: number[] = json.o || [];
  const H: number[] = json.h || [];
  const L: number[] = json.l || [];
  const C: number[] = json.c || [];
  const n = Math.min(T.length, O.length, H.length, L.length, C.length);
  if (n === 0) return [];

  const bars: Bar[] = [];
  for (let i = 0; i < n; i++) {
    const time = Number(T[i]);
    const open = Number(O[i]);
    const high = Number(H[i]);
    const low = Number(L[i]);
    const close = Number(C[i]);

    if (
      Number.isFinite(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      bars.push({ time, open, high, low, close });
    }
  }
  return sortAndDedupe(bars);
}

/* ───────────────────────────────
 * FMP Stable (historical EOD) → Bar[]
 * 응답 변주를 최대한 포괄:
 *  - { historical: [...] }
 *  - { historicalStockList: [{ historical: [...] }] }
 *  - 직접 배열
 *  - { data: [...] }
 * 날짜 필드 후보: date | reportedDate | timestamp
 * ───────────────────────────────*/
export function toBarsFromFmpHistorical(json: any): Bar[] {
  let arr: any[] = [];

  if (Array.isArray(json)) {
    arr = json;
  } else if (Array.isArray(json?.historical)) {
    arr = json.historical;
  } else if (
    Array.isArray(json?.historicalStockList) &&
    json.historicalStockList[0]?.historical
  ) {
    arr = json.historicalStockList[0].historical;
  } else if (Array.isArray(json?.data)) {
    arr = json.data;
  }

  if (!arr.length) return [];

  const bars: Bar[] = [];
  for (const r of arr) {
    const dateRaw = r?.date ?? r?.reportedDate ?? r?.timestamp;
    const t = Date.parse(String(dateRaw));
    const time = Number.isFinite(t) ? Math.floor(t / 1000) : NaN;
    const open = Number(r?.open);
    const high = Number(r?.high);
    const low = Number(r?.low);
    const close = Number(r?.close);

    if (
      Number.isFinite(time) &&
      Number.isFinite(open) &&
      Number.isFinite(high) &&
      Number.isFinite(low) &&
      Number.isFinite(close)
    ) {
      bars.push({ time, open, high, low, close });
    }
  }

  return sortAndDedupe(bars);
}
