// 線上對戰（好友房）連線層。ORDER-060 P1。
// 匿名登入 + 建房/加入房（走 SECURITY DEFINER RPC）+ Realtime 訂閱對局列。
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { MatchAction, SeatView } from "@/engine/match";
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
  difficulty?: string | null; // 房主建房時選的共用難度（normal=單字題、hard=句子題）
};

function client() {
  if (!supabase) throw new Error("Supabase 尚未設定（缺 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）");
  return supabase;
}

// 大廳一次 mount 就有好幾處各自呼叫 ensureAnonSession（進行中對局檢查、個人檔案、邀請連結
// 自動加入…）。全新訪客（沒有既有 session）第一次進站時，這些呼叫幾乎同時發生：若各自獨立
// 判斷「還沒有 session」就各自呼叫 signInAnonymously()，會建出好幾個不同的匿名帳號——最後
// client 實際生效的那個，不見得是 join_match 當下記錄成 player_b 的那個，就會出現「你不在
// 這局」。用同一個進行中的 promise 讓所有同時發生的呼叫都等同一次登入結果，不各自搶帳號。
let anonSessionInFlight: Promise<string> | null = null;

/** 確保有一個（匿名）session；回傳自己的 user id。需在 Supabase 開啟 Anonymous Sign-ins。 */
export async function ensureAnonSession(): Promise<string> {
  const sb = client();
  const { data } = await sb.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  if (!anonSessionInFlight) {
    anonSessionInFlight = (async () => {
      const { data: signed, error } = await sb.auth.signInAnonymously();
      if (error) throw error;
      return signed.user!.id;
    })().finally(() => {
      anonSessionInFlight = null; // 結束（成功或失敗）就清掉，下次真的需要能重新登入
    });
  }
  return anonSessionInFlight;
}

/** 建立房間，回傳含 6 碼房號的 match。difficulty＝房主選的共用難度（normal=單字題、hard=句子題）；
 *  deck＝房主的自組牌組（card id 陣列，30 張），沒帶就用整個卡池。 */
export async function createRoom(
  difficulty: "normal" | "hard" = "normal",
  deck?: string[] | null,
): Promise<Match> {
  const sb = client();
  const { data, error } = await sb.rpc("create_match", { p_difficulty: difficulty, p_deck: deck ?? null });
  if (error) throw error;
  return data as Match;
}

/** 以房號加入房間；房號不存在/已滿/是自己的房會丟錯。deck＝加入者的自組牌組（沒帶就用整個卡池）。 */
export async function joinRoom(code: string, deck?: string[] | null): Promise<Match> {
  const sb = client();
  const { data, error } = await sb.rpc("join_match", { p_code: code.trim().toUpperCase(), p_deck: deck ?? null });
  if (error) throw error;
  return data as Match;
}

/** 訂閱單一對局的變動（對手加入、狀態轉 active、之後 P2 的 state 更新都會推來）。
 *  onStatus 回報 Realtime 連線狀態（SUBSCRIBED / CHANNEL_ERROR / TIMED_OUT / CLOSED），供斷線指示。 */
