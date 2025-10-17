// src/hooks/usePrice.ts
"use client";

import { useCallback, useState } from "react";
import { Bar, toBarsFromAlphaVantageDaily } from "@/lib/indicators";

export type LoadState = "idle" | "loading" | "done" | "error";

export function usePrice(initialTicker = "NVDA") {
  const [ticker, setTicker] = useState<string>(initialTicker);
  const [bars, setBars] = useState<Bar[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string>("");

  const load = useCallback(
    async (sym?: string) => {
      const symbol = (sym ?? ticker).toUpperCase();
      setState("loading");
      setError("");
      try {
        const res = await fetch(
          `/api/proxy?src=alpha&symbol=${encodeURIComponent(symbol)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "price fetch error");
        const next = toBarsFromAlphaVantageDaily(json);
        setBars(next);
        setState("done");
        if (sym) setTicker(symbol);
      } catch (e: unknown) {
        setBars([]);
        setError((e as Error)?.message || "price fetch error");
        setState("error");
      }
    },
    [ticker]
  );

  return { ticker, setTicker, bars, state, error, load };
}
