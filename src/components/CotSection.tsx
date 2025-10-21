// src/components/CotSection.tsx
"use client";

import { useMemo } from "react";
import CotChart from "./CotChart";

const PRESETS = ["NQ", "ES", "YM", "RTY"] as const;

type LinePoint = { time: number; value: number | null | undefined };
type LoadState = "idle" | "loading" | "done" | "error";

export default function CotSection({
  symbol,
  seriesGroups,
  state,
  error,
  onReload,
  onChangeSymbol,
}: {
  symbol: string;
  seriesGroups: {
    nonCommercial: LinePoint[];
    commercial: LinePoint[];
    small: LinePoint[];
  };
  state: LoadState;
  error: string;
  onReload: () => void;
  onChangeSymbol: (s: string) => void;
}) {
  // 차트 라인 데이터 구성
  const lines = useMemo(
    () => [
      {
        label: "Non-Commercial Net",
        color: "#6aa0ff",
        data: seriesGroups.nonCommercial,
      },
      {
        label: "Commercial Net",
        color: "#ffd166",
        data: seriesGroups.commercial,
      },
      {
        label: "Small Traders Net",
        color: "#8ce99a",
        data: seriesGroups.small,
      },
    ],
    [seriesGroups]
  );

  // 데이터 존재 여부
  const hasAnyData = useMemo(
    () =>
      (seriesGroups.nonCommercial?.length ?? 0) > 0 ||
      (seriesGroups.commercial?.length ?? 0) > 0 ||
      (seriesGroups.small?.length ?? 0) > 0,
    [seriesGroups]
  );

  // 공통 버튼 스타일
  const baseBtnStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 8,
    border: "1px solid #444",
    background: "#1b1f2a",
    color: "#fff",
    cursor: state === "loading" ? "not-allowed" : "pointer",
    opacity: state === "loading" ? 0.6 : 1,
  };

  const presetBtnStyle = (s: string): React.CSSProperties => ({
    ...baseBtnStyle,
    border: `1px solid ${s === symbol ? "#6aa0ff" : "#444"}`,
    background: s === symbol ? "#182235" : "#1b1f2a",
  });

  const handleChange = (s: string) => {
    if (state === "loading") return; // 연속 클릭 방지
    onChangeSymbol(s);
  };

  const handleReload = () => {
    if (state === "loading") return;
    onReload();
  };

  return (
    <section
      aria-busy={state === "loading"}
      style={{
        marginTop: 24,
        background: "#12141b",
        borderRadius: 12,
        padding: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <h2 style={{ margin: "4px 0 12px", flex: 1 }}>
          COT (TFF Futures-Only) — {symbol}
        </h2>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => handleChange(s)}
              disabled={state === "loading"}
              aria-pressed={s === symbol}
              style={presetBtnStyle(s)}
              title={`Switch to ${s}`}
            >
              {s}
            </button>
          ))}
          <button
            onClick={handleReload}
            disabled={state === "loading"}
            style={baseBtnStyle}
            title="Reload COT data"
          >
            Reload
          </button>
        </div>
      </div>

      {/* 상태/알림 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        {state === "loading" && (
          <span style={{ fontSize: 12, opacity: 0.8 }}>로딩 중…</span>
        )}
        {state === "error" && (
          <span
            style={{
              fontSize: 12,
              background: "#3a1e1e",
              border: "1px solid #5a2b2b",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            에러: {error || "데이터 로드 실패"}
          </span>
        )}
        {state === "done" && !hasAnyData && (
          <span
            style={{
              fontSize: 12,
              background: "#2c2430",
              border: "1px solid #4b4152",
              borderRadius: 6,
              padding: "4px 8px",
            }}
          >
            데이터가 없습니다. (마켓명 또는 기간을 확인하세요)
          </span>
        )}

        {/* 개발 편의 카운트 표시 */}
        <span style={{ fontSize: 12, opacity: 0.6 }}>
          non-com: {seriesGroups.nonCommercial?.length ?? 0} · com:{" "}
          {seriesGroups.commercial?.length ?? 0} · small:{" "}
          {seriesGroups.small?.length ?? 0}
        </span>
      </div>

      {/* 차트/플레이스홀더 */}
      {hasAnyData ? (
        <CotChart title="COT — Net Positions" lines={lines} height={240} />
      ) : (
        <div
          style={{
            height: 240,
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
      )}
    </section>
  );
}