export function subscribeMatch(
  matchId: string,
  onChange: (m: Match) => void,
  onStatus?: (status: string) => void,
): RealtimeChannel {
  const sb = client();
  const channel = sb
    .channel(`match:${matchId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "matches", filter: `id=eq.${matchId}` },
      (payload) => onChange(payload.new as Match),
    )
    .subscribe((status) => onStatus?.(status));
  return channel;
}

// ───────────────────────── 對局內即時聊天（好友房，broadcast）─────────────────────────
// 好友房是「邀請特定朋友對戰」，所以是朋友對朋友聊天（非陌生人），風險低。
// 用 Supabase Realtime broadcast：訊息只在兩個 client 之間即時廣播、不進資料庫（一次性、
// 不留存、無需 migration/RLS）。self:false → 送出者不會收到自己的回音，所以「收到的訊息一律
// 來自對手」，本端送出時自己在畫面上樂觀顯示即可。
export type ChatMsg = { text: string; ts: number };

/** 訂閱對局聊天頻道；收到對手訊息時呼叫 onMessage。回傳 channel 供送訊息與清理。 */
export function subscribeChat(matchId: string, onMessage: (m: ChatMsg) => void): RealtimeChannel {
  const sb = client();
  const channel = sb
    .channel(`chat:${matchId}`, { config: { broadcast: { self: false } } })
    .on("broadcast", { event: "msg" }, ({ payload }) => onMessage(payload as ChatMsg))
    .subscribe();
  return channel;
}

/** 送一則聊天訊息（廣播給對手）。text 已在呼叫端裁切長度。 */
export function sendChat(channel: RealtimeChannel, text: string): void {
  channel.send({ type: "broadcast", event: "msg", payload: { text, ts: Date.now() } as ChatMsg });
}

/** 找出我目前「進行中」的對局（斷線重連 / 回大廳後復歸用）。RLS 只會回我參與的列。 */
export async function findMyActiveMatch(): Promise<Match | null> {
  const uid = await ensureAnonSession();
  const sb = client();
  const { data } = await sb
    .from("matches")
    .select("*")
    .eq("status", "active")
    .or(`player_a.eq.${uid},player_b.eq.${uid}`)
    .order("updated_at", { ascending: false })
    .limit(1);
  return (data?.[0] as Match) ?? null;
}

/** 讀取單一對局現況（訂閱前先抓一次，避免錯過剛發生的變動）。 */
export async function fetchMatch(matchId: string): Promise<Match | null> {
  const sb = client();
  const { data, error } = await sb.from("matches").select("*").eq("id", matchId).maybeSingle();
  if (error) throw error;
  return (data as Match) ?? null;
}

// ───────────────────────── P2：權威對戰視角 / 意圖 ─────────────────────────
// 完整權威狀態存在 client 讀不到的 match_state；一切經 Vercel Route Handler 收送。
async function accessToken(): Promise<string> {
  const sb = client();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("尚未登入");
  return token;
}

/** 拉自己座位的脱敏視角（收到 Realtime poke 後呼叫）。 */
export async function fetchView(matchId: string): Promise<SeatView> {
  const token = await accessToken();
  const res = await fetch(`/api/match/view?id=${encodeURIComponent(matchId)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "讀取失敗");
  return json.view as SeatView;
}

/** 送出對戰意圖；伺服器權威結算後回傳自己視角（立即更新，不必等 poke）。 */
export async function sendAction(matchId: string, action: MatchAction): Promise<SeatView> {
  const token = await accessToken();
  const res = await fetch("/api/match/action", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ matchId, action }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "動作失敗");
  return json.view as SeatView;
}

// ───────────────────────── P4：個人檔案 / 天梯 ─────────────────────────

export type Profile = { display_name: string; wins: number; losses: number; account_id: string | null };

/** 讀我自己的檔案（RLS 只讓讀自己）。account_id 有值代表已申請/登入序號。 */
export async function myProfile(): Promise<Profile | null> {
  const uid = await ensureAnonSession();
  const sb = client();
  const { data } = await sb.from("profiles").select("display_name,wins,losses,account_id").eq("id", uid).maybeSingle();
  return (data as Profile) ?? null;
}

/** 設定我的顯示名稱（RLS self-update）。純本機這次匿名身分用，跟序號帳號的名稱是分開的——
 *  申請/登入序號會覆蓋這裡（見 registerAccount/loginAccount）。 */
export async function setDisplayName(name: string): Promise<void> {
  const uid = await ensureAnonSession();
  const sb = client();
  const trimmed = name.trim().slice(0, 20) || "織者";
  const { error } = await sb.from("profiles").update({ display_name: trimmed }).eq("id", uid);
  if (error) throw error;
}

// ───────────────────────── 序號帳號：跨裝置保留戰績 ─────────────────────────

/** 申請新序號（顯示名稱唯一 + 4–6 位 PIN），成功後這台裝置這次的身分即掛上此序號。 */
export async function registerAccount(displayName: string, pin: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch("/api/account/register", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ displayName, pin }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "申請失敗");
  return json.displayName as string;
}

/** 用既有名稱+PIN 登入，把這台裝置這次的身分接回同一個序號（戰績聚合、顯示名稱同步）。 */
export async function loginAccount(displayName: string, pin: string): Promise<string> {
  const token = await accessToken();
  const res = await fetch("/api/account/login", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ displayName, pin }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "登入失敗");
  return json.displayName as string;
}

export type LeaderboardRow = { display_name: string; wins: number; losses: number };

/** 天梯前 20（走 service-role 端點，跨玩家讀取；只含已申請序號的玩家，戰績按序號聚合）。 */
export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? "讀取失敗");
  return json.leaderboard as LeaderboardRow[];
}
