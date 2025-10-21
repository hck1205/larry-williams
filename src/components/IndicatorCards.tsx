// src/components/IndicatorCards.tsx
"use client";

import type { Bar } from "@/lib/indicators";
import { useMemo } from "react";

type Props = {
  bars: Bar[];
  wr: number[]; // Williams %R (보통 -100~0)
  uo: number[]; // Ultimate Oscillator (0~100)
  breakout: boolean[]; // 전일 고가 돌파
};

const fmtNum = (v: unknown, digits = 2) =>
  Number.isFinite(v as number) ? (v as number).toFixed(digits) : "—";

const fmtPct = (v: unknown, digits = 1) =>
  Number.isFinite(v as number) ? `${(v as number).toFixed(digits)}%` : "—";

function wrColor(wrVal?: number): string {
  if (!Number.isFinite(wrVal)) return "#e6e6e6";
  if ((wrVal as number) > -20) return "#ff7675"; // 과매수 (덜 음수)
  if ((wrVal as number) < -80) return "#74c69d"; // 과매도
  return "#e6e6e6"; // 중립
}

function uoColor(uoVal?: number): string {
  if (!Number.isFinite(uoVal)) return "#e6e6e6";
  if ((uoVal as number) >= 50) return "#74c69d"; // 강세
  return "#ff7675"; // 약세
}

function badgeStyle(bg: string, border: string): React.CSSProperties {
  return {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    background: bg,
    border: `1px solid ${border}`,
  };
}

export default function IndicatorCards({ bars, wr, uo, breakout }: Props) {
  const { lastClose, lastWr, lastUo, lastBreak, prevClose } = useMemo(() => {
    const lastBar = bars.at(-1);
    const prevBar = bars.at(-2);
    return {
      lastClose: lastBar?.close,
      prevClose: prevBar?.close,
      lastWr: wr.at(-1),
      lastUo: uo.at(-1),
      lastBreak: breakout.at(-1),
    };
  }, [bars, wr, uo, breakout]);

  const closeDelta = useMemo(() => {
    if (!Number.isFinite(lastClose) || !Number.isFinite(prevClose)) return null;
    const d = (lastClose as number) - (prevClose as number);
    const dp = (d / (prevClose as number)) * 100;
    return { d, dp };
  }, [lastClose, prevClose]);

  const cardsContainerStyle: React.CSSProperties = {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  };

  const cardStyle: React.CSSProperties = {
    background: "#12141b",
    border: "1px solid #1f2430",
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    flex: "1 1 180px",
  };

  return (
    <section style={cardsContainerStyle} aria-label="indicator summary">
      {/* Close */}
      <div style={cardStyle} title="마감가(또는 최신 종가)">
        <div style={{ fontSize: 12, opacity: 0.8 }}>Close</div>
        <div style={{ fontSize: 20, marginTop: 6 }}>{fmtNum(lastClose, 2)}</div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          {closeDelta ? (
            <>
              <span
                style={{ color: closeDelta.d >= 0 ? "#74c69d" : "#ff7675" }}
              >
                {closeDelta.d >= 0 ? "▲" : "▼"} {fmtNum(closeDelta.d, 2)}
              </span>{" "}
              <span style={{ opacity: 0.8 }}>({fmtPct(closeDelta.dp, 2)})</span>
            </>
          ) : (
            <span style={{ opacity: 0.6 }}>—</span>
          )}
        </div>
      </div>

      {/* Williams %R */}
      <div
        style={cardStyle}
        title="Williams %R (14): 최고·최저 대비 현 위치 (과매수/과매도)"
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>Williams %R (14)</div>
        <div
          style={{
            fontSize: 20,
            marginTop: 6,
            color: wrColor(lastWr as number),
          }}
        >
          {Number.isFinite(lastWr ?? NaN) ? fmtNum(lastWr, 1) : "—"}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          범례:{" "}
          <span style={badgeStyle("#2a1c1c", "#4a2a2a")}> &gt;-20 과매수</span>{" "}
          <span style={badgeStyle("#19241d", "#2e4a34")}> &lt;-80 과매도</span>
        </div>
      </div>

      {/* Ultimate Oscillator */}
      <div
        style={cardStyle}
        title="Ultimate Oscillator (7,14,28): 모멘텀 통합 지표"
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>Ultimate Osc (7,14,28)</div>
        <div
          style={{
            fontSize: 20,
            marginTop: 6,
            color: uoColor(lastUo as number),
          }}
        >
          {Number.isFinite(lastUo ?? NaN) ? fmtNum(lastUo, 1) : "—"}
        </div>
        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.9 }}>
          기준: <span style={badgeStyle("#19241d", "#2e4a34")}>50↑ 강세</span>
          <span style={badgeStyle("#2a1c1c", "#4a2a2a")}>50↓ 약세</span>
        </div>
      </div>

      {/* Breakout */}
      <div
        style={cardStyle}
        title="전일 고가 돌파 여부 (종가 기준)"
        aria-label={`breakout ${lastBreak ? "yes" : "no"}`}
      >
        <div style={{ fontSize: 12, opacity: 0.8 }}>Breakout (prev high)</div>
        <div style={{ marginTop: 6 }}>
          <span
            style={
              lastBreak
                ? badgeStyle("#19241d", "#2e4a34")
                : badgeStyle("#2a1c1c", "#4a2a2a")
            }
          >
            {lastBreak ? "Yes" : "No"}
          </span>
        </div>
      </div>
    </section>
  );
}
