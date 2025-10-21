// src/app/api/proxy/route.ts
import { CFTC_MARKET_MAP } from "@/lib/cot";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const CFTC_HOST = "https://publicreportinghub.cftc.gov";
const DATASET_TFF_FUTURES_ONLY = "gpe5-46if"; // Traders in Financial Futures - Futures Only

/* ─────────────────────────────────────────────
 * Small helpers (중복 제거)
 * ────────────────────────────────────────────*/
const getEnv = (key: string) => {
  const v = (process.env as Record<string, string | undefined>)[key] ?? "";
  return v;
};

const tokenHostForFinnhub = (token: string) =>
  token?.startsWith("sandbox_")
    ? "https://sandbox.finnhub.io"
    : "https://finnhub.io";

const buildFmpUrl = (
  path: string,
  params: Record<string, string | undefined>
) => {
  const apikey = getEnv("FMP_API_KEY");
  if (!apikey) throw new Error("Missing FMP_API_KEY");
  const url = new URL(`https://financialmodelingprep.com${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") url.searchParams.set(k, v);
  }
  url.searchParams.set("apikey", apikey);
  return url.toString();
};

/* ─────────────────────────────────────────────
 * White-list (ALLOW_SOURCES)
 * ────────────────────────────────────────────*/
const ALLOW_SOURCES = {
  /* ──────────────────────────────────────────
   * ✅ Finnhub Candle (유료 플랜 필요; sandbox 자동 전환)
   * ─────────────────────────────────────────*/
  finnhub_candle: {
    host: "https://finnhub.io",
    buildUrl: (sp: URLSearchParams) => {
      const symbol = (sp.get("symbol") || "NVDA").toUpperCase();
      const resolution = sp.get("resolution") || "D"; // 1,5,15,30,60,D,W,M
      const from =
        sp.get("from") ||
        Math.floor(Date.now() / 1000 - 400 * 86400).toString();
      const to = sp.get("to") || Math.floor(Date.now() / 1000).toString();

      const token = getEnv("FINNHUB_API_KEY");
      if (!token) throw new Error("Missing FINNHUB_API_KEY");

      const host = tokenHostForFinnhub(token);
      // 실제 캔들 엔드포인트 (403 가능)
      const url = new URL(`${host}/api/v1/stock/candle`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("resolution", resolution);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      url.searchParams.set("token", token);
      return url.toString();
    },
    cacheControl: "public, s-maxage=60, stale-while-revalidate=300",
    contentTypeFallback: "application/json; charset=utf-8",
  },

  /* ──────────────────────────────────────────
   * ✅ Finnhub Quote (현재가/당일 데이터)
   * ─────────────────────────────────────────*/
  finnhub_quote: {
    host: "https://finnhub.io",
    buildUrl: (sp: URLSearchParams) => {
      const symbol = (sp.get("symbol") || "NVDA").toUpperCase();
      const token = getEnv("FINNHUB_API_KEY");
      if (!token) throw new Error("Missing FINNHUB_API_KEY");
      const host = tokenHostForFinnhub(token);
      const url = new URL(`${host}/api/v1/quote`);
      url.searchParams.set("symbol", symbol);
      url.searchParams.set("token", token);
      return url.toString();
    },
    cacheControl: "no-store",
    contentTypeFallback: "application/json; charset=utf-8",
  },

  /* ──────────────────────────────────────────
   * ✅ FMP EOD (Stable) — 일봉 OHLC
   * ─────────────────────────────────────────*/
  fmp_eod: {
    host: "https://financialmodelingprep.com",
    buildUrl: (sp: URLSearchParams) => {
      const symbol = (sp.get("symbol") || "NVDA").toUpperCase();
      const from = sp.get("from") || ""; // YYYY-MM-DD (선택)
      const to = sp.get("to") || ""; // YYYY-MM-DD (선택)
      // 일부 계정에서 from/to 미지원일 수 있음 → 없어도 호출되게 유지
      return buildFmpUrl("/stable/historical-price-eod/full", {
        symbol,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
    },
    cacheControl: "public, s-maxage=600, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },

  /* ──────────────────────────────────────────
   * ✅ FMP COT (Stable 분석) — alias: fmp_cot
   * ─────────────────────────────────────────*/
  fmp_cot: {
    host: "https://financialmodelingprep.com",
    buildUrl: (sp: URLSearchParams) => {
      const symbol = sp.get("symbol") || ""; // 선택
      const from = sp.get("from") || ""; // YYYY-MM-DD (선택)
      const to = sp.get("to") || ""; // YYYY-MM-DD (선택)
      return buildFmpUrl("/stable/commitment-of-traders-analysis", {
        ...(symbol ? { symbol } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },

  /* ──────────────────────────────────────────
   * ✅ FMP COT (Stable 기본 리포트)
   * ─────────────────────────────────────────*/
  fmp_cot_report: {
    host: "https://financialmodelingprep.com",
    buildUrl: (_sp: URLSearchParams) => {
      return buildFmpUrl("/stable/commitment-of-traders-report", {});
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },

  /* ──────────────────────────────────────────
   * ✅ CFTC PRE (TFF Futures Only) — Socrata JSON
   * ─────────────────────────────────────────*/
  // src/app/api/proxy/route.ts (cftc_pre_tff만 교체)
  cftc_pre_tff: {
    host: CFTC_HOST,
    buildUrl: (sp: URLSearchParams) => {
      const from = sp.get("from") || "2024-01-01";
      const to = sp.get("to") || new Date().toISOString().slice(0, 10);

      // 입력값(축약 포함)을 정식명으로 매핑
      const raw = sp.get("market") || "NASDAQ-100 Consolidated";
      const market = CFTC_MARKET_MAP[raw.toUpperCase()] ?? raw;

      // Socrata where: 대소문자 무시 + 접두사 매칭
      const escape = (s: string) => s.replaceAll("'", "''");
      const whereParts = [
        `report_date_as_yyyy_mm_dd between '${from}' and '${to}'`,
        `upper(market_and_exchange_names) like upper('${escape(market)}%')`,
      ];
      const where = encodeURIComponent(whereParts.join(" AND "));

      return (
        `${CFTC_HOST}/resource/${DATASET_TFF_FUTURES_ONLY}.json` +
        `?$where=${where}&$order=report_date_as_yyyy_mm_dd&$limit=50000`
      );
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },
  // ALLOW_SOURCES에 추가: cftc_markets (기간 내 distinct market 나열)
  cftc_markets: {
    host: CFTC_HOST,
    buildUrl: (sp: URLSearchParams) => {
      const from = sp.get("from") || "2024-01-01";
      const to = sp.get("to") || new Date().toISOString().slice(0, 10);
      const where = encodeURIComponent(
        `report_date_as_yyyy_mm_dd between '${from}' and '${to}'`
      );
      // distinct + 카운트
      const select = encodeURIComponent(
        "market_and_exchange_names, count(1) as n"
      );
      const group = encodeURIComponent("market_and_exchange_names");
      const order = encodeURIComponent("n DESC");
      return (
        `${CFTC_HOST}/resource/${DATASET_TFF_FUTURES_ONLY}.json` +
        `?$select=${select}&$where=${where}&$group=${group}&$order=${order}&$limit=2000`
      );
    },
    cacheControl: "public, s-maxage=86400, stale-while-revalidate=604800",
    contentTypeFallback: "application/json; charset=utf-8",
  },
} as const;

/* ─────────────────────────────────────────────
 * OPTIONS (CORS preflight)
 * ────────────────────────────────────────────*/
export async function OPTIONS(req: NextRequest) {
  const res = new NextResponse(null, { status: 204 });
  res.headers.set(
    "access-control-allow-origin",
    req.headers.get("origin") || "*"
  );
  res.headers.set("access-control-allow-headers", "content-type");
  res.headers.set("access-control-allow-methods", "GET,OPTIONS");
  res.headers.set("access-control-max-age", "86400");
  return res;
}

/* ─────────────────────────────────────────────
 * GET handler
 * ────────────────────────────────────────────*/
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const src = (searchParams.get("src") ||
      "finnhub_quote") as keyof typeof ALLOW_SOURCES;
    if (!(src in ALLOW_SOURCES)) {
      return NextResponse.json({ error: "src not allowed" }, { status: 400 });
    }

    const targetUrl = ALLOW_SOURCES[src].buildUrl(searchParams);
    const upstream = await fetch(targetUrl, {
      headers: {
        "user-agent": "lw-dashboard/edge",
        accept: "application/json,text/plain,*/*",
      },
      cache: "no-store",
    });

    const bodyText = await upstream.text();

    // 업스트림 응답/에러를 그대로 패스스루 + 디버그 헤더
    const res = new NextResponse(bodyText, {
      status: upstream.status,
      headers: {
        "content-type":
          upstream.headers.get("content-type") ||
          ALLOW_SOURCES[src].contentTypeFallback,
        "cache-control": ALLOW_SOURCES[src].cacheControl,
        "x-debug-upstream-host": new URL(targetUrl).host,
        "x-debug-upstream-status": String(upstream.status),
      },
    });

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
