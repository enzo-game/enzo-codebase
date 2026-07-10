// 對戰引擎核心邏輯 —— 純函式，無 React 依賴。
// P0：從 src/app/play/page.tsx 抽出，供前端 UI 與（未來）Supabase Edge Function 共用。
import { CARDS, Card, TOKEN_SAPLING, Theme } from "@/data/cards";
import { vocab, distractors } from "@/data/truku";
import {
  Difficulty,
  Game,
  LogEntry,
  Minion,
  QuizState,
  Side,
  Target,
  TargetKind,
  HERO_HP,
  BOARD_MAX,
  HAND_MAX,
} from "./types";

// ───────────────────────── 工具 ─────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const uid = () => Math.random().toString(36).slice(2);

export function pushLog(log: LogEntry[], text: string, tone: LogEntry["tone"]): LogEntry[] {
  return [{ key: uid(), text, tone }, ...log].slice(0, 12);
}

export function cloneGame(g: Game): Game {
  return {
    ...g,
    pDeck: [...g.pDeck],
    pHand: [...g.pHand],
    pBoard: [...g.pBoard],
    eDeck: [...g.eDeck],
    eHand: [...g.eHand],
    eBoard: [...g.eBoard],
    log: [...g.log],
  };
}

/** 對戰場上單一隨從造成傷害，死亡即移除 */
export function hurt(board: Minion[], key: string, n: number): Minion[] {
  return board
    .map((m) => (m.key === key ? { ...m, health: m.health - n } : m))
    .filter((m) => m.health > 0);
}

/** 對整排隨從造成傷害（AoE 不受潛行保護） */
export function aoe(board: Minion[], n: number): Minion[] {
  return board.map((m) => ({ ...m, health: m.health - n })).filter((m) => m.health > 0);
}

export function checkWinner(g: Game): Game {
  if (g.enemyHp <= 0) return { ...g, winner: "player", phase: "over" };
  if (g.playerHp <= 0) return { ...g, winner: "enemy", phase: "over" };
  return g;
}

// ───────────────────────── 法術目標規則 ─────────────────────────

const SPELL_TARGET: Record<string, TargetKind> = {
  dmgAny2: "any",
  dmgAny5: "any",
  dmgAny8: "any",
  dmgMinion4: "anyMinion",
  dmgEnemyMinion3: "enemyMinion",
  shuffleBackEnemy: "enemyMinion",
  friendTaunt03: "friendMinion",
  buffFriend11: "friendMinion",
};

export function spellTargetKind(card: Card): TargetKind {
  if (card.type !== "spell" || !card.effect) return "none";
  return SPELL_TARGET[card.effect] ?? "none";
}

/** 玩家視角：這種目標類型目前有沒有合法目標可選 */
export function hasValidTarget(g: Game, kind: TargetKind): boolean {
  if (kind === "none" || kind === "any") return true; // any 永遠可打敵方英雄
  const enemyOk = g.eBoard.some((m) => !m.stealth);
  if (kind === "enemyMinion") return enemyOk;
  if (kind === "friendMinion") return g.pBoard.length > 0;
  return enemyOk || g.pBoard.length > 0; // anyMinion（我方隨從一律可指定）
}

// ───────────────────────── 攻擊規則（嘲諷／潛行）─────────────────────────

/** 攻擊方可指定的防守目標：有（未潛行的）嘲諷者就必須先打嘲諷 */
export function attackTargets(defBoard: Minion[]): { heroAllowed: boolean; keys: Set<string>; mustTaunt: boolean } {
  const taunts = defBoard.filter((m) => m.taunt && !m.stealth);
  if (taunts.length > 0) {
    return { heroAllowed: false, keys: new Set(taunts.map((m) => m.key)), mustTaunt: true };
  }
  return {
    heroAllowed: true,
    keys: new Set(defBoard.filter((m) => !m.stealth).map((m) => m.key)),
    mustTaunt: false,
  };
}

// ───────────────────────── 抽牌 ─────────────────────────

