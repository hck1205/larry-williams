// src/components/Chart.tsx
"use client";

import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type SeriesDataItemTypeMap, // v5: 시리즈별 setData 타입 맵
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";
import type { Bar } from "@/lib/indicators";

type Props = {
  bars: Bar[];
  wr: number[]; // Williams %R (초반 NaN 가능)
  uo: number[]; // Ultimate Oscillator (항상 0~100이지만 빈 배열 가능)
};

export default function PriceChart({ bars, wr, uo }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const wrRef = useRef<ISeriesApi<"Line"> | null>(null);
  const uoRef = useRef<ISeriesApi<"Line"> | null>(null);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // ---- 가공 데이터 (메모) --------------------------------------------------
  const candleData = useMemo<SeriesDataItemTypeMap["Candlestick"][]>(() => {
    return (bars ?? []).map((b) => ({
      time: b.time as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
  }, [bars]);

  // v5: Line 시리즈는 NaN 허용 ❌ → 값이 없을 땐 { time } 형태(WhitespaceData)로
  const wrData = useMemo<SeriesDataItemTypeMap["Line"][]>(() => {
    const out: SeriesDataItemTypeMap["Line"][] = [];
    for (let i = 0; i < (bars?.length ?? 0); i++) {
      const t = bars[i].time as Time;
      const v = wr?.[i];
      if (Number.isFinite(v)) out.push({ time: t, value: v as number });
      else out.push({ time: t }); // whitespace
    }
    return out;
  }, [bars, wr]);

  const uoData = useMemo<SeriesDataItemTypeMap["Line"][]>(() => {
    const out: SeriesDataItemTypeMap["Line"][] = [];
    for (let i = 0; i < (bars?.length ?? 0); i++) {
      const t = bars[i].time as Time;
      const v = uo?.[i];
      if (Number.isFinite(v)) out.push({ time: t, value: v as number });
      else out.push({ time: t }); // (보통 빈 배열만 오지만 방어적으로 처리)
    }
    return out;
  }, [bars, uo]);

  // ---- 차트 생성/제거 (한 번) ----------------------------------------------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 440,
      layout: { background: { color: "#12141b" }, textColor: "#e6e6e6" },
      grid: {
        vertLines: { color: "#1f2430" },
        horzLines: { color: "#1f2430" },
      },
      timeScale: { borderColor: "#2c3242" },
      rightPriceScale: { borderColor: "#2c3242" },
    });
    chartRef.current = chart;

    // 캔들 시리즈
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "#26a69a",
      downColor: "#ef5350",
      borderVisible: false,
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // WR 라인
    wrRef.current = chart.addSeries(LineSeries, {
      color: "#6aa0ff",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // UO 라인
    uoRef.current = chart.addSeries(LineSeries, {
      color: "#8ce99a",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });

    // 리사이즈 대응
    const ro = new ResizeObserver(() => {
      const ch = chartRef.current;
      const host = containerRef.current;
      if (ch && host) ch.applyOptions({ width: host.clientWidth });
    });
    ro.observe(el);
    resizeObsRef.current = ro;

    return () => {
      try {
        resizeObsRef.current?.disconnect();
      } catch {}
      resizeObsRef.current = null;

      candleRef.current = null;
      wrRef.current = null;
      uoRef.current = null;

      try {
        chartRef.current?.remove();
      } catch {}
      chartRef.current = null;
    };
  }, []);

  // ---- 데이터 반영 ---------------------------------------------------------
  useEffect(() => {
    const ch = chartRef.current;
    const candle = candleRef.current;
    const wrS = wrRef.current;
    const uoS = uoRef.current;
    if (!ch || !candle || !wrS || !uoS) return;

    candle.setData(candleData);
    wrS.setData(wrData); // NaN → whitespace 처리됨
    uoS.setData(uoData);

    if (candleData.length) ch.timeScale().fitContent();
  }, [candleData, wrData, uoData]);

  // ---- 렌더 ---------------------------------------------------------------
  if (!bars?.length) {
    return (
      <div
        style={{
          height: 440,
          borderRadius: 12,
          background: "#14161e",
          border: "1px dashed #2b3140",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#9aa3b2",
          fontSize: 13,
        }}
      >
        No price data
      </div>
    );
  }

  return <div ref={containerRef} style={{ width: "100%", height: 440 }} />;
}
