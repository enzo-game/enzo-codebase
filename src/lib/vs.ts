// 線上對戰（好友房）連線層。ORDER-060 P1。
// 匿名登入 + 建房/加入房（走 SECURITY DEFINER RPC）+ Realtime 訂閱對局列。
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type MatchStatus = "waiting" | "active" | "finished";

export type Match = {
  id: string;
  status: MatchStatus;
  room_code: string;
  player_a: string;
  player_b: string | null;
  state: unknown | null;
  turn_owner: string | null;
  turn_deadline: string | null;
  winner: string | null;
  created_at: string;
  updated_at: string;
};

function client() {
  if (!supabase) throw new Error("Supabase 尚未設定（缺 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）");
  return supabase;
}

/** 確保有一個（匿名）session；回傳自己的 user id。需在 Supabase 開啟 Anonymous Sign-ins。 */
export async function ensureAnonSession(): Promise<string> {
  const sb = client();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return signed.user!.id;
}

/** 建立房間，回傳含 6 碼房號的 match。 */
export async function createRoom(): Promise<Match> {
  const sb = client();
  const { data, error } = await sb.rpc("create_match");
  if (error) throw error;
  return data as Match;
}

/** 以房號加入房間；房號不存在/已滿/是自己的房會丟錯。 */
export async function joinRoom(code: string): Promise<Match> {
  const sb = client();
  const { data, error } = await sb.rpc("join_match", { p_code: code.trim().toUpperCase() });
  if (error) throw error;
  return data as Match;
}

/** 訂閱單一對局的變動（對手加入、狀態轉 active、之後 P2 的 state 更新都會推來）。 */
export function subscribeMatch(matchId: string, onChange: (m: Match) => void): RealtimeChannel {
  const sb = client();
  const channel = sb
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      (payload) => onChange(payload.new as Match),
    )
    .subscribe();
  return channel;
}

/** 讀取單一對局現況（訂閱前先抓一次，避免錯過剛發生的變動）。 */
export async function fetchMatch(matchId: string): Promise<Match | null> {
  const sb = client();
  const { data, error } = await sb.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (error) throw error;
  return (data as Match) ?? null;
}