/** 直接在（已 clone 的）ng 上抽牌，回傳實際抽到張數 */
export function drawCards(ng: Game, side: Side, n: number): number {
  let drawn = 0;
  for (let i = 0; i < n; i++) {
    const deck = side === "player" ? ng.pDeck : ng.eDeck;
    const hand = side === "player" ? ng.pHand : ng.eHand;
    if (deck.length === 0 || hand.length >= HAND_MAX) break;
    const [top, ...rest] = deck;
    if (side === "player") {
      ng.pDeck = rest;
      ng.pHand = [...hand, top];
    } else {
      ng.eDeck = rest;
      ng.eHand = [...hand, top];
    }
    drawn++;
  }
  return drawn;
}

// ───────────────────────── 隨從入場（含戰吼）─────────────────────────

export function playMinionFor(g: Game, side: Side, card: Card, isCorrect: boolean): Game {
  const ng = cloneGame(g);
  const my = side === "player";
  const board = my ? ng.pBoard : ng.eBoard;
  if (board.length >= BOARD_MAX) return ng;

  const bs = isCorrect ? card.bonusStats : undefined;
  const kws = new Set([...(card.keywords ?? []), ...((isCorrect ? card.bonusKeywords : undefined) ?? [])]);
  const atk = (card.attack ?? 0) + (bs?.atk ?? 0);
  const hp = (card.health ?? 0) + (bs?.hp ?? 0);
  const minion: Minion = {
    key: uid(),
    card,
    attack: atk,
    health: hp,
    maxHealth: hp,
    canAttack: kws.has("charge"),
    taunt: kws.has("taunt"),
    stealth: kws.has("stealth"),
    bonus: isCorrect,
  };
  if (my) ng.pBoard = [...ng.pBoard, minion];
  else ng.eBoard = [...ng.eBoard, minion];

  if (my) {
    ng.log = pushLog(
      ng.log,
      isCorrect
        ? `✓ ${card.nameZh}：答對！加成「${card.bonusText}」（${atk}/${hp}）`
        : `✕ ${card.nameZh}：答錯，基礎打出（${atk}/${hp}）`,
      isCorrect ? "good" : "bad",
    );
  } else {
    ng.log = pushLog(ng.log, `山林試煉派出「${card.nameZh}」（${atk}/${hp}）`, "sys");
  }

  // 戰吼
  switch (card.effect) {
    case "draw1": {
      const n = drawCards(ng, side, isCorrect ? 2 : 1);
      if (n > 0) ng.log = pushLog(ng.log, `${card.nameZh} 戰吼：${my ? "織者" : "山林試煉"}抽 ${n} 張牌`, my ? "info" : "sys");
      break;
    }
    case "summonSapling1": {
      const count = isCorrect ? 2 : 1;
      let summoned = 0;
      for (let i = 0; i < count; i++) {
        const b = my ? ng.pBoard : ng.eBoard;
        if (b.length >= BOARD_MAX) break;
        const sap: Minion = {
          key: uid(),
          card: TOKEN_SAPLING,
          attack: TOKEN_SAPLING.attack ?? 2,
          health: TOKEN_SAPLING.health ?? 2,
          maxHealth: TOKEN_SAPLING.health ?? 2,
          canAttack: false,
          taunt: false,
          stealth: false,
          bonus: false,
        };
        if (my) ng.pBoard = [...ng.pBoard, sap];
        else ng.eBoard = [...ng.eBoard, sap];
        summoned++;
      }
      if (summoned > 0) ng.log = pushLog(ng.log, `${card.nameZh} 戰吼：召喚 ${summoned} 個 2/2 幼樹`, my ? "info" : "sys");
      break;
    }
    case "aoeEnemy2": {
      const n = isCorrect ? 3 : 2;
      if (my) ng.eBoard = aoe(ng.eBoard, n);
      else ng.pBoard = aoe(ng.pBoard, n);
      ng.log = pushLog(ng.log, `${card.nameZh} 戰吼：對所有敵方隨從造成 ${n} 點傷害`, my ? "info" : "sys");
      break;
    }
  }
  return checkWinner(ng);
}

// ───────────────────────── 法術結算 ─────────────────────────

