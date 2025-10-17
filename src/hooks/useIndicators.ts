// src/hooks/useIndicators.ts
"use client";

import { useMemo } from "react";
import {
  type Bar,
  williamsR,
  ultimateOscillator,
  breakoutFlags,
} from "@/lib/indicators";

export interface UseIndicatorsOptions {
  wrLen?: number; // Williams %R 기간 (기본 14)
  uoFast?: number; // UO fast (기본 7)
  uoMid?: number; // UO mid (기본 14)
  uoSlow?: number; // UO slow (기본 28)
}

export function useIndicators(bars: Bar[], opts: UseIndicatorsOptions = {}) {
  const { wrLen = 14, uoFast = 7, uoMid = 14, uoSlow = 28 } = opts;

  const wr = useMemo(() => williamsR(bars, wrLen), [bars, wrLen]);
  const uo = useMemo(
    () => ultimateOscillator(bars, uoFast, uoMid, uoSlow),
    [bars, uoFast, uoMid, uoSlow]
  );
  const bo = useMemo(() => breakoutFlags(bars), [bars]);

  const latestIdx = bars.length - 1;

  const latestWR = useMemo(
    () =>
      latestIdx >= 0 && Number.isFinite(wr[latestIdx]) ? wr[latestIdx] : NaN,
    [wr, latestIdx]
  );
  const latestUO = useMemo(
    () =>
      latestIdx >= 0 && Number.isFinite(uo[latestIdx]) ? uo[latestIdx] : NaN,
    [uo, latestIdx]
  );
  const latestBO = useMemo(
    () => (latestIdx >= 0 ? !!bo[latestIdx] : false),
    [bo, latestIdx]
  );

  // Larry Williams 조건(샘플 휴리스틱):
  // 1) 어제 %R ≤ -90 (과매도)
  // 2) 오늘 %R이 어제보다 상승 (반등 시도)
  // 3) UO가 상승 중
  // 4) 전일 고가 돌파
  const buyHint = useMemo(() => {
    if (latestIdx < 2) return false;
    const wasOversold = wr[latestIdx - 1] <= -90;
    const wrUp = wr[latestIdx] > wr[latestIdx - 1];
    const uoUp = uo[latestIdx] >= uo[latestIdx - 1];
    const breakout = bo[latestIdx] === true;
    return wasOversold && wrUp && uoUp && breakout;
  }, [wr, uo, bo, latestIdx]);

  return {
    wr,
    uo,
    bo,
    latestIdx,
    latestWR,
    latestUO,
    latestBO,
    buyHint,
  };
}
