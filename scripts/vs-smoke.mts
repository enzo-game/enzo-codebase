// 線上對戰後端 smoke test：驗證 Supabase 三把金鑰、匿名登入、migration 表/RPC、RLS 去敏。
// 前置：.env.local 填好三把金鑰、跑過 0001+0002、開啟 Anonymous Sign-ins。
// 執行：npx tsx scripts/vs-smoke.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── 讀 .env.local（tsx 不會自動載入）──
const env: Record<string, string> = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

function need(name: string, v?: string) {
  if (!v) throw new Error(`.env.local 缺 ${name}`);
}
need("NEXT_PUBLIC_SUPABASE_URL", URL_);
need("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON);
need("SUPABASE_SERVICE_ROLE_KEY", SERVICE);

const pass = (s: string) => console.log(`  ✓ ${s}`);
const fresh = () => createClient(URL_, ANON, { auth: { persistSession: false } });

async function main() {
  console.log("── 對戰後端 smoke test ──");

  // 1. 匿名登入（座位 A）
  const A = fresh();
  const { data: aAuth, error: aErr } = await A.auth.signInAnonymously();
  if (aErr) throw new Error(`匿名登入失敗（是否已開 Anonymous Sign-ins？）：${aErr.message}`);
  const uidA = aAuth.user!.id;
  pass(`匿名登入 A：${uidA.slice(0, 8)}…`);

  // 2. 建房
  const { data: created, error: cErr } = await A.rpc("create_match");
  if (cErr) throw new Error(`create_match 失敗（migration 0001 是否跑過？）：${cErr.message}`);
  const room = (created as { id: string; room_code: string }).room_code;
  const matchId = (created as { id: string }).id;
  pass(`建房成功，房號 ${room}`);

  // 3. 座位 B 匿名登入 + 加入房
  const B = fresh();
  const { data: bAuth, error: bErr } = await B.auth.signInAnonymously();
  if (bErr) throw new Error(`座位 B 匿名登入失敗：${bErr.message}`);
  const uidB = bAuth.user!.id;
  const { data: joined, error: jErr } = await B.rpc("join_match", { p_code: room });
  if (jErr) throw new Error(`join_match 失敗：${jErr.message}`);
  const jm = joined as { status: string; player_a: string; player_b: string };
  if (jm.status !== "active" || jm.player_b !== uidB) throw new Error("加入後狀態不正確");
  pass(`座位 B 加入，狀態轉 active（B=${uidB.slice(0, 8)}…）`);

  // 4. RLS：非參與者讀不到別人的房
  const C = fresh();
  await C.auth.signInAnonymously();
  const { data: peek } = await C.from("matches").select("*").eq("id", matchId);
  if (peek && peek.length > 0) throw new Error("RLS 破洞：路人讀得到別人的對局！");
  pass("RLS：路人讀不到他人對局");

  // 5. RLS：任何 client 都讀不到 match_state（權威態）
  const { data: secretPeek } = await A.from("match_state").select("*").eq("match_id", matchId);
  if (secretPeek && secretPeek.length > 0) throw new Error("RLS 破洞：client 讀得到 match_state！");
  pass("RLS：client 讀不到 match_state（權威態保密）");

  // 6. service role：確認三張表 + profiles trigger 有建
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  for (const t of ["matches", "match_state", "profiles", "match_events"]) {
    const { error } = await svc.from(t).select("*", { count: "exact", head: true });
    if (error) throw new Error(`service role 讀 ${t} 失敗（0002 是否跑過？）：${error.message}`);
  }
  pass("service role：matches / match_state / profiles / match_events 皆存在");
  const { count: profCount } = await svc
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .in("id", [uidA, uidB]);
  if ((profCount ?? 0) < 2) throw new Error("profiles 自動建立 trigger 未生效");
  pass(`profiles trigger：A/B 皆自動建檔（${profCount} 筆）`);

  // 收尾：刪掉測試對局
  await svc.from("matches").delete().eq("id", matchId);

  console.log("\n後端連線全數通過 ✓ —— 可以開兩個瀏覽器對打了。");
}

main().catch((e) => {
  console.error("\n✗ smoke test 失敗：", e instanceof Error ? e.message : e);
  process.exit(1);
});