export function castSpell(g: Game, side: Side, card: Card, isCorrect: boolean, target?: Target): Game {
  const ng = cloneGame(g);
  const my = side === "player";
  const foeSide: Side = my ? "enemy" : "player";
  const foeHeroName = my ? "山林試煉" : "織者";

  const getBoard = (s: Side) => (s === "player" ? ng.pBoard : ng.eBoard);
  const setBoard = (s: Side, b: Minion[]) => {
    if (s === "player") ng.pBoard = b;
    else ng.eBoard = b;
  };
  const healMyHero = (n: number) => {
    if (my) ng.playerHp = Math.min(HERO_HP, ng.playerHp + n);
    else ng.enemyHp = Math.min(HERO_HP, ng.enemyHp + n);
  };
  const dmgFoeHero = (n: number) => {
    if (my) ng.enemyHp = Math.max(0, ng.enemyHp - n);
    else ng.playerHp = Math.max(0, ng.playerHp - n);
  };
  const targetName = (): string => {
    if (!target || target.kind === "hero") return foeHeroName;
    const t = getBoard(target.side).find((m) => m.key === target.key);
    return t ? `「${t.card.nameZh}」` : "目標";
  };
  const hurtTarget = (n: number): string => {
    if (!target || target.kind !== "minion") return "";
    const name = targetName();
    setBoard(target.side, hurt(getBoard(target.side), target.key, n));
    return name;
  };

  let note = "";
  switch (card.effect) {
    case "dmgAny2":
    case "dmgAny5":
    case "dmgAny8": {
      const base = card.effect === "dmgAny2" ? 2 : card.effect === "dmgAny5" ? 5 : 8;
      const n = card.effect === "dmgAny8" ? 8 : base + (isCorrect ? 1 : 0);
      if (!target || target.kind === "hero") {
        dmgFoeHero(n);
        note = `對${foeHeroName}造成 ${n} 點傷害`;
      } else {
        note = `對${hurtTarget(n)}造成 ${n} 點傷害`;
      }
      if (card.effect === "dmgAny8" && isCorrect && my) {
        ng.pMana = Math.min(ng.pMaxMana, ng.pMana + 1);
        note += "；退還 1 點法力";
      }
      break;
    }
    case "dmgMinion4": {
      const n = isCorrect ? 5 : 4;
      note = `對${hurtTarget(n)}造成 ${n} 點傷害`;
      break;
    }
    case "dmgEnemyMinion3": {
      const n = isCorrect ? 4 : 3;
      note = `對${hurtTarget(n)}造成 ${n} 點傷害`;
      break;
    }
    case "dmgEnemyHero3": {
      const n = isCorrect ? 4 : 3;
      dmgFoeHero(n);
      note = `對${foeHeroName}造成 ${n} 點傷害`;
      break;
    }
    case "aoeEnemy3": {
      const n = isCorrect ? 4 : 3;
      setBoard(foeSide, aoe(getBoard(foeSide), n));
      note = `對所有敵方隨從造成 ${n} 點傷害`;
      break;
    }
    case "twoSuns": {
      dmgFoeHero(4);
      setBoard(foeSide, aoe(getBoard(foeSide), 1));
      if (!isCorrect) setBoard(side, aoe(getBoard(side), 1));
      note = isCorrect
        ? `對${foeHeroName}造成 4 點傷害；敵方隨從各受 1 點（我方免疫）`
        : `對${foeHeroName}造成 4 點傷害；雙方隨從各受 1 點`;
      break;
    }
    case "floodAll4": {
      ng.pBoard = aoe(ng.pBoard, 4);
      ng.eBoard = aoe(ng.eBoard, 4);
      note = "對所有隨從（不分敵我）造成 4 點傷害";
      if (isCorrect) {
        healMyHero(3);
        note += "；我方英雄回復 3 點";
      }
      break;
    }
    case "healHero5": {
      const n = isCorrect ? 8 : 5;
      healMyHero(n);
      note = `回復我方英雄 ${n} 點`;
      break;
    }
    case "healHero8": {
      healMyHero(8);
      note = "回復我方英雄 8 點";
      if (isCorrect) {
        const n = drawCards(ng, side, 1);
        if (n > 0) note += "；抽 1 張牌";
      }
      break;
    }
    case "draw1":
    case "draw2": {
      const base = card.effect === "draw1" ? 1 : 2;
      const n = drawCards(ng, side, base + (isCorrect ? 1 : 0));
      note = `抽 ${n} 張牌`;
      break;
    }
    case "allFriendStealth": {
      const myBoard = getBoard(side).map((m) => ({
        ...m,
        stealth: true,
        health: m.health + (isCorrect ? 1 : 0),
        maxHealth: m.maxHealth + (isCorrect ? 1 : 0),
      }));
      setBoard(side, myBoard);
      note = isCorrect ? "我方所有隨從獲得潛行並 +0/+1" : "我方所有隨從獲得潛行";
      break;
    }
    case "friendTaunt03": {
      const up = isCorrect ? 5 : 3;
      if (target?.kind === "minion") {
        const name = targetName();
        setBoard(
          target.side,
          getBoard(target.side).map((m) =>
            m.key === target.key
              ? { ...m, taunt: true, health: m.health + up, maxHealth: m.maxHealth + up }
              : m,
          ),
        );
        note = `${name}獲得嘲諷與 +0/+${up}`;
      }
      break;
    }
    case "buffFriend11": {
      if (target?.kind === "minion") {
        const name = targetName();
        setBoard(
          target.side,
          getBoard(target.side).map((m) =>
            m.key === target.key
              ? {
                  ...m,
                  attack: m.attack + 1,
                  health: m.health + 1,
                  maxHealth: m.maxHealth + 1,
                  canAttack: isCorrect ? true : m.canAttack,
                }
              : m,
          ),
        );
        note = isCorrect ? `${name}+1/+1 並獲得衝鋒` : `${name}+1/+1`;
      }
      break;
    }
    case "shuffleBackEnemy": {
      if (target?.kind === "minion") {
        const b = getBoard(target.side);
        const t = b.find((m) => m.key === target.key);
        if (t) {
          setBoard(target.side, b.filter((m) => m.key !== target.key));
          const deck = target.side === "player" ? [...ng.pDeck] : [...ng.eDeck];
          deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, t.card);
          if (target.side === "player") ng.pDeck = deck;
          else ng.eDeck = deck;
          note = `「${t.card.nameZh}」被洗回牌庫`;
        }
      }
      if (isCorrect) {
        const n = drawCards(ng, side, 1);
        if (n > 0) note += "；抽 1 張牌";
      }
      break;
    }
  }

  if (my) {
    ng.log = pushLog(
      ng.log,
      isCorrect ? `✓ ${card.nameZh}：答對！${note}` : `✕ ${card.nameZh}：答錯，基礎施放（${note}）`,
      isCorrect ? "good" : "bad",
    );
  } else {
    ng.log = pushLog(ng.log, `山林試煉施放「${card.nameZh}」：${note}`, "sys");
  }
  return checkWinner(ng);
}

