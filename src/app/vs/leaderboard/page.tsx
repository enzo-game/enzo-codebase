"use client";

// ORDER-060 P4 —— 天梯：勝場前 20 名。資料走 /api/leaderboard（service role 跨玩家讀取）。
// 視覺（enzo-art ui-leaderboard 全素材整合，2026-07-15 依 CLAUDE-FIX-leaderboard-integration.md
// 目標 mock 重做）：「山巔排行殿」。素材全部到位、資料層疊在美術上：
//   - 頁首冠冕 leaderboard-header-crest（自主框裁出的山峰＋標題石牌），標題「天梯」刻在石牌上
//   - 前三名 leaderboard-top3-podium-stones 石碑領獎台（金/銀/銅，內建盾徽＋橢圓頭像框＋名牌），
//     名次/名字/頭像以百分比錨定疊在對應凹槽（整張等比縮放 → 永遠對齊）
//   - 第 4 名起 leaderboard-table-panel 木石框（border-image 九宮切，列數不限不變形），每列：
//     rank-badge 盾徽名次、avatar-frame 頭像框、progress-bar-frame 勝率條外框、player-row-highlight 自己列高亮
//   - 返回鈕 leaderboard-button-plaque 木石牌（border-image）
// 所有名次／名稱／數字一律 React 渲染，圖片只提供構圖、不承載真實資料。圖示 inline SVG（no-emoji）。
// 手機版走堆疊卡片式（mock 為桌面 mock；窄螢幕退化為單欄，見 globals.css @media）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { fetchLeaderboard, myProfile, type LeaderboardRow as LeaderboardEntry } from "@/lib/vs";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchLeaderboard()
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    // 高亮「你」自己那一列（以顯示名稱比對）
    myProfile()
      .then((p) => p && setMyName(p.display_name))
      .catch(() => {});
  }, []);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const isMe = (name: string) => !!myName && name === myName;

  return (
    <main className="lb-page">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="lb-bg" src="/images/ui/leaderboard/leaderboard-bg-mountain-night-v1.jpg" alt="" aria-hidden />
      <div className="lb-scrim" aria-hidden />

      <div className="lb-shell">
        {/* 頁首：山峰＋刻字石牌 */}
        <header className="lb-crest">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lb-crest-art" src="/images/ui/leaderboard/leaderboard-header-crest-v1.png" alt="" aria-hidden />
          <div className="lb-crest-text">
            <h1>天梯</h1>
            <p>勝場排行 · 群峰之巔</p>
          </div>
        </header>

        {!supabaseConfigured ? (
          <StonePanel tone="warn">後端尚未設定。</StonePanel>
        ) : err ? (
          <StonePanel tone="error">{err}</StonePanel>
        ) : rows === null ? (
          <StonePanel tone="loading">攀登紀錄載入中…</StonePanel>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* 前三名石碑領獎台（2-1-3） */}
            <section className="lb-podium" aria-label="前三名">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="lb-podium-art" src="/images/ui/leaderboard/leaderboard-top3-podium-stones-v1.png" alt="" aria-hidden />
              <PodiumCell place={2} entry={podium[1]} isMe={podium[1] ? isMe(podium[1].display_name) : false} />
              <PodiumCell place={1} entry={podium[0]} isMe={podium[0] ? isMe(podium[0].display_name) : false} />
              <PodiumCell place={3} entry={podium[2]} isMe={podium[2] ? isMe(podium[2].display_name) : false} />
            </section>

            {/* 第 4 名起：木石排行表 */}
            {rest.length > 0 && (
              <section className="lb-ranking" aria-label="排行榜">
                <div className="lb-thead" aria-hidden>
                  <span>名次</span>
                  <span>玩家</span>
                  <span>勝率</span>
                  <span>勝場</span>
                  <span>敗場</span>
                </div>
                <div className="lb-rows">
                  {rest.map((r, i) => (
                    <RankingRow key={i} rank={i + 4} entry={r} isMe={isMe(r.display_name)} delay={i * 45} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="lb-back-wrap">
          <Link href="/vs" className="lb-back">
            <span>← 回到大廳</span>
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ───────── 領獎台（前三名，2-1-3 排列，資料疊在石碑凹槽上） ───────── */

const PLACE_LABEL: Record<1 | 2 | 3, string> = { 1: "冠軍", 2: "亞軍", 3: "季軍" };

function PodiumCell({ place, entry, isMe }: { place: 1 | 2 | 3; entry?: LeaderboardEntry; isMe: boolean }) {
  if (!entry) return null;
  const delay = place === 1 ? 120 : place === 2 ? 40 : 200;
  return (
    <div className={`lb-pod lb-pod-${place} ${isMe ? "is-me" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="lb-pod-rank" aria-hidden>{place}</span>
      <span className="lb-pod-avatar" aria-hidden>{initial(entry.display_name)}</span>
      <div className="lb-pod-name">
        {entry.display_name}
        {isMe && <span className="lb-pod-you">（你）</span>}
      </div>
      <div className="lb-pod-rec">
        <span className="lb-w">{entry.wins}</span> 勝 · <span className="lb-l">{entry.losses}</span> 敗
        <span className="lb-pod-label"> · {PLACE_LABEL[place]}</span>
      </div>
    </div>
  );
}

/* ───────── 排行表（第 4 名起） ───────── */

function RankingRow({ rank, entry, isMe, delay }: { rank: number; entry: LeaderboardEntry; isMe: boolean; delay: number }) {
  const total = entry.wins + entry.losses;
  const rate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  return (
    <div className={`lb-row ${isMe ? "is-me" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      {isMe && <span className="lb-row-you" aria-hidden>你</span>}
      <span className="lb-rank" aria-hidden>
        <span className="lb-rank-n">{rank}</span>
      </span>

      <div className="lb-player">
        <span className="lb-player-avatar" aria-hidden>
          {initial(entry.display_name)}
        </span>
        <span className="lb-player-name">{entry.display_name}</span>
      </div>

      <div className="lb-rate">
        <span className="lb-rate-track">
          <span className="lb-rate-fill" style={{ width: `${rate}%`, animationDelay: `${delay + 100}ms` }} />
        </span>
        <span className="lb-rate-pct">{rate}%</span>
      </div>

      <span className="lb-wins">{entry.wins}</span>
      <span className="lb-losses">{entry.losses}</span>

      {/* 手機版收成一格（CSS 依螢幕寬度切換顯示） */}
      <span className="lb-record">
        <span className="lb-w">{entry.wins}</span> 勝 · <span className="lb-l">{entry.losses}</span> 敗
      </span>
    </div>
  );
}

/* ───────── 訊息狀態（載入 / 錯誤 / 未設定） ───────── */

function StonePanel({ tone, children }: { tone: "warn" | "error" | "loading"; children: React.ReactNode }) {
  return (
    <div className={`lb-panel is-${tone}`}>
      <p className="lb-panel-title">{children}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="lb-panel lb-empty">
      <SummitIcon className="lb-empty-icon" />
      <p className="lb-empty-title">群峰之巔尚無人立旗。</p>
      <p className="lb-empty-sub">快去對戰，成為第一位登頂者。</p>
    </div>
  );
}

/* ───────── 工具 / 圖示 ───────── */

function initial(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

// 山巔＋登頂旗（空狀態用）
function SummitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M4 20 L10 7 L13 12 L16.5 5 L21 20 Z" />
      <path d="M16.5 5 V1.5 M16.5 2 L19 3 L16.5 4" strokeLinecap="round" />
    </svg>
  );
}
