"use client";

// ORDER-060 P4 —— 天梯：勝場前 20 名。資料走 /api/leaderboard（service role 跨玩家讀取）。
// 視覺（CLAUDE-leaderboard-visual-handoff.md）：「山林天梯大廳」——通往山巔的排行榜石碑。
// 背景走 enzo-art 已核發的 leaderboard-bg.jpg（夜山／溪流／木架／石碑／營火），前三名做
// 2-1-3 領獎台（金銀銅牌），第 4 名起用石板排行表（勝率條）。所有名次／名稱／數字一律
// 由 React 渲染，背景圖只提供構圖，不承載任何真實資料。圖示一律 inline SVG 線稿（no-emoji）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { fetchLeaderboard, myProfile, type Profile } from "@/lib/vs";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Profile[] | null>(null);
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
      <img className="lb-bg" src="/images/vs/leaderboard/leaderboard-bg.jpg" alt="" aria-hidden />
      <div className="lb-scrim" aria-hidden />

      <div className="lb-shell">
        <header className="lb-header">
          <SummitIcon className="lb-summit-icon" />
          <h1>天梯</h1>
          <p>勝場排行 · 群峰之巔</p>
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
            <section className="lb-podium" aria-label="前三名">
              <PodiumCard place={2} entry={podium[1]} isMe={podium[1] ? isMe(podium[1].display_name) : false} />
              <PodiumCard place={1} entry={podium[0]} isMe={podium[0] ? isMe(podium[0].display_name) : false} />
              <PodiumCard place={3} entry={podium[2]} isMe={podium[2] ? isMe(podium[2].display_name) : false} />
            </section>

            {rest.length > 0 && (
              <section className="lb-ranking" aria-label="排行榜">
                <div className="lb-ranking-head" aria-hidden>
                  <span>名次</span>
                  <span>玩家</span>
                  <span>勝率</span>
                  <span>勝場</span>
                  <span>敗場</span>
                </div>
                {rest.map((r, i) => (
                  <RankingRow key={i} rank={i + 4} entry={r} isMe={isMe(r.display_name)} delay={i * 45} />
                ))}
              </section>
            )}
          </>
        )}

        <div className="lb-back-wrap">
          <Link href="/vs" className="lb-back">
            ← 回到大廳
          </Link>
        </div>
      </div>
    </main>
  );
}
/* ───────── 領獎台（前三名，2-1-3 排列） ───────── */

const PLACE_LABEL: Record<1 | 2 | 3, string> = { 1: "冠軍", 2: "亞軍", 3: "季軍" };
const PLACE_CLASS: Record<1 | 2 | 3, string> = { 1: "is-first", 2: "is-second", 3: "is-third" };

function PodiumCard({ place, entry, isMe }: { place: 1 | 2 | 3; entry?: Profile; isMe: boolean }) {
  if (!entry) return <div aria-hidden />;
  const delay = place === 1 ? 120 : place === 2 ? 40 : 200;
  return (
    <div
      className={`lb-podium-card ${PLACE_CLASS[place]} ${isMe ? "is-me" : ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {place === 1 && <CrownIcon className="lb-podium-crown" />}
      <span className="lb-podium-rank">
        {place === 1 && (
          <>
            <LaurelIcon className="lb-podium-laurel side-l" />
            <LaurelIcon className="lb-podium-laurel side-r" />
          </>
        )}
        {place}
      </span>
      <span className="lb-podium-avatar" aria-hidden>
        {initial(entry.display_name)}
        {place === 2 && <PineIcon className="lb-podium-accent" />}
        {place === 3 && <PeakIcon className="lb-podium-accent" />}
      </span>
      <div className="lb-podium-name">
        {entry.display_name}
        {isMe && <span className="lb-podium-you">（你）</span>}
      </div>
      <div className="lb-podium-record">
        <span className="lb-w">{entry.wins}</span> 勝 · <span className="lb-l">{entry.losses}</span> 敗
      </div>
      <div className="lb-podium-label">{PLACE_LABEL[place]}</div>
    </div>
  );
}

/* ───────── 排行表（第 4 名起） ───────── */

function RankingRow({ rank, entry, isMe, delay }: { rank: number; entry: Profile; isMe: boolean; delay: number }) {
  const total = entry.wins + entry.losses;
  const rate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  return (
    <div className={`lb-row ${isMe ? "is-me" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <span className="lb-rank">{rank}</span>

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

/* ───────── 訊息狀態（載入 / 錯誤 / 未設定）── 沿用同一石碑內容區 ───────── */

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

// 山巔＋登頂旗（天梯：通往山巔）
function SummitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M4 20 L10 7 L13 12 L16.5 5 L21 20 Z" />
      <path d="M16.5 5 V1.5 M16.5 2 L19 3 L16.5 4" strokeLinecap="round" />
    </svg>
  );
}

// 冠軍冠冕（線稿，非 emoji）
function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.4 9H4.4L3 8z" opacity="0.95" />
      <rect x="4.2" y="18" width="15.6" height="2" rx="0.6" />
    </svg>
  );
}

// 冠軍章環側邊的月桂枝（一枚，靠 CSS scaleX(-1) 鏡射出另一側）
function LaurelIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" className={className} aria-hidden>
      <path d="M20 12c-3 5-8 8-14 8" />
      <path d="M8 8.5 5.5 7M8.5 11 6 10M9.5 13.5 7 13M11 16 9 16" />
      <path d="M14 6.5 12 5M15 9 12.5 8M16 11.5 13.5 11M16.5 14.5 14 14.5" />
    </svg>
  );
}

// 亞軍頭像角上的小松（呼應山林主題）
function PineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2 7 9h2.4L6 14h2.6L5 20h14l-3.6-6h2.6L14.6 9H17z" />
    </svg>
  );
}

// 季軍頭像角上的雙峰（呼應「群峰之巔」）
function PeakIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M2 19h20L15.5 8l-3 4-2-2.5L2 19z" />
    </svg>
  );
}