// ───────────────────────── 玩家出牌（答題後結算）─────────────────────────

/** 從手牌移除卡片、扣費、記錄答題結果；不合法則回 null */
export function commitCard(g: Game, card: Card, isCorrect: boolean): Game | null {
  const idx = g.pHand.findIndex((c) => c.id === card.id);
  if (idx === -1 || card.cost > g.pMana) return null;
  const ng = cloneGame(g);
  ng.pHand = ng.pHand.filter((_, i) => i !== idx);
  ng.pMana -= card.cost;
  if (isCorrect) ng.correct += 1;
  else ng.wrong += 1;
  return ng;
}

export function playCardResolved(g: Game, card: Card, isCorrect: boolean, target?: Target): Game {
  const ng = commitCard(g, card, isCorrect);
  if (!ng) return g;
  if (card.type === "minion") return playMinionFor(ng, "player", card, isCorrect);
  return castSpell(ng, "player", card, isCorrect, target);
}

// ───────────────────────── 攻擊結算(雙方共用，含嘲諷／潛行）─────────────────────────

export function resolveAttack(g: Game, side: Side, attackerKey: string, target: Target): Game {
  const ng = cloneGame(g);
  const my = side === "player";
  const atkBoard = my ? ng.pBoard : ng.eBoard;
  const defBoard = my ? ng.eBoard : ng.pBoard;
  const attacker = atkBoard.find((m) => m.key === attackerKey);
  if (!attacker || !attacker.canAttack) return g;

  const legal = attackTargets(defBoard);
  if (target.kind === "hero" && !legal.heroAllowed) return g;
  if (target.kind === "minion" && !legal.keys.has(target.key)) return g;

  const tone: LogEntry["tone"] = my ? "info" : "sys";
  const spend = (b: Minion[], hpLeft: number) =>
    b
      .map((m) => (m.key === attackerKey ? { ...m, health: hpLeft, canAttack: false, stealth: false } : m))
      .filter((m) => m.health > 0);

  if (target.kind === "hero") {
    if (my) ng.enemyHp = Math.max(0, ng.enemyHp - attacker.attack);
    else ng.playerHp = Math.max(0, ng.playerHp - attacker.attack);
    if (my) ng.pBoard = spend(ng.pBoard, attacker.health);
    else ng.eBoard = spend(ng.eBoard, attacker.health);
    ng.log = pushLog(ng.log, `${attacker.card.nameZh} 攻擊${my ? "山林試煉" : "織者"} ${attacker.attack} 點`, tone);
  } else {
    const t = defBoard.find((m) => m.key === target.key);
    if (!t) return g;
    const aHp = attacker.health - t.attack;
    const tHp = t.health - attacker.attack;
    if (my) {
      ng.pBoard = spend(ng.pBoard, aHp);
      ng.eBoard = hurt(ng.eBoard, t.key, attacker.attack);
    } else {
      ng.eBoard = spend(ng.eBoard, aHp);
      ng.pBoard = hurt(ng.pBoard, t.key, attacker.attack);
    }
    ng.log = pushLog(
      ng.log,
      `${attacker.card.nameZh}（${attacker.attack}/${aHp}）換 ${t.card.nameZh}（${t.attack}/${tHp}）`,
      tone,
    );
  }
  return checkWinner(ng);
}

