// src/hooks/useCot.ts
"use client";

import { useCallback, useState } from "react";
import { cotToSeries, latestCotSignal, parseCftcTff } from "@/lib/cot";

export type LoadState = "idle" | "loading" | "done" | "error";

export interface UseCotOptions {
  /** 기본 from (YYYY-MM-DD) */
  from?: string;
  /** 기본 to (YYYY-MM-DD) */
  to?: string;
  /** 초기 COT 심볼 (예: 'NQ', 'ES' 등) */
  initialSymbol?: string;
}

export function useCot(options: UseCotOptions = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(
    options.from ?? `${new Date().getFullYear()}-01-01`
  );
  const [to, setTo] = useState(options.to ?? today);
  const [symbol, setSymbol] = useState(options.initialSymbol ?? "NQ");

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");

  // 가공 결과
  const [series, setSeries] = useState<{ time: number; value: number }[]>([]);
  const [summary, setSummary] = useState<{
    symbol: string;
    date: string;
    commercialNet: number;
    nonCommercialNet: number;
    bias: "bullish" | "bearish" | "neutral";
  } | null>(null);

  const load = useCallback(
    async (opts?: { from?: string; to?: string; symbol?: string }) => {
      const _from = opts?.from ?? from;
      const _to = opts?.to ?? to;
      const _symbol = (opts?.symbol ?? symbol)?.trim();

      setState("loading");
      setError("");

      try {
        const qs = new URLSearchParams({ from: _from, to: _to });
        if (_symbol) qs.set("symbol", _symbol);

        const res = await fetch(
          `/api/proxy?src=cftc_pre_tff&from=${_from}&to=${_to}&market=${encodeURIComponent(
            _symbol
          )}`
        );
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "cot fetch error");

        const parsed = parseCftcTff(json);
        const nextSeries = cotToSeries(parsed);
        const nextSummary = latestCotSignal(parsed);

        setSeries(nextSeries);
        setSummary(nextSummary ?? null);

        setFrom(_from);
        setTo(_to);
        setSymbol(_symbol);

        setState("done");
      } catch (e: unknown) {
        setSeries([]);
        setSummary(null);
        setError((e as Error)?.message || "cot fetch error");
        setState("error");
      }
    },
    [from, to, symbol]
  );

  return {
    // 상태
    state,
    error,
    // 파라미터
    from,
    to,
    symbol,
    setFrom,
    setTo,
    setSymbol,
    // 가공 결과
    series,
    summary,
    // 액션
    load,
  };
}
