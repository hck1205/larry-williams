// src/components/CotChart.tsx
"use client";

import {
  createChart,
  LineSeries, // ✅ v5: addSeries(LineSeries, options)
  type LineData,
  type Time, // Time = UTCTimestamp | BusinessDay
} from "lightweight-charts";
import { useEffect, useRef } from "react";

type Props = {
  title?: string;
  series: { time: number; value: number }[]; // seconds(UTC) 기준
  height?: number;
};

export default function CotChart({
  title = "Commercial Net Position",
  series,
  height = 180,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, { width: el.clientWidth, height });
    // ✅ v5 표준: addSeries(LineSeries, options)
    const line = chart.addSeries(LineSeries, {
      lineWidth: 2,
    });

    const toTime = (t: number) => t as Time;
    const data: LineData[] = series.map((d) => ({
      time: toTime(d.time),
      value: d.value,
    }));
    line.setData(data);
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() =>
      chart.applyOptions({ width: el.clientWidth })
    );
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [series, height]);

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, opacity: 0.8 }}
      >
        {title}
      </div>
      <div ref={containerRef} style={{ width: "100%", height }} />
    </div>
  );
}
