// src/hooks/usePrice.ts
"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Bar } from "@/lib/indicators";
import { toBarsFromFmpHistorical } from "@/lib/indicators";

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
  const backoff = () =>
    new Promise((r) => setTimeout(r, 300 * Math.pow(3, attempt))); // 300ms → 900ms → 2700ms

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
      if ((e as any)?.name === "AbortError") throw e; // 즉시 종료
      if (attempt >= retries) throw e;
      attempt++;
      await backoff();
    }
  }
}

export function usePrice(initialTicker = "NVDA") {
  const [ticker, setTicker] = useState<string>(initialTicker.toUpperCase());
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");

  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (sym?: string, range?: Range) => {
      const symbol = (sym ?? ticker).toUpperCase();
      const r = { ...defaultRange(), ...(range ?? {}) };

      // 이전 요청 취소
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setState("loading");
      setError("");

      try {
        const qs = new URLSearchParams();
        qs.set("src", "fmp_eod");
        qs.set("symbol", symbol);
        if (r.from) qs.set("from", r.from); // 'YYYY-MM-DD'
        if (r.to) qs.set("to", r.to); // 'YYYY-MM-DD'

        const resp = await fetchWithRetry(`/api/proxy?${qs.toString()}`, {
          headers: { accept: "application/json" },
          signal: ac.signal,
          cache: "no-store",
        });

        const json = await resp.json().catch(() => ({} as any));
        if (!resp.ok) {
          const msg = json?.error || `price fetch error: ${resp.status}`;
          throw new Error(msg);
        }

        const next = toBarsFromFmpHistorical(json);
        // 콘솔 디버그: 필요 없으면 지우셔도 됩니다.
        // console.debug("EOD bars:", next.length);

        setBars(next);
        setState("done");
        if (sym && symbol !== ticker) setTicker(symbol);
      } catch (e: unknown) {
        if ((e as any)?.name === "AbortError") return; // 새 요청으로 대체된 경우
        setBars([]);
        setError((e as Error)?.message || "price fetch error");
        setState("error");
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [ticker]
  );

  // 파생 상태: 데이터 유무 (UI 최적화용, 선택사항)
  const hasBars = useMemo(() => (bars?.length ?? 0) > 0, [bars]);

  return { ticker, setTicker, bars, hasBars, state, error, load };
}
