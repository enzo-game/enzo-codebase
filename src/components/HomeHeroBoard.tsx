"use client";

// 首頁的「峽谷英雄榜」：天梯前 5 名精華，資料走 /api/leaderboard（同天梯頁的 fetchLeaderboard）。
// 後端未設定 / 尚無資料就低調不顯示或給空狀態，不讓首頁出現壞掉的區塊。全站禁 emoji：名次用線稿徽章。
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { fetchLeaderboard, type LeaderboardRow } from "@/lib/vs";

const RANK_ACCENT = [
  "border-amber-400/70 text-amber-200 bg-amber-500/10",
  "border-slate-300/60 text-slate-200 bg-slate-300/10",
  "border-orange-400/60 text-orange-200 bg-orange-500/10",
];

function winRate(r: LeaderboardRow) {
  const total = r.wins + r.losses;
  return total > 0 ? Math.round((r.wins / total) * 100) : 0;
}

export default function HomeHeroBoard() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchLeaderboard()
      .then(setRows)
      .catch(() => setErr(true));
  }, []);

  if (!supabaseConfigured) return null;

  const top = (rows ?? []).slice(0, 5);

  return (
    <section className="anim-logo mt-5 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/40 to-emerald-950/30 px-6 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-base font-semibold text-amber-100/90">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className="h-[1.15em] w-[1.15em] shrink-0 text-amber-300/90" aria-hidden>
            <path d="M2 20h20" strokeLinecap="round" />
            <path d="M4 20 L10 7 L13 12 L16.5 5 L21 20 Z" />
            <path d="M16.5 5 V1.5 M16.5 2 L19 3 L16.5 4" strokeLinecap="round" />
          </svg>
          <span>峽谷英雄榜</span>
        </div>
        <Link href="/vs/leaderboard" className="shrink-0 text-xs text-amber-300/80 hover:text-amber-200 underline">
          看完整天梯 →
        </Link>
      </div>

      <div className="mt-4">
        {err ? (
          <p className="text-xs text-slate-500">英雄榜暫時載入不了，稍後再試。</p>
        ) : rows === null ? (
          <p className="text-xs text-slate-500">攀登紀錄載入中…</p>
        ) : top.length === 0 ? (
          <p className="text-xs text-slate-400">還沒有人上榜，去線上對戰贏一場，成為第一位峽谷英雄。</p>
        ) : (
          <ol className="space-y-1.5">
            {top.map((r, i) => (
              <li key={`${r.display_name}-${i}`} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                    RANK_ACCENT[i] ?? "border-slate-600 text-slate-400 bg-slate-800/40"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-slate-100">{r.display_name}</span>
                <span className="shrink-0 text-xs text-amber-200/90">{r.wins} 勝</span>
                <span className="shrink-0 text-xs text-slate-500 tabular-nums">{winRate(r)}%</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
