// 線上對戰全鏈路 e2e：兩個真實匿名帳號，透過真的 Route Handler + 真的 Supabase 打完整一局。
// 不需 dev server、不需瀏覽器。驗證：JWT 認座位、權威結算、DB 讀寫、脱敏、回合流、反作弊。
// 前置：.env.local 三把金鑰 + migration + 匿名登入（先跑 vs-smoke.mts 綠燈）。
// 執行：npx tsx scripts/vs-e2e.mts
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ── 先把 .env.local 灌進 process.env，再動態 import route（route 在載入時讀 env）──
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const { POST: actionPOST } = await import("../src/app/api/match/action/route.ts");
const { GET: viewGET } = await import("../src/app/api/match/view/route.ts");
const { GET: leaderboardGET } = await import("../src/app/api/leaderboard/route.ts");
const { spellTargetKind } = await import("../src/engine/game.ts");
import type { SeatView, ClientTarget, MatchAction } from "../src/engine/match.ts";

const pass = (s: string) => console.log(`  ✓ ${s}`);
function must(c: boolean, msg: string) {
  if (!c) throw new Error("斷言失敗：" + msg);
}

// ── 透過 Route Handler 收送 ──
async function act(token: string, matchId: string, action: MatchAction): Promise<{ status: number; view?: SeatView; error?: string }> {
  const res = await actionPOST(
    new Request("http://x/api/match/action", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ matchId, action }),
    }),
  );
  const json = (await res.json()) as { view?: SeatView; error?: string };
  return { status: res.status, ...json };
}
async function view(token: string, matchId: string): Promise<SeatView> {
  const res = await viewGET(new Request(`http://x/api/match/view?id=${matchId}`, { headers: { authorization: `Bearer ${token}` } }));
  const json = (await res.json()) as { view?: SeatView; error?: string };
  if (!res.ok || !json.view) throw new Error(`view 失敗 ${res.status}：${json.error}`);
  return json.view;
}

function assertNoLeak(v: SeatView) {
  must(!("hand" in (v.opp as object)), "opp 不得含 hand");
  must(typeof v.opp.handCount === "number", "opp 只給 handCount");
  if (v.quiz) must(!("answerIdx" in (v.quiz as object)), "題目不得含答案");
}

function spellTarget(v: SeatView, card: SeatView["you"]["hand"][number]): ClientTarget | undefined {
  const kind = spellTargetKind(card);
  if (kind === "none") return undefined;
  if (kind === "any") return { kind: "hero" };
  if (kind === "friendMinion") {
    const m = [...v.you.board].sort((a, b) => b.attack - a.attack)[0];
    return m ? { kind: "minion", who: "you", key: m.key } : undefined;
  }
  const m = v.opp.board.filter((x) => !x.stealth).sort((a, b) => b.attack - a.attack)[0];
  if (m) return { kind: "minion", who: "opp", key: m.key };
  if (kind === "anyMinion") {
    const own = [...v.you.board].sort((a, b) => b.attack - a.attack)[0];
    return own ? { kind: "minion", who: "you", key: own.key } : undefined;
  }
  return undefined;
}

