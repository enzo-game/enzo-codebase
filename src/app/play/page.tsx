"use client";

import Link from "next/link";
import { Noto_Serif_TC } from "next/font/google";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { CARDS, Card, RARITY_COLOR, Rarity, Theme, TOKEN_SAPLING } from "@/data/cards";
import { vocab, distractors, audioUrl } from "@/data/truku";
import AmbientAudio from "@/components/AmbientAudio";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxArrive, sfxLose } from "@/lib/sfx";

// ───────────────────────── 型別 ─────────────────────────

type Side = "player" | "enemy";

type Minion = {
  key: string;
  card: Card;
  attack: number;
  health: number;
  maxHealth: number;
  canAttack: boolean;
  taunt: boolean;
  stealth: boolean;
  bonus: boolean;
};

type LogEntry = { key: string; text: string; tone: "good" | "bad" | "sys" | "info" };

type Phase = "player" | "enemy" | "over";

type Game = {
  phase: Phase;
  turn: number;
  playerHp: number;
  enemyHp: number;
  pMaxMana: number;
  pMana: number;
  pDeck: Card[];
  pHand: Card[];
  pBoard: Minion[];
  eMaxMana: number;
  eDeck: Card[];
  eHand: Card[];
  eBoard: Minion[];
  log: LogEntry[];
  correct: number;
  wrong: number;
  winner: Side | null;
};

/** 攻擊或法術的指定目標（hero＝施放者的敵方英雄） */
type Target = { kind: "hero" } | { kind: "minion"; side: Side; key: string };

type TargetKind = "none" | "any" | "anyMinion" | "enemyMinion" | "friendMinion";

type QuizState = {
  card: Card;
  prompt: string;
  options: string[];
  answerIdx: number;
  word: string;
  chinese: string;
};

// 卡名用襯線字（比照 /journey 的標題字），像收藏卡的名條
const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

const HERO_HP = 30;
const BOARD_MAX = 7;
const HAND_MAX = 10;

