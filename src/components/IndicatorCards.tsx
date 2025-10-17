// src/components/IndicatorCards.tsx
"use client";

import React from "react";

type Props = {
  latestWR: number | string; // 예:  -75.3  또는 'N/A'
  latestUO: number | string; // 예:   41.2  또는 'N/A'
  latestBO: boolean | string; // 예:   true  /  'O' / 'X'
  buyHint: boolean;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
      {children}
    </div>
  );
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>{children}</h3>;
}

export default function IndicatorCards({
  latestWR,
  latestUO,
  latestBO,
  buyHint,
}: Props) {
  return (
    <>
      <section
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
        }}
      >
        <Card>
          <H3>Williams %R (14)</H3>
          <p>
            Latest:&nbsp;
            {typeof latestWR === "number" ? latestWR.toFixed(1) : latestWR}
            &nbsp;(<span style={{ opacity: 0.75 }}>≤ -90 과매도</span>)
          </p>
        </Card>

        <Card>
          <H3>Ultimate Oscillator (7/14/28)</H3>
          <p>
            Latest:&nbsp;
            {typeof latestUO === "number" ? latestUO.toFixed(1) : latestUO}
            &nbsp;(<span style={{ opacity: 0.75 }}>30↓ 약세 / 50 중립</span>)
          </p>
        </Card>

        <Card>
          <H3>전일 고가 돌파</H3>
          <p>
            {typeof latestBO === "string" ? latestBO : latestBO ? "O" : "X"}
          </p>
        </Card>
      </section>

      <section style={{ marginTop: 10 }}>
        <b>매수 힌트:</b> {buyHint ? "조건 충족 가능성 ↑" : "조건 미충족"}
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>
          ※ 교육용 샘플. 실제 투자는 본인 책임입니다.
        </div>
      </section>
    </>
  );
}