// 只看「脱敏視角」下棋（bot 讀不到答案 → 猜第 0 個，正好驗反作弊）。
async function takeTurn(token: string, matchId: string, v0: SeatView): Promise<SeatView> {
  let v = v0;
  // 出牌
  for (let g = 0; g < 30; g++) {
    if (v.phase === "over") return v;
    const affordable = v.you.hand.filter((c) => c.cost <= v.you.mana).sort((a, b) => b.cost - a.cost);
    if (affordable.length === 0) break;
    let advanced = false;
    for (const card of affordable) {
      const target = card.type === "spell" ? spellTarget(v, card) : undefined;
      const r = await act(token, matchId, { type: "playCard", cardId: card.id, target });
      if (r.status !== 200 || !r.view) continue; // 目標不合法等 → 換張
      v = r.view;
      assertNoLeak(v);
      must(v.quiz != null, "出牌後應出現題目");
      const ar = await act(token, matchId, { type: "answer", optionIdx: 0 }); // 猜（讀不到答案）
      must(ar.status === 200 && !!ar.view, "作答應成功");
      v = ar.view!;
      assertNoLeak(v);
      advanced = true;
      break;
    }
    if (!advanced) break;
  }
  // 攻擊
  for (let g = 0; g < 30; g++) {
    if (v.phase === "over") return v;
    const attacker = v.you.board.find((m) => m.canAttack && m.attack > 0);
    if (!attacker) break;
    const taunts = v.opp.board.filter((m) => m.taunt && !m.stealth);
    const target: ClientTarget = taunts.length > 0 ? { kind: "minion", who: "opp", key: taunts[0].key } : { kind: "hero" };
    const r = await act(token, matchId, { type: "attack", attackerKey: attacker.key, target });
    if (r.status !== 200 || !r.view) break;
    v = r.view;
  }
  if (v.phase === "over") return v;
  const e = await act(token, matchId, { type: "endTurn" });
  must(e.status === 200 && !!e.view, "結束回合應成功");
  return e.view!;
}

