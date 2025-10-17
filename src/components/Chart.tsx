// src/components/Chart.tsx (lightweight-charts v5.0.9)
"use client";

import {
  createChart,
  CandlestickSeries, // ✅ v5: 시리즈 클래스를 가져와서
  type CandlestickData,
  type Time, //   Time = UTCTimestamp | BusinessDay
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { Bar } from "@/lib/indicators";

type Props = { bars: Bar[] };

export default function Chart({ bars }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height: 420,
    });

    // ✅ v5 방식: addSeries(CandlestickSeries, options)
    const candle = chart.addSeries(CandlestickSeries, {});

    // 데이터 세팅
    const toTime = (t: number): Time => t as Time; // 초 단위 Unix라면 그대로, ms면 Math.floor(t/1000)
    const data: CandlestickData[] = bars.map((b) => ({
      time: toTime(b.time),
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    }));
    candle.setData(data);
    chart.timeScale().fitContent();

    // 반응형
    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [bars]);

  return <div ref={containerRef} style={{ width: "100%", height: 420 }} />;
}
