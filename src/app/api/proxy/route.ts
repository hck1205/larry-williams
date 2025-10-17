// src/app/api/proxy/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
// 상단에 상수
const CFTC_HOST = "https://publicreportinghub.cftc.gov";
const DATASET_TFF_FUTURES_ONLY = "gpe5-46if"; // Traders in Financial Futures - Futures Only

// 선택: 축약코드 → 정식 마켓명 매핑 (필요 시 확장)
const MARKET_MAP: Record<string, string> = {
  NQ: "NASDAQ-100 Consolidated",
  ES: "S&P 500 Consolidated",
  YM: "DJIA Consolidated",
  RTY: "Russell 2000 Consolidated",
};

// ─────────────────────────────────────────────
// 허용 소스(화이트리스트)
// ─────────────────────────────────────────────
const ALLOW_SOURCES = {
  // 가격 데이터 (무료 엔드포인트 권장)
  alpha: {
    host: "https://www.alphavantage.co",
    buildUrl: (sp: URLSearchParams) => {
      const symbol = (sp.get("symbol") || "AAPL").toUpperCase();
      const fn = sp.get("function") || "TIME_SERIES_DAILY"; // DAILY_ADJUSTED는 프리미엄일 수 있음
      const apikey = process.env.ALPHAVANTAGE_API_KEY;
      if (!apikey) throw new Error("Missing ALPHAVANTAGE_API_KEY");
      return `https://www.alphavantage.co/query?function=${encodeURIComponent(
        fn
      )}&symbol=${encodeURIComponent(
        symbol
      )}&datatype=json&outputsize=compact&apikey=${apikey}`;
    },
    cacheControl: "public, s-maxage=30", // 단기 캐시
    contentTypeFallback: "application/json; charset=utf-8",
  },

  // ✅ COT 데이터 (FMP COT Analysis)
  fmp_cot: {
    host: "https://financialmodelingprep.com",
    buildUrl: (sp: URLSearchParams) => {
      const from = sp.get("from") || "2024-01-01";
      const to = sp.get("to") || new Date().toISOString().slice(0, 10);
      const symbol = sp.get("symbol"); // 선택: 특정 심볼(계약) 필터
      const apikey = process.env.FMP_API_KEY;
      if (!apikey) throw new Error("Missing FMP_API_KEY");

      // 기본: 기간 분석 엔드포인트
      const base = `https://financialmodelingprep.com/api/v4/commitment_of_traders_report_analysis?from=${encodeURIComponent(
        from
      )}&to=${encodeURIComponent(to)}&apikey=${apikey}`;

      // ✅ 수정된 부분
      // symbol이 있을 경우 "analysis/{symbol}" 경로 사용
      if (symbol) {
        return `https://financialmodelingprep.com/api/v4/commitment_of_traders_report_analysis/${encodeURIComponent(
          symbol
        )}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(
          to
        )}&apikey=${apikey}`;
      }

      return base;
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },
  // ─────────────────────────────────────────────
  // ✅ CFTC PRE (TFF Futures-Only) — Socrata JSON
  // ─────────────────────────────────────────────
  cftc_pre_tff: {
    host: CFTC_HOST,
    buildUrl: (sp: URLSearchParams) => {
      const from = sp.get("from") || "2024-01-01";
      const to = sp.get("to") || new Date().toISOString().slice(0, 10);

      // 사용자가 NQ/ES 같이 보냈을 때 정식 이름으로 매핑
      const raw = sp.get("market") || "NASDAQ-100 Consolidated";
      const market = MARKET_MAP[raw.toUpperCase()] ?? raw;

      const where = encodeURIComponent(
        `report_date_as_yyyy_mm_dd between '${from}' and '${to}' AND market_and_exchange_names = '${market}'`
      );
      const url =
        `${CFTC_HOST}/resource/${DATASET_TFF_FUTURES_ONLY}.json` +
        `?$where=${where}&$order=report_date_as_yyyy_mm_dd&$limit=50000`;

      return url;
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },
} as const;

// ─────────────────────────────────────────────
// GET 핸들러
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const src = (searchParams.get("src") ||
      "alpha") as keyof typeof ALLOW_SOURCES;

    if (!(src in ALLOW_SOURCES)) {
      return NextResponse.json({ error: "src not allowed" }, { status: 400 });
    }

    const targetUrl = ALLOW_SOURCES[src].buildUrl(searchParams);

    // 민감 헤더 제거 & 외부 호출
    const upstream = await fetch(targetUrl, {
      headers: {
        "user-agent": "lw-dashboard/edge",
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    const body = await upstream.text();
    const res = new NextResponse(body, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ||
          ALLOW_SOURCES[src].contentTypeFallback,
        "cache-control": ALLOW_SOURCES[src].cacheControl,
      },
    });

    // CORS — 필요 시 특정 오리진만 허용하세요.
    res.headers.set(
      "access-control-allow-origin",
      req.headers.get("origin") || "*"
    );
    res.headers.set("access-control-allow-headers", "content-type");

    return res;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: (err as Error)?.message || "proxy error" },
      { status: 500 }
    );
  }
}
