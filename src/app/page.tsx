"use client";

import { useEffect } from "react";

// 차트/섹션 컴포넌트
import Chart from "@/components/Chart";
import IndicatorCards from "@/components/IndicatorCards";
import CotSection from "@/components/CotSection";

// 훅
import { usePrice } from "@/hooks/usePrice";
import { useCot } from "@/hooks/useCot";
import { useIndicators } from "@/hooks/useIndicators";

export default function Page() {
  // ── 가격 훅
  const {
    ticker,
    setTicker,
    bars,
    state: priceState,
    error: priceErr,
    load: loadPrice,
  } = usePrice("NVDA");

  console.log("bars", bars);

  // ── COT 훅 (초기 NQ)
  const {
    from,
    to,
    symbol: cotSymbol,
    setSymbol: setCotSymbol,
    state: cotState,
    error: cotErr,
    series: cotSeries,
    summary: cotSummary,
    load: loadCot,
  } = useCot({ initialSymbol: "NQ" });

  // ── 지표 훅 (bars → %R/UO/돌파 + 매수 힌트)
  const { latestWR, latestUO, latestBO, buyHint } = useIndicators(bars);

  // 초기 로드
  useEffect(() => {
    void loadPrice(ticker);
    void loadCot(cotSymbol ? { symbol: cotSymbol, from, to } : undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 폼 제출 핸들러
  const onFetch = (e: React.FormEvent) => {
    e.preventDefault();
    void loadPrice(ticker);
    // 필요 시 COT 심볼도 함께 변경하도록 UI 확장 가능
  };

  return (
    <main
      style={{
        maxWidth: 1080,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ marginBottom: 8 }}>Larry Williams Dashboard</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>
        가격/지표는 티커 기준, COT은 선물 심볼(예: NQ) 기준입니다.
      </p>

      {/* 가격 티커 입력 */}
      <form
        onSubmit={onFetch}
        style={{ display: "flex", gap: 8, margin: "12px 0 16px" }}
      >
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="NVDA"
          aria-label="Ticker"
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "10px 12px",
            width: 200,
          }}
        />
        <button
          style={{
            padding: "10px 16px",
            borderRadius: 8,
            border: "1px solid #222",
            background: "#111",
            color: "white",
          }}
        >
          {priceState === "loading" ? "Loading…" : "Fetch"}
        </button>
      </form>

      {/* 가격 차트 */}
      {priceErr && (
        <div style={{ color: "crimson", marginBottom: 8 }}>
          Price Error: {priceErr}
        </div>
      )}
      {bars.length > 0 && <Chart bars={bars} />}

      {/* 지표 카드 */}
      {bars.length > 0 && (
        <IndicatorCards
          latestWR={Number.isFinite(latestWR) ? (latestWR as number) : "N/A"}
          latestUO={Number.isFinite(latestUO) ? (latestUO as number) : "N/A"}
          latestBO={typeof latestBO === "boolean" ? latestBO : false}
          buyHint={buyHint}
        />
      )}

      {/* COT 심볼 빠른 변경 (선택) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void loadCot({ symbol: cotSymbol, from, to });
        }}
        style={{ display: "flex", gap: 8, margin: "20px 0 8px" }}
      >
        <input
          value={cotSymbol}
          onChange={(e) => setCotSymbol(e.target.value.toUpperCase())}
          placeholder="NQ"
          aria-label="COT Symbol"
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: "8px 10px",
            width: 140,
          }}
        />
        <button
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #222",
            background: "#111",
            color: "white",
          }}
        >
          {cotState === "loading" ? "Loading…" : "Load COT"}
        </button>
      </form>

      {/* COT 섹션 */}
      <CotSection
        title="COT (Commercial Net Position)"
        series={cotSeries}
        summary={cotSummary}
        error={cotErr}
      />
    </main>
  );
}
