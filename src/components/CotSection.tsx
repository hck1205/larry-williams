// src/components/CotSection.tsx
"use client";

import React from "react";
import CotChart from "@/components/CotChart";

type Summary = {
  symbol: string;
  date: string;
  commercialNet: number;
  nonCommercialNet: number;
  bias: "bullish" | "bearish" | "neutral";
} | null;

type Props = {
  title?: string; // 섹션 타이틀
  series: { time: number; value: number }[]; // cotToSeries() 결과
  summary: Summary; // latestCotSignal() 결과
  error?: string; // 에러 메시지 (있으면 표시)
};

export default function CotSection({
  title = "COT (Commercial Net Position)",
  series,
  summary,
  error,
}: Props) {
  return (
    <section style={{ marginTop: 24 }}>
      <h2 style={{ margin: "12px 0" }}>{title}</h2>

      {error && (
        <div style={{ color: "crimson", marginBottom: 8 }}>
          COT Error: {error}
        </div>
      )}

      {!!series.length && (
        <CotChart
          title={
            summary?.symbol
              ? `Commercial Net Position (${summary.symbol})`
              : "Commercial Net Position"
          }
          series={series}
          height={180}
        />
      )}

      {summary && (
        <div style={card()}>
          <H3>최근 COT 요약</H3>
          <p>
            Symbol: <b>{summary.symbol}</b>
          </p>
          <p>Date: {summary.date}</p>
          <p>Commercial Net: {summary.commercialNet.toLocaleString()}</p>
          <p>Non-Commercial Net: {summary.nonCommercialNet.toLocaleString()}</p>
          <p>
            Bias: <b>{summary.bias}</b>
          </p>
        </div>
      )}
    </section>
  );
}

function card() {
  return { border: "1px solid #eee", borderRadius: 12, padding: 12 } as const;
}
function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{children}</h3>;
}