async function main() {
  console.log("── 線上對戰全鏈路 e2e（真 Route Handler + 真 Supabase）──");
  const fresh = () => createClient(URL_, ANON, { auth: { persistSession: false } });

  // 建帳號 + 配對（走 RPC，與大廳同路徑）
  const A = fresh();
  const { data: a } = await A.auth.signInAnonymously();
  const tokenA = a.session!.access_token;
  const { data: created, error: cErr } = await A.rpc("create_match");
  if (cErr) throw new Error("create_match：" + cErr.message);
  const matchId = (created as { id: string }).id;
  const room = (created as { room_code: string }).room_code;

  const B = fresh();
  const { data: b } = await B.auth.signInAnonymously();
  const tokenB = b.session!.access_token;
  await B.rpc("join_match", { p_code: room });
  const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const uidA = a.user!.id;
  const uidB = b.user!.id;
  // P4：設顯示名稱，稍後驗對局內對手名與天梯
  await svc.from("profiles").update({ display_name: "甲" }).eq("id", uidA);
  await svc.from("profiles").update({ display_name: "乙" }).eq("id", uidB);
  pass(`配對完成（房號 ${room}）`);

  // 反作弊：非當前座位不能動、無 token 401
  const seed = await view(tokenA, matchId); // 觸發伺服器發牌
  must(seed.yourTurn, "A 應先手");
  must(seed.you.hand.length === 4 && seed.opp.handCount === 4, "起手手牌數不對");
  must(seed.youName === "甲" && seed.oppName === "乙", "view 應帶雙方顯示名稱");
  assertNoLeak(seed);
  pass("伺服器發牌完成，A 先手、雙方起手 4 張、脱敏正常、帶名稱");

  const wrongTurn = await act(tokenB, matchId, { type: "endTurn" });
  must(wrongTurn.status === 400, "非當前座位動作應 400");
  const noAuth = await actionPOST(
    new Request("http://x/api/match/action", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ matchId, action: { type: "endTurn" } }) }),
  );
  must(noAuth.status === 401, "無 token 應 401");
  pass("反作弊：越權動作 400、無 token 401");

  // P3 回合逾時（透過真 handler + 真 DB）：把權威狀態的截止改到過去，A 讀 view 應觸發伺服器自動結束回合
  {
    const { data: row } = await svc.from("match_state").select("state").eq("match_id", matchId).maybeSingle();
    const stt = (row as { state: Record<string, unknown> }).state;
    stt.deadline = 1; // 遠古＝必逾時
    await svc.from("match_state").update({ state: stt }).eq("match_id", matchId);
    const vA2 = await view(tokenA, matchId);
    must(!vA2.yourTurn, "逾時後 A 不應再是自己回合");
    must(vA2.turn === seed.turn + 1, "逾時應推進一回合");
    must(typeof vA2.deadlineMs === "number" && vA2.deadlineMs > Date.now(), "逾時後應有新的未來截止");
    const vB2 = await view(tokenB, matchId);
    must(vB2.yourTurn, "逾時後應輪到 B");
    pass("回合逾時：改截止到過去 → view 觸發伺服器 enforceDeadline 自動換手");
  }

  // 完整對局：讀 view 判斷輪到誰，該座位走完一回合，直到分勝負
  let last: SeatView = seed;
  for (let round = 0; round < 60 && last.phase !== "over"; round++) {
    const vA = await view(tokenA, matchId);
    if (vA.phase === "over") { last = vA; break; }
    if (vA.yourTurn) last = await takeTurn(tokenA, matchId, vA);
    else {
      const vB = await view(tokenB, matchId);
      if (vB.phase === "over") { last = vB; break; }
      must(vB.yourTurn, "應該輪到某一方");
      last = await takeTurn(tokenB, matchId, vB);
    }
  }

  must(last.phase === "over", `對局應在 60 輪內結束（實際回合 ${last.turn}）`);
  // 雙方各自視角一致：一勝一負
  const finalA = await view(tokenA, matchId);
  const finalB = await view(tokenB, matchId);
  must(finalA.outcome != null && finalB.outcome != null, "雙方都應有結果");
  must(finalA.outcome !== finalB.outcome, "一方勝、一方負");
  pass(`完整對局跑完：第 ${last.turn} 回合分勝負，A=${finalA.outcome} / B=${finalB.outcome}`);

  // 結束後仍不能動
  const afterOver = await act(tokenA, matchId, { type: "endTurn" });
  must(afterOver.status === 400, "結束後動作應被拒");
  pass("對局結束後動作正確被拒");

  // P4：勝負紀錄
  const winnerUid = finalA.outcome === "win" ? uidA : uidB;
  const loserUid = finalA.outcome === "win" ? uidB : uidA;
  const winnerName = finalA.outcome === "win" ? "甲" : "乙";
  const { data: wp } = await svc.from("profiles").select("wins,losses").eq("id", winnerUid).maybeSingle();
  const { data: lp } = await svc.from("profiles").select("wins,losses").eq("id", loserUid).maybeSingle();
  must(((wp as { wins: number })?.wins ?? 0) >= 1, "勝方 wins 應 +1");
  must(((lp as { losses: number })?.losses ?? 0) >= 1, "敗方 losses 應 +1");
  pass(`勝負紀錄：勝方 ${(wp as { wins: number }).wins} 勝、敗方 ${(lp as { losses: number }).losses} 敗`);

  // P4：對局內雙方名稱
  must(finalA.oppName === "乙" && finalB.oppName === "甲", "對局內應顯示對手名稱");
  pass("對局內顯示雙方名稱");

  // P4：天梯端點含勝方
  const lbRes = await leaderboardGET();
  const lbJson = (await lbRes.json()) as { leaderboard: { display_name: string; wins: number }[] };
  must(
    Array.isArray(lbJson.leaderboard) &&
      lbJson.leaderboard.some((r) => r.display_name === winnerName && r.wins >= 1),
    "天梯應含勝方戰績",
  );
  pass("天梯 /api/leaderboard 含勝方戰績");

  // 收尾：刪對局 + 清掉測試用 profiles（避免污染正式天梯）
  await svc.from("matches").delete().eq("id", matchId);
  await svc.from("profiles").delete().in("id", [uidA, uidB]);
  console.log("\n全鏈路 e2e 全數通過 ✓ —— 線上對戰後端＋權威層＋留存真的能打完一局。");
}

main().catch((e) => {
  console.error("\n✗ e2e 失敗：", e instanceof Error ? e.message : e);
  process.exit(1);
});
