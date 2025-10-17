export const metadata = { title: "LW Dashboard" };

const RootLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="ko">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
};

export default RootLayout;
