"use client";

// ORDER-060 P4 —— 天梯：勝場前 20 名。資料走 /api/leaderboard（service role 跨玩家讀取）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseConfigured } from "@/lib/supabase";
import { fetchLeaderboard, type Profile } from "@/lib/vs";

export default function LeaderboardPage() {
  const [rows, setRows] = useState<Profile[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    fetchLeaderboard()
      .then(setRows)
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-wide text-center mb-1">🏆 天梯</h1>
        <p className="text-sm text-neutral-400 text-center mb-8">勝場排行 · 前 20 名</p>

        {!supabaseConfigured ? (
          <p className="text-center text-amber-300">後端尚未設定。</p>
        ) : err ? (
          <p className="text-center text-rose-400">{err}</p>
        ) : rows === null ? (
          <p className="text-center text-neutral-500 animate-pulse">載入中…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-neutral-500">還沒有人有戰績，快去對戰開榜！</p>
        ) : (
          <ol className="space-y-1">
            {rows.map((r, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg bg-neutral-900/60 border border-neutral-800 px-4 py-2.5"
              >
                <span
                  className={`w-6 text-center font-bold ${
                    i === 0 ? "text-amber-300" : i === 1 ? "text-neutral-300" : i === 2 ? "text-amber-600" : "text-neutral-500"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{r.display_name}</span>
                <span className="text-emerald-400 tabular-nums font-semibold">{r.wins} 勝</span>
                <span className="text-neutral-500 tabular-nums text-sm">{r.losses} 敗</span>
              </li>
            ))}
          </ol>
        )}

        <div className="mt-10 text-center">
          <Link href="/vs" className="text-sm text-neutral-500 hover:text-neutral-300 underline">
            ← 回大廳
          </Link>
        </div>
      </div>
    </main>
  );
}
