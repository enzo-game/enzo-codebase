// 對戰引擎核心邏輯 —— 純函式，無 React 依賴。
// P0：從 src/app/play/page.tsx 抽出，供前端 UI 與（未來）Supabase Edge Function 共用。
import { CARDS, Card, TOKEN_SAPLING, Theme } from "@/data/cards";
import { vocab, distractors } from "@/data/truku";
import { randomSentence, sentenceDistractors } from "@/data/truku-sentences";
import {
  Anchor,
  CombatEvent,
  Difficulty,
  EventStep,
  Game,
  LogEntry,
  Minion,
  QuizState,
  Side,
  SpellVfx,
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

/** 對單一隨從造成傷害：石鎧（聖盾）先抵擋一次；死亡不在此移除，交給 reap() 觸發亡語後清場。 */
export function hurt(board: Minion[], key: string, n: number): Minion[] {
  if (n <= 0) return board;
  return board.map((m) => {
    if (m.key !== key) return m;
    if (m.divineShield) return { ...m, divineShield: false }; // 石鎧抵擋，血量不減
    return { ...m, health: m.health - n };
  });
}

/** 對整排隨從造成傷害（AoE 不受潛行保護）；石鎧同樣先抵擋，死亡交給 reap()。 */
export function aoe(board: Minion[], n: number): Minion[] {
  if (n <= 0) return board;
  return board.map((m) => {
    if (m.divineShield) return { ...m, divineShield: false };
    return { ...m, health: m.health - n };
  });
}

/** 這一側在場隨從提供的法術增幅總和（法術傷害 +N）。 */
export function spellPower(g: Game, side: Side): number {
  const board = side === "player" ? g.pBoard : g.eBoard;
  return board.reduce((s, m) => s + (m.spellDamage ?? 0), 0);
}

/** 依關鍵字（含答對加成關鍵字）與數值加成，產生一隻在場隨從。 */
export function spawnMinion(card: Card, isCorrect: boolean): Minion {
  const bs = isCorrect ? card.bonusStats : undefined;
  const kws = new Set([...(card.keywords ?? []), ...((isCorrect ? card.bonusKeywords : undefined) ?? [])]);
  const atk = (card.attack ?? 0) + (bs?.atk ?? 0);
  const hp = (card.health ?? 0) + (bs?.hp ?? 0);
  const hasCharge = kws.has("charge");
  const hasRush = kws.has("rush");
  return {
    key: uid(),
    card,
    attack: atk,
    health: hp,
    maxHealth: hp,
    canAttack: hasCharge || hasRush, // 衝鋒/突襲：登場即可攻擊
    taunt: kws.has("taunt"),
    stealth: kws.has("stealth"),
    bonus: isCorrect,
    divineShield: kws.has("divineShield") || undefined,
    lifesteal: kws.has("lifesteal") || undefined,
    windfury: kws.has("windfury") || undefined,
    rushBound: (hasRush && !hasCharge) || undefined, // 突襲（非衝鋒）：本回合不可打臉
    attacksUsed: 0,
    spellDamage: card.spellDamage,
  };
}

/** 亡語結算：dyingSide＝死亡隨從所屬方。 */
function runDeathrattle(ng: Game, dyingSide: Side, card: Card): void {
  const my = dyingSide === "player";
  const who = my ? "織者" : "山林試煉";
  switch (card.deathrattle) {
    case "drawOwner1": {
      const n = drawCards(ng, dyingSide, 1);
      if (n > 0) ng.log = pushLog(ng.log, `${card.nameZh} 亡語：${who}抽 ${n} 張牌`, my ? "info" : "sys");
      break;
    }
    case "summonSapling": {
      const board = my ? ng.pBoard : ng.eBoard;
      if (board.length < BOARD_MAX) {
        const sap = spawnMinion(TOKEN_SAPLING, false);
        if (my) ng.pBoard = [...ng.pBoard, sap];
        else ng.eBoard = [...ng.eBoard, sap];
        ng.log = pushLog(ng.log, `${card.nameZh} 亡語：召喚一個 2/2 幼樹`, my ? "info" : "sys");
      }
      break;
    }
    case "healOwnerHero2": {
      if (my) ng.playerHp = Math.min(HERO_HP, ng.playerHp + 2);
      else ng.enemyHp = Math.min(HERO_HP, ng.enemyHp + 2);
      ng.log = pushLog(ng.log, `${card.nameZh} 亡語：回復${who} 2 點`, my ? "info" : "sys");
      break;
    }
  }
}

/** 清場：把血量歸零的隨從移除，並依序觸發其亡語（亡語連鎖最多處理數輪）。 */
export function reap(ng: Game): Game {
  for (let pass = 0; pass < 4; pass++) {
    const deadP = ng.pBoard.filter((m) => m.health <= 0);
    const deadE = ng.eBoard.filter((m) => m.health <= 0);
    if (deadP.length === 0 && deadE.length === 0) break;
    ng.pBoard = ng.pBoard.filter((m) => m.health > 0);
    ng.eBoard = ng.eBoard.filter((m) => m.health > 0);
    for (const m of deadP) if (m.card.deathrattle) runDeathrattle(ng, "player", m.card);
    for (const m of deadE) if (m.card.deathrattle) runDeathrattle(ng, "enemy", m.card);
  }
  return ng;
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
    const hand = side === "player" ? ng.pHand : ng.eHand;
    if (hand.length >= HAND_MAX) break; // 手牌已滿，不再抽（不棄牌、不懲罰）
    // 牌庫抽空 → 立刻重新洗一副全新牌庫，確保永遠有牌可抽（無疲勞機制）
    if ((side === "player" ? ng.pDeck : ng.eDeck).length === 0) {
      const refill = buildDeck();
      if (side === "player") ng.pDeck = refill;
      else ng.eDeck = refill;
      ng.log = pushLog(
        ng.log,
        `${side === "player" ? "織者" : "山林試煉"}的牌庫已用盡，重新洗牌`,
        side === "player" ? "info" : "sys",
      );
    }
    const deck = side === "player" ? ng.pDeck : ng.eDeck;
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

  const minion = spawnMinion(card, isCorrect);
  const atk = minion.attack;
  const hp = minion.health;
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
        const sap = spawnMinion(TOKEN_SAPLING, false);
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
  return checkWinner(reap(ng));
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

  const sp = spellPower(ng, side); // 我方在場隨從提供的法術增幅
  let note = "";
  switch (card.effect) {
    case "dmgAny2":
    case "dmgAny5":
    case "dmgAny8": {
      const base = card.effect === "dmgAny2" ? 2 : card.effect === "dmgAny5" ? 5 : 8;
      const n = (card.effect === "dmgAny8" ? 8 : base + (isCorrect ? 1 : 0)) + sp;
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
      const n = (isCorrect ? 5 : 4) + sp;
      note = `對${hurtTarget(n)}造成 ${n} 點傷害`;
      break;
    }
    case "dmgEnemyMinion3": {
      const n = (isCorrect ? 4 : 3) + sp;
      note = `對${hurtTarget(n)}造成 ${n} 點傷害`;
      break;
    }
    case "dmgEnemyHero3": {
      const n = (isCorrect ? 4 : 3) + sp;
      dmgFoeHero(n);
      note = `對${foeHeroName}造成 ${n} 點傷害`;
      break;
    }
    case "aoeEnemy3": {
      const n = (isCorrect ? 4 : 3) + sp;
      setBoard(foeSide, aoe(getBoard(foeSide), n));
      note = `對所有敵方隨從造成 ${n} 點傷害`;
      break;
    }
    case "twoSuns": {
      dmgFoeHero(4 + sp);
      setBoard(foeSide, aoe(getBoard(foeSide), 1 + sp));
      if (!isCorrect) setBoard(side, aoe(getBoard(side), 1));
      note = isCorrect
        ? `對${foeHeroName}造成 ${4 + sp} 點傷害；敵方隨從各受 ${1 + sp} 點（我方免疫）`
        : `對${foeHeroName}造成 ${4 + sp} 點傷害；敵方隨從各受 ${1 + sp} 點、我方各受 1 點`;
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
  return checkWinner(reap(ng));
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
  if (!attacker || !attacker.canAttack || attacker.attack <= 0) return g;

  // 突襲：登場當回合不可攻擊英雄
  if (target.kind === "hero" && attacker.rushBound) return g;

  const legal = attackTargets(defBoard);
  if (target.kind === "hero" && !legal.heroAllowed) return g;
  if (target.kind === "minion" && !legal.keys.has(target.key)) return g;

  const tone: LogEntry["tone"] = my ? "info" : "sys";
  const healSide = (s: Side, n: number) => {
    if (n <= 0) return;
    if (s === "player") ng.playerHp = Math.min(HERO_HP, ng.playerHp + n);
    else ng.enemyHp = Math.min(HERO_HP, ng.enemyHp + n);
  };
  // 攻擊者攻擊後：疾風判斷是否還能再攻一次；潛行解除
  const markAttacked = (b: Minion[]) =>
    b.map((m) => {
      if (m.key !== attackerKey) return m;
      const used = (m.attacksUsed ?? 0) + 1;
      const maxA = m.windfury ? 2 : 1;
      return { ...m, attacksUsed: used, canAttack: used < maxA, stealth: false };
    });

  if (target.kind === "hero") {
    if (my) ng.enemyHp = Math.max(0, ng.enemyHp - attacker.attack);
    else ng.playerHp = Math.max(0, ng.playerHp - attacker.attack);
    if (attacker.lifesteal) healSide(side, attacker.attack); // 汲取：同額回復自己英雄
    if (my) ng.pBoard = markAttacked(ng.pBoard);
    else ng.eBoard = markAttacked(ng.eBoard);
    ng.log = pushLog(
      ng.log,
      `${attacker.card.nameZh} 攻擊${my ? "山林試煉" : "織者"} ${attacker.attack} 點${attacker.lifesteal ? "，汲取回復" : ""}`,
      tone,
    );
  } else {
    const t = defBoard.find((m) => m.key === target.key);
    if (!t) return g;
    // 傷害前快照（石鎧會吸收，實際造成傷害＝無盾時的攻擊力）
    const dealtToTarget = t.divineShield ? 0 : attacker.attack;
    const dealtToAttacker = attacker.divineShield ? 0 : t.attack;
    const defSide: Side = my ? "enemy" : "player";

    // 互相造成傷害（hurt 內含石鎧抵擋）
    if (my) {
      ng.eBoard = hurt(ng.eBoard, t.key, attacker.attack);
      ng.pBoard = hurt(ng.pBoard, attackerKey, t.attack);
      ng.pBoard = markAttacked(ng.pBoard);
    } else {
      ng.pBoard = hurt(ng.pBoard, t.key, attacker.attack);
      ng.eBoard = hurt(ng.eBoard, attackerKey, t.attack);
      ng.eBoard = markAttacked(ng.eBoard);
    }
    // 汲取：實際造成傷害才回復（石鎧抵擋則不回）
    if (attacker.lifesteal) healSide(side, dealtToTarget);
    if (t.lifesteal) healSide(defSide, dealtToAttacker);

    const notes: string[] = [];
    if (dealtToTarget === 0) notes.push("石鎧抵擋");
    if (attacker.lifesteal && dealtToTarget > 0) notes.push("汲取回復");
    ng.log = pushLog(
      ng.log,
      `${attacker.card.nameZh}（${attacker.attack}）換 ${t.card.nameZh}（${t.attack}）${notes.length ? "：" + notes.join("、") : ""}`,
      tone,
    );
  }
  return checkWinner(reap(ng));
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

/** 系統回合的最終盤面（供無頭模擬／非動畫路徑使用）。動畫路徑改用 enemyTurnFlow。 */
export function runEnemyTurn(g: Game, difficulty: Difficulty = "normal"): Game {
  return applyLast(enemyTurnFlow(g, difficulty), g);
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

  // 突襲：登場當回合只能打隨從（不可打臉）——沒有隨從可打就這回合放棄攻擊
  if (cur.rushBound) {
    if (cands.length === 0) return null;
    const killable = cands.filter((t) => cur.attack >= t.health).sort((a, b) => b.attack - a.attack);
    const pick = killable[0] ?? [...cands].sort((a, b) => b.attack - a.attack)[0];
    return { kind: "minion", side: "player", key: pick.key };
  }

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
  ng.pBoard = ng.pBoard.map((m) => ({ ...m, canAttack: true, attacksUsed: 0, rushBound: false }));
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

/** 單字題：隨機決定方向（中文找族語 / 族語找中文），同一張卡不會每次都長得一樣。 */
export function makeQuiz(card: Card): QuizState {
  const v = vocab(card.vocabId);
  const reverse = Math.random() < 0.5;
  // 多要幾個干擾候選（詞庫偶爾有同義重複詞，去重後才 slice(0,3)，確保選項一定湊滿 4 個）。
  const candidates = distractors(card.vocabId, 8);
  const options = reverse
    ? dedupeWithAnswer(v.chinese, candidates.map((d) => d.chinese), 3)
    : dedupeWithAnswer(v.word, candidates.map((d) => d.word), 3);
  return {
    card,
    prompt: reverse ? `「${v.word}」的中文意思是？` : `「${v.chinese}」的太魯閣族語是？`,
    options,
    answerIdx: options.indexOf(reverse ? v.chinese : v.word),
    word: v.word,
    chinese: v.chinese,
    kind: "word",
  };
}

/** 取正解＋最多 n 個文字不重複的干擾項並洗牌（詞庫偶爾有同義重複詞/句，重複會讓題目沒法作答）。 */
function dedupeWithAnswer(answer: string, candidates: string[], n: number): string[] {
  const seen = new Set([answer]);
  const uniq: string[] = [];
  for (const c of candidates) {
    if (uniq.length >= n) break;
    if (seen.has(c)) continue;
    seen.add(c);
    uniq.push(c);
  }
  return shuffle([answer, ...uniq]);
}

/** 困難模式：整句四選一（非拆詞卡重組，戰鬥節奏不被拖慢）。詞庫來源同 /sentences（2024 句真實例句）。 */
export function makeSentenceQuiz(card: Card): QuizState {
  const s = randomSentence();
  const options = shuffle([s.truku, ...sentenceDistractors(s, 3).map((d) => d.truku)]);
  return {
    card,
    prompt: `「${s.chinese}」的太魯閣語是？`,
    options,
    answerIdx: options.indexOf(s.truku),
    word: s.truku,
    chinese: s.chinese,
    kind: "sentence",
    audioUrl: s.audioUrl,
  };
}

// ───────────────────────── 戰鬥事件流（引擎產生有序事件＋快照；畫面逐一播放）─────────────────────────

function applyLast(steps: EventStep[], fallback: Game): Game {
  return steps.length ? steps[steps.length - 1].state : fallback;
}

function heroAnchor(side: Side): Anchor {
  return side === "player" ? "heroPlayer" : "heroEnemy";
}

/** 攻擊/法術目標 → 錨點字串（hero 目標＝施放者的對方英雄）。 */
function targetAnchor(side: Side, target: Target): Anchor {
  if (target.kind === "hero") return heroAnchor(side === "player" ? "enemy" : "player");
  return target.key;
}

const SPELL_VFX: Record<string, SpellVfx> = {
  dmgAny2: "damage",
  dmgAny5: "damage",
  dmgAny8: "damage",
  dmgMinion4: "damage",
  dmgEnemyMinion3: "damage",
  dmgEnemyHero3: "damage",
  aoeEnemy3: "aoe",
  twoSuns: "aoe",
  floodAll4: "aoe",
  healHero5: "heal",
  healHero8: "heal",
  draw1: "draw",
  draw2: "draw",
  allFriendStealth: "buff",
  friendTaunt03: "buff",
  buffFriend11: "buff",
  shuffleBackEnemy: "damage",
};
function spellVfxFor(card: Card): SpellVfx {
  return (card.effect && SPELL_VFX[card.effect]) || "damage";
}

/** 比較前後盤面，推導 SUMMON / DAMAGE / HEAL / DEATH（英雄與雙方隨從）。 */
function deriveHits(before: Game, after: Game): CombatEvent[] {
  const evs: CombatEvent[] = [];
  const heroDelta = (bHp: number, aHp: number, anchor: Anchor) => {
    if (aHp < bHp) evs.push({ t: "DAMAGE", anchor, amount: bHp - aHp });
    else if (aHp > bHp) evs.push({ t: "HEAL", anchor, amount: aHp - bHp });
  };
  heroDelta(before.playerHp, after.playerHp, "heroPlayer");
  heroDelta(before.enemyHp, after.enemyHp, "heroEnemy");
  (["player", "enemy"] as Side[]).forEach((side) => {
    const b = side === "player" ? before.pBoard : before.eBoard;
    const a = side === "player" ? after.pBoard : after.eBoard;
    const bMap = new Map(b.map((m) => [m.key, m]));
    const aMap = new Map(a.map((m) => [m.key, m]));
    for (const m of a) {
      const pm = bMap.get(m.key);
      if (!pm) evs.push({ t: "SUMMON", side, key: m.key });
      else if (m.health < pm.health) evs.push({ t: "DAMAGE", anchor: m.key, amount: pm.health - m.health });
      else if (m.health > pm.health) evs.push({ t: "HEAL", anchor: m.key, amount: m.health - pm.health });
    }
    for (const m of b) if (!aMap.has(m.key)) evs.push({ t: "DEATH", side, key: m.key });
  });
  return evs;
}

/** 玩家出牌（已答題）→ 事件流。回空陣列代表不合法。 */
export function playCardFlow(g: Game, card: Card, isCorrect: boolean, target?: Target): EventStep[] {
  const committed = commitCard(g, card, isCorrect);
  if (!committed) return [];
  const steps: EventStep[] = [
    { event: { t: "CARD_PLAY", side: "player", cardId: card.id, isCorrect }, state: committed },
  ];
  if (card.type === "minion") {
    const after = playMinionFor(committed, "player", card, isCorrect);
    for (const e of deriveHits(committed, after)) steps.push({ event: e, state: after });
  } else {
    const after = castSpell(committed, "player", card, isCorrect, target);
    const anchors = target ? [targetAnchor("player", target)] : [];
    steps.push({
      event: { t: "SPELL", side: "player", cardId: card.id, vfx: spellVfxFor(card), anchors },
      state: after,
    });
    for (const e of deriveHits(committed, after)) steps.push({ event: e, state: after });
  }
  return steps;
}

/** 攻擊 → 事件流（蓄力→突進→命中→傷害/死亡）。回空陣列代表不合法。 */
export function attackFlow(g: Game, side: Side, attackerKey: string, target: Target): EventStep[] {
  const after = resolveAttack(g, side, attackerKey, target);
  if (after === g) return [];
  const anchor = targetAnchor(side, target);
  const steps: EventStep[] = [
    { event: { t: "ATTACK_WINDUP", side, key: attackerKey }, state: g },
    { event: { t: "ATTACK_LUNGE", side, key: attackerKey, target: anchor }, state: g },
    { event: { t: "IMPACT", anchor }, state: after },
  ];
  for (const e of deriveHits(g, after)) steps.push({ event: e, state: after });
  return steps;
}

/** 玩家回合開始：回合旗標 → 法力刷新 → 抽牌。 */
export function startTurnFlow(g: Game): EventStep[] {
  const after = startPlayerTurn(g);
  const steps: EventStep[] = [
    { event: { t: "TURN_START", side: "player", turn: after.turn }, state: after },
    { event: { t: "MANA_REFRESH", side: "player" }, state: after },
  ];
  const drew = after.pHand.length - g.pHand.length;
  if (drew > 0) steps.push({ event: { t: "DRAW", side: "player", count: drew }, state: after });
  return steps;
}

/** 玩家結束回合：回合結束效果 → TURN_END（切到敵方 phase）。 */
export function endTurnFlow(g: Game): EventStep[] {
  const eot = checkWinner(endOfTurnEffects(g, "player"));
  const steps: EventStep[] = [];
  for (const e of deriveHits(g, eot)) steps.push({ event: e, state: eot });
  const handoff: Game = { ...eot, phase: eot.winner ? "over" : "enemy" };
  steps.push({ event: { t: "TURN_END", side: "player" }, state: handoff });
  return steps;
}

/** 系統（AI）整個回合 → 有序事件流。行為對齊原 runEnemyTurn（同樣的隨機序）。 */
export function enemyTurnFlow(g: Game, difficulty: Difficulty = "normal"): EventStep[] {
  const steps: EventStep[] = [];
  let ng = cloneGame(g);
  ng.eMaxMana = Math.min(ng.eMaxMana + 1, 10);
  let mana = ng.eMaxMana;
  steps.push({ event: { t: "TURN_START", side: "enemy", turn: ng.turn }, state: ng });
  steps.push({ event: { t: "MANA_REFRESH", side: "enemy" }, state: ng });

  const preDraw = ng;
  ng = cloneGame(ng);
  drawCards(ng, "enemy", 1);
  const drew = ng.eHand.length - preDraw.eHand.length;
  if (drew > 0) steps.push({ event: { t: "DRAW", side: "enemy", count: drew }, state: ng });
  ng = { ...ng, eBoard: ng.eBoard.map((m) => ({ ...m, canAttack: true, attacksUsed: 0, rushBound: false })) };

  const bonusChance = AI_BONUS_CHANCE[difficulty];

  let guard = 24;
  while (guard-- > 0 && !ng.winner) {
    if (difficulty === "easy" && Math.random() < 0.25) break;
    const playable = ng.eHand.map((c, i) => ({ c, i })).filter((x) => aiCanPlay(ng, x.c, mana));
    if (playable.length === 0) break;
    playable.sort((a, b) => b.c.cost - a.c.cost);
    let pick = playable[0];
    if (difficulty === "hard" && ng.eBoard.length < 3) {
      const minionPick = playable.find((x) => x.c.type === "minion");
      if (minionPick) pick = minionPick;
    }
    const { c, i } = pick;
    const before: Game = { ...ng, eHand: ng.eHand.filter((_, j) => j !== i) };
    mana -= c.cost;
    const isCorrect = Math.random() < bonusChance;
    let after: Game;
    steps.push({ event: { t: "CARD_PLAY", side: "enemy", cardId: c.id, isCorrect }, state: before });
    if (c.type === "minion") {
      after = playMinionFor(before, "enemy", c, isCorrect);
    } else {
      const tgt = aiSpellTarget(before, c);
      after = castSpell(before, "enemy", c, isCorrect, tgt);
      const anchors = tgt ? [targetAnchor("enemy", tgt)] : [];
      steps.push({ event: { t: "SPELL", side: "enemy", cardId: c.id, vfx: spellVfxFor(c), anchors }, state: after });
    }
    for (const e of deriveHits(before, after)) steps.push({ event: e, state: after });
    ng = after;
  }

  if (!ng.winner) ng = enemyAttackFlow(ng, difficulty, steps);
  if (!ng.winner) {
    const after = endOfTurnEffects(ng, "enemy");
    for (const e of deriveHits(ng, after)) steps.push({ event: e, state: after });
    ng = checkWinner(after);
  }
  steps.push({ event: { t: "TURN_END", side: "enemy" }, state: ng });
  return steps;
}

/** 系統攻擊階段（emit 事件版）；回傳最終盤面。行為對齊原 runEnemyAttacks。 */
function enemyAttackFlow(g: Game, difficulty: Difficulty, steps: EventStep[]): Game {
  let ng = g;
  const pushAttack = (before: Game, attackerKey: string, target: Target): Game => {
    const after = resolveAttack(before, "enemy", attackerKey, target);
    if (after === before) return before;
    const anchor = targetAnchor("enemy", target);
    steps.push({ event: { t: "ATTACK_WINDUP", side: "enemy", key: attackerKey }, state: before });
    steps.push({ event: { t: "ATTACK_LUNGE", side: "enemy", key: attackerKey, target: anchor }, state: before });
    steps.push({ event: { t: "IMPACT", anchor }, state: after });
    for (const e of deriveHits(before, after)) steps.push({ event: e, state: after });
    return after;
  };

  if (difficulty === "hard") {
    const taunts = ng.pBoard.filter((m) => m.taunt && !m.stealth);
    const ready = ng.eBoard.filter((m) => m.canAttack && m.attack > 0);
    const totalAtk = ready.reduce((s, m) => s + m.attack, 0);
    if (taunts.length === 0 && totalAtk >= ng.playerHp) {
      for (const m of ready) {
        if (ng.winner) break;
        ng = pushAttack(ng, m.key, { kind: "hero" });
      }
      return ng;
    }
  }

  // 讓某隻這回合不再被選為攻擊者（突襲無目標／攻擊被拒時退場，避免卡住其他可攻擊者）
  const retire = (state: Game, key: string): Game => ({
    ...state,
    eBoard: state.eBoard.map((m) => (m.key === key ? { ...m, canAttack: false } : m)),
  });

  let guard = 24;
  while (!ng.winner && guard-- > 0) {
    const cur = ng.eBoard.find((m) => m.canAttack && m.attack > 0);
    if (!cur) break;
    const legal = attackTargets(ng.pBoard);
    const target = chooseEnemyAttackTarget(ng, cur, legal, difficulty);
    if (!target) {
      ng = retire(ng, cur.key);
      continue;
    }
    const after = pushAttack(ng, cur.key, target);
    if (after === ng) {
      ng = retire(ng, cur.key);
      continue;
    }
    ng = after;
  }
  return ng;
}
