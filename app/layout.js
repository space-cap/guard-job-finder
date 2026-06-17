import "./globals.css";

export const metadata = {
  title: "경비 일자리 모니터",
  description: "고용24 경비 일자리 검색 및 알림 대시보드"
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
