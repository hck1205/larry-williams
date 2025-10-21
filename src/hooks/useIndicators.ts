// src/hooks/useIndicators.ts
"use client";

import { useMemo } from "react";
import {
  williamsR,
  ultimateOscillator,
  breakoutFlags,
  type Bar,
} from "@/lib/indicators";

/**
 * Price bar 기반의 보조지표를 계산하는 훅.
 * - WR (Williams %R)
 * - UO (Ultimate Oscillator)
 * - Breakout flag
 */
export function useIndicators(bars: Bar[]) {
  return useMemo(() => {
    if (!bars?.length) {
      return { wr: [], uo: [], breakout: [] };
    }

    try {
      const wr = williamsR(bars, 14);
      const uo = ultimateOscillator(bars, 7, 14, 28);
      const breakout = breakoutFlags(bars);
      return { wr, uo, breakout };
    } catch (err) {
      console.error("Indicator calculation error:", err);
      // 에러 발생 시 안전한 빈 배열 반환
      return { wr: [], uo: [], breakout: [] };
    }
  }, [bars]);
}
