// src/lib/cot.ts

export type CotPoint = {
  time: number; // unix sec (UTC)
  // Larry 3라인 근사 매핑 (TFF → Larry categories)
  nonCommercialNet?: number; // ≈ AssetMgr + LevMoney + OtherRept
  commercialNet?: number; // ≈ Dealer
  smallTradersNet?: number; // ≈ NonRept
  // 선택: OI 대비 비율 (%)
  nonCommercialNetPct?: number;
  commercialNetPct?: number;
  smallTradersNetPct?: number;
};

/** 축약코드 → CFTC 정식 마켓명 (route.ts에서도 이걸 import해서 사용 권장) */
export const CFTC_MARKET_MAP: Record<string, string> = {
  NQ: "NASDAQ-100 Consolidated",
  ES: "S&P 500 Consolidated",
  YM: "DJIA Consolidated",
  RTY: "Russell 2000 Consolidated",
};
export function mapCftcMarket(shortOrName: string): string {
  const key = (shortOrName ?? "").toUpperCase();
  return CFTC_MARKET_MAP[key] ?? shortOrName;
}

/* ───────── 내부 유틸 ───────── */

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const s = v.replace(/,/g, "").trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function pick(obj: any, keys: string[]): unknown {
  for (const k of keys) {
    const v = obj?.[k];
    if (v != null) return v;
  }
  return undefined;
}
function toUnix(dateLike?: string): number | undefined {
  if (!dateLike) return undefined;
  const t = Date.parse(dateLike);
  if (Number.isFinite(t)) return Math.floor(t / 1000);
  // 20250117 같은 형태 방어
  if (/^\d{8}$/.test(dateLike)) {
    const y = Number(dateLike.slice(0, 4));
    const m = Number(dateLike.slice(4, 6));
    const d = Number(dateLike.slice(6, 8));
    return Math.floor(Date.UTC(y, m - 1, d) / 1000);
  }
  return undefined;
}

/* ───────── 메인 파서: CFTC TFF(Futures-Only, gpe5-46if) → CotPoint[] ─────────
 * 소크라타 필드명(소문자_언더스코어) 기준. 확정 키를 사용.
 * Larry 3라인은 아래 근사 매핑을 적용:
 *   Non-Commercial ≈ AssetMgr + LevMoney + OtherRept
 *   Commercial    ≈ Dealer
 *   Small         ≈ NonRept
 */
export function toCotPointsFromCftcTff(rows: any[]): CotPoint[] {
  if (!Array.isArray(rows)) return [];

  const out: CotPoint[] = [];
  const seen: Record<number, number> = {}; // time → idx (중복 날짜 덮어쓰기)

  for (const r of rows) {
    const dateStr =
      (pick(r, [
        "report_date_as_yyyy_mm_dd", // 일반적
        "report_date",
        "as_of_date_in_form_yyyymmdd",
        "date",
      ]) as string | undefined) ?? undefined;
    const time = toUnix(dateStr);
    if (!time) continue;

    // --- TFF 확정 키 (롱/숏) ---
    const dealerLong = toNum(pick(r, ["dealer_positions_long_all"]));
    const dealerShort = toNum(pick(r, ["dealer_positions_short_all"]));

    const assetLong = toNum(pick(r, ["asset_mgr_positions_long_all"]));
    const assetShort = toNum(pick(r, ["asset_mgr_positions_short_all"]));

    const levLong = toNum(pick(r, ["lev_money_positions_long_all"]));
    const levShort = toNum(pick(r, ["lev_money_positions_short_all"]));

    const othLong = toNum(pick(r, ["other_rept_positions_long_all"]));
    const othShort = toNum(pick(r, ["other_rept_positions_short_all"]));

    const nonrepLong = toNum(pick(r, ["nonrept_positions_long_all"]));
    const nonrepShort = toNum(pick(r, ["nonrept_positions_short_all"]));

    const openInterest = toNum(
      pick(r, [
        "open_interest_all", // 보통 이 키로 옴
        "open_interest", // 혹시나 있을 변주
      ])
    );

    // 순포지션(롱-숏)
    const dealerNet =
      dealerLong != null && dealerShort != null
        ? dealerLong - dealerShort
        : undefined;
    const assetNet =
      assetLong != null && assetShort != null
        ? assetLong - assetShort
        : undefined;
    const levNet =
      levLong != null && levShort != null ? levLong - levShort : undefined;
    const othNet =
      othLong != null && othShort != null ? othLong - othShort : undefined;
    const nonrepNet =
      nonrepLong != null && nonrepShort != null
        ? nonrepLong - nonrepShort
        : undefined;

    // Larry 3라인 근사 매핑
    const sum = (...vals: (number | undefined)[]) =>
      vals.reduce(
        (acc, v) => (Number.isFinite(v) ? acc + (v as number) : acc),
        0
      );

    const nonCommercialNet = (() => {
      const s = sum(assetNet, levNet, othNet);
      return Number.isFinite(s) ? s : undefined;
    })();

    const commercialNet = Number.isFinite(dealerNet)
      ? (dealerNet as number)
      : undefined;
    const smallTradersNet = Number.isFinite(nonrepNet)
      ? (nonrepNet as number)
      : undefined;

    // OI 대비 비율(%)
    const pct = (net?: number) =>
      openInterest && Number.isFinite(net)
        ? (net! / openInterest) * 100
        : undefined;

    const point: CotPoint = {
      time,
      nonCommercialNet,
      commercialNet,
      smallTradersNet,
      nonCommercialNetPct: pct(nonCommercialNet),
      commercialNetPct: pct(commercialNet),
      smallTradersNetPct: pct(smallTradersNet),
    };

    // 중복 날짜 → 마지막 행으로 덮어쓰기
    const prev = seen[time];
    if (prev != null) {
      out[prev] = point;
    } else {
      seen[time] = out.length;
      out.push(point);
    }
  }

  // 오름차순 정렬
  out.sort((a, b) => a.time - b.time);
  return out;
}

/** UI 헬퍼: CotPoint[] → 3라인 시리즈 그룹 */
export function toCotSeriesGroups(points: CotPoint[]) {
  return {
    nonCommercial: points.map((d) => ({
      time: d.time,
      value: d.nonCommercialNet,
    })),
    commercial: points.map((d) => ({ time: d.time, value: d.commercialNet })),
    small: points.map((d) => ({ time: d.time, value: d.smallTradersNet })),
    // 비율 라인이 필요하면 아래처럼 교체/추가:
    // nonCommercialPct: points.map((d) => ({ time: d.time, value: d.nonCommercialNetPct })),
    // commercialPct:   points.map((d) => ({ time: d.time, value: d.commercialNetPct })),
    // smallPct:        points.map((d) => ({ time: d.time, value: d.smallTradersNetPct })),
  };
}
