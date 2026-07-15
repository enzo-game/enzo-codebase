"use client";

// ORDER-060 P4 —— 天梯：勝場前 20 名。資料走 /api/leaderboard（service role 跨玩家讀取）。
// 視覺（2026-07-15 改版）：沿用 /battle 的深色霓虹卡片視覺語言（slate-950 底＋夜山背景＋
// 霓虹光暈卡片），只保留背景圖，捨棄石木素材那套。前三名做霓虹領獎台（金/銀/銅＝amber/sky/
// fuchsia），第 4 名起用霓虹列表；自己那列 emerald 霓虹高亮。所有數字一律 React 渲染。
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { fetchLeaderboard, myProfile, type LeaderboardRow as LeaderboardEntry } from "@/lib/vs";

type Place = 1 | 2 | 3;
const PLACE = {
  1: { label: "冠軍", order: "sm:order-2", lift: "sm:-translate-y-5", border: "border-amber-600/50", ringHover: "hover:border-amber-400/90", glow: "bg-amber-500/30", text: "text-amber-300", ring: "ring-amber-400/60", pill: "bg-amber-400/90 text-black" },
  2: { label: "亞軍", order: "sm:order-1", lift: "", border: "border-sky-700/50", ringHover: "hover:border-sky-400/90", glow: "bg-sky-500/25", text: "text-sky-300", ring: "ring-sky-400/60", pill: "bg-sky-300/90 text-black" },
  3: { label: "季軍", order: "sm:order-3", lift: "", border: "border-fuchsia-700/50", ringHover: "hover:border-fuchsia-400/90", glow: "bg-fuchsia-500/25", text: "text-fuchsia-300", ring: "ring-fuchsia-400/60", pill: "bg-fuchsia-300/90 text-black" },
} satisfies Record<Place, unknown> as Record<Place, { label: string; order: string; lift: string; border: string; ringHover: string; glow: string; text: string; ring: string; pill: string }>;

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [myName, setMyName] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchLeaderboard()
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
    myProfile()
      .then((p) => p && setMyName(p.display_name))
      .catch(() => {});
  }, []);

  const podium = rows?.slice(0, 3) ?? [];
  const rest = rows?.slice(3) ?? [];
  const isMe = (name: string) => !!myName && name === myName;

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/ui/leaderboard/leaderboard-bg-mountain-night-v1.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/80 to-slate-950/90" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-5 py-14">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">天梯</h1>
          <p className="mt-3 text-sm text-slate-300/90">勝場排行 · 群峰之巔</p>
          <div className="mx-auto mt-4 flex items-center justify-center gap-3 text-slate-600">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
        </header>

        {!supabaseConfigured ? (
          <Panel tone="warn">後端尚未設定。</Panel>
        ) : err ? (
          <Panel tone="error">{err}</Panel>
        ) : rows === null ? (
          <Panel tone="loading">攀登紀錄載入中…</Panel>
        ) : rows.length === 0 ? (
          <Empty />
        ) : (
          <>
            {/* 前三名霓虹領獎台 */}
            <section className="mt-10 grid gap-4 sm:grid-cols-3 sm:items-end" aria-label="前三名">
              {([1, 2, 3] as Place[]).map((place) => {
                const entry = podium[place - 1];
                if (!entry) return <div key={place} className={PLACE[place].order} aria-hidden />;
                return <PodiumCard key={place} place={place} entry={entry} isMe={isMe(entry.display_name)} />;
              })}
            </section>

            {/* 第 4 名起：霓虹列表 */}
            {rest.length > 0 && (
              <section className="mt-6 flex flex-col gap-2.5" aria-label="排行榜">
                {rest.map((r, i) => (
                  <RankingRow key={i} rank={i + 4} entry={r} isMe={isMe(r.display_name)} />
                ))}
              </section>
            )}
          </>
        )}

        <div className="mt-9 text-center">
          <Link
            href="/vs"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-700/70 bg-slate-900/50 px-5 py-2.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition-colors hover:border-slate-500 hover:bg-slate-800/70"
          >
            ← 回到大廳
          </Link>
        </div>
      </div>
    </main>
  );
}

/* ───────── 前三名霓虹卡 ───────── */

