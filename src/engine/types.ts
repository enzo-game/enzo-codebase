// 對戰引擎型別 —— 純資料，無 React 依賴。
// P0：從 src/app/play/page.tsx 抽出，供前端 UI 與（未來）Supabase Edge Function 共用。
import type { Card } from "@/data/cards";

export type Side = "player" | "enemy";

export type Minion = {
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

export type LogEntry = { key: string; text: string; tone: "good" | "bad" | "sys" | "info" };

export type Phase = "player" | "enemy" | "over";

export type Game = {
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
export type Target = { kind: "hero" } | { kind: "minion"; side: Side; key: string };

export type TargetKind = "none" | "any" | "anyMinion" | "enemyMinion" | "friendMinion";

/** 電腦對手強度。影響：是否答題觸發加成、出牌取捨、攻擊/換血/斬殺判斷。 */
export type Difficulty = "easy" | "normal" | "hard";

export type QuizState = {
  card: Card;
  prompt: string;
  options: string[];
  answerIdx: number;
  word: string;
  chinese: string;
};

export const HERO_HP = 30;
export const BOARD_MAX = 7;
export const HAND_MAX = 10;
