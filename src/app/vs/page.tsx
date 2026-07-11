"use client";

// ORDER-060 P1 —— 好友房大廳：建房 / 輸房號加入 / Realtime 等待對手接上。
// P2 會在「已連上」之後接續：伺服器權威對戰狀態同步（Edge Function + matches.state）。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseConfigured } from "@/lib/supabase";
import { createRoom, joinRoom, ensureAnonSession, subscribeMatch, type Match } from "@/lib/vs";

type View = "idle" | "creating" | "waiting" | "joining" | "connected" | "error";

export default function VsPage() {
  const router = useRouter();
  const [view, setView] = useState<View>("idle");
  const [match, setMatch] = useState<Match | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 卸載時清掉 Realtime 訂閱
  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, []);

  function enterBattle(m: Match) {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    router.push(`/vs/${m.id}`);
  }

  function watch(m: Match) {
    channelRef.current?.unsubscribe();
    channelRef.current = subscribeMatch(m.id, (next) => {
      setMatch(next);
      if (next.status === "active") {
        setView("connected");
        enterBattle(next); // 對手接上 → 直接進盤面
      }
    });
  }

  async function handleCreate() {
    setErr("");
    setView("creating");
    try {
      await ensureAnonSession();
      const m = await createRoom();
      setMatch(m);
      setView("waiting");
      watch(m); // 等對手加入 → Realtime 推 active
    } catch (e) {
      setErr(msg(e));
      setView("error");
    }
  }

  async function handleJoin() {
    setErr("");
    if (code.trim().length < 4) {
      setErr("請輸入房號");
      return;
    }
    setView("joining");
    try {
      await ensureAnonSession();
      const m = await joinRoom(code);
      setMatch(m);
      setView("connected"); // join 成功即為 active
      enterBattle(m); // 直接進盤面（我方為後手 B）
    } catch (e) {
      setErr(joinErr(e));
      setView("error");
    }
  }

  function reset() {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setMatch(null);
    setCode("");
    setErr("");
    setView("idle");
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold tracking-wide text-center mb-1">線上對戰</h1>
        <p className="text-sm text-neutral-400 text-center mb-8">好友房 · 建房或輸入房號連上彼此</p>

        {!supabaseConfigured ? (
          <NotConfigured />
        ) : view === "idle" ? (
          <div className="space-y-3">
            <button
              onClick={handleCreate}
              className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-500 py-3 font-semibold transition"
            >
              建立房間
            </button>
            <div className="flex items-center gap-2 pt-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="輸入房號"
                maxLength={6}
                className="flex-1 rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-3 tracking-[0.3em] text-center uppercase focus:outline-none focus:border-emerald-500"
              />
              <button
                onClick={handleJoin}
                className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-5 py-3 font-semibold transition"
              >
                加入
              </button>
            </div>
          </div>
        ) : view === "creating" || view === "joining" ? (
          <p className="text-center text-neutral-400">{view === "creating" ? "建立房間中…" : "加入中…"}</p>
        ) : view === "waiting" ? (
          <div className="text-center space-y-5">
            <p className="text-sm text-neutral-400">把房號給對方，等他加入</p>
            <div className="text-4xl font-mono tracking-[0.4em] bg-neutral-900 border border-neutral-700 rounded-xl py-6">
              {match?.room_code}
            </div>
            <p className="text-sm text-neutral-500 animate-pulse">等待對手接上…</p>
            <button onClick={reset} className="text-sm text-neutral-500 hover:text-neutral-300 underline">
              取消
            </button>
          </div>
        ) : view === "connected" ? (
          <div className="text-center space-y-4">
            <div className="text-emerald-400 text-lg font-semibold">兩位玩家已連上</div>
            <p className="text-sm text-neutral-400">
              房號 <span className="font-mono tracking-widest">{match?.room_code}</span>
            </p>
            <p className="text-xs text-neutral-500 leading-relaxed">
              P1（配對連線）完成。實際對戰同步為 P2：伺服器權威狀態
              <br />
              （Edge Function 寫入 matches.state → Realtime 推兩端）。
            </p>
            <button onClick={reset} className="text-sm text-neutral-500 hover:text-neutral-300 underline">
              離開
            </button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-rose-400">{err}</p>
            <button onClick={reset} className="rounded-lg bg-neutral-800 hover:bg-neutral-700 px-5 py-2.5 transition">
              返回
            </button>
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/play" className="text-sm text-neutral-500 hover:text-neutral-300 underline">
            ← 單機對 AI
          </Link>
        </div>
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-5 text-sm text-amber-200/90 leading-relaxed">
      <p className="font-semibold mb-2">後端尚未設定</p>
      <p className="text-amber-200/70">
        線上對戰需要 Supabase。請在 <code className="text-amber-100">.env.local</code> 填入{" "}
        <code className="text-amber-100">NEXT_PUBLIC_SUPABASE_URL</code> 與{" "}
        <code className="text-amber-100">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>，並在 Supabase 開啟 Anonymous
        Sign-ins、套用 <code className="text-amber-100">supabase/migrations</code>。
      </p>
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function joinErr(e: unknown): string {
  const m = msg(e);
  if (m.includes("not joinable")) return "房號不存在、已滿，或那是你自己的房";
  return m;
}
