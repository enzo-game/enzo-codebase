// 練習模式的本地對手（座位 b）。純引擎（applyMatchAction）同步操作，跑在瀏覽器裡，
// 邏輯跟 scripts/vs-opponent.mts 一致：換牌保留全部 → 出得起的牌就出（高費優先、答對率 60%）
// → 能攻擊就攻擊（有嘲諷先打嘲諷）→ 結束回合。給玩家一個隨時能進去測 /vs 功能的沙包。
import { applyMatchAction, viewFor, type MatchState, type ClientTarget, type SeatView } from "@/engine/match";
import { spellTargetKind } from "@/engine/game";

function botSpellTarget(v: SeatView, card: SeatView["you"]["hand"][number]): ClientTarget | undefined {
  const k = spellTargetKind(card);
  if (k === "none") return undefined;
  if (k === "any") return { kind: "hero" };
  if (k === "friendMinion") {
    const m = [...v.you.board].sort((a, b) => b.attack - a.attack)[0];
    return m ? { kind: "minion", who: "you", key: m.key } : undefined;
  }
  const m = v.opp.board.filter((x) => !x.stealth).sort((a, b) => b.attack - a.attack)[0];
  if (m) return { kind: "minion", who: "opp", key: m.key };
  if (k === "anyMinion") {
    const o = [...v.you.board].sort((a, b) => b.attack - a.attack)[0];
    return o ? { kind: "minion", who: "you", key: o.key } : undefined;
  }
  return undefined;
}

/** 把座位 b（練習對手）該做的事一次跑完，回傳新狀態。不是 b 的回合就（幾乎）原樣回傳。 */
export function runPracticeBotTurn(state: MatchState): MatchState {
  let s = state;
  // 換牌階段：b 保留全部起手牌
  if (s.mulligan && !s.mulligan.b) {
    const r = applyMatchAction(s, "b", { type: "mulligan", replaceIdx: [] });
    if (r.ok) s = r.state;
  }
  if (s.mulligan || s.winner || s.current !== "b") return s;

  // 出牌階段（高費優先；答對率 60% 給點壓力）
  for (let g = 0; g < 30; g++) {
    if (s.winner) return s;
    const v = viewFor(s, "b");
    const aff = v.you.hand.filter((c) => c.cost <= v.you.mana).sort((a, b) => b.cost - a.cost);
    if (!aff.length) break;
    let adv = false;
    for (const card of aff) {
      const target = card.type === "spell" ? botSpellTarget(v, card) : undefined;
      const r = applyMatchAction(s, "b", { type: "playCard", cardId: card.id, target });
      if (!r.ok) continue;
      s = r.state;
      const optCount = s.pending!.quiz.options.length || 4;
      const correctIdx = s.pending!.quiz.answerIdx;
      const idx = Math.random() < 0.6 ? correctIdx : (correctIdx + 1) % optCount;
      const ans = applyMatchAction(s, "b", { type: "answer", optionIdx: idx });
      if (ans.ok) { s = ans.state; adv = true; }
      break;
    }
    if (!adv) break;
  }

  // 攻擊階段（有嘲諷先打嘲諷，否則打臉）
  for (let g = 0; g < 30; g++) {
    if (s.winner) return s;
    const v = viewFor(s, "b");
    const atk = v.you.board.find((m) => m.canAttack && m.attack > 0);
    if (!atk) break;
    const taunts = v.opp.board.filter((m) => m.taunt && !m.stealth);
    const target: ClientTarget = taunts.length ? { kind: "minion", who: "opp", key: taunts[0].key } : { kind: "hero" };
    const r = applyMatchAction(s, "b", { type: "attack", attackerKey: atk.key, target });
    if (!r.ok || r.state === s) break;
    s = r.state;
  }

  if (s.winner) return s;
  const e = applyMatchAction(s, "b", { type: "endTurn" });
  if (e.ok) s = e.state;
  return s;
}
