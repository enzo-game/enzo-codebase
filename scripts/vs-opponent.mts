// 陪打對手 bot：以匿名帳號加入指定房號，之後自動走完自己每個回合（透過真 Route Handler）。
// 用途：司令/瀏覽器當 A，這支當 B，讓 UI 能實際跑起來看。
// 執行：npx tsx scripts/vs-opponent.mts <房號>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const { POST: actionPOST } = await import("../src/app/api/match/action/route.ts");
const { GET: viewGET } = await import("../src/app/api/match/view/route.ts");
const { spellTargetKind } = await import("../src/engine/game.ts");
import type { SeatView, ClientTarget, MatchAction } from "../src/engine/match.ts";

const code = process.argv[2];
if (!code) throw new Error("用法：npx tsx scripts/vs-opponent.mts <房號>");

async function act(token: string, matchId: string, action: MatchAction) {
  const res = await actionPOST(new Request("http://x/api/match/action", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ matchId, action }),
  }));
  return { status: res.status, ...((await res.json()) as { view?: SeatView; error?: string }) };
}
async function view(token: string, matchId: string): Promise<SeatView> {
  const res = await viewGET(new Request(`http://x/api/match/view?id=${matchId}`, { headers: { authorization: `Bearer ${token}` } }));
  const j = (await res.json()) as { view?: SeatView; error?: string };
  if (!res.ok || !j.view) throw new Error(`view ${res.status}: ${j.error}`);
  return j.view;
}
function spellTarget(v: SeatView, card: SeatView["you"]["hand"][number]): ClientTarget | undefined {
  const k = spellTargetKind(card);
  if (k === "none") return undefined;
  if (k === "any") return { kind: "hero" };
  if (k === "friendMinion") { const m = [...v.you.board].sort((a, b) => b.attack - a.attack)[0]; return m ? { kind: "minion", who: "you", key: m.key } : undefined; }
  const m = v.opp.board.filter((x) => !x.stealth).sort((a, b) => b.attack - a.attack)[0];
  if (m) return { kind: "minion", who: "opp", key: m.key };
  if (k === "anyMinion") { const o = [...v.you.board].sort((a, b) => b.attack - a.attack)[0]; return o ? { kind: "minion", who: "you", key: o.key } : undefined; }
  return undefined;
}
async function takeTurn(token: string, matchId: string, v0: SeatView) {
  let v = v0;
  for (let g = 0; g < 30; g++) {
    if (v.phase === "over") return v;
    const aff = v.you.hand.filter((c) => c.cost <= v.you.mana).sort((a, b) => b.cost - a.cost);
    if (!aff.length) break;
    let adv = false;
    for (const card of aff) {
      const target = card.type === "spell" ? spellTarget(v, card) : undefined;
      const r = await act(token, matchId, { type: "playCard", cardId: card.id, target });
      if (r.status !== 200 || !r.view) continue;
      const ar = await act(token, matchId, { type: "answer", optionIdx: Math.floor(Math.random() * 4) });
      if (ar.status === 200 && ar.view) { v = ar.view; adv = true; }
      break;
    }
    if (!adv) break;
  }
  for (let g = 0; g < 30; g++) {
    if (v.phase === "over") return v;
    const at = v.you.board.find((m) => m.canAttack && m.attack > 0);
    if (!at) break;
    const t = v.opp.board.filter((m) => m.taunt && !m.stealth);
    const target: ClientTarget = t.length ? { kind: "minion", who: "opp", key: t[0].key } : { kind: "hero" };
    const r = await act(token, matchId, { type: "attack", attackerKey: at.key, target });
    if (r.status !== 200 || !r.view) break;
    v = r.view;
  }
  if (v.phase !== "over") await act(token, matchId, { type: "endTurn" });
  return v;
}

const sb = createClient(URL_, ANON, { auth: { persistSession: false } });
await sb.auth.signInAnonymously();
const token = sb.auth.getSession ? (await sb.auth.getSession()).data.session!.access_token : "";
const { data: joined, error } = await sb.rpc("join_match", { p_code: code });
if (error) throw new Error("join_match: " + error.message);
const matchId = (joined as { id: string }).id;
console.log(`B 已加入房 ${code}（match ${matchId.slice(0, 8)}…）。等 A 出手，輪到 B 就自動打…`);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 400; i++) {
  let v: SeatView;
  try { v = await view(token, matchId); } catch { await sleep(1500); continue; }
  if (v.phase === "over") { console.log(`對局結束，B ${v.outcome === "win" ? "勝" : "負"}。`); break; }
  if (v.phase === "mulligan") {
    if (v.mulliganPending) {
      console.log("換牌階段：B 保留全部起手牌");
      await act(token, matchId, { type: "mulligan", replaceIdx: [] });
    }
    await sleep(1000);
    continue;
  }
  if (v.yourTurn) { console.log(`第 ${v.turn} 回合：B 出手`); await takeTurn(token, matchId, v); }
  await sleep(1500);
}