function PodiumCard({ place, entry, isMe }: { place: Place; entry: LeaderboardEntry; isMe: boolean }) {
  const a = PLACE[place];
  const total = entry.wins + entry.losses;
  const rate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  return (
    <div className={`anim-card anim-card-${((place - 1) % 2) + 1} relative ${a.order} ${a.lift}`}>
      <div className={`glow-breathe pointer-events-none absolute -inset-2 rounded-3xl blur-2xl ${a.glow}`} aria-hidden />
      <div
        className={`group relative flex flex-col items-center rounded-2xl border ${a.border} ${a.ringHover} bg-slate-900/55 p-5 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 ${
          isMe ? "ring-2 ring-emerald-400/70" : ""
        }`}
      >
        <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${a.pill}`}>{a.label}</span>
        {place === 1 && <CrownIcon className={`mb-1 h-6 w-6 ${a.text}`} />}
        <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-slate-950/60 text-2xl font-bold ring-2 ${a.ring} ${a.text}`}>
          {initial(entry.display_name)}
        </div>
        <div className="mt-3 flex items-center gap-1.5">
          <span className={`text-sm font-black ${a.text}`}>#{place}</span>
          <span className="max-w-[9rem] truncate text-lg font-bold text-slate-100">{entry.display_name}</span>
        </div>
        {isMe && <span className="text-xs font-semibold text-emerald-300">（你）</span>}
        <div className="mt-1.5 text-sm text-slate-300/90">
          <span className="font-bold text-emerald-300">{entry.wins}</span> 勝 ·{" "}
          <span className="font-bold text-rose-300">{entry.losses}</span> 敗
        </div>
        <div className="mt-2 w-full">
          <RateBar rate={rate} accent={a.text} />
        </div>
      </div>
    </div>
  );
}

/* ───────── 排行列（第 4 名起） ───────── */

function RankingRow({ rank, entry, isMe }: { rank: number; entry: LeaderboardEntry; isMe: boolean }) {
  const total = entry.wins + entry.losses;
  const rate = total > 0 ? Math.round((entry.wins / total) * 100) : 0;
  return (
    <div className="relative">
      {isMe && <div className="glow-breathe pointer-events-none absolute -inset-1 rounded-2xl blur-xl bg-emerald-500/20" aria-hidden />}
      <div
        className={`relative flex items-center gap-3 rounded-xl border px-3.5 py-2.5 backdrop-blur-sm transition-colors sm:gap-4 sm:px-4 ${
          isMe ? "border-emerald-400/70 bg-emerald-950/40" : "border-slate-800/60 bg-slate-900/45 hover:border-slate-700"
        }`}
      >
        <span
          className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg text-sm font-black ${
            isMe ? "bg-emerald-400/90 text-black" : "bg-slate-800/80 text-slate-300"
          }`}
        >
          {rank}
        </span>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-slate-950/60 text-sm font-bold text-slate-200 ring-1 ring-slate-600/70">
          {initial(entry.display_name)}
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-semibold text-slate-100">{entry.display_name}</span>
          {isMe && <span className="flex-none rounded bg-emerald-400/90 px-1.5 py-0.5 text-[10px] font-bold text-black">你</span>}
        </div>
        {/* 勝率條（桌面顯示） */}
        <div className="hidden w-40 flex-none items-center gap-2 sm:flex">
          <RateBar rate={rate} accent="text-emerald-300" />
        </div>
        {/* 勝敗 */}
        <div className="flex flex-none items-center gap-1 text-sm tabular-nums">
          <span className="font-bold text-emerald-300">{entry.wins}</span>
          <span className="text-slate-500">·</span>
          <span className="font-bold text-rose-300">{entry.losses}</span>
        </div>
      </div>
    </div>
  );
}

/* ───────── 勝率條 ───────── */

function RateBar({ rate, accent }: { rate: number; accent: string }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-800/80">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300 shadow-[0_0_8px_rgba(150,220,110,0.6)] transition-[width] duration-700 ease-out"
          style={{ width: `${rate}%` }}
        />
      </span>
      <span className={`w-9 flex-none text-right text-xs font-bold ${accent}`}>{rate}%</span>
    </div>
  );
}

/* ───────── 狀態 ───────── */

function Panel({ tone, children }: { tone: "warn" | "error" | "loading"; children: React.ReactNode }) {
  const border = tone === "error" ? "border-rose-800/60" : "border-slate-700/60";
  return (
    <div className={`mx-auto mt-10 w-full max-w-md rounded-2xl border ${border} bg-slate-900/55 p-8 text-center backdrop-blur-sm`}>
      <p className={`text-sm text-slate-200/90 ${tone === "loading" ? "glow-breathe" : ""}`}>{children}</p>
    </div>
  );
}

function Empty() {
  return (
    <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-slate-700/60 bg-slate-900/55 p-9 text-center backdrop-blur-sm">
      <SummitIcon className="mx-auto h-10 w-10 text-slate-500" />
      <p className="mt-3 font-semibold text-slate-100">群峰之巔尚無人立旗。</p>
      <p className="mt-1 text-sm text-slate-400">快去對戰，成為第一位登頂者。</p>
    </div>
  );
}

/* ───────── 工具 / 圖示 ───────── */

function initial(name: string): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

function CrownIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M3 8l3.5 3L12 4l5.5 7L21 8l-1.4 9H4.4L3 8z" />
      <rect x="4.2" y="18" width="15.6" height="2" rx="0.6" />
    </svg>
  );
}

function SummitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M4 20 L10 7 L13 12 L16.5 5 L21 20 Z" />
      <path d="M16.5 5 V1.5 M16.5 2 L19 3 L16.5 4" strokeLinecap="round" />
    </svg>
  );
}
