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
  /** 石鎧（聖盾）：抵擋下一次傷害後消失 */
  divineShield?: boolean;
  /** 汲取（吸血）：這隻造成傷害時，同額回復自己英雄 */
  lifesteal?: boolean;
  /** 疾風（風怒）：每回合可攻擊兩次 */
  windfury?: boolean;
  /** 突襲：登場當回合可攻擊敵方隨從，但不可攻擊英雄（次回合解除） */
  rushBound?: boolean;
  /** 本回合已攻擊次數（疾風判斷用；每回合開始歸零） */
  attacksUsed?: number;
  /** 法術增幅：在場時使我方法術傷害 +N */
  spellDamage?: number;
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
  /** "word"＝單字四選一（預設）；"sentence"＝困難模式的句子四選一。 */
  kind?: "word" | "sentence";
  /** 句子題的官方發音檔（word 題沿用舊路徑，從 card.vocabId 查 audioUrl()）。 */
  audioUrl?: string | null;
};

export const HERO_HP = 30;
export const BOARD_MAX = 7;
export const HAND_MAX = 10;

// ───────────────────────── 戰鬥事件時間軸（引擎產生，畫面逐一播放）─────────────────────────
// 錨點：隨從 key，或英雄 "heroPlayer" / "heroEnemy"
export type Anchor = string;

/** 法術視覺類別（決定顏色與動態） */
export type SpellVfx = "damage" | "heal" | "summon" | "draw" | "buff" | "aoe";

/** 引擎輸出的有序戰鬥事件。畫面依序播放對應動畫。 */
export type CombatEvent =
  | { t: "TURN_START"; side: Side; turn: number }
  | { t: "MANA_REFRESH"; side: Side }
  | { t: "DRAW"; side: Side; count: number }
  | { t: "CARD_PLAY"; side: Side; cardId: string; isCorrect: boolean }
  | { t: "SUMMON"; side: Side; key: string }
  | { t: "SPELL"; side: Side; cardId: string; vfx: SpellVfx; anchors: Anchor[] }
  | { t: "ATTACK_WINDUP"; side: Side; key: string }
  | { t: "ATTACK_LUNGE"; side: Side; key: string; target: Anchor }
  | { t: "IMPACT"; anchor: Anchor }
  | { t: "DAMAGE"; anchor: Anchor; amount: number }
  | { t: "HEAL"; anchor: Anchor; amount: number }
  | { t: "DEATH"; side: Side; key: string }
  | { t: "TURN_END"; side: Side };

/** 一個事件 ＋ 其發生後的權威盤面快照（畫面播放到此事件時即渲染此 state）。 */
export type EventStep = { event: CombatEvent; state: Game };