// ───────────────────────── 回合結束效果 ─────────────────────────

export function endOfTurnEffects(g: Game, side: Side): Game {
  let ng = g;
  const board = side === "player" ? g.pBoard : g.eBoard;
  for (const m of board) {
    if (m.card.effect === "healHero1") {
      const n = m.bonus ? 2 : 1;
      const next = cloneGame(ng);
      if (side === "player") next.playerHp = Math.min(HERO_HP, next.playerHp + n);
      else next.enemyHp = Math.min(HERO_HP, next.enemyHp + n);
      next.log = pushLog(
        next.log,
        `${m.card.nameZh} 回合結束：回復${side === "player" ? "織者" : "山林試煉"} ${n} 點`,
        side === "player" ? "good" : "sys",
      );
      ng = next;
    }
  }
  return ng;
}

// ───────────────────────── 系統（AI）回合 ─────────────────────────

export function aiCanPlay(ng: Game, c: Card, mana: number): boolean {
  if (c.cost > mana) return false;
  if (c.type === "minion") return ng.eBoard.length < BOARD_MAX;
  const kind = spellTargetKind(c);
  // AI 視角：敵方隨從＝玩家隨從（潛行不可指定）
  if (kind === "enemyMinion" || kind === "anyMinion") return ng.pBoard.some((m) => !m.stealth);
  if (kind === "friendMinion") return ng.eBoard.length > 0;
  return true;
}

export function aiSpellTarget(ng: Game, c: Card): Target | undefined {
  const kind = spellTargetKind(c);
  if (kind === "none") return undefined;
  if (kind === "any") return { kind: "hero" }; // 直接打臉
  if (kind === "friendMinion") {
    const pick = [...ng.eBoard].sort((a, b) => b.attack - a.attack)[0];
    return pick ? { kind: "minion", side: "enemy", key: pick.key } : undefined;
  }
  // enemyMinion / anyMinion：打玩家最強的未潛行隨從
  const pick = ng.pBoard.filter((m) => !m.stealth).sort((a, b) => b.attack - a.attack)[0];
  return pick ? { kind: "minion", side: "player", key: pick.key } : undefined;
}

/** 各難度「答對觸發加成」的機率：簡單從不加成、困難幾乎必加成 */
const AI_BONUS_CHANCE: Record<Difficulty, number> = { easy: 0, normal: 0.3, hard: 0.85 };

