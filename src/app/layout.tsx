import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "峽谷行者 Canyon Walker · Truku 山徑 — 太魯閣族語冒險卡牌",
  description:
    "《峽谷行者 Canyon Walker》是結合太魯閣族語學習的冒險卡牌遊戲：修復山徑、答對族語題觸發加成，帶隊伍安全返回部落。族語詞彙與發音來自原住民族語E樂園（原民會）。",
  applicationName: "峽谷行者 Canyon Walker",
  openGraph: {
    title: "峽谷行者 Canyon Walker · Truku 山徑",
    description: "答對太魯閣族語題，修復山徑、帶隊伍返回部落。原民族語學習 × 冒險卡牌。",
    type: "website",
    locale: "zh_TW",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant-TW"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
