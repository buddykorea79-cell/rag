import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "생애주기별 안전교육 챗봇",
  description:
    "생애주기별 안전교육 교재를 근거로 답변하는 RAG 기반 챗봇 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className="bg-gradient-to-b from-slate-100 via-slate-50 to-blue-100/70 font-sans text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
