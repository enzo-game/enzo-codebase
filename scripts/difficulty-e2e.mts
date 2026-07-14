// 全鏈路：建 hard 房（真 create_match RPC）→ bot 加入 → 出牌 → 確認題型變句子題、view.difficulty=hard。
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const { POST: actionPOST } = await import("../src/app/api/match/action/route.ts");
const { GET: viewGET } = await import("../src/app/api/match/view/route.ts");
import type { SeatView, MatchAction } from "../src/engine/match.ts";

const pass = (s: string) => console.log(`  ✓ ${s}`);
function must(c: boolean, m: string) { if (!c) throw new Error("斷言失敗：" + m); }
const fresh = () => createClient(URL_, ANON, { auth: { persistSession: false } });
async function act(token: string, matchId: string, action: MatchAction) {
  const res = await actionPOST(new Request("http://x", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ matchId, action }) }));
  return { status: res.status, ...((await res.json()) as { view?: SeatView; error?: string }) };
}
async function view(token: string, matchId: string): Promise<SeatView> {
  const res = await viewGET(new Request(`http://x?id=${matchId}`, { headers: { authorization: `Bearer ${token}` } }));
  const j = (await res.json()) as { view?: SeatView; error?: string };
  if (!res.ok || !j.view) throw new Error(`view ${res.status}: ${j.error}`);
  return j.view;
}

const svc = createClient(URL_, SERVICE, { auth: { persistSession: false } });

// A 建 hard 房
const A = fresh();
const { data: a } = await A.auth.signInAnonymously();
const tokenA = a.session!.access_token;
const { data: created, error } = await A.rpc("create_match", { p_difficulty: "hard" });
if (error) throw new Error("create_match: " + error.message);
const matchId = (created as { id: string; difficulty: string }).id;
must((created as { difficulty: string }).difficulty === "hard", `create_match 回的列 difficulty 應為 hard，實得 ${(created as { difficulty: string }).difficulty}`);
pass("create_match({p_difficulty:'hard'}) → matches.difficulty=hard（migration 0005 生效）");

// B 加入
const B = fresh();
const { data: b } = await B.auth.signInAnonymously();
const tokenB = b.session!.access_token;
await B.rpc("join_match", { p_code: (created as { room_code: string }).room_code });

// 觸發發牌（伺服器 initMatch 應讀 difficulty=hard）→ 雙方換牌 → A 出牌 → 題型應是句子題
const seed = await view(tokenA, matchId);
must(seed.difficulty === "hard", `view.difficulty 應為 hard，實得 ${seed.difficulty}`);
pass("SeatView.difficulty=hard（伺服器 initMatch 讀到房間難度）");

await act(tokenA, matchId, { type: "mulligan", replaceIdx: [] });
await act(tokenB, matchId, { type: "mulligan", replaceIdx: [] });

// 推進回合累積法力，直到 A 出得了一張牌並拿到題目（避開第 1 回合 1 法力可能沒牌可出/需目標的情況）
let quizPrompt = "";
for (let round = 0; round < 10 && !quizPrompt; round++) {
  const vv = await view(tokenA, matchId);
  if (vv.phase === "over") break;
  if (vv.yourTurn) {
    for (const c of vv.you.hand) {
      const r = await act(tokenA, matchId, { type: "playCard", cardId: c.id });
      if (r.status === 200 && r.view?.quiz) { quizPrompt = r.view.quiz.prompt; break; }
    }
    if (!quizPrompt) await act(tokenA, matchId, { type: "endTurn" });
  } else {
    await act(tokenB, matchId, { type: "endTurn" }); // B 的回合，直接推進
  }
}
must(!!quizPrompt, "推進數回合後應該出到一張牌並拿到題目");
// 句子題 prompt＝「<整句中文>」的太魯閣語是？（中文通常較長、含標點）；單字題中文多為 1–3 字
const chineseInPrompt = (quizPrompt.match(/「(.+?)」/)?.[1] ?? "");
must(quizPrompt.includes("的太魯閣語是？"), "hard 題目方向應是中文問族語");
must(chineseInPrompt.length >= 4, `hard 應是句子題（中文題幹較長），實得題幹「${chineseInPrompt}」（prompt: ${quizPrompt}）`);
pass(`出牌題目確為句子題：「${chineseInPrompt}」…`);

// 收尾：刪測試對局
await svc.from("matches").delete().eq("id", matchId);
console.log("\n共用難度全鏈路 e2e 通過 ✓ —— 建 hard 房、伺服器出句子題真的接上了。");
