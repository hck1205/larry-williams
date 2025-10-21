// src/app/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrice } from "@/hooks/usePrice";
import { useIndicators } from "@/hooks/useIndicators";
import { useCot } from "@/hooks/useCot";
import PriceChart from "@/components/Chart";
import CotSection from "@/components/CotSection";
import IndicatorCards from "@/components/IndicatorCards";

const TICKER_PRESETS = ["NVDA", "AAPL", "SPY"] as const;

export default function Page() {
  const [input, setInput] = useState("NVDA");

  // 가격(=FMP EOD); 훅 내부에서 ticker를 upper로 관리
  const { ticker, bars, state, error, load } = usePrice("NVDA");
  const { wr, uo, breakout } = useIndicators(bars);

  // COT (CFTC) — NQ 기본
  const { symbol, seriesGroups, cotState, cotError, loadCot } = useCot("NQ");

  // 최초 로드
  useEffect(() => {
    load(); // Price
    loadCot(); // COT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = useCallback(async () => {
    const sym = (input || "").trim().toUpperCase();
    if (!sym) return;
    await load(sym);
  }, [input, load]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") onSearch();
  };

  const hasBars = useMemo(() => (bars?.length ?? 0) > 0, [bars]);

  return (
    <main style={{ padding: 20, maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ margin: "8px 0 16px" }}>Larry Williams Dashboard</h1>

      {/* 검색 바 + 상태 */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ticker (예: NVDA, AAPL)"
          style={{
            padding: 8,
            borderRadius: 8,
            border: "1px solid #333",
            flex: "0 0 220px",
            background: "#0f1218",
            color: "#e6e6e6",
          }}
        />
        <button
          onClick={onSearch}
          disabled={state === "loading"}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #444",
            background: "#1b1f2a",
            color: "#fff",
            cursor: state === "loading" ? "not-allowed" : "pointer",
            opacity: state === "loading" ? 0.6 : 1,
          }}
          title="Load price data"
        >
          {state === "loading" ? "Loading…" : "Load"}
        </button>

        {/* 프리셋 */}
        <div style={{ display: "flex", gap: 6 }}>
          {TICKER_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => {
                setInput(t);
                load(t);
              }}
              disabled={state === "loading"}
              style={{
                padding: "6px 10px",
                borderRadius: 8,
                border: "1px solid #444",
                background: ticker === t ? "#182235" : "#1b1f2a",
                color: "#fff",
                cursor: state === "loading" ? "not-allowed" : "pointer",
                opacity: state === "loading" ? 0.6 : 1,
              }}
              title={`Load ${t}`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* 상태/오류 표시 */}
        <span style={{ opacity: 0.8, alignSelf: "center" }}>
          {state === "loading"
            ? "로딩 중…"
            : state === "error"
            ? `에러: ${error}`
            : hasBars
            ? ticker
            : "데이터 없음"}
        </span>
      </div>

      {/* 지표 카드 */}
      <IndicatorCards bars={bars} wr={wr} uo={uo} breakout={breakout} />

      {/* 가격 차트 */}
      <section
        style={{
          marginTop: 20,
          background: "#12141b",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <h2 style={{ margin: "4px 0 12px" }}>{ticker} — Price</h2>
        {hasBars ? (
          <PriceChart bars={bars} wr={wr} uo={uo} />
        ) : (
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
        )}
      </section>

      {/* COT 섹션 */}
      <CotSection
        symbol={symbol}
        setSymbol={() => {
          /* 내부에서 직접 관리하지 않음: loadCot 사용 */
        }}
        seriesGroups={seriesGroups}
        state={cotState}
        error={cotError}
        onReload={() => loadCot(symbol)}
        onChangeSymbol={(s) => loadCot(s)}
      />
    </main>
  );
}
