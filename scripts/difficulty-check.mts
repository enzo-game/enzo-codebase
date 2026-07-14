// 驗證 /vs 共用難度：hard→句子題、normal→單字題（出牌後看 pending 的題型 kind）。
import { initMatch, applyMatchAction, viewFor, type MatchState, type Seat } from "../src/engine/match.ts";

function must(c: boolean, m: string) { if (!c) throw new Error("斷言失敗：" + m); }

function firstQuizKind(difficulty: "normal" | "hard"): { kind: string; viewDiff: string } {
  let s = initMatch(0, difficulty);
  for (const seat of ["a", "b"] as Seat[]) {
    const r = applyMatchAction(s, seat, { type: "mulligan", replaceIdx: [] });
    must(r.ok, "換牌應成功");
    s = (r as { ok: true; state: MatchState }).state;
  }
  s = { ...s, meta: { ...s.meta, a: { maxMana: 99, mana: 99 } } };
  // 出第一張牌（不管是什麼，出題就好；需目標的法術會被 validatePlay 擋，逐張試到能出）
  for (const card of s.game.pHand) {
    const r = applyMatchAction(s, "a", { type: "playCard", cardId: card.id });
    if (r.ok) {
      const st = (r as { ok: true; state: MatchState }).state;
      must(st.pending != null, "應進入待答");
      return { kind: st.pending!.quiz.kind, viewDiff: viewFor(st, "a").difficulty };
    }
  }
  throw new Error("這手牌沒有一張出得了（都需指定目標？）——重跑一次");
}

// normal → 單字題
{
  const { kind, viewDiff } = firstQuizKind("normal");
  must(kind === "word", `normal 應出單字題，實得 ${kind}`);
  must(viewDiff === "normal", `view.difficulty 應為 normal，實得 ${viewDiff}`);
  console.log("  ✓ normal：出單字題（word），view.difficulty=normal");
}
// hard → 句子題
{
  const { kind, viewDiff } = firstQuizKind("hard");
  must(kind === "sentence", `hard 應出句子題，實得 ${kind}`);
  must(viewDiff === "hard", `view.difficulty 應為 hard，實得 ${viewDiff}`);
  console.log("  ✓ hard：出句子題（sentence），view.difficulty=hard");
}
// 預設（不帶難度）→ normal
{
  const s = initMatch();
  must(s.difficulty === "normal", `initMatch 不帶難度應預設 normal，實得 ${s.difficulty}`);
  console.log("  ✓ initMatch 不帶難度＝預設 normal（向後相容）");
}

console.log("共用難度驗證通過 ✓");
