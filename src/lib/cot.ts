// src/lib/cot.ts

export interface CotData {
  symbol: string;
  date: string; // YYYY-MM-DD
  commercialLong: number;
  commercialShort: number;
  nonCommercialLong: number;
  nonCommercialShort: number;
  openInterest?: number;
  commercialNet: number;
  nonCommercialNet: number;
}

/**
 * ✅ FMP COT Analysis 응답(JSON) → CotData[] 변환
 * 참고: https://site.financialmodelingprep.com/developer/docs/cot-reports-analysis-api/
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseFmpCot(json: any): CotData[] {
  if (!Array.isArray(json)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return json.map((item: any) => {
    const commercialLong = Number(item.commercialLong ?? 0);
    const commercialShort = Number(item.commercialShort ?? 0);
    const nonCommercialLong = Number(item.nonCommercialLong ?? 0);
    const nonCommercialShort = Number(item.nonCommercialShort ?? 0);

    return {
      symbol: item.symbol ?? "",
      date: item.date ?? "",
      commercialLong,
      commercialShort,
      nonCommercialLong,
      nonCommercialShort,
      openInterest: Number(item.openInterest ?? 0),
      commercialNet: commercialLong - commercialShort,
      nonCommercialNet: nonCommercialLong - nonCommercialShort,
    };
  });
}

/**
 * ✅ COT 데이터 중 가장 최근 주간(혹은 N주간 평균) Net Position 계산
 */
export function latestCotSignal(data: CotData[]): {
  symbol: string;
  date: string;
  commercialNet: number;
  nonCommercialNet: number;
  bias: "bullish" | "bearish" | "neutral";
} | null {
  if (!data.length) return null;

  const latest = data[data.length - 1];
  const prev = data[data.length - 2];

  const delta = latest.commercialNet - (prev?.commercialNet ?? 0);

  let bias: "bullish" | "bearish" | "neutral" = "neutral";
  if (latest.commercialNet > 0 && delta > 0) bias = "bullish";
  else if (latest.commercialNet < 0 && delta < 0) bias = "bearish";

  return {
    symbol: latest.symbol,
    date: latest.date,
    commercialNet: latest.commercialNet,
    nonCommercialNet: latest.nonCommercialNet,
    bias,
  };
}

/**
 * ✅ 간단한 시각화용 데이터 변환
 * (시간순 배열로 정렬)
 */
export function cotToSeries(data: CotData[]) {
  return data
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((d) => ({
      time: Math.floor(new Date(d.date).getTime() / 1000),
      value: d.commercialNet,
    }));
}

// CFTC PRE (TFF) JSON → CotData[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCftcTff(rows: any[]): CotData[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const date = (r.report_date_as_yyyy_mm_dd || "").slice(0, 10); // 'YYYY-MM-DD...'

    // 예시: 기관과 유사 관점으로 dealers+asset_managers를 묶거나,
    // 혹은 단일 그룹(예: asset managers)만 볼 수도 있습니다.
    const dealerLong = Number(r.dealer_long_all ?? 0);
    const dealerShort = Number(r.dealer_short_all ?? 0);
    const amLong = Number(r.asset_mgr_long_all ?? 0);
    const amShort = Number(r.asset_mgr_short_all ?? 0);

    // 한 가지 전략: "상대적으로 느린 자금"으로 보는 dealers+asset managers를 'commercial' 유사로 취급
    const commercialLong = dealerLong + amLong;
    const commercialShort = dealerShort + amShort;

    // 투기 성향이 강한 집단으로 보는 leveraged funds를 'nonCommercial' 유사로 취급
    const nclLong = Number(r.lev_money_long_all ?? 0);
    const nclShort = Number(r.lev_money_short_all ?? 0);

    return {
      symbol: r.market_and_exchange_names || "",
      date,
      commercialLong,
      commercialShort,
      nonCommercialLong: nclLong,
      nonCommercialShort: nclShort,
      openInterest: Number(r.open_interest_all ?? 0),
      commercialNet: commercialLong - commercialShort,
      nonCommercialNet: nclLong - nclShort,
    };
  });
}
