// src/components/CotChart.tsx
"use client";

import {
  createChart,
  LineSeries, // v5
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";
import { useEffect, useMemo, useRef } from "react";

export type CotLine = { time: number; value: number | null | undefined };
type LineSpec = { label: string; color: string; data: CotLine[] };

type Props = {
  title?: string;
  height?: number;
  lines: LineSpec[]; // seconds(UTC)
};

export default function CotChart({
  title = "COT — Net Positions",
  height = 220,
  lines,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // 데이터 가공 (NaN 제거)
  const normalized = useMemo(() => {
    const toTime = (t: number) => t as Time;
    return lines.map((l) => ({
      ...l,
      data: l.data
        .filter((d) => Number.isFinite(d.value ?? NaN))
        .map((d) => ({
          time: toTime(d.time),
          value: d.value as number,
        })) as LineData[],
    }));
  }, [lines]);

  const hasAnyData = useMemo(
    () => normalized.some((l) => (l.data?.length ?? 0) > 0),
    [normalized]
  );

  // 1) mount/unmount: create chart (한 번, 혹은 height 변경 시 재생성)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: { background: { color: "#12141b" }, textColor: "#e6e6e6" },
      grid: {
        vertLines: { color: "#1f2430" },
        horzLines: { color: "#1f2430" },
      },
      timeScale: { borderColor: "#2c3242" },
      rightPriceScale: { borderColor: "#2c3242" },
    });
    chartRef.current = chart;

    // 최초 시리즈 셸 생성 (라벨/색상 기준)
    seriesRefs.current = normalized.map((l) =>
      chart.addSeries(LineSeries, {
        color: l.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      })
    );

    // 리사이즈
    const ro = new ResizeObserver(() => {
      const el2 = containerRef.current;
      const ch = chartRef.current;
      if (!el2 || !ch) return;
      ch.applyOptions({ width: el2.clientWidth });
    });
    ro.observe(el);
    resizeObsRef.current = ro;

    return () => {
      // cleanup 순서: 옵저버 → ref 초기화 → chart.remove()
      try {
        resizeObsRef.current?.disconnect();
      } catch {}
      resizeObsRef.current = null;

      seriesRefs.current = [];

      try {
        chartRef.current?.remove();
      } catch {}
      chartRef.current = null;
    };
    // height 바뀌면 전체 재생성. 고정하려면 deps를 []로 변경.
  }, [
    height /* normalized 길이가 바뀌더라도 재생성을 원치 않으면 여기 넣지 마세요 */,
  ]);

  // 2) 시리즈 개수 reconcile (lines 개수가 변할 수 있는 경우)
  useEffect(() => {
    const ch = chartRef.current;
    if (!ch) return;

    const existing = seriesRefs.current.length;
    const needed = normalized.length;

    // 추가가 필요하면 추가
    for (let i = existing; i < needed; i++) {
      const spec = normalized[i];
      const s = ch.addSeries(LineSeries, {
        color: spec.color,
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: true,
      });
      seriesRefs.current.push(s);
    }

    // 초과분 제거
    if (existing > needed) {
      for (let i = existing - 1; i >= needed; i--) {
        try {
          // v5에서는 시리즈 remove API 없이 chart.remove() 시 전체 정리되므로
          // 여기서는 단순히 배열에서만 제거 (재생성 시 전체 cleanup에 맡김)
        } catch {}
        seriesRefs.current.pop();
      }
    }
  }, [normalized.length]);

  // 3) 데이터 세팅
  useEffect(() => {
    const ch = chartRef.current;
    const srs = seriesRefs.current;
    if (!ch || srs.length === 0) return;

    const count = Math.min(srs.length, normalized.length);
    for (let i = 0; i < count; i++) {
      srs[i].setData(normalized[i].data as LineData[]);
    }

    if (hasAnyData) ch.timeScale().fitContent();
  }, [normalized, hasAnyData]);

  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, opacity: 0.8 }}
      >
        {title}
      </div>

      {/* 데이터 없을 때 플레이스홀더 */}
      {!hasAnyData ? (
        <div
          style={{
            height,
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
          No COT data
        </div>
      ) : (
        <div ref={containerRef} style={{ width: "100%", height }} />
      )}

      {/* 범례 */}
      <div
        style={{
          display: "flex",
          gap: 12,
          fontSize: 12,
          marginTop: 6,
          opacity: 0.8,
          flexWrap: "wrap",
        }}
      >
        {lines.map((l) => (
          <span
            key={l.label}
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <i
              style={{
                width: 10,
                height: 10,
                background: l.color,
                display: "inline-block",
                borderRadius: 2,
              }}
            />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
