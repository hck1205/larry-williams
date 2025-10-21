// src/hooks/useCot.ts
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  toCotPointsFromCftcTff,
  mapCftcMarket,
  type CotPoint,
} from "@/lib/cot";

export type LoadState = "idle" | "loading" | "done" | "error";

type Range = { from?: string; to?: string };

function defaultRange(): Range {
  // 최근 2년 (YYYY-MM-DD)
  const to = new Date();
  const from = new Date();
  from.setFullYear(to.getFullYear() - 2);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

async function fetchWithRetry(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
  retries = 2
) {
  let attempt = 0;
  // 300ms → 900ms → 2700ms (max 2회 재시도)
  const backoff = () =>
    new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt)));

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const resp = await fetch(url, init);
      if (resp.status === 429 && attempt < retries) {
        attempt++;
        await backoff();
        continue;
      }
      return resp;
    } catch (e) {
      // Abort는 바로 throw
      if ((e as any)?.name === "AbortError") throw e;
      if (attempt >= retries) throw e;
      attempt++;
      await backoff();
    }
  }
}

export function useCot(initialSymbol = "NQ") {
  const [symbol, setSymbol] = useState(initialSymbol.toUpperCase());
  const [cotData, setCotData] = useState<CotPoint[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  const loadCot = useCallback(
    async (sym?: string, range?: Range) => {
      const s = (sym ?? symbol).toUpperCase();
      const market = mapCftcMarket(s); // "NQ" → "NASDAQ-100 Consolidated"

      // 기본 기간 적용
      const r = { ...defaultRange(), ...(range ?? {}) };

      // 이전 요청 취소
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setState("loading");
      setError("");

      try {
        const qs = new URLSearchParams();
        qs.set("src", "cftc_pre_tff");
        qs.set("market", market);
        if (r.from) qs.set("from", r.from);
        if (r.to) qs.set("to", r.to);

        const resp = await fetchWithRetry(`/api/proxy?${qs.toString()}`, {
          headers: { accept: "application/json" },
          signal: ac.signal,
          cache: "no-store",
        });

        // upstream body
        const json = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
          // 소크라타 쿼리 문자열/마켓명 이슈 힌트
          const msg =
            json?.error ||
            `cot fetch error: ${resp.status}. Check market name & date range`;
          throw new Error(msg);
        }

        const points = toCotPointsFromCftcTff(json);
        setCotData(points);
        setState("done");
        if (sym && s !== symbol) setSymbol(s);
      } catch (e: unknown) {
        if ((e as Error)?.name === "AbortError") return; // 사용자가 새 요청을 보낸 경우
        setCotData([]);
        setError((e as Error)?.message || "cot fetch error");
        setState("error");
      } finally {
        // 현재 컨트롤러 소멸
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [symbol]
  );

  const seriesGroups = useMemo(
    () => ({
      nonCommercial: cotData.map((d) => ({
        time: d.time,
        value: d.nonCommercialNet,
      })),
      commercial: cotData.map((d) => ({
        time: d.time,
        value: d.commercialNet,
      })),
      small: cotData.map((d) => ({
        time: d.time,
        value: d.smallTradersNet,
      })),
    }),
    [cotData]
  );

  return {
    symbol,
    setSymbol, // 외부에서 심볼만 바꾸고 싶을 때 사용 (loadCot 호출 권장)
    cotData,
    seriesGroups,
    cotState: state,
    cotError: error,
    loadCot,
  };
}
