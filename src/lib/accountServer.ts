// 序號帳號（ORDER-060）—— 玩家自取顯示名稱 + PIN，之後在別的裝置/新的匿名 session 用同樣
// 名稱+PIN 登入，把當前匿名身分（profiles 列）掛回同一個 player_accounts，戰績按序號聚合。
// 只在 server 執行（本檔只可被 Route Handler import；沒裝 server-only 套件，跟 matchServer.ts
// 同一個做法——單純用註解提醒，靠 SUPABASE_SERVICE_ROLE_KEY 無 NEXT_PUBLIC_ 前綴避免流到 client）。
// PIN hash 用 Node 內建 crypto.scrypt，不依賴額外套件；不留明碼。
import { scrypt as scryptCb, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient, callerId, matchServerConfigured } from "@/lib/matchServer";

const scrypt = promisify(scryptCb);

const NAME_MAX = 20;
const PIN_RE = /^\d{4,6}$/; // 4–6 位數字，低摩擦、好記好打

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scrypt(pin, salt, 32)) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");
  const derived = (await scrypt(pin, salt, 32)) as Buffer;
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export type AccountResult =
  | { ok: true; displayName: string }
  | { ok: false; status: number; error: string };

function validateInput(displayName: string, pin: string): string | null {
  const name = displayName.trim();
  if (!name) return "請輸入顯示名稱";
  if (name.length > NAME_MAX) return `名稱最多 ${NAME_MAX} 字`;
  if (!PIN_RE.test(pin)) return "PIN 碼要 4–6 位數字";
  return null;
}

/** 用當前身分（呼叫者的匿名 uid）申請一個新序號：名稱必須沒被別人用過。
 *  成功後把呼叫者現在的 profiles 列掛上這個序號，並把 display_name 同步成序號名稱。 */
export async function registerAccount(authHeader: string | null, displayName: string, pin: string): Promise<AccountResult> {
  if (!matchServerConfigured) return { ok: false, status: 503, error: "後端尚未設定" };
  const svc = serviceClient();
  const uid = await callerId(svc, authHeader);
  if (!uid) return { ok: false, status: 401, error: "未登入" };

  const bad = validateInput(displayName, pin);
  if (bad) return { ok: false, status: 400, error: bad };
  const name = displayName.trim().slice(0, NAME_MAX);

  const { data: taken } = await svc.from("player_accounts").select("id").eq("display_name", name).maybeSingle();
  if (taken) return { ok: false, status: 409, error: "這個名稱已經有人用了，換一個試試" };

  const pinHash = await hashPin(pin);
  const { data: account, error: insErr } = await svc
    .from("player_accounts")
    .insert({ display_name: name, pin_hash: pinHash })
    .select("id")
    .single();
  if (insErr || !account) return { ok: false, status: 500, error: "建立序號失敗，請再試一次" };

  await attachProfile(svc, uid, (account as { id: string }).id, name);
  return { ok: true, displayName: name };
}

/** 用名稱+PIN 登入：驗證通過就把呼叫者現在的（可能是全新的）匿名身分掛回這個序號，
 *  之後這個匿名 session 記的戰績會併進同一份聚合資料，在別的裝置也能接回名字/戰績。 */
export async function loginAccount(authHeader: string | null, displayName: string, pin: string): Promise<AccountResult> {
  if (!matchServerConfigured) return { ok: false, status: 503, error: "後端尚未設定" };
  const svc = serviceClient();
  const uid = await callerId(svc, authHeader);
  if (!uid) return { ok: false, status: 401, error: "未登入" };

  const bad = validateInput(displayName, pin);
  if (bad) return { ok: false, status: 400, error: bad };
  const name = displayName.trim().slice(0, NAME_MAX);

  const { data: account } = await svc
    .from("player_accounts")
    .select("id,pin_hash")
    .eq("display_name", name)
    .maybeSingle();
  if (!account) return { ok: false, status: 404, error: "找不到這個名稱，確認是不是打錯了" };

  const okPin = await verifyPin(pin, (account as { pin_hash: string }).pin_hash);
  if (!okPin) return { ok: false, status: 401, error: "PIN 碼不對" };

  await attachProfile(svc, uid, (account as { id: string }).id, name);
  return { ok: true, displayName: name };
}

/** 把 uid 的 profiles 列掛上 account_id，並同步 display_name 成序號名稱（讓既有的名稱欄位、
 *  對局內顯示、天梯都自然拿到同一個名字，不必另外維護第二套名稱欄位）。 */
async function attachProfile(svc: SupabaseClient, uid: string, accountId: string, name: string): Promise<void> {
  await svc.from("profiles").update({ account_id: accountId, display_name: name }).eq("id", uid);
}
