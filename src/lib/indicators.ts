// src/lib/indicators.ts
export type Bar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

// ───────────────────────────────
// Williams %R (과매도/과매수 지표)
// ───────────────────────────────
export function williamsR(bars: Bar[], length = 14): number[] {
  if (!bars.length) return [];
  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    if (i < length - 1) {
      out.push(NaN);
      continue;
    }
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - length + 1; j <= i; j++) {
      highestHigh = Math.max(highestHigh, bars[j].high);
      lowestLow = Math.min(lowestLow, bars[j].low);
    }
    const wr =
      -100 *
      ((highestHigh - bars[i].close) / (highestHigh - lowestLow || 1e-9));
    out.push(wr);
  }
  return out;
}

// ───────────────────────────────
// Ultimate Oscillator (모멘텀 통합)
// ───────────────────────────────
export function ultimateOscillator(
  bars: Bar[],
  s = 7,
  m = 14,
  l = 28
): number[] {
  if (!bars.length) return [];
  const bp: number[] = []; // Buying Pressure
  const tr: number[] = []; // True Range

  for (let i = 0; i < bars.length; i++) {
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;
    const minLowClose = Math.min(bars[i].low, prevClose);
    const maxHighClose = Math.max(bars[i].high, prevClose);
    bp.push(bars[i].close - minLowClose);
    tr.push(maxHighClose - minLowClose || 1e-9);
  }

  const avg = (arr: number[], i: number, len: number) => {
    let sumBP = 0,
      sumTR = 0;
    const start = Math.max(0, i - len + 1);
    for (let k = start; k <= i; k++) {
      sumBP += bp[k];
      sumTR += tr[k];
    }
    return sumTR ? sumBP / sumTR : 0;
  };

  const out: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    const a1 = avg(bp, i, s);
    const a2 = avg(bp, i, m);
    const a3 = avg(bp, i, l);
    const uo = (100 * (4 * a1 + 2 * a2 + a3)) / 7;
    out.push(uo);
  }
  return out;
}

// ───────────────────────────────
// 전일 고가 돌파 여부
// ───────────────────────────────
export function breakoutFlags(bars: Bar[]): boolean[] {
  const out: boolean[] = [];
  for (let i = 0; i < bars.length; i++) {
    const yHigh = i > 0 ? bars[i - 1].high : NaN;
    out.push(i > 0 ? bars[i].close > yHigh : false);
  }
  return out;
}

// ───────────────────────────────
// AlphaVantage 데이터 변환 유틸
// ───────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toBarsFromAlphaVantageDaily(json: any): Bar[] {
  const series = json["Time Series (Daily)"];
  if (!series) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entries = Object.entries(series) as [string, any][];
  entries.sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  return entries.map(([date, v]) => ({
    time: new Date(date).getTime() / 1000,
    open: Number(v["1. open"]),
    high: Number(v["2. high"]),
    low: Number(v["3. low"]),
    close: Number(v["4. close"]),
  }));
}