// ───────────────────────── 圖示（比照 /journey ORDER-039：全面移除表情符號）─────────────────────────
// 一律用線稿 SVG 圖示，不用彩色 emoji 圖形字元。統一 24×24 viewBox、currentColor 描邊，
// 可用 text-* class 跟著文字變色。✓ ✕ ○ ★ ▶ ◀ 等純排版符號（非彩色 emoji）維持不變。
type IconProps = { className?: string };
function IconCheck({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}
function IconCross({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}
function IconMountain({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 19l6-11 4 6 2-3 6 8z" />
    </svg>
  );
}
function IconRain({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 15.5a4 4 0 01.5-8 5 5 0 019.4 2.1A3.5 3.5 0 0116 17H8" />
      <path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2" />
    </svg>
  );
}
function IconHeart({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20s-7-4.4-9.5-9A5.5 5.5 0 0112 5.8 5.5 5.5 0 0121.5 11c-2.5 4.6-9.5 9-9.5 9z" />
    </svg>
  );
}
function IconPerson({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M5 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5" />
    </svg>
  );
}
function IconPaw({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="15" r="4" />
      <circle cx="6" cy="9" r="2" />
      <circle cx="18" cy="9" r="2" />
      <circle cx="9.5" cy="5.5" r="1.7" />
      <circle cx="14.5" cy="5.5" r="1.7" />
    </svg>
  );
}
function IconLeaf({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z" />
      <path d="M5 19c3-3 6-6 10-10" />
    </svg>
  );
}
function IconBow({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3a15 15 0 000 18" />
      <path d="M6 12h14" />
      <path d="M17 9l3 3-3 3" />
    </svg>
  );
}
function IconScroll({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h11a2 2 0 012 2v12a2 2 0 01-2 2H8a3 3 0 01-3-3V6a2 2 0 00-2-2h4z" />
      <path d="M9 9h7M9 13h7" />
    </svg>
  );
}

// 卡牌題材圖示（傳說系列用卷軸線稿；person 主題已隨 v1 卡表淘汰）
const THEME_ICON = {
  legend: IconScroll,
  animal: IconPaw,
  plant: IconLeaf,
  nature: IconMountain,
  tool: IconBow,
} satisfies Record<Theme, (props: IconProps) => JSX.Element>;

// ───────────────────────── 卡面美術（ORDER-044，enzo-culture 複核 35/35 通過）─────────────────────────
// 依卡 id 對應卡面圖；沒有對應圖的卡維持原本純文字版型（UI 必須容忍缺圖）。

const CARD_ART: Record<string, string> = {
  "leg-l01": "/images/cards/l01-millet.jpg",
  "leg-l02": "/images/cards/l02-bow.jpg",
  "leg-l03": "/images/cards/l03-footprint.jpg",
  "leg-l04": "/images/cards/l04-flashflood.jpg",
  "leg-l05": "/images/cards/l05-crystal.jpg",
  "leg-l06": "/images/cards/l06-twosuns.jpg",
  "leg-l07": "/images/cards/l07-rainbow.jpg",
  "leg-l08": "/images/cards/l08-arrow.jpg",
  "leg-l09": "/images/cards/l09-flood.jpg",
  "leg-l10": "/images/cards/l10-pusuqhuni.jpg",
  "leg-l11": "/images/cards/l11-mawi.jpg",
  "leg-n01": "/images/cards/n01-stars.jpg",
  "leg-n02": "/images/cards/n02-fog.jpg",
  "leg-n03": "/images/cards/n03-thunder.jpg",
  "leg-n04": "/images/cards/n04-moon.jpg",
  "leg-n05": "/images/cards/n05-mist.jpg",
  "leg-n06": "/images/cards/n06-lightning.jpg",
  "leg-n07": "/images/cards/n07-typhoon.jpg",
  "leg-a01": "/images/cards/a01-muntjac.jpg",
  "leg-a02": "/images/cards/a02-boar.jpg",
  "leg-a03": "/images/cards/a03-squirrel.jpg",
  "leg-a04": "/images/cards/a04-dog.jpg",
  "leg-a05": "/images/cards/a05-waterbird.jpg",
  "leg-a06": "/images/cards/a06-pangolin.jpg",
  "leg-a07": "/images/cards/a07-leopard.jpg",
  "leg-a08": "/images/cards/a08-sambar.jpg",
  "leg-a09": "/images/cards/a09-bear.jpg",
  "leg-p01": "/images/cards/p01-wade.jpg",
  "leg-p02": "/images/cards/p02-trap.jpg",
  "leg-p03": "/images/cards/p03-mushroom.jpg",
  "leg-p04": "/images/cards/p04-hearth.jpg",
  "leg-p05": "/images/cards/p05-cypress.jpg",
  "leg-token-sapling": "/images/cards/token-sapling.jpg",
};

// 稀有度 → 卡框光暈（史詩靜態紫暈、傳說琥珀呼吸暈；樣式見 globals.css .hs-glow-*）
const RARITY_GLOW: Record<Rarity, string> = {
  common: "",
  rare: "",
  epic: "hs-glow-epic",
  legendary: "hs-glow-legendary",
};

const RARITY_ZH: Record<Rarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史詩",
  legendary: "傳說",
};

// ───────────────────────── 切面寶石（費用／攻擊／生命指示器）─────────────────────────
// 依司令規格：費用＝藍寶石六角柱切、攻擊＝琥珀石六角切、生命＝紅寶石盾形切。
// 小型 SVG：深色鑲邊（bezel）→ 漸層主體 → 三角切面（亮／暗面）→ 白色高光點。
// 文化紅線：輪廓一律避開菱形（祖靈之眼紋樣），切面也只用三角形，不出現菱形塊面。

/** 寶石漸層共用定義：整頁 render 一次，供所有 StatGem 以 url(#…) 引用 */
function GemDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="gemSapphire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#0284c7" />
          <stop offset="1" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="gemAmber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="0.55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="gemRuby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.55" stopColor="#e11d48" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type GemKind = "cost" | "atk" | "hp";

/** 藍寶石：直立六角柱切（尖頂尖底、左右直邊，六邊形非菱形） */
function GemShapeCost() {
  return (
    <>
      <polygon points="12,0.8 21.5,6.6 21.5,17.4 12,23.2 2.5,17.4 2.5,6.6" fill="#0c2f45" stroke="#bae6fd" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <polygon points="12,2.8 19.7,7.6 19.7,16.4 12,21.2 4.3,16.4 4.3,7.6" fill="url(#gemSapphire)" />
      <polygon points="12,2.8 4.3,7.6 12,12.2" fill="#ffffff" opacity="0.34" />
      <polygon points="12,2.8 19.7,7.6 12,12.2" fill="#ffffff" opacity="0.18" />
      <polygon points="4.3,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.14" />
      <polygon points="19.7,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.26" />
      <circle cx="8.2" cy="6.6" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

/** 琥珀石：平頂六角切 */
function GemShapeAtk() {
  return (
    <>
      <polygon points="6,1.2 18,1.2 23.3,12 18,22.8 6,22.8 0.7,12" fill="#5b3308" stroke="#fde68a" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <polygon points="7.1,3.1 16.9,3.1 21.2,12 16.9,20.9 7.1,20.9 2.8,12" fill="url(#gemAmber)" />
      <polygon points="7.1,3.1 16.9,3.1 12,12" fill="#ffffff" opacity="0.3" />
      <polygon points="7.1,3.1 2.8,12 12,12" fill="#ffffff" opacity="0.16" />
      <polygon points="2.8,12 7.1,20.9 12,12" fill="#000000" opacity="0.14" />
      <polygon points="7.1,20.9 16.9,20.9 12,12" fill="#000000" opacity="0.26" />
      <polygon points="21.2,12 16.9,20.9 12,12" fill="#000000" opacity="0.18" />
      <circle cx="8.6" cy="6" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

/** 紅寶石：盾形切 */
function GemShapeHp() {
  return (
    <>
      <path d="M12 0.8 L21.6 4.6 V11.4 C21.6 17.5 12 23.2 12 23.2 C12 23.2 2.4 17.5 2.4 11.4 V4.6 Z" fill="#4c0519" stroke="#fecdd3" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <path d="M12 2.8 L19.7 5.9 V11.2 C19.7 16.2 12 20.9 12 20.9 C12 20.9 4.3 16.2 4.3 11.2 V5.9 Z" fill="url(#gemRuby)" />
      <polygon points="12,2.8 4.3,5.9 12,11.6" fill="#ffffff" opacity="0.32" />
      <polygon points="12,2.8 19.7,5.9 12,11.6" fill="#ffffff" opacity="0.16" />
      <polygon points="4.3,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.14" />
      <polygon points="19.7,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.26" />
      <circle cx="8.4" cy="6.4" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

const GEM_SHAPE: Record<GemKind, () => JSX.Element> = {
  cost: GemShapeCost,
  atk: GemShapeAtk,
  hp: GemShapeHp,
};

function StatGem({
  kind,
  value,
  size = "md",
  tone = "text-white",
  className = "",
}: {
  kind: GemKind;
  value: number;
  size?: "md" | "sm";
  tone?: string;
  className?: string;
}) {
  const Shape = GEM_SHAPE[kind];
  return (
    <span className={`hs-gem hs-gem-${size} ${className}`}>
      <svg viewBox="0 0 24 24" className="block w-full h-full" aria-hidden focusable="false">
        <Shape />
      </svg>
      <span className={`hs-gem-num ${tone}`}>{value}</span>
    </span>
  );
}

const BOARD_BG = "/images/cards/board-battle.jpg";
const CARDBACK = "/images/cards/cardback.jpg";

// ───────────────────────── 工具 ─────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const uid = () => Math.random().toString(36).slice(2);

function pushLog(log: LogEntry[], text: string, tone: LogEntry["tone"]): LogEntry[] {
  return [{ key: uid(), text, tone }, ...log].slice(0, 12);
}

function cloneGame(g: Game): Game {
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
function hurt(board: Minion[], key: string, n: number): Minion[] {
  return board
    .map((m) => (m.key === key ? { ...m, health: m.health - n } : m))
    .filter((m) => m.health > 0);
}

/** 對整排隨從造成傷害（AoE 不受潛行保護） */
function aoe(board: Minion[], n: number): Minion[] {
  return board.map((m) => ({ ...m, health: m.health - n })).filter((m) => m.health > 0);
}

function checkWinner(g: Game): Game {
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

function spellTargetKind(card: Card): TargetKind {
  if (card.type !== "spell" || !card.effect) return "none";
  return SPELL_TARGET[card.effect] ?? "none";
}

/** 玩家視角：這種目標類型目前有沒有合法目標可選 */
function hasValidTarget(g: Game, kind: TargetKind): boolean {
  if (kind === "none" || kind === "any") return true; // any 永遠可打敵方英雄
  const enemyOk = g.eBoard.some((m) => !m.stealth);
  if (kind === "enemyMinion") return enemyOk;
  if (kind === "friendMinion") return g.pBoard.length > 0;
  return enemyOk || g.pBoard.length > 0; // anyMinion（我方隨從一律可指定）
}

// ───────────────────────── 攻擊規則（嘲諷／潛行）─────────────────────────

/** 攻擊方可指定的防守目標：有（未潛行的）嘲諷者就必須先打嘲諷 */
function attackTargets(defBoard: Minion[]): { heroAllowed: boolean; keys: Set<string>; mustTaunt: boolean } {
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
function drawCards(ng: Game, side: Side, n: number): number {
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

function playMinionFor(g: Game, side: Side, card: Card, isCorrect: boolean): Game {
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

function castSpell(g: Game, side: Side, card: Card, isCorrect: boolean, target?: Target): Game {
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
function commitCard(g: Game, card: Card, isCorrect: boolean): Game | null {
  const idx = g.pHand.findIndex((c) => c.id === card.id);
  if (idx === -1 || card.cost > g.pMana) return null;
  const ng = cloneGame(g);
  ng.pHand = ng.pHand.filter((_, i) => i !== idx);
  ng.pMana -= card.cost;
  if (isCorrect) ng.correct += 1;
  else ng.wrong += 1;
  return ng;
}

function playCardResolved(g: Game, card: Card, isCorrect: boolean, target?: Target): Game {
  const ng = commitCard(g, card, isCorrect);
  if (!ng) return g;
  if (card.type === "minion") return playMinionFor(ng, "player", card, isCorrect);
  return castSpell(ng, "player", card, isCorrect, target);
}

// ───────────────────────── 攻擊結算（雙方共用，含嘲諷／潛行）─────────────────────────

function resolveAttack(g: Game, side: Side, attackerKey: string, target: Target): Game {
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

function endOfTurnEffects(g: Game, side: Side): Game {
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

function aiCanPlay(ng: Game, c: Card, mana: number): boolean {
  if (c.cost > mana) return false;
  if (c.type === "minion") return ng.eBoard.length < BOARD_MAX;
  const kind = spellTargetKind(c);
  // AI 視角：敵方隨從＝玩家隨從（潛行不可指定）
  if (kind === "enemyMinion" || kind === "anyMinion") return ng.pBoard.some((m) => !m.stealth);
  if (kind === "friendMinion") return ng.eBoard.length > 0;
  return true;
}

function aiSpellTarget(ng: Game, c: Card): Target | undefined {
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

function runEnemyTurn(g: Game): Game {
  let ng = cloneGame(g);
  ng.eMaxMana = Math.min(ng.eMaxMana + 1, 10);
  let mana = ng.eMaxMana;

  drawCards(ng, "enemy", 1);
  ng.eBoard = ng.eBoard.map((m) => ({ ...m, canAttack: true }));

  // 出牌：出得起就出，費用高的優先（戰吼／法術一律基礎效果，AI 不答題）
  let guard = 24;
  while (guard-- > 0 && !ng.winner) {
    const playable = ng.eHand
      .map((c, i) => ({ c, i }))
      .filter((x) => aiCanPlay(ng, x.c, mana))
      .sort((a, b) => b.c.cost - a.c.cost);
    if (playable.length === 0) break;
    const { c, i } = playable[0];
    ng.eHand = ng.eHand.filter((_, j) => j !== i);
    mana -= c.cost;
    if (c.type === "minion") {
      ng = playMinionFor(ng, "enemy", c, false);
    } else {
      const target = aiSpellTarget(ng, c);
      ng = castSpell(ng, "enemy", c, false, target);
    }
  }
  if (ng.winner) return ng;

  // 攻擊：遵守嘲諷／潛行——先解會致命的嘲諷，否則找有價值的換血，否則打臉
  let guard2 = 24;
  while (!ng.winner && guard2-- > 0) {
    const cur = ng.eBoard.find((m) => m.canAttack && m.attack > 0);
    if (!cur) break;
    const legal = attackTargets(ng.pBoard);
    let target: Target;
    if (!legal.heroAllowed) {
      const taunts = ng.pBoard.filter((m) => legal.keys.has(m.key));
      const killable = taunts.filter((t) => cur.attack >= t.health).sort((a, b) => b.attack - a.attack);
      const pick = killable[0] ?? [...taunts].sort((a, b) => b.attack - a.attack)[0];
      if (!pick) break;
      target = { kind: "minion", side: "player", key: pick.key };
    } else {
      const cands = ng.pBoard.filter((m) => legal.keys.has(m.key));
      const trade = cands
        .filter((t) => cur.attack >= t.health && t.attack >= 3)
        .sort((a, b) => b.attack - a.attack)[0];
      target = trade ? { kind: "minion", side: "player", key: trade.key } : { kind: "hero" };
    }
    const after = resolveAttack(ng, "enemy", cur.key, target);
    if (after === ng) break; // 防呆：攻擊沒有生效就跳出
    ng = after;
  }
  if (ng.winner) return ng;

  ng = endOfTurnEffects(ng, "enemy");
  return checkWinner(ng);
}

function startPlayerTurn(g: Game): Game {
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
function buildDeck(): Card[] {
  return shuffle(
    CARDS.flatMap((c) => (c.rarity === "common" || c.rarity === "rare" ? [c, c] : [c])),
  );
}

function newGame(): Game {
  const p = buildDeck();
  const e = buildDeck();
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

// ───────────────────────── 答題（真實太魯閣語詞庫）─────────────────────────

function makeQuiz(card: Card): QuizState {
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

function playVocabAudio(id: string) {
  const url = audioUrl(id);
  if (!url) return;
  try {
    const a = new Audio(url);
    a.play().catch(() => {});
  } catch {
    // 音檔失敗不阻斷流程
  }
}

// ───────────────────────── 元件 ─────────────────────────

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<Game>(() => newGame());
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ card: Card; isCorrect: boolean } | null>(null);

  useEffect(() => {
    // 刻意的客戶端 mount 初始化：newGame() 內含 Math.random()，須在 client 產生以避免 SSR/CSR hydration 不一致
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setGame(newGame());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 終局音效：勝利 / 落敗（中性 UI 完成音，非族樂）
  const winner = game.winner;
  useEffect(() => {
    if (winner === "player") sfxArrive();
    else if (winner === "enemy") sfxLose();
  }, [winner]);

  function reset() {
    setQuiz(null);
    setRevealed(null);
    setSelected(null);
    setPending(null);
    setGame(newGame());
  }

  function tryPlay(card: Card) {
    if (game.phase !== "player" || game.winner || pending || quiz) return;
    if (card.cost > game.pMana) return;
    if (card.type === "minion" && game.pBoard.length >= BOARD_MAX) {
      setGame((g) => ({ ...g, log: pushLog(g.log, "戰場已滿（上限 7 個隨從）。", "info") }));
      return;
    }
    const kind = spellTargetKind(card);
    if (!hasValidTarget(game, kind)) {
      setGame((g) => ({ ...g, log: pushLog(g.log, `「${card.nameZh}」目前沒有合法目標。`, "info") }));
      return;
    }
    setSelected(null);
    setRevealed(null);
    setQuiz(makeQuiz(card));
  }

  function answer(idx: number) {
    if (!quiz || revealed !== null) return;
    const isCorrect = idx === quiz.answerIdx;
    if (isCorrect) sfxCorrect();
    else sfxWrong();
    setRevealed(idx);
    // 揭曉後自動播一次正解發音（視聽同步），結算改由玩家自己按「繼續 ▶」
    const vocabId = quiz.card.vocabId;
    setTimeout(() => playVocabAudio(vocabId), 400);
  }

  /** 「繼續 ▶」：關閉答題視窗並結算出牌（需要目標的法術先進入選目標模式） */
  function continueAfterQuiz() {
    if (!quiz || revealed === null) return;
    const isCorrect = revealed === quiz.answerIdx;
    const card = quiz.card;
    setQuiz(null);
    setRevealed(null);
    sfxPlayCard();
    const kind = spellTargetKind(card);
    if (card.type === "spell" && kind !== "none") {
      setPending({ card, isCorrect });
    } else {
      setGame((g) => playCardResolved(g, card, isCorrect));
    }
  }

  function castPendingAt(target: Target) {
    if (!pending) return;
    const { card, isCorrect } = pending;
    setPending(null);
    setGame((g) => playCardResolved(g, card, isCorrect, target));
  }

  const pendingKind: TargetKind = pending ? spellTargetKind(pending.card) : "none";
  const atkLegal = attackTargets(game.eBoard);

  function onPlayerMinion(key: string) {
    if (game.phase !== "player" || game.winner) return;
    if (pending) {
      if (pendingKind === "friendMinion" || pendingKind === "anyMinion") {
        castPendingAt({ kind: "minion", side: "player", key });
      }
      return;
    }
    const m = game.pBoard.find((x) => x.key === key);
    if (!m || !m.canAttack) return;
    setSelected((s) => (s === key ? null : key));
  }

  function onEnemyMinion(key: string) {
    if (game.phase !== "player" || game.winner) return;
    const m = game.eBoard.find((x) => x.key === key);
    if (!m) return;
    if (pending) {
      if ((pendingKind === "any" || pendingKind === "anyMinion" || pendingKind === "enemyMinion") && !m.stealth) {
        castPendingAt({ kind: "minion", side: "enemy", key });
      }
      return;
    }
    if (!selected || !atkLegal.keys.has(key)) return;
    setGame((g) => resolveAttack(g, "player", selected, { kind: "minion", side: "enemy", key }));
    setSelected(null);
  }

  function onEnemyHero() {
    if (game.phase !== "player" || game.winner) return;
    if (pending) {
      if (pendingKind === "any") castPendingAt({ kind: "hero" });
      return;
    }
    if (!selected || !atkLegal.heroAllowed) return;
    setGame((g) => resolveAttack(g, "player", selected, { kind: "hero" }));
    setSelected(null);
  }

  function endTurn() {
    if (game.phase !== "player" || game.winner || pending || quiz) return;
    setSelected(null);
    setGame((g) => {
      const afterEot = checkWinner(endOfTurnEffects(g, "player"));
      return { ...afterEot, phase: afterEot.winner ? "over" : "enemy" };
    });
    setTimeout(() => {
      setGame((g) => {
        if (g.winner) return g;
        const afterEnemy = runEnemyTurn(g);
        if (afterEnemy.winner) return afterEnemy;
        return startPlayerTurn(afterEnemy);
      });
    }, 700);
  }

  const total = game.correct + game.wrong;
  const rate = total === 0 ? 0 : Math.round((game.correct / total) * 100);

  if (!mounted) return <main className="min-h-screen bg-slate-950" />;

  const enemyHeroTargetable =
    game.phase === "player" &&
    !game.winner &&
    ((pending !== null && pendingKind === "any") || (selected !== null && !pending && atkLegal.heroAllowed));

  const enemyMinionTargetable = (m: Minion): boolean => {
    if (game.phase !== "player" || game.winner !== null) return false;
    if (pending) {
      return (
        (pendingKind === "any" || pendingKind === "anyMinion" || pendingKind === "enemyMinion") && !m.stealth
      );
    }
    return selected !== null && atkLegal.keys.has(m.key);
  };

  const friendMinionTargetable = pending !== null && (pendingKind === "friendMinion" || pendingKind === "anyMinion");

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 p-3 sm:p-5">
      <AmbientAudio />
      <GemDefs />
      <div className="max-w-5xl mx-auto">
        {/* 標題列 */}
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
                ◀ 模式選擇
              </Link>
              <span className="text-[10px] rounded-full bg-sky-500/80 text-black px-2 py-0.5">
                模式 B
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">峽谷行者 · 山林試煉（vs 系統）</h1>
            <p className="text-[11px] text-slate-400">
              傳說牌組：出牌先答太魯閣族語題（真實詞庫，揭曉後自動播發音），答對觸發加成效果。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-slate-800 px-2 py-1">回合 {game.turn}</span>
            <span className="rounded bg-sky-900/60 px-2 py-1">
              法力 {game.pMana}/{game.pMaxMana}
            </span>
            <span className="rounded bg-emerald-900/60 px-2 py-1">命中 {rate}%</span>
          </div>
        </header>

        {/* 系統（敵方）英雄 */}
        <section className="mb-2">
          <button
            onClick={onEnemyHero}
            disabled={!enemyHeroTargetable}
            className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 transition
              ${enemyHeroTargetable ? "border-rose-400 bg-rose-950/40 hover:bg-rose-900/50 cursor-pointer" : "border-slate-800 bg-slate-900/50"}`}
          >
            <span className="text-sm font-semibold flex items-center gap-1">
              <IconMountain className="w-3.5 h-3.5 shrink-0" /> 山林試煉（系統）
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARDBACK} alt="" className="w-4 h-5 rounded-[3px] object-cover border border-slate-600 ml-1" />
              <span className="text-[10px] text-slate-500">手牌 {game.eHand.length} · 牌庫 {game.eDeck.length}</span>
            </span>
            <span className="text-rose-300 font-bold flex items-center gap-1">
              <IconHeart className="w-3.5 h-3.5 shrink-0" /> {game.enemyHp}/{HERO_HP}
            </span>
          </button>
          {selected && !pending && atkLegal.mustTaunt && (
            <p className="text-[11px] text-amber-300 mt-1">
              敵方有嘲諷隨從，必須先攻擊嘲諷者（無法打英雄或其他隨從）。
            </p>
          )}
          {pending && (
            <p className="text-[11px] text-amber-300 mt-1">
              選擇「{pending.card.nameZh}」的目標
              {pendingKind === "any" && "（任一隨從或敵方英雄）"}
              {pendingKind === "anyMinion" && "（任一隨從）"}
              {pendingKind === "enemyMinion" && "（一個敵方隨從，潛行者不可指定）"}
              {pendingKind === "friendMinion" && "（一個友方隨從）"}
            </p>
          )}
        </section>

        {/* 戰場區（雙方）：board-battle 卡面戰場背景 + 深色壓暗層，維持棋子可讀性 */}
        <div
          className="relative rounded-xl overflow-hidden mb-2 bg-cover bg-center"
          style={{ backgroundImage: `url(${BOARD_BG})` }}
        >
          <div className="absolute inset-0 bg-slate-950/70" aria-hidden />
          <div className="relative p-2 space-y-2">
        {/* 敵方戰場 */}
        <section>
          <div className="min-h-24 rounded-xl border border-rose-900/40 bg-rose-950/10 px-2 pt-2 pb-4 flex flex-wrap gap-x-3 gap-y-4">
            {game.eBoard.length === 0 && (
              <span className="text-slate-600 text-xs self-center px-2">山林試煉尚無隨從。</span>
            )}
            {game.eBoard.map((e) => {
              const targetable = enemyMinionTargetable(e);
              const ThemeIcon = THEME_ICON[e.card.theme];
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : ""].filter(Boolean).join("·");
              return (
                <button
                  key={e.key}
                  onClick={() => onEnemyMinion(e.key)}
                  disabled={!targetable}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}`}
                  className={`hs-token w-[72px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${targetable ? "hover:ring-2 hover:ring-rose-400 cursor-pointer" : ""}`}
                >
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-amber-200/40">
                        <ThemeIcon className="w-7 h-7" />
                      </span>
                    )}
                    <span className="hs-art-frame" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
                  </span>
                  <StatGem kind="atk" value={e.attack} size="sm" className="hs-gem-atk" />
                  <StatGem
                    kind="hp"
                    value={e.health}
                    size="sm"
                    tone={e.health < e.maxHealth ? "text-rose-200" : "text-white"}
                    className="hs-gem-hp"
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* 我方戰場 */}
        <section>
          <div className="min-h-24 rounded-xl border border-sky-900/40 bg-sky-950/10 px-2 pt-2 pb-4 flex flex-wrap gap-x-3 gap-y-4">
            {game.pBoard.length === 0 && (
              <span className="text-slate-600 text-xs self-center px-2">
                尚無隨從，從手牌打出吧。
              </span>
            )}
            {game.pBoard.map((e) => {
              const ready = e.canAttack && game.phase === "player" && !game.winner && !pending;
              const spellTarget = friendMinionTargetable;
              const ThemeIcon = THEME_ICON[e.card.theme];
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : "", e.bonus ? "加成" : ""]
                .filter(Boolean)
                .join("·");
              return (
                <button
                  key={e.key}
                  onClick={() => onPlayerMinion(e.key)}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}`}
                  className={`hs-token w-[72px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${ready && selected !== e.key && !spellTarget ? "hs-ready-pulse" : ""}
                    ${selected === e.key ? "ring-2 ring-amber-400 -translate-y-1" : ""}
                    ${spellTarget ? "ring-2 ring-emerald-400 cursor-pointer" : ""}
                    ${ready || spellTarget ? "cursor-pointer hover:-translate-y-0.5" : e.stealth ? "" : "opacity-70"}`}
                >
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="absolute inset-0 flex items-center justify-center text-amber-200/40">
                        <ThemeIcon className="w-7 h-7" />
                      </span>
                    )}
                    <span className="hs-art-frame" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
                  </span>
                  {e.bonus && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black shadow">
                      ★
                    </span>
                  )}
                  <StatGem kind="atk" value={e.attack} size="sm" className="hs-gem-atk" />
                  <StatGem
                    kind="hp"
                    value={e.health}
                    size="sm"
                    tone={e.health < e.maxHealth ? "text-rose-200" : "text-white"}
                    className="hs-gem-hp"
                  />
                </button>
              );
            })}
          </div>
        </section>
          </div>
        </div>

        {/* 我方英雄 + 控制 */}
        <section className="mb-2 flex items-center justify-between rounded-xl border border-sky-400/40 bg-sky-950/30 px-3 py-2">
          <span className="text-sm font-semibold flex items-center gap-1">
            <IconPerson className="w-3.5 h-3.5 shrink-0" /> 織者（你）
          </span>
          <div className="flex items-center gap-3">
            <span className="text-sky-300 font-bold flex items-center gap-1">
              <IconHeart className="w-3.5 h-3.5 shrink-0" /> {game.playerHp}/{HERO_HP}
            </span>
            <button
              onClick={endTurn}
              disabled={game.phase !== "player" || !!game.winner || !!pending || !!quiz}
              className="rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-3 py-1 text-sm font-medium"
            >
              {game.phase === "enemy" ? "系統行動中…" : "結束回合 ▶"}
            </button>
            <button
              onClick={reset}
              className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm"
            >
              重新開始
            </button>
          </div>
        </section>

        {/* 手牌 */}
        <section className="mb-3">
          <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">
            手牌（牌庫剩 {game.pDeck.length}）
            {selected && !pending && (
              <span className="text-amber-300 ml-2">▶ 已選攻擊者，點敵方目標</span>
            )}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-4 pt-2 pb-2">
            {game.pHand.length === 0 && (
              <span className="text-slate-600 text-xs">手牌已空，結束回合抽牌。</span>
            )}
            {game.pHand.map((c, i) => {
              const playable =
                c.cost <= game.pMana && game.phase === "player" && !game.winner && !pending && !quiz;
              const ThemeIcon = THEME_ICON[c.theme];
              const art = CARD_ART[c.id];
              return (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  title={c.nameZh}
                  className={`hs-card ${RARITY_GLOW[c.rarity]} w-[124px] sm:w-[150px] aspect-[5/7] shrink-0 text-left border-2 ${RARITY_COLOR[c.rarity]}
                    ${playable ? "hs-card-playable cursor-pointer" : "opacity-40 cursor-not-allowed"}`}
                >
                  {/* 內容層：切圓角、蓋在稀有度外框內 */}
                  <span className="absolute inset-0 rounded-[12px] overflow-hidden flex flex-col">
                    {/* 畫窗（上 55%）：金內框裱起來的肖像；缺圖用大號題材線稿 */}
                    <span className="relative h-[55%] shrink-0 rounded-t-[12px] bg-gradient-to-b from-slate-800 to-slate-900">
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art} alt={c.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-amber-200/40">
                          <ThemeIcon className="w-12 h-12" />
                        </span>
                      )}
                      <span className="hs-art-frame" aria-hidden />
                    </span>
                    {/* 文字欄：類型／稀有度、效果、答對加成 */}
                    <span className="flex-1 flex flex-col px-1.5 pt-3.5 pb-2 text-center">
                      <span className="flex items-center justify-center gap-1 text-[8px] tracking-[0.15em] text-amber-200/70">
                        <ThemeIcon className="w-2.5 h-2.5 shrink-0" />
                        {c.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[c.rarity]}
                      </span>
                      {c.effectText !== "—" && (
                        <span title={c.effectText} className="text-[9px] leading-tight text-slate-200 mt-0.5 line-clamp-2">
                          {c.effectText}
                        </span>
                      )}
                      <span title={c.bonusText} className="text-[9px] leading-tight text-amber-300/90 mt-0.5 line-clamp-2">
                        ★ {c.bonusText}
                      </span>
                    </span>
                  </span>
                  {/* 名條：跨在畫窗與文字欄接縫上 */}
                  <span
                    title={c.nameZh}
                    className={`${notoSerifTC.className} hs-name-banner absolute left-0 right-0 top-[55%] -translate-y-1/2 z-[5] block px-1.5 py-0.5 text-center text-[11px] font-bold truncate`}
                  >
                    {c.nameZh}
                  </span>
                  {/* 法力水晶（藍寶石切面，實際費用） */}
                  <StatGem kind="cost" value={c.cost} className="hs-gem-cost" />
                  {/* 攻／血寶石（隨從）或類型小牌（法術） */}
                  {c.type === "minion" ? (
                    <>
                      <StatGem kind="atk" value={c.attack ?? 0} className="hs-gem-atk" />
                      <StatGem kind="hp" value={c.health ?? 0} className="hs-gem-hp" />
                    </>
                  ) : (
                    <span className="hs-spell-chip">法術</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 紀錄 */}
        <section>
          <h2 className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">戰鬥紀錄</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 min-h-16 space-y-0.5 text-xs">
            {game.log.map((l) => (
              <div
                key={l.key}
                className={
                  l.tone === "good"
                    ? "text-emerald-300"
                    : l.tone === "bad"
                      ? "text-rose-300"
                      : l.tone === "sys"
                        ? "text-orange-300"
                        : "text-slate-400"
                }
              >
                {l.text}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* 答題彈窗（真實太魯閣語詞庫；揭曉後自動播發音，手動按「繼續 ▶」結算） */}
      {quiz && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            {CARD_ART[quiz.card.id] && (
              <div className="relative rounded-xl overflow-hidden mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={CARD_ART[quiz.card.id]}
                  alt={quiz.card.nameZh}
                  className="w-full h-40 object-cover"
                />
                {/* 與手牌畫窗同款的金內框（收藏卡裱框感） */}
                <span className="hs-art-frame" aria-hidden />
              </div>
            )}
            <div className="text-xs text-slate-400 mb-1">
              打出「{quiz.card.nameZh}」— 答對觸發加成「{quiz.card.bonusText}」
            </div>
            <h3 className="text-lg font-bold mb-4">{quiz.prompt}</h3>
            <div className="grid gap-2">
              {quiz.options.map((opt, idx) => {
                let cls = "bg-slate-800 hover:bg-slate-700";
                if (revealed !== null) {
                  if (idx === quiz.answerIdx) cls = "bg-emerald-700";
                  else if (idx === revealed) cls = "bg-rose-700";
                  else cls = "bg-slate-800 opacity-60";
                }
                return (
                  <button
                    key={idx}
                    disabled={revealed !== null}
                    onClick={() => answer(idx)}
                    className={`rounded-lg px-4 py-2 text-left ${cls}`}
                  >
                    {String.fromCharCode(65 + idx)}. {opt}
                  </button>
                );
              })}
            </div>
            {revealed !== null && (
              <div className="mt-3">
                <p className="text-xs text-slate-300 flex items-start gap-1">
                  {revealed === quiz.answerIdx ? (
                    <IconCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <IconCross className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span>
                    {revealed === quiz.answerIdx ? "答對！觸發加成效果。" : "答錯，以基礎效果打出。"}
                    「{quiz.chinese}」= {quiz.word}
                  </span>
                </p>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={continueAfterQuiz}
                    className="rounded bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-sm font-medium"
                  >
                    繼續 ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 勝敗彈窗 */}
      {game.winner && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center">
            <div className="flex justify-center mb-2">
              {game.winner === "player" ? (
                <IconMountain className="w-10 h-10 text-emerald-400" />
              ) : (
                <IconRain className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <h3 className="text-xl font-bold mb-1">
              {game.winner === "player" ? "通過山林試煉！" : "山林試煉未過"}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              命中率 {rate}%（答對 {game.correct} · 答錯 {game.wrong}）
            </p>
            <button
              onClick={reset}
              className="rounded bg-sky-600 hover:bg-sky-500 px-5 py-2 font-medium"
            >
              再挑戰一次
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
