// 驗證「手牌清空→補抽 5」：/play（playCardResolved 直算＋playCardFlow 事件流）與 /vs 各測一次。
// 用固定的純白隨從 leg-a01（山羌，衝鋒、無抽牌/召喚戰吼）當「最後一張手牌」，出掉它手牌會歸 0，
// 應立刻補成 5——這樣不會被「抽牌類卡自己補了手牌」的情況干擾，斷言乾淨、每次都可重現。
import { CARDS } from "../src/data/cards.ts";
import { newGame, playCardResolved, playCardFlow } from "../src/engine/game.ts";
import { initMatch, applyMatchAction, viewFor, type MatchState, type Seat } from "../src/engine/match.ts";

function must(c: boolean, m: string) { if (!c) throw new Error("斷言失敗：" + m); }
const vanilla = CARDS.find((c) => c.id === "leg-a01")!; // 山羌：衝鋒純白隨從
must(!!vanilla && vanilla.type === "minion", "找得到純白隨從 leg-a01");

// ── /play：playCardResolved（直算路徑）──
{
  const base = newGame();
  const g = { ...base, pHand: [vanilla], pMana: 99, pMaxMana: 99 };
  const after = playCardResolved(g, vanilla, false);
  must(after.pHand.length === 5, `/play 直算：出光最後一張後應補成 5，實得 ${after.pHand.length}`);
  console.log("  ✓ /play：手牌歸 0 → 補成 5（playCardResolved）");
}

// ── /play：playCardFlow（實際 UI 走的事件流）——確認最後一個事件的 state 帶著補回的手牌 ──
{
  const base = newGame();
  const g = { ...base, pHand: [vanilla], pMana: 99, pMaxMana: 99 };
  const steps = playCardFlow(g, vanilla, false);
  must(steps.length > 0, "playCardFlow 應回傳事件");
  const finalState = steps[steps.length - 1].state;
  must(finalState.pHand.length === 5, `/play 事件流：最後事件 state 手牌應為 5，實得 ${finalState.pHand.length}`);
  console.log("  ✓ /play：補抽 5 有進事件流、UI 最終 state 帶得到（playCardFlow）");
}

// ── /vs：座位 A 手牌只剩這張純白隨從，出掉 + 作答，手牌應補成 5（含脱敏視角）──
{
  let s = initMatch();
  for (const seat of ["a", "b"] as Seat[]) {
    const r = applyMatchAction(s, seat, { type: "mulligan", replaceIdx: [] });
    must(r.ok, "換牌應成功");
    s = (r as { ok: true; state: MatchState }).state;
  }
  // 把座位 A 手牌換成只有一張純白隨從、給滿法力
  s = { ...s, game: { ...s.game, pHand: [vanilla] }, meta: { ...s.meta, a: { maxMana: 99, mana: 99 } } };
  const r1 = applyMatchAction(s, "a", { type: "playCard", cardId: vanilla.id });
  must(r1.ok, "出牌應成功");
  s = (r1 as { ok: true; state: MatchState }).state;
  const r2 = applyMatchAction(s, "a", { type: "answer", optionIdx: 0 });
  must(r2.ok, "作答應成功");
  s = (r2 as { ok: true; state: MatchState }).state;
  must(s.game.pHand.length === 5, `/vs：出光後手牌應補成 5，實得 ${s.game.pHand.length}`);
  must(viewFor(s, "a").you.hand.length === 5, "/vs：座位脱敏視角手牌也應是 5");
  console.log("  ✓ /vs：手牌歸 0 → 補成 5（含座位脱敏視角）");
}

console.log("手牌清空補抽 5 驗證通過 ✓");