export function runEnemyTurn(g: Game, difficulty: Difficulty = "normal"): Game {
  let ng = cloneGame(g);
  ng.eMaxMana = Math.min(ng.eMaxMana + 1, 10);
  let mana = ng.eMaxMana;

  drawCards(ng, "enemy", 1);
  ng.eBoard = ng.eBoard.map((m) => ({ ...m, canAttack: true }));

  const bonusChance = AI_BONUS_CHANCE[difficulty];

  // 出牌：出得起就出。難度差異——
  //  easy：偶爾提前收手、故意留法力（打得比較鬆）、從不答題加成
  //  normal：高費優先，基礎效果為主
  //  hard：場上隨從少時優先鋪隨從，且高機率答對觸發加成
  let guard = 24;
  while (guard-- > 0 && !ng.winner) {
    if (difficulty === "easy" && Math.random() < 0.25) break;

    const playable = ng.eHand
      .map((c, i) => ({ c, i }))
      .filter((x) => aiCanPlay(ng, x.c, mana));
    if (playable.length === 0) break;

    playable.sort((a, b) => b.c.cost - a.c.cost);
    let pick = playable[0];
    if (difficulty === "hard" && ng.eBoard.length < 3) {
      const minionPick = playable.find((x) => x.c.type === "minion");
      if (minionPick) pick = minionPick;
    }

    const { c, i } = pick;
    ng.eHand = ng.eHand.filter((_, j) => j !== i);
    mana -= c.cost;
    const isCorrect = Math.random() < bonusChance;
    if (c.type === "minion") {
      ng = playMinionFor(ng, "enemy", c, isCorrect);
    } else {
      const target = aiSpellTarget(ng, c);
      ng = castSpell(ng, "enemy", c, isCorrect, target);
    }
  }
  if (ng.winner) return ng;

  ng = runEnemyAttacks(ng, difficulty);
  if (ng.winner) return ng;

  ng = endOfTurnEffects(ng, "enemy");
  return checkWinner(ng);
}

/** 系統回合的攻擊階段（遵守嘲諷／潛行）。困難會先偵測斬殺、做價值換血。 */
function runEnemyAttacks(g: Game, difficulty: Difficulty): Game {
  let ng = g;

  // 困難：斬殺偵測——沒有嘲諷擋路且總攻擊足以打死玩家英雄，就全員打臉
  if (difficulty === "hard") {
    const taunts = ng.pBoard.filter((m) => m.taunt && !m.stealth);
    const ready = ng.eBoard.filter((m) => m.canAttack && m.attack > 0);
    const totalAtk = ready.reduce((s, m) => s + m.attack, 0);
    if (taunts.length === 0 && totalAtk >= ng.playerHp) {
      for (const m of ready) {
        if (ng.winner) break;
        ng = resolveAttack(ng, "enemy", m.key, { kind: "hero" });
      }
      return checkWinner(ng);
    }
  }

  let guard = 24;
  while (!ng.winner && guard-- > 0) {
    const cur = ng.eBoard.find((m) => m.canAttack && m.attack > 0);
    if (!cur) break;
    const legal = attackTargets(ng.pBoard);
    const target = chooseEnemyAttackTarget(ng, cur, legal, difficulty);
    if (!target) break;
    const after = resolveAttack(ng, "enemy", cur.key, target);
    if (after === ng) break; // 防呆：攻擊沒有生效就跳出
    ng = after;
  }
  return ng;
}

/** 依難度替單一攻擊者挑目標；回 null 代表這隻沒有可打的目標。 */
function chooseEnemyAttackTarget(
  ng: Game,
  cur: Minion,
  legal: { heroAllowed: boolean; keys: Set<string>; mustTaunt: boolean },
  difficulty: Difficulty,
): Target | null {
  // 被嘲諷擋住：一定要先打嘲諷
  if (!legal.heroAllowed) {
    const taunts = ng.pBoard.filter((m) => legal.keys.has(m.key));
    if (taunts.length === 0) return null;
    if (difficulty === "easy") {
      return { kind: "minion", side: "player", key: taunts[0].key };
    }
    const killable = taunts.filter((t) => cur.attack >= t.health).sort((a, b) => b.attack - a.attack);
    const pick = killable[0] ?? [...taunts].sort((a, b) => b.attack - a.attack)[0];
    return { kind: "minion", side: "player", key: pick.key };
  }

  const cands = ng.pBoard.filter((m) => legal.keys.has(m.key));

  // 簡單：幾乎只打臉（放生玩家隨從），玩家更容易翻盤
  if (difficulty === "easy") {
    if (cands.length === 0 || Math.random() < 0.8) return { kind: "hero" };
    return { kind: "minion", side: "player", key: cands[0].key };
  }

  // 困難：價值換血——這一擊能殺掉的目標裡，優先「換完自己還活」或「對方比我兇」
  if (difficulty === "hard") {
    const killable = cands.filter((t) => cur.attack >= t.health).sort((a, b) => b.attack - a.attack);
    const survives = killable.find((t) => cur.health > t.attack);
    const worthy = killable.find((t) => t.attack >= cur.attack);
    const trade = survives ?? worthy;
    return trade ? { kind: "minion", side: "player", key: trade.key } : { kind: "hero" };
  }

  // 普通：能殺且對方攻擊 >=3 才換，否則打臉
  const trade = cands
    .filter((t) => cur.attack >= t.health && t.attack >= 3)
    .sort((a, b) => b.attack - a.attack)[0];
  return trade ? { kind: "minion", side: "player", key: trade.key } : { kind: "hero" };
}

