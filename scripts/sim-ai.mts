// 無頭 AI 平衡模擬：固定玩家策略，對三檔電腦難度各跑 N 局，統計電腦勝率。
// 執行：npx tsx scripts/sim-ai.mts
import {
  newGame,
  runEnemyTurn,
  startPlayerTurn,
  endOfTurnEffects,
  checkWinner,
  playCardResolved,
  resolveAttack,
  attackTargets,
  spellTargetKind,
  hasValidTarget,
} from "../src/engine/game.ts";
import type { Game, Target, Difficulty } from "../src/engine/types.ts";

const PLAYER_ACCURACY = 0.6; // 模擬玩家答題正確率
const MAX_TURNS = 60;

function pickPlayerSpellTarget(g: Game, kind: string): Target | undefined {
  if (kind === "none") return undefined;
  if (kind === "any") return { kind: "hero" };
  if (kind === "friendMinion") {
    const p = [...g.pBoard].sort((a, b) => b.attack - a.attack)[0];
    return p ? { kind: "minion", side: "player", key: p.key } : undefined;
  }
  const p = g.eBoard.filter((m) => !m.stealth).sort((a, b) => b.attack - a.attack)[0];
  return p ? { kind: "minion", side: "player", key: p.key } : undefined;
}

function playerTurn(g0: Game): Game {
  let g = g0;
  // 出牌：高費優先
  let guard = 24;
  while (guard-- > 0 && !g.winner) {
    const playable = g.pHand
      .filter((c) => c.cost <= g.pMana)
      .filter((c) => (c.type === "minion" ? g.pBoard.length < 7 : hasValidTarget(g, spellTargetKind(c))))
      .sort((a, b) => b.cost - a.cost);
    if (playable.length === 0) break;
    const card = playable[0];
    const isCorrect = Math.random() < PLAYER_ACCURACY;
    const kind = spellTargetKind(card);
    const target = card.type === "spell" ? pickPlayerSpellTarget(g, kind) : undefined;
    const next = playCardResolved(g, card, isCorrect, target);
    if (next === g) break; // 沒生效，避免死迴圈
    g = next;
  }
  if (g.winner) return g;

  // 攻擊：普通策略——能殺且對方攻擊>=3 才換，否則打臉
  let g2 = 24;
  while (!g.winner && g2-- > 0) {
    const cur = g.pBoard.find((m) => m.canAttack && m.attack > 0);
    if (!cur) break;
    const legal = attackTargets(g.eBoard);
    let target: Target;
    if (!legal.heroAllowed) {
      const taunts = g.eBoard.filter((m) => legal.keys.has(m.key));
      const kill = taunts.filter((t) => cur.attack >= t.health).sort((a, b) => b.attack - a.attack);
      const pick = kill[0] ?? [...taunts].sort((a, b) => b.attack - a.attack)[0];
      if (!pick) break;
      target = { kind: "minion", side: "enemy", key: pick.key };
    } else {
      const cands = g.eBoard.filter((m) => legal.keys.has(m.key));
      const trade = cands.filter((t) => cur.attack >= t.health && t.attack >= 3).sort((a, b) => b.attack - a.attack)[0];
      target = trade ? { kind: "minion", side: "enemy", key: trade.key } : { kind: "hero" };
    }
    const after = resolveAttack(g, "player", cur.key, target);
    if (after === g) break;
    g = after;
  }
  return g;
}

function simulate(difficulty: Difficulty): "player" | "enemy" | "draw" {
  let g = newGame();
  for (let t = 0; t < MAX_TURNS; t++) {
    g = playerTurn(g);
    if (g.winner) return g.winner;
    g = checkWinner(endOfTurnEffects(g, "player"));
    if (g.winner) return g.winner;
    g = runEnemyTurn(g, difficulty);
    if (g.winner) return g.winner;
    g = startPlayerTurn(g);
    if (g.winner) return g.winner;
  }
  return "draw";
}

const N = 300;
for (const diff of ["easy", "normal", "hard"] as Difficulty[]) {
  let enemyWins = 0;
  let playerWins = 0;
  let draws = 0;
  for (let i = 0; i < N; i++) {
    const r = simulate(diff);
    if (r === "enemy") enemyWins++;
    else if (r === "player") playerWins++;
    else draws++;
  }
  const rate = ((enemyWins / N) * 100).toFixed(1);
  console.log(
    `${diff.padEnd(6)} 電腦勝率 ${rate}%  (電腦 ${enemyWins} / 玩家 ${playerWins} / 平手 ${draws})`,
  );
}
