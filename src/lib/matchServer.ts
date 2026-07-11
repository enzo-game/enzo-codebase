// 線上對戰 P2 —— 伺服器端（Vercel Route Handler）權威層工具。
// 只在 server 執行：用 service role 讀寫 match_state（client 讀不到），跑 TS 引擎，回脱敏視角。
// 注意：本檔只可被 Route Handler（server）import；SUPABASE_SERVICE_ROLE_KEY 無 NEXT_PUBLIC_ 前綴，
// 不會被打包進 client bundle。
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  initMatch,
  applyMatchAction,
  enforceDeadline,
  viewFor,
  type MatchState,
  type MatchAction,
  type Seat,
  type SeatView,
} from "@/engine/match";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const matchServerConfigured = Boolean(URL && SERVICE_KEY);

/** service role client：bypass RLS，僅供伺服器端。 */
export function serviceClient(): SupabaseClient {
  if (!URL || !SERVICE_KEY) throw new Error("伺服器缺 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return createClient(URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

type MatchRow = {
  id: string;
  status: "waiting" | "active" | "finished";
  player_a: string;
  player_b: string | null;
  winner: string | null;
  version: number;
};

/** 從 Authorization: Bearer <jwt> 認出呼叫者 user id（匿名 session 也有 id）。 */
export async function callerId(svc: SupabaseClient, authHeader: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function seatOf(m: MatchRow, uid: string): Seat | null {
  if (m.player_a === uid) return "a";
  if (m.player_b === uid) return "b";
  return null;
}

const seatUid = (m: MatchRow, seat: Seat) => (seat === "a" ? m.player_a : m.player_b);
const otherSeat = (seat: Seat): Seat => (seat === "a" ? "b" : "a");

/** 讀 match（含 version），找不到回 null。 */
async function loadMatch(svc: SupabaseClient, matchId: string): Promise<MatchRow | null> {
  const { data } = await svc
    .from("matches")
    .select("id,status,player_a,player_b,winner,version")
    .eq("id", matchId)
    .maybeSingle();
  return (data as MatchRow) ?? null;
}

// ───────────────────────── P4：名稱注入 + 勝負紀錄 ─────────────────────────

/** 讀雙方顯示名稱 {a,b}（讀不到就 undefined），供對局內顯示對手名。 */
async function fetchNames(svc: SupabaseClient, m: MatchRow): Promise<Record<Seat, string | undefined>> {
  const ids = [m.player_a, m.player_b].filter(Boolean) as string[];
  const { data } = await svc.from("profiles").select("id,display_name").in("id", ids);
  const byId = new Map((data ?? []).map((r: { id: string; display_name: string }) => [r.id, r.display_name]));
  return { a: byId.get(m.player_a), b: m.player_b ? byId.get(m.player_b) : undefined };
}

/** 脱敏視角 + 雙方名稱。 */
function viewWithNames(state: MatchState, seat: Seat, names: Record<Seat, string | undefined>): SeatView {
  return { ...viewFor(state, seat), youName: names[seat], oppName: names[otherSeat(seat)] };
}

/** 對局結束記一次勝負（service role increment）。只在 finish 轉換那一次呼叫，故不需去重旗標。 */
async function recordResult(svc: SupabaseClient, winnerUid: string, loserUid: string | null): Promise<void> {
  const { data: w } = await svc.from("profiles").select("wins").eq("id", winnerUid).maybeSingle();
  if (w) await svc.from("profiles").update({ wins: ((w as { wins: number }).wins ?? 0) + 1 }).eq("id", winnerUid);
  if (loserUid) {
    const { data: l } = await svc.from("profiles").select("losses").eq("id", loserUid).maybeSingle();
    if (l) await svc.from("profiles").update({ losses: ((l as { losses: number }).losses ?? 0) + 1 }).eq("id", loserUid);
  }
}

/** 讀權威狀態；若對局已 active 但尚未初始化，冪等地發牌建立。 */
const iso = (ms: number | null) => (ms == null ? null : new Date(ms).toISOString());

async function ensureState(
  svc: SupabaseClient,
  m: MatchRow,
  now: number,
): Promise<{ state: MatchState; version: number } | null> {
  const { data } = await svc.from("match_state").select("state,version").eq("match_id", m.id).maybeSingle();
  if (data) return { state: data.state as MatchState, version: (data as { version: number }).version };
  if (m.status !== "active" || !m.player_b) return null; // 還沒兩人到齊，無狀態可建
  // 首次初始化：發牌（帶 now 設回合截止）。on conflict do nothing 保證雙方同時觸發也只留一份。
  const fresh = initMatch(now);
  await svc.from("match_state").insert({ match_id: m.id, state: fresh, version: 0 }).select().maybeSingle();
  const { data: after } = await svc.from("match_state").select("state,version").eq("match_id", m.id).maybeSingle();
  if (!after) return null;
  await svc
    .from("matches")
    .update({ turn_owner: seatUid(m, fresh.current), turn_deadline: iso(fresh.deadline), version: 0 })
    .eq("id", m.id);
  return { state: after.state as MatchState, version: (after as { version: number }).version };
}

/** 讀權威狀態，並在讀到的當下懶執行「回合逾時」：若已過截止就自動結束當前回合、寫回、bump version
 *  （Realtime poke 兩端）。回傳強制後的最新 {state, version}。 */
async function loadEnforced(
  svc: SupabaseClient,
  m: MatchRow,
  now: number,
): Promise<{ state: MatchState; version: number } | null> {
  const loaded = await ensureState(svc, m, now);
  if (!loaded) return null;
  const { state, timedOut } = enforceDeadline(loaded.state, now);
  if (!timedOut) return loaded;

  const nextVersion = loaded.version + 1;
  const { data: written } = await svc
    .from("match_state")
    .update({ state, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("match_id", m.id)
    .eq("version", loaded.version) // version-guard：別人搶先寫就以對方的為準
    .select("match_id")
    .maybeSingle();
  if (!written) {
    const { data: re } = await svc.from("match_state").select("state,version").eq("match_id", m.id).maybeSingle();
    return re ? { state: re.state as MatchState, version: (re as { version: number }).version } : loaded;
  }
  await svc
    .from("matches")
    .update({
      turn_owner: state.winner ? null : seatUid(m, state.current),
      turn_deadline: iso(state.deadline),
      status: state.winner ? "finished" : "active",
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("id", m.id);
  return { state, version: nextVersion };
}

export type ViewResult =
  | { ok: true; view: SeatView }
  | { ok: false; status: number; error: string };

/** GET 視角：回呼叫者座位的脱敏狀態。 */
export async function getView(authHeader: string | null, matchId: string): Promise<ViewResult> {
  const svc = serviceClient();
  const uid = await callerId(svc, authHeader);
  if (!uid) return { ok: false, status: 401, error: "未登入" };
  const m = await loadMatch(svc, matchId);
  if (!m) return { ok: false, status: 404, error: "對局不存在" };
  const seat = seatOf(m, uid);
  if (!seat) return { ok: false, status: 403, error: "你不在這局" };
  const loaded = await loadEnforced(svc, m, Date.now());
  if (!loaded) return { ok: false, status: 409, error: "對局尚未開始" };
  return { ok: true, view: viewWithNames(loaded.state, seat, await fetchNames(svc, m)) };
}

/** POST 動作：認證 → 讀權威 → 套用 → version-guard 寫回 → 回自己視角。 */
export async function postAction(
  authHeader: string | null,
  matchId: string,
  action: MatchAction,
): Promise<ViewResult> {
  const svc = serviceClient();
  const uid = await callerId(svc, authHeader);
  if (!uid) return { ok: false, status: 401, error: "未登入" };
  const m = await loadMatch(svc, matchId);
  if (!m) return { ok: false, status: 404, error: "對局不存在" };
  const seat = seatOf(m, uid);
  if (!seat) return { ok: false, status: 403, error: "你不在這局" };

  // 樂觀鎖：讀（含逾時強制）→ 套 → 寫（where version 相符）；衝突重試一次。
  for (let attempt = 0; attempt < 2; attempt++) {
    const now = Date.now();
    const loaded = await loadEnforced(svc, m, now);
    if (!loaded) return { ok: false, status: 409, error: "對局尚未開始" };

    const result = applyMatchAction(loaded.state, seat, action, now);
    if (!result.ok) return { ok: false, status: 400, error: result.error };

    const next = result.state;
    const nextVersion = loaded.version + 1;
    const { data: written } = await svc
      .from("match_state")
      .update({ state: next, version: nextVersion, updated_at: new Date().toISOString() })
      .eq("match_id", m.id)
      .eq("version", loaded.version) // version-guard
      .select("match_id")
      .maybeSingle();

    if (!written) continue; // 版本被搶先 → 重讀重試

    // 更新 matches 的公開欄位並 bump version（Realtime poke 兩端）
    const winnerUid = next.winner ? seatUid(m, next.winner) : null;
    await svc
      .from("matches")
      .update({
        turn_owner: next.winner ? null : seatUid(m, next.current),
        turn_deadline: iso(next.deadline),
        winner: winnerUid,
        status: next.winner ? "finished" : "active",
        version: nextVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", m.id);

    // 剛分出勝負（本次是 finish 轉換）→ 記一次勝負。m.winner 之前為 null 保證只記一次。
    if (next.winner && !m.winner && winnerUid) {
      await recordResult(svc, winnerUid, seatUid(m, otherSeat(next.winner)));
    }

    return { ok: true, view: viewWithNames(next, seat, await fetchNames(svc, m)) };
  }
  return { ok: false, status: 409, error: "狀態版本衝突，請重試" };
}