export function startPlayerTurn(g: Game): Game {
  const ng = cloneGame(g);
  ng.turn += 1;
  ng.phase = "player";
  ng.pMaxMana = Math.min(ng.pMaxMana + 1, 10);
  ng.pMana = ng.pMaxMana;
  ng.pBoard = ng.pBoard.map((m) => ({ ...m, canAttack: true }));
  drawCards(ng, "player", 1);
  ng.log = pushLog(ng.log, `── 第 ${ng.turn} 回合 ──`, "info");
  return ng;
}

// ───────────────────────── 初始化 ─────────────────────────

/** 牌組：普通＋稀有各 2 張、史詩＋傳說各 1 張，雙方同一份卡池 */
export function buildDeck(): Card[] {
  return shuffle(
    CARDS.flatMap((c) => (c.rarity === "common" || c.rarity === "rare" ? [c, c] : [c])),
  );
}

/** 敵方牌組：可選主題偏向（該主題多一份，抽到機率提高 → 不同對手手感）。 */
export function buildEnemyDeck(theme?: Theme): Card[] {
  const base = CARDS.flatMap((c) => (c.rarity === "common" || c.rarity === "rare" ? [c, c] : [c]));
  if (!theme) return shuffle(base);
  const biased = [...base, ...CARDS.filter((c) => c.theme === theme)];
  return shuffle(biased);
}

export function newGame(opponentTheme?: Theme): Game {
  const p = buildDeck();
  const e = buildEnemyDeck(opponentTheme);
  return {
    phase: "player",
    turn: 1,
    playerHp: HERO_HP,
    enemyHp: HERO_HP,
    pMaxMana: 1,
    pMana: 1,
    pDeck: p.slice(4),
    pHand: p.slice(0, 4),
    pBoard: [],
    eMaxMana: 0,
    eDeck: e.slice(4),
    eHand: e.slice(0, 4),
    eBoard: [],
    log: pushLog([], "山林試煉開始，織者出發。", "info"),
    correct: 0,
    wrong: 0,
    winner: null,
  };
}

/** 開局換牌（mulligan）：把手牌中選定索引的牌洗回牌庫、重抽等量。玩家專用。 */
export function mulligan(g: Game, replaceIdx: number[]): Game {
  if (replaceIdx.length === 0) return g;
  const ng = cloneGame(g);
  const idxSet = new Set(replaceIdx);
  const returned = ng.pHand.filter((_, i) => idxSet.has(i));
  ng.pHand = ng.pHand.filter((_, i) => !idxSet.has(i));
  ng.pDeck = shuffle([...ng.pDeck, ...returned]);
  drawCards(ng, "player", returned.length);
  return ng;
}

// ───────────────────────── 答題（真實太魯閣語詞庫）─────────────────────────

export function makeQuiz(card: Card): QuizState {
  const v = vocab(card.vocabId);
  const options = shuffle([v.word, ...distractors(card.vocabId, 3).map((d) => d.word)]);
  return {
    card,
    prompt: `「${v.chinese}」的太魯閣族語是？`,
    options,
    answerIdx: options.indexOf(v.word),
    word: v.word,
    chinese: v.chinese,
  };
}
