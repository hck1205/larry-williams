// src/app/layout.tsx
export const metadata = {
  title: "Larry Williams Dashboard",
  description: "Williams %R / Ultimate Oscillator / COT 시각화",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          fontFamily:
            "-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,Apple Color Emoji,Segoe UI Emoji",
          background: "#0e0f14",
          color: "#e6e6e6",
        }}
      >
        {children}
      </body>
    </html>
  );
}
