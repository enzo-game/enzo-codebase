"use client";

import Link from "next/link";
import { Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import { useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef, type ReactNode } from "react";
import { vocab, audioUrl, distractors, ATTRIBUTION, SOURCE, SOURCE_URL, VOCAB } from "@/data/truku";
import AmbientAudio from "@/components/AmbientAudio";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxArrive, sfxLose, sfxStreak } from "@/lib/sfx";

// 章節標題卡字體（沿用 /prologue 同套字體系統，維持敘事連續性）
const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });
const notoSansTC = Noto_Sans_TC({ weight: ["400", "500"], subsets: ["latin"], display: "swap" });

/*
 * 模式 A · 山徑劇情（灰盒 MVP）
 * 依 DECISION-SHANJING：採《山徑織圖》為模式 A 機制規格，單關「修復山徑」。
 * 放行紅線：內建族語答題閘門（打行動/協作牌前答對族語題 → 全額生效，答錯 → 半額）。
 * 美術全 placeholder（中性色塊/emoji）；族語為「示範佔位」，正式內容待 hunter.db + 語言部/文化部複核。
 * 非戰鬥結構：系統挑戰＝環境（落石/險徑/天候），不塑造敵對族群。
 */

// ───────────────────────── 型別 ─────────────────────────

type Resource = "food" | "wood" | "stone" | "rope";
type NodeType = "start" | "obstacle" | "bridge" | "event" | "supply" | "destination" | "hazard";
type CardType = "action" | "coop" | "supply" | "watch" | "weave";
type EffectId =
  | "scout"
  | "clearStone"
  | "buildBridge"
  | "coopClear"
  | "gatherFood"
  | "reduceStress"
  | "weaveMark"
  | "braceWind"
  | "shelterBrace";

// ORDER-050（P2 第二關）：環境危害（ENVIRONMENT_HAZARD，來自 mode-survival-expansion-chapters-v2-full.json 第一章）
// clearThreshold＝節點 obstacle 點數；ongoingPenalty＝未清除時每次紮營（日末）持續扣的代價。
type HazardPenalty = { kind: "hp" | "pressure"; amount: number; text: string };

type PathNode = {
  id: string;
  name: string;
  vocabId: string; // 對應真實太魯閣語詞（klokah trv=33）
  type: NodeType;
  obstacle: number; // 需清除的阻礙點數（bridge：1 = 未搭建；hazard：clearThreshold）
  cleared: boolean;
  hazard?: HazardPenalty; // 僅 hazard 節點：未清除時每次紮營套用的持續懲罰
};

type JCard = {
  key: string;
  name: string;
  vocabId: string; // 該卡對應真實太魯閣語詞（klokah trv=33）
  cost: number;
  type: CardType;
  effect: EffectId;
  desc: string;
  costRes?: Partial<Record<Resource, number>>;
  quiz: boolean; // 是否觸發族語答題閘門
};

type LogEntry = { key: string; text: string; tone: "good" | "bad" | "sys" | "info" };

type LevelId = "l1" | "l2";

type JGame = {
  levelId: LevelId; // ORDER-050：本局所屬關卡（天數上限、節點、牌庫、事件池皆依關卡設定）
  day: number;
  ap: number;
  maxAp: number;
  pressure: number;
  maxPressure: number;
  teamHp: number;
  maxTeamHp: number;
  res: Record<Resource, number>;
  nodes: PathNode[];
  idx: number;
  hand: JCard[];
  deck: JCard[];
  discard: JCard[];
  event: EventCard | null;
  coopDiscount: number;
  status: "playing" | "won" | "lost";
  log: LogEntry[];
  correct: number;
  wrong: number;
  streak: number; // 連續答對題數（v2 核心循環重構）
  wordLog: { vocabId: string; correct: boolean }[]; // v4（ORDER-033）：逐題紀錄，供結局回顧「這次學了什麼」
  trialedNodes: string[]; // v7（ORDER-042）：已做過「族語試煉」的節點 id（每節點限一次）
  fastDebt: number | null; // ORDER-048（P1）：事件節點「快速通過」的延遲反噬——記下兩節點後的 idx，走到時壓力+2
};

type EventCard = {
  name: string;
  vocabId: string;
  kind: "天候" | "地形" | "正面" | "路段危機" | "啟程";
  pressure: number;
  desc: string;
};

// ───────────────────────── 圖示（v6，ORDER-039：全面移除表情符號）─────────────────────────
// 司令要求「要有圖啊，我們NO EMOJI」——全站不用彩色 emoji 圖形字元，一律用線稿 SVG 圖示或既有已核准
// 圖片素材（RES_IMG/場景圖）。統一 24×24 viewBox、currentColor 描邊，可用 text-* class 跟著文字變色，
// 不需要外部生圖（不受 Codex 產出進度限制）。✓ ✕ ○ ★ ▶ ◀ 等純排版符號（非彩色 emoji）維持不變。
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
function IconSpeaker({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.3 8.7a5 5 0 010 6.6" />
      <path d="M19 6a9 9 0 010 12" />
    </svg>
  );
}
function IconFlame({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5c1 3.2-2.2 4.3-2.2 7.3a4.2 4.2 0 108.4 0c0-1-.5-1.8-.5-1.8.6 3.8-1.4 4.8-1.4 4.8 1.7-4-1.1-7.2-4.3-10.3z" />
    </svg>
  );
}
function IconMoon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8.5 8.5 0 1110.5 4a7 7 0 009.5 10.5z" />
    </svg>
  );
}
function IconFootprint({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <ellipse cx="9" cy="8" rx="3" ry="4" />
      <ellipse cx="15" cy="16" rx="3" ry="4" />
    </svg>
  );
}
function IconPackage({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l9-5 9 5-9 5-9-5z" />
      <path d="M3 8v9l9 5 9-5V8" />
      <path d="M12 13v9" />
    </svg>
  );
}
function IconHammer({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 6.5l3.5 3.5-3 3-3.5-3.5z" />
      <path d="M15.5 5.3l3.6-1.6 1.7 1.7-1.6 3.6" />
      <path d="M12.5 9.5L4 18l2 2 8.5-8.5" />
    </svg>
  );
}
function IconPickaxe({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 6c4-3 9-3 13 0-2 4-6 7-10 8" />
      <path d="M9 14l-5 6" />
    </svg>
  );
}
function IconRun({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="14.5" cy="4.5" r="1.6" />
      <path d="M9 20l2-5-3-2 1-5 4 1 2 3 3 1" />
      <path d="M13 13l3 2-1 5" />
    </svg>
  );
}
function IconSearch({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}
function IconQuestion({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.3a2.7 2.7 0 115.2.9c0 1.9-2.5 1.9-2.5 3.8" />
      <circle cx="12" cy="17.3" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconBook({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5c3-1.4 6-1.4 8 0v14c-2-1.4-5-1.4-8 0z" />
      <path d="M20 5c-3-1.4-6-1.4-8 0v14c2-1.4 5-1.4 8 0z" />
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
function IconGauge({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15a8 8 0 0116 0" />
      <path d="M12 15l4-4" />
      <path d="M12 15h.01" />
    </svg>
  );
}
function IconFlag({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v18" />
      <path d="M5 4.5l13 3-13 3z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconTarget({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconAlert({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l9.5 17H2.5z" />
      <path d="M12 9.5V14" />
      <circle cx="12" cy="17" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ───────────────────────── 常數 ─────────────────────────

// ORDER-048（P1 收緊）：第一關天數 7→6、起始糧 6→4——依 mode-a-review-v2-boredom 診斷。
// ORDER-050（P2）：天數上限改為「關卡設定」（見 LEVELS），不再是全域常數。
const HAND_LIMIT = 5;
// 解鎖與關卡記憶（localStorage key；僅在 client mount 後讀寫，避免 SSR 觸碰 window）
const LS_LEVEL2_UNLOCKED = "cw_level2_unlocked";
const LS_LAST_LEVEL = "cw_journey_level";
// ORDER-051：首次教學 coach marks 旗標（做完/跳過即不再出現）
const LS_COACH_DONE = "cw_journey_coach_done";
// ORDER-051：電影感全頁背景——沿用已過文化複核的既有場景圖（stories/scene-start-v1），暗化 80%＋vignette
const PAGE_BG = "/images/journey/stories/scene-start-v1.jpg";
// ORDER-051（引導點 3）：首次教學 4 站（任務面板→行動聚光燈→手牌→紮營），各一句話
const COACH_STEPS: { title: string; text: string }[] = [
  { title: "任務面板", text: "看這裡——每一步的狀況跟該做的事，都寫在這本任務誌上。" },
  { title: "行動聚光燈", text: "跟著金色光暈走：掛著「▶ 現在」的按鈕，就是你現在該按的那一顆。" },
  { title: "手牌", text: "出行動籤推進任務——多數牌要先答對族語題，行動才會全額生效。" },
  { title: "紮營", text: "行動點用完就按「紮營」收束今日，換日補滿行動點再上路。" },
];
const RES_NAME: Record<Resource, string> = { food: "糧食", wood: "木材", stone: "石材", rope: "繩索" };
// 美術素材（ORDER-015，Codex 生圖，已過 enzo-culture 複核）
const RES_IMG: Record<Resource, string> = {
  food: "/images/journey/res-food-v1.png",
  wood: "/images/journey/res-wood-v1.png",
  stone: "/images/journey/res-stone-v1.png",
  rope: "/images/journey/res-rope-v1.png",
};
// 資源金幣（ORDER-017 圖 + 決策#22 族語落字）：klokah 查證真實詞，標「示範·待核」；
// mockup 原用詞 matu/sbalay/puni/lukus 經查證為誤（sbalay 且屬敏感詞），已排除。
const COIN_IMG: Record<Resource, string> = {
  food: "/images/journey/coins/coin-food-v1.png",
  wood: "/images/journey/coins/coin-wood-v1.png",
  stone: "/images/journey/coins/coin-stone-v1.png",
  rope: "/images/journey/coins/coin-rope-v1.png",
};
// 對應 klokah 詞條 id（真實太魯閣語，含發音）：idaw 飯／qhuni 樹／btunux 石頭／gasil 繩索
const RES_VOCAB: Record<Resource, string> = {
  food: "21-01", // idaw 飯
  wood: "08-03", // qhuni 樹
  stone: "12-05", // btunux 石頭
  rope: "09-15", // gasil 繩索
};
const NODE_IMG: Record<NodeType, string> = {
  start: "/images/journey/node-normal-v1.png",
  obstacle: "/images/journey/node-rockfall-v1.png",
  bridge: "/images/journey/node-bridge-v1.png",
  event: "/images/journey/node-event-v1.png",
  supply: "/images/journey/node-supply-v1.png",
  destination: "/images/journey/node-destination-v1.png",
  hazard: "/images/journey/node-event-v1.png", // ORDER-050：環境危害沿用事件節點圖（風雨警示氛圍，免新生圖）
};
const MAP_BASE = "/images/journey/board-journey-map-base-v1.jpg";

// 場景水彩底圖（ORDER-017，已過 enzo-culture 複核）：依節點型別給不同場景氛圍
const SCENE_IMG: Record<NodeType, string> = {
  start: "/images/journey/scene/scene-start-v1.png",
  obstacle: "/images/journey/scene/scene-rockfall-v1.png",
  bridge: "/images/journey/scene/scene-bridge-v1.png",
  event: "/images/journey/scene/scene-forest-v1.png",
  supply: "/images/journey/scene/scene-camp-v1.png",
  destination: "/images/journey/scene/scene-village-v1.png",
  hazard: "/images/journey/scene/scene-forest-v1.png", // ORDER-050：風雨危害沿用林霧場景
};

// 行動籤卡面（ORDER-017）：以效果 id 對應（weaveMark 織圖無專屬卡面，維持純文字）
const CARD_ART: Partial<Record<EffectId, string>> = {
  scout: "/images/journey/cards/card-art-patrol-v1.png",
  clearStone: "/images/journey/cards/card-art-stone-v1.png",
  buildBridge: "/images/journey/cards/card-art-bridge-v1.png",
  coopClear: "/images/journey/cards/card-art-carry-v1.png",
  gatherFood: "/images/journey/cards/card-art-supply-v1.png",
  reduceStress: "/images/journey/cards/card-art-watch-v1.png",
};

// 量表 / 頂欄小圖示（ORDER-017）
const METER_PRESSURE = "/images/journey/meter-pressure-v1.png";
const METER_STAMINA = "/images/journey/meter-stamina-v1.png";
const ICON_DAY = "/images/journey/icon-day-v1.png";
const ICON_ACTION = "/images/journey/icon-action-v1.png";
const ICON_HIT = "/images/journey/icon-hit-v1.png";

// 側邊導覽（ORDER-017 nav 圖示）：山徑（本頁）與對戰為實連結，其餘功能敬請期待
const NAV_ITEMS: { key: string; label: string; img: string; href?: string }[] = [
  { key: "journey", label: "山徑", img: "/images/journey/nav/nav-journey-v1.png", href: "/journey" },
  { key: "battle", label: "對戰", img: "/images/journey/nav/nav-battle-v1.png", href: "/play" },
  { key: "collection", label: "收藏", img: "/images/journey/nav/nav-collection-v1.png" },
  { key: "tribe", label: "部落", img: "/images/journey/nav/nav-tribe-v1.png" },
  { key: "achievement", label: "成就", img: "/images/journey/nav/nav-achievement-v1.png" },
  { key: "settings", label: "設定", img: "/images/journey/nav/nav-settings-v1.png" },
];

// 中性裝飾外框（ORDER-018，Themis+司令 2026-07-08 放行；非正式織紋框，僅中性替代）
const FRAME_CORNER = "/images/journey/frames/frame-corner-tl-v1.png";
const FRAME_EDGE_H = "/images/journey/frames/frame-edge-h-v1.png";
const FRAME_EDGE_V = "/images/journey/frames/frame-edge-v-v1.png";
const FRAME_DIVIDER = "/images/journey/frames/frame-divider-v1.png";

// ───────────────────────── 章節架構（v2：對齊 /prologue 的敘事章節，非各做各的）─────────────────────────
// 6 節點分 3 章，沿用序幕已建立的章節名與傳說主題（Pusu Qhuni／大洪水／射日／彩虹橋），
// 讓「先講故事」跟「玩的時候」是同一套架構，不是進了山徑就與序幕脫節。
type ChapterMeta = { kicker: string; title: string; sub: string; nodeStart: number; nodeEnd: number };

const CHAPTERS_L1: ChapterMeta[] = [
  {
    kicker: "壹 · 斷路",
    title: "溪水暴漲的那一夜，路碎成了好幾段。",
    sub: "落石封住峽口，你得從立霧溪口出發，先把眼前這段路修好。",
    nodeStart: 0,
    nodeEnd: 1,
  },
  {
    kicker: "貳 · 遠行",
    title: "祖先曾為了射下太陽，世代接力，遠行不歸。",
    sub: "峽谷吊橋、林間捷徑——換你帶隊伍上路，一步步往部落走。",
    nodeStart: 2,
    nodeEnd: 3,
  },
  {
    kicker: "終 · 彩虹橋",
    title: "把每一個人，平安帶回部落。",
    sub: "補給、然後抵達——天邊那道彩虹橋連著此世與祖先，在等你們。",
    nodeStart: 4,
    nodeEnd: 5,
  },
];

// ORDER-050（P2 第二關）：《風雨的稜線》章節——文字取材自 mode-survival-expansion-chapters-v2-full.json
// 第一章（環境生存壓力主題），不新編傳說，只用設計文件既有的敘事語句與中性場景描述。
const CHAPTERS_L2: ChapterMeta[] = [
  {
    kicker: "壹 · 風起",
    title: "山上的風暴從不跟人商量。",
    sub: "雲層壓得很低，稜線在霧裡忽隱忽現。趁風雨全面來襲之前，帶隊伍上稜線。",
    nodeStart: 0,
    nodeEnd: 1,
  },
  {
    kicker: "貳 · 稜線",
    title: "稜線是雷雨最愛的獵場。",
    sub: "崩坡、雷擊、亂流——環境危害不清除，就會在每個夜裡持續消耗你的隊伍。",
    nodeStart: 2,
    nodeEnd: 4,
  },
  {
    kicker: "終 · 背風",
    title: "只要有一點火星，其他人的眼神就會亮起來。",
    sub: "翻過最後一段稜線，找到背風的凹地——把隊伍完整地帶下山。",
    nodeStart: 5,
    nodeEnd: 6,
  },
];

function chaptersOf(levelId: LevelId): ChapterMeta[] {
  return levelId === "l2" ? CHAPTERS_L2 : CHAPTERS_L1;
}

function chapterForIdx(levelId: LevelId, idx: number): { chapter: ChapterMeta; index: number } {
  const chapters = chaptersOf(levelId);
  const i = chapters.findIndex((c) => idx >= c.nodeStart && idx <= c.nodeEnd);
  const index = i === -1 ? chapters.length - 1 : i;
  return { chapter: chapters[index], index };
}

const uid = () => Math.random().toString(36).slice(2);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pushLog(log: LogEntry[], text: string, tone: LogEntry["tone"]): LogEntry[] {
  return [{ key: uid(), text, tone }, ...log].slice(0, 12);
}

// ───────────────────────── 牌庫 / 節點 / 事件（示範佔位資料）─────────────────────────

// vocabId 對應 klokah trv=33 真實詞：走路25-10 石頭12-05 橋樑12-07 搬運26-52 幫忙34-05 飯21-01 看28-03
const CARD_POOL: Omit<JCard, "key">[] = [
  { name: "巡路", vocabId: "25-10", cost: 1, type: "action", effect: "scout", quiz: true, desc: "前進 1 格；答對額外壓力 -1（不需要這張牌也能用常駐「前進」按鈕前進）。" },
  { name: "搬石", vocabId: "12-05", cost: 2, type: "action", effect: "clearStone", quiz: true, desc: "清除落石阻礙：答對 -2、答錯 -1。" },
  { name: "搭橋", vocabId: "12-07", cost: 2, type: "action", effect: "buildBridge", quiz: true, costRes: { wood: 1, rope: 1 }, desc: "使橋梁路段可通行（耗木材1、繩索1）。" },
  { name: "共同搬運", vocabId: "26-52", cost: 2, type: "coop", effect: "coopClear", quiz: true, desc: "協力清障：答對 -3（體力<5 為 -2）、答錯 -1。" },
  { name: "分工合作", vocabId: "34-05", cost: 1, type: "coop", effect: "weaveMark", quiz: true, desc: "織線標記：壓力 -1（答對再 -1），下一張牌 -1 行動點。" },
  { name: "整理物資", vocabId: "21-01", cost: 1, type: "supply", effect: "gatherFood", quiz: false, desc: "獲得 2 糧食。" },
  { name: "守望", vocabId: "28-03", cost: 2, type: "watch", effect: "reduceStress", quiz: true, desc: "降低壓力：答對 -3、答錯 -1。" },
];

// ORDER-050（P2 第二關）：《風雨的稜線》專屬行動牌——改編自設計文件第一章 RESOLVE_ACTION
// （c1_resolve_bracewind／c1_resolve_shelterbrace），對「環境危害」節點清除進度。
// vocabId 皆為 klokah 已驗證真實詞：bgihur 風（10-04）／bling dgiyaq 山洞（10-18）。
const CARD_POOL_L2: Omit<JCard, "key">[] = [
  { name: "頂風前行", vocabId: "10-04", cost: 2, type: "action", effect: "braceWind", quiz: true, desc: "清除環境危害：答對 -2、答錯 -1。" },
  { name: "架設臨時遮蔽", vocabId: "10-18", cost: 2, type: "coop", effect: "shelterBrace", quiz: true, costRes: { wood: 1 }, desc: "清除環境危害：答對 -2 且壓力 -1、答錯 -1（耗木材1）。" },
];

function buildDeck(levelId: LevelId): JCard[] {
  const counts: Record<EffectId, number> = {
    scout: 3,
    clearStone: 3,
    buildBridge: 2,
    coopClear: 2,
    gatherFood: 2,
    reduceStress: 2,
    weaveMark: 2,
    braceWind: 3,
    shelterBrace: 2,
  };
  const deck: JCard[] = [];
  // 第二關沒有吊橋節點，「搭橋」抽掉不佔牌庫；改混入危害清除牌（頂風前行／架設臨時遮蔽）
  const protos =
    levelId === "l2" ? [...CARD_POOL.filter((c) => c.effect !== "buildBridge"), ...CARD_POOL_L2] : CARD_POOL;
  for (const proto of protos) {
    const n = counts[proto.effect] ?? 1;
    for (let i = 0; i < n; i++) deck.push({ ...proto, key: uid() });
  }
  return shuffle(deck);
}

// v2 機制移植：event 節點隨機池（3 種情境，重玩時抽一種，取代永遠固定的「林間捷徑」）
// 效果數值保持一致（快速通過=壓力+2；謹慎探勘=耗木材1・繩索1換糧食+1），只變情境文字，降低平衡風險
const EVENT_NODE_POOL: { name: string; vocabId: string }[] = [
  { name: "林間捷徑", vocabId: "10-01" }, // elug 道路
  { name: "倒木擋道", vocabId: "08-03" }, // qhuni 樹
  { name: "岔路口", vocabId: "25-10" }, // mksa 走路
];

// v3（ORDER-030）：節點故事——依 enzo-game-design/docs/mode-a-chapter-story-v1.md，
// 融入已核准的太魯閣族傳說（大洪水/射日/巨人馬威/彩虹橋意象），依節點 vocabId 對應。
// 事件節點（林間捷徑/倒木擋道/岔路口）隨機池，各配一段故事，維持一致性。
const NODE_STORY_L1: Record<string, string> = {
  "10-07": "出發前，老人家只交代一句話：「路斷了，就一段一段修。別想著一次到家。」你把繩子重新繫緊，看了隊伍一眼——該上路了。",
  "12-05": "這段路，三天前還在。溪水漲得比記憶中的任何一次都高，把整片山壁沖鬆，落石堆得比人高。老人家說，這樣的大水，祖先也遇過一次——那次，山河整個重新排過。這次，換你們重新排一次路。",
  "12-07": "吊橋斷了一半，垂在溪谷上晃。傳說中射日的祖先，也是這樣一段一段把不可能的距離走完的——出發的人揹著孩子，沿路種下小米，等到射日成功，早已是後代的事了。這座橋，你們也接得完。",
  "10-01": "林間有一條窄窄的近路，繞過一塊被踩得凹陷的台地——老一輩叫它「馬威的腳印」。傳說巨人馬威一步能跨一座山頭，腳一跺就踏出這樣的平台；他曾張大嘴堵在獵物的必經之路上，不勞而獲，害族人挨餓。後來族人們合力把燒紅的水晶石偽裝成獵物滾下山，馬威一口吞下，痛得滾進花蓮外海，只剩兩腳露出水面，成了蘭嶼與綠島。族人說，馬威應該只是睡著了，還在那片海裡，默默看著這片山。——這條捷徑好走，但貪快，有時候要付出代價。",
  "08-03": "一棵巨大的檜木橫倒在小徑正中央，樹根還帶著新鮮的濕泥——這棵樹倒下不過是這幾天的事。繞過去，還是想辦法直接跨過？",
  "25-10": "小徑在這裡分成兩條，一條寬一條窄，都通往看不見盡頭的林子裡。沒有路標，只能靠自己的判斷。",
  "12-01": "隊伍在營地卸下重擔，糧食分著吃。沒有人多說話，但每個人都在補：補睡眠、補力氣、補接下來要用的木頭與繩索。部落已經不遠了。",
  "24-04": "最後一段路，天邊真的出現了一道彩虹橋。老人家說，那橋連著這個世界和祖先所在的地方——不是要你們現在就過橋，是提醒你們：平安回家，本身就是被祖先看顧著的事。把每一個人，帶回部落。",
};

// v5（ORDER-037）：故事卡配圖——沿用 ORDER-017 已通過 enzo-culture 複核的 6 張節點場景圖
// （review-order-016-017-ui-art.md，🟢×6 PASS，無人物無圖騰），不用等 ORDER-034 新一批 Codex 生圖，
// 現有已核准素材就能立刻讓每張故事卡都有圖。林間三個事件變體（林間捷徑/倒木擋道/岔路口）共用同一張林霧場景。
const NODE_STORY_IMG_L1: Record<string, string> = {
  "10-07": "/images/journey/stories/scene-start-v1.jpg",
  "12-05": "/images/journey/stories/scene-rockfall-v1.jpg",
  "12-07": "/images/journey/stories/scene-bridge-v1.jpg",
  "10-01": "/images/journey/stories/scene-forest-v1.jpg",
  "08-03": "/images/journey/stories/scene-forest-v1.jpg",
  "25-10": "/images/journey/stories/scene-forest-v1.jpg",
  "12-01": "/images/journey/stories/scene-camp-v1.jpg",
  "24-04": "/images/journey/stories/scene-village-v1.jpg",
};

// ─────────── ORDER-050（P2）：第二關《風雨的稜線》節點資料 ───────────
// 依 mode-survival-expansion-chapters-v2-full.json 第一章改編：
// 環境危害池 3 抽 2（暴風雨／雷擊／側風亂流，各帶 clearThreshold 與紮營時的 ongoingPenalty）、
// 事件節點池 3 抽 1（碎石坡／雲霧牆／雷擊稜線，套用既有 event 節點的快速通過/謹慎探勘取捨）。
// vocabId 全為 klokah 已驗證真實詞。原設計「凍僵的手指壓力卡」機制（手牌壓力卡）超出現有引擎，
// 改編為等價的持續體力損耗（見 hazard.text）。
type HazardProto = { name: string; vocabId: string; threshold: number; hazard: HazardPenalty };

const HAZARD_POOL_L2: HazardProto[] = [
  {
    name: "突發性高山暴風雨",
    vocabId: "11-21", // bgihur paru 颱風
    threshold: 4,
    hazard: { kind: "hp", amount: 2, text: "雨水穿透外衣帶走體溫，隊伍體力 -2" },
  },
  {
    name: "劈裂山巔的雷擊",
    vocabId: "11-10", // bruwa 雷
    threshold: 3,
    hazard: { kind: "hp", amount: 3, text: "雷擊風險持續逼近，隊伍體力 -3" },
  },
  {
    name: "側風亂流",
    vocabId: "10-04", // bgihur 風
    threshold: 3,
    hazard: { kind: "pressure", amount: 2, text: "側風不斷把人推離路線，壓力 +2" },
  },
];

const EVENT_NODE_POOL_L2: { name: string; vocabId: string }[] = [
  { name: "崩塌的碎石坡", vocabId: "34-16" }, // msunu 崩落
  { name: "突至的雲霧牆", vocabId: "11-12" }, // rulung 雲
  { name: "雷擊稜線", vocabId: "11-10" }, // bruwa 雷
];

// 第二關節點故事：文字取材自設計文件第一章的 flavorText／description（環境描述，非傳說），
// 連接句為中性場景敘述，不新編傳說、不觸文化紅線詞。
const NODE_STORY_L2: Record<string, string> = {
  "10-22": "雲層壓得很低，稜線在霧裡忽隱忽現。老人家看了天色只說：「要走就趁現在，風雨不會等人。」高山上的極端氣候是所有旅人最平等的考驗——把裝備綁緊，該上稜線了。",
  "11-21": "山上的風暴從不跟人商量。當雨水穿透外衣，帶走體溫只需要幾分鐘。在暴雨與狂風面前，隊伍的體能與意志被剝離到只剩最純粹的生存本能——不把這陣風雨撐過去，夜裡它會一點一點消耗所有人。",
  "11-10": "風突然停了，空氣裡有一股燒焦的味道。你數不到三秒，天就裂開了一道白光。稜線是雷雨最愛的獵場——聽到雷聲已經太晚，真正該注意的是那股皮膚發麻的靜電感。",
  "10-04": "風不是從前面來的，是從側面硬生生把人推開。你必須整個人斜著身子走。稜線上的側風比迎面風更危險——它不會讓你停下，只會悄悄把你推向你以為安全的方向。",
  "34-16": "前方必經的獵路因昨夜的暴雨發生了土石崩塌，大量鬆動的碎石正不斷沿著峭壁滑落。強行通過伴隨著墜落的風險；繞道則要多花時間，而風暴將至。",
  "11-12": "一整片雲霧毫無預警地從山谷湧上，能見度瞬間降到不足一公尺。隊伍必須決定：手拉手摸索前進，還是停下來等霧散。",
  "12-11": "昨夜的暴雨把整段路埋進了石堆裡，鬆動的石塊還在滲水。帶著故障的路況上稜線更危險——得把這段路重新排出來。",
  "11-17": "找到一處背風的凹地。濕木頭很難點著，但只要有一點火星，其他人的眼神就會亮起來。幾根樹枝、一塊防水布，勉強能擋住最兇的那陣風。夠了，暫時夠了。",
  "10-12": "風勢在山腳邊終於小了下來。回頭看，稜線還埋在鉛灰色的雲裡。每個人都濕透了，但每個人都在。把隊伍完整地帶下山——這就是這趟路最重要的事。",
};

const NODE_STORY_IMG_L2: Record<string, string> = {
  "10-22": "/images/journey/stories/scene-start-v1.jpg",
  "11-21": "/images/journey/stories/scene-forest-v1.jpg",
  "11-10": "/images/journey/stories/scene-forest-v1.jpg",
  "10-04": "/images/journey/stories/scene-forest-v1.jpg",
  "34-16": "/images/journey/stories/scene-rockfall-v1.jpg",
  "11-12": "/images/journey/stories/scene-forest-v1.jpg",
  "12-11": "/images/journey/stories/scene-rockfall-v1.jpg",
  "11-17": "/images/journey/stories/scene-camp-v1.jpg",
  // 10-12（山腳終點）刻意不配圖：既有場景圖無「下山背風谷地」的合適素材，故事卡容忍缺圖
};

function buildNodesL1(): PathNode[] {
  // vocabId：河流10-07 石頭12-05 橋樑12-07 家12-01 部落24-04
  const ev = EVENT_NODE_POOL[Math.floor(Math.random() * EVENT_NODE_POOL.length)];
  return [
    { id: "n0", name: "立霧溪口（起點）", vocabId: "10-07", type: "start", obstacle: 0, cleared: true },
    { id: "n1", name: "落石路段", vocabId: "12-05", type: "obstacle", obstacle: 2, cleared: false },
    { id: "n2", name: "峽谷吊橋", vocabId: "12-07", type: "bridge", obstacle: 1, cleared: false },
    { id: "n3", name: ev.name, vocabId: ev.vocabId, type: "event", obstacle: 0, cleared: false },
    { id: "n4", name: "山腰營地", vocabId: "12-01", type: "supply", obstacle: 0, cleared: false },
    { id: "n5", name: "部落（目的地）", vocabId: "24-04", type: "destination", obstacle: 0, cleared: false },
  ];
}

// 第二關地圖：7 節點，危害池 3 抽 2、事件池 3 抽 1（依設計文件 poolConfig 的隨機抽取精神），
// 重玩時稜線上的危害組合不同。事件節點避開與已抽危害同 vocabId（故事卡以 vocabId 為鍵）。
function buildNodesL2(): PathNode[] {
  const hazards = shuffle(HAZARD_POOL_L2).slice(0, 2);
  const usedVocab = new Set(hazards.map((h) => h.vocabId));
  const evPool = EVENT_NODE_POOL_L2.filter((e) => !usedVocab.has(e.vocabId));
  const ev = evPool[Math.floor(Math.random() * evPool.length)];
  const mkHazard = (i: number, h: HazardProto): PathNode => ({
    id: `m${i}`,
    name: h.name,
    vocabId: h.vocabId,
    type: "hazard",
    obstacle: h.threshold,
    cleared: false,
    hazard: h.hazard,
  });
  return [
    { id: "m0", name: "稜線登山口（起點）", vocabId: "10-22", type: "start", obstacle: 0, cleared: true },
    mkHazard(1, hazards[0]),
    { id: "m2", name: ev.name, vocabId: ev.vocabId, type: "event", obstacle: 0, cleared: false },
    { id: "m3", name: "崩落的石堆", vocabId: "12-11", type: "obstacle", obstacle: 3, cleared: false },
    mkHazard(4, hazards[1]),
    { id: "m5", name: "背風凹地（營地）", vocabId: "11-17", type: "supply", obstacle: 0, cleared: false },
    { id: "m6", name: "山腳背風處（目的地）", vocabId: "10-12", type: "destination", obstacle: 0, cleared: false },
  ];
}

// v2 機制移植（ORDER-028 拍板）：擴充事件池至 12 項，紮營時隨機抽 1，重玩更有變化
const EVENTS: EventCard[] = [
  // vocabId：風10-04 河流10-07 太陽11-02 石頭12-05 獵物16-08 雲11-12
  { name: "風起雲湧", vocabId: "10-04", kind: "天候", pressure: 1, desc: "山風漸強，隊伍步伐放緩。" },
  { name: "溪水上升", vocabId: "10-07", kind: "地形", pressure: 1, desc: "溪水漲起，橋段更難通行。" },
  { name: "好天氣", vocabId: "11-02", kind: "正面", pressure: -1, desc: "天色轉晴，士氣回升。" },
  { name: "落石再起", vocabId: "12-05", kind: "路段危機", pressure: 1, desc: "碎石不時滑落。" },
  { name: "山林餽贈", vocabId: "16-08", kind: "正面", pressure: -1, desc: "沿途採得野菜與山產。" },
  { name: "濃霧起", vocabId: "11-12", kind: "天候", pressure: 1, desc: "白霧壟罩，視線受阻。" },
  // vocabId：冷32-08 雪11-07 餓27-14 滑掉25-37 月亮11-03 幫忙34-05
  { name: "寒風刺骨", vocabId: "32-08", kind: "天候", pressure: 1, desc: "低溫讓隊伍手腳僵硬，動作慢了下來。" },
  { name: "初雪飄落", vocabId: "11-07", kind: "天候", pressure: 1, desc: "細雪灑落山徑，腳下打滑，得放慢腳步。" },
  { name: "飢腸轆轆", vocabId: "27-14", kind: "路段危機", pressure: 1, desc: "糧食消耗得比預期快，肚子開始抗議。" },
  { name: "濕滑坡地", vocabId: "25-37", kind: "地形", pressure: 1, desc: "剛下過雨的坡地又濕又滑，得小心行走。" },
  { name: "月色皎潔", vocabId: "11-03", kind: "正面", pressure: -1, desc: "夜裡的月光意外地明亮，找路輕鬆不少。" },
  { name: "隊伍互相打氣", vocabId: "34-05", kind: "正面", pressure: -1, desc: "疲憊時互相扶持一把，士氣回升不少。" },
];

// ORDER-050（P2）：第二關紮營事件池加料——改編自設計文件第一章 CampRest 事件與天候描述
// （檢查裝備受潮／雷雨將至），vocabId 皆為 klokah 已驗證真實詞。
const EVENTS_L2: EventCard[] = [
  ...EVENTS,
  { name: "裝備受潮", vocabId: "32-17", kind: "天候", pressure: 1, desc: "雨水滲進行囊，部分裝備又濕又重，行動更費力。" }, // mhuriq 濕的
  { name: "雷聲逼近", vocabId: "11-10", kind: "天候", pressure: 1, desc: "遠方天空開始閃爍白光，雷聲的間隔越來越短。" }, // bruwa 雷
  { name: "雨勢漸歇", vocabId: "11-31", kind: "正面", pressure: -1, desc: "雨停了一陣，隊伍抓緊空檔整裝趕路。" }, // msuwal 雨停
];

// ───────────────────────── 關卡設定（ORDER-050，P2：第二關上線）─────────────────────────
// 依 mode-a-review-v2-boredom P2：只有一關「玩一次就見底」是無聊的根因，第二關啟用
// mode-survival-expansion-chapters-v2-full.json 第一章《風雨的稜線》。第一關維持原樣不動。
type LevelConfig = {
  id: LevelId;
  name: string; // 關卡名（標題列／主線面板用）
  pickLabel: string; // 關卡選擇卡標籤
  pickDesc: string;
  mission: string; // ORDER-052：常駐使命句，讓玩家知道為何出發與如何完成
  maxDay: number;
  startRes: Record<Resource, number>;
  buildNodes: () => PathNode[];
  events: EventCard[];
  chapters: ChapterMeta[];
  nodeStory: Record<string, string>;
  nodeStoryImg: Record<string, string>;
  startEvent: EventCard;
  startLog: string;
  mainQuest: string; // 主線面板標題
};

const LEVELS: Record<LevelId, LevelConfig> = {
  l1: {
    id: "l1",
    name: "修復山徑",
    pickLabel: "第一關 · 修復山徑",
    pickDesc: "溪水沖斷了回部落的路，一段一段修好它。",
    mission: "溪水沖斷了回家的路——在第 6 日入夜前，把每一段路重新接起來，帶每個人回到部落。",
    maxDay: 6,
    startRes: { food: 4, wood: 3, stone: 2, rope: 2 },
    buildNodes: buildNodesL1,
    events: EVENTS,
    chapters: CHAPTERS_L1,
    nodeStory: NODE_STORY_L1,
    nodeStoryImg: NODE_STORY_IMG_L1,
    startEvent: {
      name: "啟程",
      vocabId: "10-01", // 道路 elug
      kind: "啟程",
      pressure: 0,
      desc: "隊伍自立霧溪口出發，目標是安全返回部落。前方山徑待你逐段修復通行。",
    },
    startLog: "第 1 日：隊伍自立霧溪口啟程。",
    mainQuest: "修復山徑 · 返回部落",
  },
  l2: {
    id: "l2",
    name: "風雨的稜線",
    pickLabel: "第二關 · 風雨的稜線",
    pickDesc: "暴風雨正面撲向稜線——環境危害不清除，每晚都會消耗隊伍。",
    mission: "風暴壓上稜線——在第 7 日入夜前清除持續消耗隊伍的危害，帶大家下到背風處。",
    // 7 節點、兩個多點數危害＋3 點石堆：比第一關多一天，但經濟更緊（糧 3、木 2）
    maxDay: 7,
    startRes: { food: 3, wood: 2, stone: 2, rope: 2 },
    buildNodes: buildNodesL2,
    events: EVENTS_L2,
    chapters: CHAPTERS_L2,
    nodeStory: NODE_STORY_L2,
    nodeStoryImg: NODE_STORY_IMG_L2,
    startEvent: {
      name: "風雨將至",
      vocabId: "11-21", // bgihur paru 颱風
      kind: "啟程",
      pressure: 0,
      desc: "雲層壓低，風勢漸強。隊伍要趕在風暴最猛的時刻之前翻過稜線，抵達山腳的背風處。",
    },
    startLog: "第 1 日：隊伍自稜線登山口出發，天色不太對勁。",
    mainQuest: "翻越稜線 · 帶隊下山",
  },
};

function levelCfg(g: JGame): LevelConfig {
  return LEVELS[g.levelId];
}

// ───────────────────────── 初始化 ─────────────────────────

function newGame(levelId: LevelId): JGame {
  const cfg = LEVELS[levelId];
  const deck = buildDeck(levelId);
  return {
    levelId,
    day: 1,
    ap: 3,
    maxAp: 3,
    pressure: 3,
    maxPressure: 10,
    teamHp: 12,
    maxTeamHp: 12,
    res: { ...cfg.startRes },
    nodes: cfg.buildNodes(),
    idx: 0,
    hand: deck.slice(0, HAND_LIMIT),
    deck: deck.slice(HAND_LIMIT),
    discard: [],
    event: cfg.startEvent,
    coopDiscount: 0,
    status: "playing",
    log: pushLog([], cfg.startLog, "sys"),
    correct: 0,
    wrong: 0,
    streak: 0,
    wordLog: [],
    trialedNodes: [],
    fastDebt: null,
  };
}

// ───────────────────────── 壓力分級（v2：情緒曲線）─────────────────────────

type PressureTier = "calm" | "tense" | "critical";

function pressureTier(g: JGame): PressureTier {
  if (g.pressure >= 8) return "critical";
  if (g.pressure >= 5) return "tense";
  return "calm";
}

// 危急時行動點上限收緊（3→2），逼玩家加快腳步
function effectiveMaxAp(g: JGame): number {
  return pressureTier(g) === "critical" ? Math.max(1, g.maxAp - 1) : g.maxAp;
}

// ───────────────────────── 族語答題（示範佔位）─────────────────────────

type Quiz = { prompt: string; options: string[]; answer: number; audioId: string; note: string };

function quizForVocab(vocabId: string): Quiz {
  const ans = vocab(vocabId);
  const opts = shuffle([ans, ...distractors(vocabId, 3)]);
  return {
    prompt: `「${ans.chinese}」的太魯閣族語是？`,
    options: opts.map((o) => o.word),
    answer: opts.findIndex((o) => o.word === ans.word),
    audioId: vocabId,
    note: `族語詞彙與發音來源：${SOURCE}。遊戲用法之文化複核進行中。`,
  };
}

function quizFor(card: JCard): Quiz {
  return quizForVocab(card.vocabId);
}

// v3（ORDER-031）：非卡牌動作（硬清／事件謹慎/補給）補答題閘門，避免完全繞過族語題
// （放行紅線：模式 A 必須內建族語答題迴圈——這幾個動作原本零門檻，等於繞過去了）
function randomVocabId(): string {
  return VOCAB[Math.floor(Math.random() * VOCAB.length)].id;
}

// ───────────────────────── 判定 ─────────────────────────

function settle(g: JGame): JGame {
  const ng = { ...g };
  if (ng.idx >= ng.nodes.length - 1) {
    ng.status = "won";
  } else if (ng.pressure >= ng.maxPressure || ng.teamHp <= 0) {
    ng.status = "lost";
  } else if (ng.day > levelCfg(ng).maxDay) {
    ng.status = "lost";
  }
  return ng;
}

// 到達新節點的即時效果（v2：event／supply 改為玩家主動選擇，不再自動結算）
function enterNode(g: JGame): JGame {
  const ng: JGame = { ...g, nodes: g.nodes.map((n) => ({ ...n })), res: { ...g.res } };
  const node = ng.nodes[ng.idx];
  if (!node) return ng;
  if (node.type === "start" || node.type === "destination") {
    node.cleared = true;
  } else if (node.type === "event") {
    ng.log = pushLog(ng.log, `抵達「${node.name}」：請選擇如何通過。`, "sys");
  } else if (node.type === "supply") {
    ng.log = pushLog(ng.log, `抵達「${node.name}」：請選擇要補給的資源。`, "sys");
  } else if (node.type === "hazard") {
    ng.log = pushLog(ng.log, `環境危害「${node.name}」擋在前方（${node.obstacle} 點）：不清除，每次紮營都會付出代價。`, "bad");
  }
  return ng;
}

// ───────────────────────── 前進（v2：脫離卡牌經濟，隨時可走，修死局）─────────────────────────

function canAdvance(g: JGame): boolean {
  if (g.status !== "playing") return false;
  if (g.ap < 1) return false;
  const node = g.nodes[g.idx];
  return !!node && node.cleared && g.idx < g.nodes.length - 1;
}

function advance(g: JGame): JGame {
  if (!canAdvance(g)) return g;
  let ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })), ap: g.ap - 1 };
  ng.idx += 1;
  ng = enterNode(ng);
  ng.log = pushLog(ng.log, `▶ 前進至「${ng.nodes[ng.idx].name}」。`, "info");
  // ORDER-048（P1）：快速通過的延遲反噬在抵達指定節點時觸發
  if (ng.fastDebt !== null && ng.idx >= ng.fastDebt) {
    ng.pressure = Math.min(ng.maxPressure, ng.pressure + 2);
    ng.fastDebt = null;
    ng.log = pushLog(ng.log, `當時快速通過沒探勘的路況，回頭咬了一口——壓力 +2。`, "bad");
  }
  return settle(ng);
}

// ───────────────────────── 花資源硬清（v2：risk/reward，落石/吊橋不靠語言題的另一條路）─────────────────────────

function hardClearCost(n: PathNode): Partial<Record<Resource, number>> | null {
  if (n.type === "obstacle" && !n.cleared) return { stone: 2 };
  if (n.type === "bridge" && !n.cleared) return { wood: 2, rope: 2 };
  // ORDER-050：環境危害的資源解——花料架起足夠堅固的遮蔽硬撐過去（比照橋段的雙資源代價）
  if (n.type === "hazard" && !n.cleared) return { wood: 2, rope: 2 };
  return null;
}

function canHardClear(g: JGame): boolean {
  if (g.status !== "playing") return false;
  const node = g.nodes[g.idx];
  const cost = node && hardClearCost(node);
  if (!cost) return false;
  return Object.entries(cost).every(([r, v]) => g.res[r as Resource] >= (v ?? 0));
}

// v3（ORDER-031）：花資源硬清補答題閘門（答對全額清除／答錯半額，資源照樣扣——
// 原本零門檻等於繞過族語題，違反模式 A 放行紅線）
function hardClear(g: JGame, correct: boolean, vocabId: string): JGame {
  if (!canHardClear(g)) return g;
  const cost = hardClearCost(g.nodes[g.idx]) as Partial<Record<Resource, number>>;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  for (const [r, v] of Object.entries(cost)) ng.res[r as Resource] -= v ?? 0;
  ng.wordLog = [...ng.wordLog, { vocabId, correct }];
  if (correct) {
    ng.correct += 1;
    ng.streak += 1;
  } else {
    ng.wrong += 1;
    ng.streak = 0;
  }
  const node = ng.nodes[ng.idx];
  if (correct) {
    node.obstacle = 0;
    node.cleared = true;
    ng.log = pushLog(ng.log, `✓ 答對｜花資源硬清：「${node.name}」已可通行。`, "good");
  } else {
    const half = Math.ceil(node.obstacle / 2);
    node.obstacle = half;
    if (node.obstacle === 0) node.cleared = true;
    ng.log = pushLog(ng.log, `✕ 答錯｜花資源硬清：資源已耗，僅清一半（剩 ${node.obstacle}）。`, "info");
  }
  return settle(applyStreakBonus(ng));
}

// ───────────────────────── 事件／補給節點選擇（v2：真取捨；v3 加答題閘門）─────────────────────────

// 「快速通過」故意保留免答題（設計本意：花代價換省事的高風險捷徑），但代價調高（壓力+2→+4）
// 「謹慎探勘」改為答題閘門：答對才有額外糧食，答錯仍清節點但沒有加碼
function resolveEventChoice(g: JGame, choice: "fast" | "careful", correct?: boolean, vocabId?: string): JGame {
  const node = g.nodes[g.idx];
  if (g.status !== "playing" || !node || node.type !== "event" || node.cleared) return g;
  if (choice === "careful" && (g.res.wood < 1 || g.res.rope < 1)) return g;
  let ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  const n2 = ng.nodes[ng.idx];
  n2.cleared = true;
  if (choice === "fast") {
    ng.pressure = Math.min(ng.maxPressure, ng.pressure + 4);
    // ORDER-048（P1）：沒探勘就硬闖，兩個節點後路況回來咬人（TRPG「選擇有重量」）
    ng.fastDebt = ng.idx + 2;
    ng.log = pushLog(ng.log, `「${n2.name}」快速通過：壓力 +4。沒探勘的路況，之後可能回來咬人。`, "bad");
  } else {
    ng.res.wood -= 1;
    ng.res.rope -= 1;
    if (vocabId) ng.wordLog = [...ng.wordLog, { vocabId, correct: !!correct }];
    if (correct) {
      ng.correct += 1;
      ng.streak += 1;
      ng.res.food += 1;
      ng.log = pushLog(ng.log, `✓ 答對｜「${n2.name}」謹慎探勘：耗木材1・繩索1，沿途採得糧食 +1。`, "good");
    } else {
      ng.wrong += 1;
      ng.streak = 0;
      ng.log = pushLog(ng.log, `✕ 答錯｜「${n2.name}」謹慎探勘：耗木材1・繩索1，沒能多找到什麼。`, "info");
    }
    ng = applyStreakBonus(ng);
  }
  return settle(ng);
}

// 補給答題閘門：答對 +3（維持既有30%變動加碼），答錯僅 +1（無加碼）
function resolveSupplyChoice(g: JGame, resource: Resource, correct: boolean, vocabId: string): JGame {
  const node = g.nodes[g.idx];
  if (g.status !== "playing" || !node || node.type !== "supply" || node.cleared) return g;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  const n2 = ng.nodes[ng.idx];
  n2.cleared = true;
  ng.wordLog = [...ng.wordLog, { vocabId, correct }];
  if (correct) {
    ng.correct += 1;
    ng.streak += 1;
    ng.res[resource] += 3;
    if (Math.random() < 0.3) {
      const resources: Resource[] = ["food", "wood", "stone", "rope"];
      const bonus = resources[Math.floor(Math.random() * resources.length)];
      ng.res[bonus] += 1;
      ng.log = pushLog(
        ng.log,
        `✓ 答對｜「${n2.name}」補給：${RES_NAME[resource]} +3，意外多撿到 ${RES_NAME[bonus]} +1！`,
        "good",
      );
    } else {
      ng.log = pushLog(ng.log, `✓ 答對｜「${n2.name}」補給：${RES_NAME[resource]} +3。`, "good");
    }
  } else {
    ng.wrong += 1;
    ng.streak = 0;
    ng.res[resource] += 1;
    ng.log = pushLog(ng.log, `✕ 答錯｜「${n2.name}」補給：${RES_NAME[resource]} +1。`, "info");
  }
  return settle(applyStreakBonus(ng));
}

// ───────────────────────── 修復路段（v5，ORDER-036：動手建造，落石節點專用）─────────────────────────
// 司令回饋：故事寫了「這次換你們重新排一次路」，結果玩家只是點按鈕答題，敘事沒兌現、遊戲太單薄。
// 改成真的要動手選材料疊路：頁岩堆疊路基、蛇木架橫樑（可省略，改走純疊石工法）、藤索綁緊固定（必要）。
// 簡化版規則式穩定度判定（非真實物理引擎，依司令拍板）。族語題仍保留、但降為輔助加成，不是唯一內容。
type BuildMaterials = { stone: number; wood: number; rope: number };

// ORDER-053：把落石與吊橋拆成兩種工法。玩家不是只在堆同一種分數，
// 而是要看眼前的山況決定「穩住路基」或「把兩岸接回來」。
type BuildMode = "rockfall" | "bridge";

function buildModeForNode(node: PathNode | undefined): BuildMode | null {
  if (node?.type === "obstacle") return "rockfall";
  if (node?.type === "bridge") return "bridge";
  return null;
}

function buildScore(b: BuildMaterials, mode: BuildMode): number {
  return mode === "bridge"
    ? Math.min(100, b.wood * 25 + b.rope * 15 + b.stone * 5)
    : Math.min(100, b.stone * 10 + b.wood * 20);
}

// 環境機制（純自然力，不掛任何族語信仰概念）：石頭堆太密會擋住水路，測試時有機率被溪水沖毀部分結構
function resolveBuildTest(g: JGame, b: BuildMaterials, quizCorrect: boolean, vocabId: string): JGame {
  const node = g.nodes[g.idx];
  const mode = buildModeForNode(node);
  if (g.status !== "playing" || !node || !mode || node.cleared || b.rope < 1) return g;
  // 吊橋需要至少兩根橫樑才有跨距；這是玩家在畫面上看得懂的硬條件，不靠隱藏數值猜答案。
  if (mode === "bridge" && b.wood < 2) return g;
  const ng: JGame = { ...g, nodes: g.nodes.map((n) => ({ ...n })) };
  ng.wordLog = [...ng.wordLog, { vocabId, correct: quizCorrect }];
  if (quizCorrect) {
    ng.correct += 1;
    ng.streak += 1;
  } else {
    ng.wrong += 1;
    ng.streak = 0;
  }

  let score = buildScore(b, mode) + (quizCorrect ? 15 : 0);
  const stormPenalty = mode === "bridge" && pressureTier(g) === "critical" ? 15 : 0;
  score = Math.max(0, score - stormPenalty);
  let envPenalty = false;
  if (mode === "rockfall" && b.stone > 8 && Math.random() < 0.3) {
    score = Math.max(0, score - 25);
    envPenalty = true;
  }
  const n2 = ng.nodes[ng.idx];
  const pass = score >= 60;
  if (pass) {
    n2.obstacle = 0;
    n2.cleared = true;
    if (mode === "rockfall" && b.wood === 0) {
      const cap = effectiveMaxAp(ng);
      if (ng.ap < cap) ng.ap = Math.min(cap, ng.ap + 1);
      ng.log = pushLog(ng.log, `✓ 「${n2.name}」重新排好了路——全程沒砍一根木材，工法巧思獎勵：行動點 +1！`, "good");
    } else if (mode === "bridge") {
      ng.log = pushLog(
        ng.log,
        stormPenalty > 0
          ? `✓ 「${n2.name}」在暴風裡接回兩岸——你用足橫樑與藤索，橋身撐住了。`
          : `✓ 「${n2.name}」兩岸重新接起，隊伍踩著有彈性的橋面安全通過。`,
        "good",
      );
    } else {
      ng.log = pushLog(ng.log, `✓ 「${n2.name}」重新排好了路，隊伍安全通過。`, "good");
    }
  } else if (envPenalty) {
    ng.log = pushLog(ng.log, `石頭堆太密擋住了水路，溪水暴漲沖毀了部分結構，得再加固一次。`, "bad");
  } else {
    ng.log = pushLog(ng.log, `✕ 結構還不夠穩，山羌走到一半又跳了回來，得再加固一次。`, "info");
  }
  return settle(applyStreakBonus(ng));
}

// ───────────────────────── 出牌結算 ─────────────────────────

function apCost(g: JGame, card: JCard): number {
  return Math.max(0, card.cost - g.coopDiscount);
}

function canAfford(g: JGame, card: JCard): boolean {
  if (g.status !== "playing") return false;
  if (apCost(g, card) > g.ap) return false;
  if (card.costRes) {
    for (const [r, v] of Object.entries(card.costRes)) {
      if (g.res[r as Resource] < (v ?? 0)) return false;
    }
  }
  return true;
}

// 連擊獎勵（v2）：每連對 3 題，順風而行，補 1 行動點。共用給卡牌與 v3 答題閘門動作。
function applyStreakBonus(ng: JGame): JGame {
  if (ng.streak > 0 && ng.streak % 3 === 0) {
    const cap = effectiveMaxAp(ng);
    if (ng.ap < cap) {
      ng.ap = Math.min(cap, ng.ap + 1);
      ng.log = pushLog(ng.log, `連對 ${ng.streak} 題！順風而行，行動點 +1。`, "good");
    } else {
      ng.log = pushLog(ng.log, `連對 ${ng.streak} 題！順風而行。`, "good");
    }
  }
  return ng;
}

// v7（ORDER-042）：族語試煉改綁節點——司令回饋「族語的挑戰不是在上面啦，他要跟節點有關係」，
// 並分享 TRPG 概念文（節點＝一幕遭遇場景，語言檢定要內嵌在場景裡，不是懸浮的旁支功能）。
// 原本標題列的「族語挑戰」（全詞庫隨機 10 題、跟情境無關）拆掉，改成每個節點一次的「族語試煉」：
// 3 題（第 1 題固定是該節點自己的詞，其餘從全詞庫抽），像 TRPG 的技能檢定——
// 通過（≥2/3）依節點型別給情境化獎勵：障礙/吊橋未清 → 阻礙 -1（邊做邊念，手更穩）；
// 其他情況 → 壓力 -1（隊伍沿路練語，心安腳穩）。未通過不懲罰，只記錄。
// 文化備註：檢定的敘事框架是「隊伍自己沿路練習詞彙」，刻意不用 TRPG 常見的「翻譯古文碑刻」
// 之類裝置——太魯閣族傳統上沒有文字系統，發明碑文等於捏造文化，屬紅線。
function applyNodeTrial(g: JGame, nodeId: string, results: { vocabId: string; correct: boolean }[]): JGame {
  const ng: JGame = { ...g, wordLog: [...g.wordLog, ...results], nodes: g.nodes.map((n) => ({ ...n })), trialedNodes: [...g.trialedNodes, nodeId] };
  const total = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  ng.correct += correctCount;
  ng.wrong += total - correctCount;
  const passed = total > 0 && correctCount / total >= 2 / 3;
  const node = ng.nodes[ng.idx];
  if (passed) {
    // ORDER-048（P1）：30% 機率升級獎勵（變動報酬，做出「賭一把」的期待感）
    const boosted = Math.random() < 0.3;
    if (node && !node.cleared && node.obstacle > 0) {
      const amt = boosted ? Math.min(2, node.obstacle) : 1;
      node.obstacle -= amt;
      if (node.obstacle === 0) node.cleared = true;
      ng.log = pushLog(
        ng.log,
        boosted
          ? `✓ 族語試煉 ${correctCount}/${total}：念得又快又順，手勢默契絕佳——「${node.name}」阻礙 -${amt}（剩 ${node.obstacle}）！`
          : `✓ 族語試煉 ${correctCount}/${total}：邊做邊念，手更穩——「${node.name}」阻礙 -1（剩 ${node.obstacle}）。`,
        "good",
      );
    } else {
      const amt = boosted ? 2 : 1;
      ng.pressure = Math.max(0, ng.pressure - amt);
      ng.log = pushLog(
        ng.log,
        boosted
          ? `✓ 族語試煉 ${correctCount}/${total}：整隊越念越有勁，壓力 -${amt}！`
          : `✓ 族語試煉 ${correctCount}/${total}：隊伍沿路練語，心安腳穩，壓力 -1。`,
        "good",
      );
    }
  } else {
    ng.log = pushLog(ng.log, `族語試煉 ${correctCount}/${total}：這幾個詞還不熟，路上再多念幾次。`, "info");
  }
  return settle(ng);
}

function playCard(g: JGame, card: JCard, correct: boolean): JGame {
  if (!canAfford(g, card)) return g;
  let ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };

  // 扣行動點與資源
  ng.ap -= apCost(g, card);
  if (g.coopDiscount > 0) ng.coopDiscount = 0;
  if (card.costRes) {
    for (const [r, v] of Object.entries(card.costRes)) {
      ng.res[r as Resource] -= v ?? 0;
    }
  }
  // 出牌進棄牌堆
  ng.hand = ng.hand.filter((c) => c.key !== card.key);
  ng.discard = [...ng.discard, card];
  if (card.quiz) {
    ng.wordLog = [...ng.wordLog, { vocabId: card.vocabId, correct }];
    if (correct) {
      ng.correct += 1;
      ng.streak += 1;
    } else {
      ng.wrong += 1;
      ng.streak = 0;
    }
  } else {
    ng.streak = 0; // 不需答題的卡也會重置連擊（v2 設計：連擊只獎勵持續答對）
  }

  const node = ng.nodes[ng.idx];
  const tag = card.quiz ? (correct ? "✓ 答對" : "✕ 答錯") : "▶";

  switch (card.effect) {
    case "scout": {
      // v2：巡路不再是前進唯一解（見常駐「前進」按鈕），但答對有額外獎勵（壓力 -1）
      if (node && node.cleared && ng.idx < ng.nodes.length - 1) {
        ng.idx += 1;
        ng = enterNode(ng);
        // ORDER-048（P1）：與常駐「前進」一致，快速通過的延遲反噬也在此結算
        if (ng.fastDebt !== null && ng.idx >= ng.fastDebt) {
          ng.pressure = Math.min(ng.maxPressure, ng.pressure + 2);
          ng.fastDebt = null;
          ng.log = pushLog(ng.log, `當時快速通過沒探勘的路況，回頭咬了一口——壓力 +2。`, "bad");
        }
        if (correct) {
          ng.pressure = Math.max(0, ng.pressure - 1);
          ng.log = pushLog(ng.log, `${tag}｜巡路：前進至「${ng.nodes[ng.idx].name}」，腳步輕快，壓力 -1。`, "good");
        } else {
          ng.log = pushLog(ng.log, `${tag}｜巡路：前進至「${ng.nodes[ng.idx].name}」。`, "info");
        }
      } else {
        ng.log = pushLog(ng.log, `${tag}｜巡路：目前路段尚未通行，無法前進。`, "bad");
      }
      break;
    }
    case "clearStone": {
      const amt = correct ? 2 : 1;
      if (node && node.type === "obstacle" && !node.cleared) {
        node.obstacle = Math.max(0, node.obstacle - amt);
        if (node.obstacle === 0) node.cleared = true;
        ng.log = pushLog(ng.log, `${tag}｜搬石：清除阻礙 ${amt}（剩 ${node.obstacle}）。`, correct ? "good" : "info");
      } else {
        ng.log = pushLog(ng.log, `${tag}｜搬石：此處無落石可清。`, "bad");
      }
      break;
    }
    case "buildBridge": {
      if (node && node.type === "bridge" && !node.cleared) {
        if (correct) {
          node.obstacle = 0;
          node.cleared = true;
          ng.log = pushLog(ng.log, `${tag}｜搭橋：橋段完成，可通行。`, "good");
        } else {
          ng.log = pushLog(ng.log, `${tag}｜搭橋：材料已用，橋段僅完成一半，需再接再厲。`, "bad");
        }
      } else {
        ng.log = pushLog(ng.log, `${tag}｜搭橋：此處無需搭橋。`, "bad");
      }
      break;
    }
    case "coopClear": {
      const full = ng.teamHp < 5 ? 2 : 3;
      const amt = correct ? full : 1;
      if (node && (node.type === "obstacle" || node.type === "bridge" || node.type === "hazard") && !node.cleared) {
        node.obstacle = Math.max(0, node.obstacle - amt);
        if (node.obstacle === 0) node.cleared = true;
        ng.log = pushLog(ng.log, `${tag}｜共同搬運：協力清除 ${amt}（剩 ${node.obstacle}）。`, correct ? "good" : "info");
      } else {
        ng.log = pushLog(ng.log, `${tag}｜共同搬運：此處無阻礙。`, "bad");
      }
      break;
    }
    case "gatherFood": {
      ng.res.food += 2;
      // v2 機制移植：30% 機率額外加碼（獎懲系統原理：固定獎勵缺乏驚喜，混搭變動獎勵）
      if (Math.random() < 0.3) {
        ng.res.food += 1;
        ng.log = pushLog(ng.log, `▶｜整理物資：糧食 +2，意外多找到一份，+1（${ng.res.food}）！`, "good");
      } else {
        ng.log = pushLog(ng.log, `▶｜整理物資：糧食 +2（${ng.res.food}）。`, "good");
      }
      break;
    }
    case "reduceStress": {
      const amt = correct ? 3 : 1;
      ng.pressure = Math.max(0, ng.pressure - amt);
      ng.log = pushLog(ng.log, `${tag}｜守望：壓力 -${amt}（${ng.pressure}/${ng.maxPressure}）。`, correct ? "good" : "info");
      break;
    }
    case "weaveMark": {
      const amt = correct ? 2 : 1;
      ng.pressure = Math.max(0, ng.pressure - amt);
      ng.coopDiscount = 1;
      ng.log = pushLog(ng.log, `${tag}｜分工合作：壓力 -${amt}，下一張牌行動點 -1。`, correct ? "good" : "info");
      break;
    }
    // ORDER-050（P2 第二關）：環境危害清除牌（改編自設計文件第一章 RESOLVE_ACTION）
    case "braceWind": {
      const amt = correct ? 2 : 1;
      if (node && node.type === "hazard" && !node.cleared) {
        node.obstacle = Math.max(0, node.obstacle - amt);
        if (node.obstacle === 0) node.cleared = true;
        ng.log = pushLog(ng.log, `${tag}｜頂風前行：低頭用肩膀頂住風，危害 -${amt}（剩 ${node.obstacle}）。`, correct ? "good" : "info");
      } else {
        ng.log = pushLog(ng.log, `${tag}｜頂風前行：此處沒有環境危害。`, "bad");
      }
      break;
    }
    case "shelterBrace": {
      const amt = correct ? 2 : 1;
      if (node && node.type === "hazard" && !node.cleared) {
        node.obstacle = Math.max(0, node.obstacle - amt);
        if (node.obstacle === 0) node.cleared = true;
        if (correct) {
          ng.pressure = Math.max(0, ng.pressure - 1);
          ng.log = pushLog(ng.log, `${tag}｜架設臨時遮蔽：撐起一角擋住最猛的那陣，危害 -${amt}（剩 ${node.obstacle}），壓力 -1。`, "good");
        } else {
          ng.log = pushLog(ng.log, `${tag}｜架設臨時遮蔽：勉強撐起，危害 -${amt}（剩 ${node.obstacle}）。`, "info");
        }
      } else {
        ng.log = pushLog(ng.log, `${tag}｜架設臨時遮蔽：此處沒有環境危害。`, "bad");
      }
      break;
    }
  }

  return settle(applyStreakBonus(ng));
}

// ───────────────────────── 紮營（結束當日）─────────────────────────

function camp(g: JGame): JGame {
  if (g.status !== "playing") return g;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };

  // 消耗糧食：壓力分級（v2）——緊張／危急時消耗加倍，逼玩家加快腳步
  const foodCost = pressureTier(g) === "calm" ? 1 : 2;
  ng.res.food -= foodCost;
  if (ng.res.food < 0) {
    ng.res.food = 0;
    ng.teamHp = Math.max(0, ng.teamHp - 2);
    ng.log = pushLog(ng.log, `紮營：糧食不足，隊伍體力 -2。`, "bad");
  } else {
    ng.log = pushLog(ng.log, `紮營：消耗 ${foodCost} 糧食（剩 ${ng.res.food}）。`, "sys");
  }

  // 未處理的路段阻礙 → 壓力 +1；環境危害（ORDER-050，P2）→ 套用該危害的 ongoingPenalty
  // （設計文件第一章：ENVIRONMENT_HAZARD 未清除，每回合結束持續付出代價——取代一般的 +1 壓力）
  const node = ng.nodes[ng.idx];
  if (node && !node.cleared) {
    if (node.type === "hazard" && node.hazard) {
      if (node.hazard.kind === "hp") {
        ng.teamHp = Math.max(0, ng.teamHp - node.hazard.amount);
      } else {
        ng.pressure = Math.min(ng.maxPressure, ng.pressure + node.hazard.amount);
      }
      ng.log = pushLog(ng.log, `環境危害「${node.name}」未清除，整夜肆虐：${node.hazard.text}。`, "bad");
    } else {
      ng.pressure = Math.min(ng.maxPressure, ng.pressure + 1);
      ng.log = pushLog(ng.log, `「${node.name}」尚未通行，壓力 +1。`, "bad");
    }
  }

  // 進入下一日
  ng.day += 1;
  ng.ap = ng.maxAp;
  ng.coopDiscount = 0;

  // 翻新事件（事件池依關卡設定：第二關加入風雨主題事件）
  const pool = levelCfg(ng).events;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  ng.event = ev;
  ng.pressure = Math.max(0, Math.min(ng.maxPressure, ng.pressure + ev.pressure));
  ng.log = pushLog(
    ng.log,
    `第 ${ng.day} 日｜事件「${ev.name}」（${ev.kind}）：壓力 ${ev.pressure >= 0 ? "+" : ""}${ev.pressure}。${ev.desc}`,
    ev.pressure > 0 ? "bad" : "good",
  );

  // 危急（壓力≥8）：行動點上限收緊，套用今日事件後的最終壓力值判定
  ng.ap = Math.min(ng.ap, effectiveMaxAp(ng));
  if (pressureTier(ng) === "critical") {
    ng.log = pushLog(ng.log, "情勢危急：行動點上限收緊為 2。", "bad");
  }

  // 補牌至手牌上限
  while (ng.hand.length < HAND_LIMIT && (ng.deck.length > 0 || ng.discard.length > 0)) {
    if (ng.deck.length === 0) {
      ng.deck = shuffle(ng.discard);
      ng.discard = [];
    }
    const [top, ...rest] = ng.deck;
    ng.hand = [...ng.hand, top];
    ng.deck = rest;
  }

  return settle(ng);
}

// ───────────────────────── 元件 ─────────────────────────

function playAudio(id: string | null) {
  if (!id) return;
  const url = audioUrl(id);
  if (!url || typeof window === "undefined") return;
  try {
    const a = new Audio(url);
    void a.play().catch(() => {});
  } catch {
    /* 忽略播放失敗（如來源暫時無法連線） */
  }
}

// ───────────────────────── 任務引導（mode-a-quests-v1，Calypso）─────────────────────────

// 目前這一步的「狀況」＋「該做什麼」（依當前節點型別與狀態，v2：對齊 core-loop-v2 設計）
// 各節點狀態下「能清除」所需的行動牌效果（不含前進——前進已脫離卡牌經濟，見常駐「前進」按鈕）
function neededEffects(n: PathNode): EffectId[] {
  if (!n.cleared && n.type === "obstacle") return ["clearStone", "coopClear"];
  if (!n.cleared && n.type === "bridge") return ["buildBridge", "coopClear"];
  if (!n.cleared && n.type === "hazard") return ["braceWind", "shelterBrace", "coopClear"];
  return [];
}

// ORDER-051（追加引導重修）：「這一步」文案全面改為動詞開頭的祈使句——司令回饋
// 「玩家不知道如何是好，我現在要做什麼都沒有說」。指令感優先，機制資訊照舊保留。
function stepHint(g: JGame): { situation: string; todo: string } {
  if (g.status === "won")
    return g.levelId === "l2"
      ? { situation: "抵達山腳背風處！", todo: "隊伍完整地下了山，任務完成。" }
      : { situation: "抵達部落！", todo: "隊伍平安返家，任務完成。" };
  if (g.status === "lost") return { situation: "任務失敗", todo: "點「重新開始」，再走一次。" };
  const n = g.nodes[g.idx];
  const last = g.idx >= g.nodes.length - 1;
  const apNote = g.ap <= 0 ? "　行動點用完了——按「紮營」收束今日，換日補滿行動點。" : "";
  let s: { situation: string; todo: string };
  switch (n.type) {
    case "obstacle":
    case "bridge": {
      const label = n.type === "obstacle" ? `落石擋道（剩 ${n.obstacle} 點）` : "峽谷吊橋斷裂";
      if (n.cleared) {
        s = { situation: n.type === "obstacle" ? "落石已清除" : "吊橋已完成", todo: "按「前進」，繼續上路（行動點 -1）。" };
      } else {
        const hasCard = g.hand.some((c) => neededEffects(n).includes(c.effect));
        const canHard = n.type === "obstacle" ? g.res.rope >= 1 : canHardClear(g);
        s = {
          situation: label,
          todo:
            !hasCard && !canHard
              ? n.type === "obstacle"
                ? "先按「紮營」換日重抽手牌、囤資源——手上沒有可用行動牌，繩索也不夠（修復路段至少要 1 繩索）。"
                : "先按「紮營」換日重抽手牌、囤資源——手上沒有可用行動牌，資源也不夠硬清。"
              : n.type === "obstacle"
                ? "把落石清掉——出「搬石」／「共同搬運」牌快速清，或點「修復路段」動手疊石架橋（可省木材，答題只是加成不是唯一內容）。"
                : "把橋接起來——出「搭橋」／「共同搬運」牌、點「搭建吊橋」動手接兩岸，或花資源硬清（木材×2・繩索×2）；每條路都會留下不同代價。",
        };
      }
      break;
    }
    case "start":
      s = { situation: `${n.name.replace("（起點）", "")}・出發點`, todo: "按「前進」，帶隊伍出發（行動點 -1）。" };
      break;
    case "hazard": {
      // ORDER-050（P2）：環境危害節點——不清除就每晚吃 ongoingPenalty，提示要講清楚代價
      if (n.cleared) {
        s = { situation: `${n.name}・已平息`, todo: "按「前進」，繼續上路（行動點 -1）。" };
      } else {
        s = {
          situation: `環境危害：${n.name}（剩 ${n.obstacle} 點）`,
          todo: `把危害壓下去——出「頂風前行」／「架設臨時遮蔽」／「共同搬運」牌清除，或花資源架遮蔽硬撐（木材×2・繩索×2）。放著不管，每次紮營：${n.hazard?.text ?? "持續付出代價"}。`,
        };
      }
      break;
    }
    case "event":
      s = n.cleared
        ? { situation: `${n.name}・已通過`, todo: "按「前進」，繼續上路（行動點 -1）。" }
        : { situation: n.name, todo: "選一條路通過——按「快速通過」（壓力 +4，之後路況可能反噬）或「謹慎探勘」（耗木材/繩索各1，答對換糧食 +1）。" };
      break;
    case "supply":
      s = n.cleared
        ? { situation: `${n.name}・已補給`, todo: "按「前進」，繼續上路（行動點 -1）。" }
        : { situation: `${n.name}・補給點`, todo: "點一項資源進行補給——答對 +3、答錯僅 +1。" };
      break;
    case "destination":
      s = { situation: last ? `${n.name.replace("（目的地）", "")}・終點在望` : n.name, todo: "按「前進」抵達終點，把每一個人帶回去。" };
      break;
    default:
      s = { situation: n.name, todo: "按「前進」，繼續上路。" };
  }
  return { situation: s.situation, todo: s.todo + apNote };
}

// ORDER-051（引導點 1）：行動聚光燈——任何時刻只有一顆「當前該按的鈕」。
// 判定優先序：終局→無；當前節點未清（落石→修復路段；吊橋/危害→硬清；事件→兩選項；補給→資源選項）；
// 已清且可前進（AP≥1）→前進；AP=0→紮營。
type PrimaryAction = "repair" | "hazard" | "event" | "supply" | "advance" | "camp" | null;

function primaryAction(g: JGame): PrimaryAction {
  if (g.status !== "playing") return null;
  const n = g.nodes[g.idx];
  if (!n) return null;
  if (!n.cleared && (n.type === "obstacle" || n.type === "bridge")) return "repair";
  if (!n.cleared && n.type === "hazard") return "hazard";
  if (!n.cleared && n.type === "event") return "event";
  if (!n.cleared && n.type === "supply") return "supply";
  if (n.cleared && g.idx < g.nodes.length - 1 && g.ap >= 1) return "advance";
  if (g.ap <= 0) return "camp";
  return null;
}

type SideQuest = { label: string; note: string; state: "ok" | "fail" | "pending" };

function sideQuests(g: JGame): SideQuest[] {
  const won = g.status === "won";
  const speedDay = levelCfg(g).maxDay - 1; // 天數上限依關卡設定（ORDER-050）
  return [
    {
      label: "零失誤",
      note: "全程族語不答錯",
      state: g.wrong === 0 ? "ok" : "fail",
    },
    {
      label: g.levelId === "l2" ? "搶在風暴前" : "神速返鄉",
      note: `第 ${speedDay} 日前抵達`,
      state: g.day > speedDay ? "fail" : won ? "ok" : "pending",
    },
    {
      label: "糧草無虞",
      note: won ? "抵達時糧食 ≥ 4" : "糧食保持 ≥ 4",
      state: g.res.food >= 4 ? "ok" : won ? "fail" : "pending",
    },
  ];
}

// ───────────────────────── 修復路段：動手拖拉建造畫布（v6，ORDER-040）─────────────────────────
// 司令分享了一份參考原型（canvas 拖拉連線 + 彈簧鬆弛視覺 + 山羌沿路徑走過的動畫），
// 想把「搭橋」做得更有實感。決定：真正的過關判定（穩定度公式、資源扣除、答題閘門）
// 沿用已上線且測試過的 resolveBuildTest／building 狀態（見上方），不讓一個全新的物理權威
// 取代已驗證的規則——避免在沒有充分測試的情況下引入新的破綻。這個畫布純粹是「動手建造」的
// 互動與視覺層：拖拉頁岩/橫樑/藤索連線＋輕量鬆弛動畫＋依實際判定結果播放山羌沿路徑通過或摔落的
// 過場動畫。不做應力斷裂判定（沒有這個必要，也避免額外的失敗模式）。
//
// 文化把關：原型用「祖靈祝福(Gaya)」當分數、把占卜鳥 Sisin 寫成會講話的教學吉祥物——
// 兩者都被拿掉。Gaya 是太魯閣族現在仍在使用的祖訓/生活規範系統，不當分數或評語角色；
// Sisin 占卜鳥是真實仍在使用的占卜方式，不裝萌當導覽員。提示文字改用中性的「工法筆記」。
// 材料標籤也一併修正：原型誤用「Urung」當黃藤（已驗證 urung＝動物的角，對不上）、
// 「Qwarux」查無來源——一律改用遊戲既有已驗證詞：qhuni（木材）／gasil（繩索）。

type PNode = { id: string; x: number; y: number; fixed: boolean; anchor: boolean; side?: "left" | "right"; vx: number; vy: number };
type PSpring = { a: string; b: string; length: number; kind: "wood" | "rope" };
type Pier = { x: number; y: number; width: number; nodeId: string };

type BuildCanvasHandle = {
  runCrossing: (pass: boolean, onDone: () => void) => void;
};

const BuildCanvas = forwardRef<
  BuildCanvasHandle,
  { tool: "stone" | "wood" | "rope"; onUseMaterial: (kind: "stone" | "wood" | "rope") => boolean; interactive: boolean }
>(function BuildCanvas({ tool, onUseMaterial, interactive }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const interactiveRef = useRef(interactive);
  interactiveRef.current = interactive;
  const onUseMaterialRef = useRef(onUseMaterial);
  onUseMaterialRef.current = onUseMaterial;

  const stateRef = useRef({
    nodes: [] as PNode[],
    springs: [] as PSpring[],
    piers: [] as Pier[],
    dragFrom: null as PNode | null,
    mouse: { x: 0, y: 0 },
    hover: null as PNode | null,
    deer: { active: false, x: 0, y: 0, path: [] as PNode[], t: 0, dur: 0, fallAt: 1, done: false },
  });

  function findWalkPath(): PNode[] | null {
    const s = stateRef.current;
    const left = s.nodes.find((n) => n.id === "L1");
    if (!left) return null;
    const visited = new Set<string>();
    let found: PNode[] | null = null;
    function dfs(node: PNode, path: PNode[]) {
      if (visited.has(node.id) || found) return;
      visited.add(node.id);
      path.push(node);
      if (node.fixed && node.side === "right") {
        found = [...path];
        return;
      }
      const neighbors: PNode[] = [];
      for (const sp of s.springs) {
        if (sp.a === node.id) {
          const n2 = s.nodes.find((n) => n.id === sp.b);
          if (n2) neighbors.push(n2);
        } else if (sp.b === node.id) {
          const n2 = s.nodes.find((n) => n.id === sp.a);
          if (n2) neighbors.push(n2);
        }
      }
      neighbors.sort((a, b) => b.x - a.x);
      for (const n2 of neighbors) dfs(n2, path);
      path.pop();
    }
    dfs(left, []);
    return found;
  }

  useImperativeHandle(ref, () => ({
    runCrossing(pass, onDone) {
      const s = stateRef.current;
      const path = findWalkPath();
      const usablePath = path && path.length >= 2 ? path : null;
      const dur = 1400;
      if (usablePath) {
        s.deer = { active: true, x: usablePath[0].x, y: usablePath[0].y - 10, path: usablePath, t: 0, dur, fallAt: pass ? 1 : 0.35 + Math.random() * 0.3, done: false };
      } else {
        // 沒有連通路徑：山羌原地表示「走不過去」，直接判定為未通過的短動畫
        const left = s.nodes.find((n) => n.id === "L1");
        s.deer = {
          active: true,
          x: left ? left.x : 0,
          y: left ? left.y - 10 : 0,
          path: left ? [left, left] : [],
          t: 0,
          dur: 500,
          fallAt: pass ? 1 : 0,
          done: false,
        };
      }
      const check = setInterval(() => {
        if (s.deer.done) {
          clearInterval(check);
          onDone();
        }
      }, 100);
    },
  }));

  // 初始化與畫布尺寸（掛載一次；resize 監聽用 ResizeObserver）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = canvas.parentElement;
    if (!container) return;

    function initNodes(w: number, h: number) {
      // 錨點座標對齊 repair-river-board.jpg 上「畫在圖裡」的四個金色光圈（ORDER-046：
      // 底圖換成俯視溪谷實景圖，canvas 只疊互動層），改圖時要一併校正這組比例。
      stateRef.current.nodes = [
        { id: "L1", x: w * 0.184, y: h * 0.237, fixed: true, anchor: true, side: "left", vx: 0, vy: 0 },
        { id: "L2", x: w * 0.171, y: h * 0.674, fixed: true, anchor: true, side: "left", vx: 0, vy: 0 },
        { id: "R1", x: w * 0.792, y: h * 0.231, fixed: true, anchor: true, side: "right", vx: 0, vy: 0 },
        { id: "R2", x: w * 0.816, y: h * 0.663, fixed: true, anchor: true, side: "right", vx: 0, vy: 0 },
      ];
      stateRef.current.springs = [];
      stateRef.current.piers = [];
      stateRef.current.deer = { active: false, x: 0, y: 0, path: [], t: 0, dur: 0, fallAt: 1, done: false };
    }

    function resize() {
      const w = container!.clientWidth;
      const h = container!.clientHeight;
      canvas!.width = w;
      canvas!.height = h;
      initNodes(w, h);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    function getPos(clientX: number, clientY: number) {
      const rect = canvas!.getBoundingClientRect();
      return { x: (clientX - rect.left) * (canvas!.width / rect.width), y: (clientY - rect.top) * (canvas!.height / rect.height) };
    }

    function nodeAt(pos: { x: number; y: number }): PNode | null {
      let found: PNode | null = null;
      for (const n of stateRef.current.nodes) {
        const d = Math.hypot(n.x - pos.x, n.y - pos.y);
        if (d < 13) found = n;
      }
      return found;
    }

    function onPointerDown(e: PointerEvent) {
      if (!interactiveRef.current) return;
      const pos = getPos(e.clientX, e.clientY);
      const s = stateRef.current;
      if (toolRef.current === "stone") {
        // 俯視圖：溪面約佔畫面中段（兩岸各留邊），頁岩樁只能放在溪面範圍
        const inRiver =
          pos.x > canvas!.width * 0.24 && pos.x < canvas!.width * 0.76 && pos.y > canvas!.height * 0.08 && pos.y < canvas!.height * 0.92;
        if (inRiver) {
          if (!onUseMaterialRef.current("stone")) return;
          const id = "P" + Math.random().toString(36).slice(2);
          s.nodes.push({ id, x: pos.x, y: pos.y, fixed: true, anchor: false, vx: 0, vy: 0 });
          s.piers.push({ x: pos.x, y: pos.y, width: 28, nodeId: id });
        }
        return;
      }
      const hit = nodeAt(pos);
      if (hit) s.dragFrom = hit;
    }

    function onPointerMove(e: PointerEvent) {
      const pos = getPos(e.clientX, e.clientY);
      stateRef.current.mouse = pos;
      stateRef.current.hover = nodeAt(pos);
    }

    function onPointerUp(e: PointerEvent) {
      if (!interactiveRef.current) return;
      const s = stateRef.current;
      if (!s.dragFrom) return;
      const pos = getPos(e.clientX, e.clientY);
      const from = s.dragFrom;
      s.dragFrom = null;
      const dist = Math.hypot(pos.x - from.x, pos.y - from.y);
      if (dist < 18 || dist > 260) return;
      if (toolRef.current !== "wood" && toolRef.current !== "rope") return;
      let to = nodeAt(pos);
      if (to && to.id === from.id) return;
      const kind = toolRef.current;
      if (!onUseMaterialRef.current(kind)) return;
      if (!to) {
        to = { id: "N" + Math.random().toString(36).slice(2), x: pos.x, y: pos.y, fixed: false, anchor: false, vx: 0, vy: 0 };
        s.nodes.push(to);
      }
      const already = s.springs.some((sp) => (sp.a === from.id && sp.b === to!.id) || (sp.a === to!.id && sp.b === from.id));
      if (!already) s.springs.push({ a: from.id, b: to.id, length: dist, kind });
    }

    canvas!.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let raf = 0;
    function tick() {
      const s = stateRef.current;
      const w = canvas!.width;
      const h = canvas!.height;

      // 輕量鬆弛（僅視覺垂墜感，不判斷斷裂——過關與否由外部已驗證的規則決定）。
      // 調校備註：重力/勁度原本讓自由節點大幅盪離放置點，容易讓第二段連線超出可及距離
      // （220px 上限），變成怎麼接都接不到——這裡把重力調輕、勁度調高、迭代加多，
      // 讓下垂感明顯但收斂快、不會盪出太遠。
      for (const n of s.nodes) {
        if (n.fixed) continue;
        n.vy += 0.04;
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.85;
        n.vy *= 0.85;
        if (n.y > h * 0.86) {
          n.y = h * 0.86;
          n.vy = 0;
        }
      }
      for (let iter = 0; iter < 10; iter++) {
        for (const sp of s.springs) {
          const a = s.nodes.find((n) => n.id === sp.a);
          const b = s.nodes.find((n) => n.id === sp.b);
          if (!a || !b) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.001;
          const diff = sp.length - dist;
          if (sp.kind === "rope" && dist < sp.length) continue; // 繩索不吃壓縮力
          const k = sp.kind === "wood" ? 0.6 : 0.35;
          const pct = (diff / dist) * k * 0.5;
          const ox = dx * pct;
          const oy = dy * pct;
          if (!a.fixed) {
            a.x -= ox;
            a.y -= oy;
          }
          if (!b.fixed) {
            b.x += ox;
            b.y += oy;
          }
        }
      }

      // 山羌過場動畫推進
      const deer = s.deer;
      if (deer.active && !deer.done) {
        deer.t += 16.7 / deer.dur;
        const segCount = Math.max(1, deer.path.length - 1);
        const travel = Math.min(deer.t, deer.fallAt);
        const segF = travel * segCount;
        const segI = Math.min(segCount - 1, Math.floor(segF));
        const localT = segF - segI;
        const p0 = deer.path[segI];
        const p1 = deer.path[Math.min(deer.path.length - 1, segI + 1)];
        if (p0 && p1) {
          deer.x = p0.x + (p1.x - p0.x) * localT;
          deer.y = p0.y - 10 + (p1.y - p0.y) * localT;
        }
        if (deer.t >= deer.fallAt && deer.fallAt < 1) {
          // 未通過：從當前點墜落
          deer.y += (deer.t - deer.fallAt) * 240;
        }
        if (deer.t >= 1) {
          deer.done = true;
        }
      }

      draw(canvas!.getContext("2d")!, w, h, s, interactiveRef.current, toolRef.current);
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas!.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // ORDER-046：canvas 改為「透明互動疊層」，鋪滿呼叫端提供的相對定位容器
  // （容器底下是 repair-river-board.jpg 俯視溪谷實景圖）。resize() 讀的是這層的尺寸。
  return (
    <div className="absolute inset-0">
      <canvas ref={canvasRef} className="block h-full w-full touch-none" />
    </div>
  );
});

function draw(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  s: {
    nodes: PNode[];
    springs: PSpring[];
    piers: Pier[];
    dragFrom: PNode | null;
    mouse: { x: number; y: number };
    hover: PNode | null;
    deer: { active: boolean; x: number; y: number; path: PNode[]; t: number; dur: number; fallAt: number; done: boolean };
  },
  interactive: boolean,
  tool: "stone" | "wood" | "rope",
) {
  ctx.clearRect(0, 0, w, h);
  // ORDER-046：背景改由底下的 repair-river-board.jpg 實景圖呈現，canvas 只畫互動元素
  // （俯視視角：頁岩樁畫成圓形石砌墩座，非側視石柱）。

  // 頁岩墩座（俯視）
  for (const pier of s.piers) {
    const r = pier.width / 2;
    ctx.beginPath();
    ctx.arc(pier.x, pier.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(71, 85, 105, 0.92)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#94a3b8";
    ctx.stroke();
    // 內圈石紋
    ctx.beginPath();
    ctx.arc(pier.x, pier.y, r * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 連線（橫樑/藤索）
  for (const sp of s.springs) {
    const a = s.nodes.find((n) => n.id === sp.a);
    const b = s.nodes.find((n) => n.id === sp.b);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    if (sp.kind === "wood") {
      ctx.strokeStyle = "#b45309";
      ctx.lineWidth = 7;
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = "#a3a3a3";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 3]);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 拖拉預覽線
  if (s.dragFrom && interactive) {
    ctx.beginPath();
    ctx.moveTo(s.dragFrom.x, s.dragFrom.y);
    ctx.lineTo(s.mouse.x, s.mouse.y);
    ctx.strokeStyle = tool === "wood" ? "rgba(180,83,9,0.7)" : "rgba(163,163,163,0.7)";
    ctx.lineWidth = tool === "wood" ? 5 : 2;
    ctx.stroke();
  }

  // 節點（ORDER-046：錨點改描邊光圈，讓底圖裡畫好的金圈透出來、canvas 只做強化與 hover 提示）
  for (const n of s.nodes) {
    if (n.anchor) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 9, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 213, 91, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.shadowColor = "rgba(255, 188, 56, 0.8)";
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.fixed ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = n.fixed ? "#94a3b8" : "#10b981";
      ctx.fill();
    }
    if (s.hover === n && interactive) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251,191,36,0.65)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // 山羌
  if (s.deer.active) {
    ctx.save();
    ctx.translate(s.deer.x, s.deer.y);
    ctx.fillStyle = "#92400e";
    ctx.beginPath();
    ctx.ellipse(0, -6, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#713f12";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -1);
    ctx.lineTo(-6, 4);
    ctx.moveTo(5, -1);
    ctx.lineTo(6, 4);
    ctx.stroke();
    ctx.fillStyle = "#78350f";
    ctx.beginPath();
    ctx.arc(-9, -10, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function JourneyPage() {
  const [game, setGame] = useState<JGame>(() => newGame("l1"));
  const [pending, setPending] = useState<JCard | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // ORDER-050（P2）：第二關解鎖狀態（localStorage，僅 client mount 後讀寫——SSR 無 window）
  const [level2Unlocked, setLevel2Unlocked] = useState(false);
  // newGame() 內含 Math.random()（洗牌／隨機事件／uid），須在 client mount 後才渲染，
  // 否則 SSR 與 client 首次渲染的牌序不一致 → hydration mismatch。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // mount 後讀取解鎖狀態與上次選擇的關卡（皆在 client 端，SSR 期間不觸碰 localStorage）
    let unlocked = false;
    try {
      unlocked = localStorage.getItem(LS_LEVEL2_UNLOCKED) === "1";
      /* eslint-disable react-hooks/set-state-in-effect */
      if (unlocked) setLevel2Unlocked(true);
      if (unlocked && localStorage.getItem(LS_LAST_LEVEL) === "l2") setGame(newGame("l2"));
    } catch {
      /* localStorage 不可用（隱私模式等）：維持預設第一關 */
    }
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // 終局音效：抵達終點 / 未能抵達（中性 UI 完成音，非族樂）
  useEffect(() => {
    if (game.status === "won") sfxArrive();
    else if (game.status === "lost") sfxLose();
  }, [game.status]);

  // ORDER-050（P2）：第一關通關 → 解鎖第二關（localStorage 記錄，跨場次保留）
  useEffect(() => {
    if (game.status === "won" && game.levelId === "l1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLevel2Unlocked(true);
      try {
        localStorage.setItem(LS_LEVEL2_UNLOCKED, "1");
      } catch {
        /* 忽略寫入失敗 */
      }
    }
  }, [game.status, game.levelId]);

  // 章節標題卡（v2）：idx 進入新章節的第一個節點時顯示，銜接 /prologue 的章節架構
  const [chapterCard, setChapterCard] = useState<number | null>(null);
  const [seenChapters, setSeenChapters] = useState<number>(-1);
  useEffect(() => {
    if (!mounted) return;
    const { index } = chapterForIdx(game.levelId, game.idx);
    if (game.nodes[game.idx]?.type !== undefined && index !== seenChapters && chaptersOf(game.levelId)[index].nodeStart === game.idx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapterCard(index);
      setSeenChapters(index);
    }
  }, [mounted, game.levelId, game.idx, game.nodes, seenChapters]);

  // 節點故事過場卡：抵達有 NODE_STORY 的節點時，彈出跟章節卡同樣的全螢幕過場（司令指示「一張一張卡」比較好看，
  // 取代原本埋在面板裡的斜體小字）。依賴 chapterCard 才觸發，讓章節卡與故事卡不會同時疊加——
  // 同一節點若兩者皆滿足，章節卡先彈出，玩家關閉後（chapterCard 變回 null）此 effect 才重新判斷並顯示故事卡。
  const [storyCard, setStoryCard] = useState<string | null>(null);
  const [seenStories, setSeenStories] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!mounted || chapterCard !== null) return;
    const node = game.nodes[game.idx];
    if (!node) return;
    const story = levelCfg(game).nodeStory[node.vocabId];
    if (story && !seenStories.has(node.vocabId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoryCard(node.vocabId);
      setSeenStories((prev) => new Set(prev).add(node.vocabId));
    }
  }, [mounted, chapterCard, game, seenStories]);

  const quiz = useMemo(() => (pending && pending.quiz ? quizFor(pending) : null), [pending]);

  // v3（ORDER-031）：非卡牌動作的答題閘門（硬清／謹慎探勘／補給／v5 修復路段測試）——共用同一套隨機詞庫題型
  const [pendingAction, setPendingAction] = useState<{
    kind: "hardClear" | "eventCareful" | "supply" | "buildTest";
    resource?: Resource;
  } | null>(null);
  const [actionRevealed, setActionRevealed] = useState<number | null>(null);
  // v4（ORDER-033）：題目改綁「當前節點」的詞，而非全詞庫隨機——司令實測回報「毫無記憶點」，
  // 隨機題跟眼前情境（節點故事剛講的東西）毫無關聯，答完就忘。改成問「這個節點」對應的詞，
  // 讓題目與剛看到的故事／情境同一個詞，形成情境記憶錨點。
  const currentNodeVocabId = game.nodes[game.idx]?.vocabId;
  const actionQuiz = useMemo(
    () => (pendingAction ? quizForVocab(currentNodeVocabId ?? randomVocabId()) : null),
    [pendingAction, currentNodeVocabId],
  );

  const total = game.correct + game.wrong;
  const rate = total === 0 ? 0 : Math.round((game.correct / total) * 100);
  const rateLabel = total === 0 ? "—" : `${rate}%`;

  // v7（ORDER-042）：族語試煉——綁節點的 TRPG 式檢定（每節點一次，3 題：節點自己的詞 + 2 題全詞庫抽），
  // 取代原本掛在標題列、跟情境無關的全域挑戰。詞庫仍為完整 1092 真實詞（klokah.tw）。
  const TRIAL_SIZE = 3;
  const [challenge, setChallenge] = useState<{ quizzes: Quiz[]; idx: number; results: { vocabId: string; correct: boolean }[]; nodeId: string } | null>(
    null,
  );
  const [challengeRevealed, setChallengeRevealed] = useState<number | null>(null);

  // v5（ORDER-036）：修復路段——動手疊石／架橫樑／綁藤索，取代落石節點原本的「花資源硬清」單鍵答題。
  // building 只存本次已放的材料數（資源在放置當下就從 game.res 扣，不設暫存/退還——跟遊戲其他機制一致：
  // 資源花下去就是花下去了，就算這次沒測過關，也不退回）。
  const [building, setBuilding] = useState<BuildMaterials | null>(null);
  // v6（ORDER-040）：畫布互動工具選擇 + 過場動畫狀態（拖拉建造期間 crossing=false；
  // 答題確認後 crossing=true，畫布播完山羌動畫才真正結算並關窗，不是答完題立刻跳結果）。
  const [buildTool, setBuildTool] = useState<"stone" | "wood" | "rope">("stone");
  const [crossing, setCrossing] = useState(false);
  const buildCanvasRef = useRef<BuildCanvasHandle>(null);
  const anyModalOpen =
    !!pending ||
    !!pendingAction ||
    chapterCard !== null ||
    storyCard !== null ||
    showRules ||
    confirmRestart ||
    !!challenge ||
    !!building;

  // ORDER-051（引導點 1）：行動聚光燈——唯一的「現在該按的鈕」
  const primary = primaryAction(game);

  // ORDER-051（引導點 3）：首次教學 coach marks——第一次進入（localStorage 旗標）逐步聚光 4 站：
  // 任務面板 → 行動聚光燈 → 手牌 → 紮營。只在全新第一關開局、章節卡/故事卡都關掉後觸發一次；
  // 彈窗開著時不觸發。SSR 安全：只在 mounted 後讀 localStorage。
  const [coach, setCoach] = useState<number | null>(null);
  const [coachTried, setCoachTried] = useState(false);
  const [coachRect, setCoachRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const questRef = useRef<HTMLElement | null>(null);
  const spotRef = useRef<HTMLDivElement | null>(null);
  const handRef = useRef<HTMLElement | null>(null);
  const campRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mounted || coachTried || coach !== null) return;
    // 只在「全新第一關開局」觸發：第 1 日、起點、且開場章節卡與節點故事卡都已看完關閉
    if (game.levelId !== "l1" || game.day !== 1 || game.idx !== 0) return;
    if (anyModalOpen || seenChapters < 0 || seenStories.size < 1) return;
    let done = true;
    try {
      done = localStorage.getItem(LS_COACH_DONE) === "1";
    } catch {
      /* localStorage 不可用：視同已完成，不打擾 */
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    setCoachTried(true);
    if (!done) setCoach(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mounted, coachTried, coach, game.levelId, game.day, game.idx, anyModalOpen, seenChapters, seenStories]);

  // 目前教學站的目標區域量測（捲入視野後取 getBoundingClientRect，resize/scroll 時重算）
  useEffect(() => {
    if (coach === null) return;
    const el = [questRef.current, spotRef.current, handRef.current, campRef.current][coach];
    if (!el) {
      setCoachRect(null);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    function measure() {
      const r = el!.getBoundingClientRect();
      setCoachRect({ top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 });
    }
    el.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
    measure();
    const t = setTimeout(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [coach]);

  function finishCoach() {
    try {
      localStorage.setItem(LS_COACH_DONE, "1");
    } catch {
      /* 忽略寫入失敗 */
    }
    setCoach(null);
  }

  // ORDER-051（引導點 4）：AP=0 且下一步就是紮營時，全頁輕微降暗、只留紮營鈕聚光（不擋彈窗與教學）
  const campDim = primary === "camp" && !anyModalOpen && coach === null;

  function addMaterial(kind: keyof BuildMaterials) {
    if (!building || game.res[kind] < 1) return false;
    setGame((g) => ({ ...g, res: { ...g.res, [kind]: g.res[kind] - 1 } }));
    setBuilding((b) => (b ? { ...b, [kind]: b[kind] + 1 } : b));
    return true;
  }

  function startBuildTest() {
    const mode = buildModeForNode(game.nodes[game.idx]);
    if (!building || !mode || building.rope < 1 || (mode === "bridge" && building.wood < 2)) return;
    setActionRevealed(null);
    setPendingAction({ kind: "buildTest" });
  }

  function startNodeTrial() {
    const node = game.nodes[game.idx];
    if (game.status !== "playing" || anyModalOpen || !node || game.trialedNodes.includes(node.id)) return;
    // 第 1 題固定考該節點自己的詞（情境錨點），其餘從全詞庫抽、不與已選重複
    const ids = new Set<string>([node.vocabId]);
    while (ids.size < Math.min(TRIAL_SIZE, VOCAB.length)) {
      ids.add(randomVocabId());
    }
    setChallenge({ quizzes: [...ids].map((id) => quizForVocab(id)), idx: 0, results: [], nodeId: node.id });
    setChallengeRevealed(null);
  }

  function answerChallenge(optIdx: number) {
    if (!challenge || challengeRevealed !== null) return;
    const q = challenge.quizzes[challenge.idx];
    const correct = optIdx === q.answer;
    if (correct) sfxCorrect();
    else sfxWrong();
    setChallengeRevealed(optIdx);
    setTimeout(() => playAudio(q.audioId), 400);
  }

  function nextChallenge() {
    if (!challenge || challengeRevealed === null) return;
    const q = challenge.quizzes[challenge.idx];
    const correct = challengeRevealed === q.answer;
    const results = [...challenge.results, { vocabId: q.audioId, correct }];
    if (challenge.idx + 1 >= challenge.quizzes.length) {
      const nodeId = challenge.nodeId;
      setGame((g) => applyNodeTrial(g, nodeId, results));
      setChallenge(null);
      setChallengeRevealed(null);
    } else {
      setChallenge({ ...challenge, idx: challenge.idx + 1, results });
      setChallengeRevealed(null);
    }
  }

  function tryPlay(card: JCard) {
    if (!canAfford(game, card)) return;
    if (card.quiz) {
      setRevealed(null);
      setPending(card);
    } else {
      sfxPlayCard();
      setGame((g) => playCard(g, card, true));
    }
  }

  // v4（ORDER-033）：答題後不再自動 850ms 就結算關掉——原本的自動倒數等於鼓勵盲按，
  // 揭曉當下自動播一次正解發音（視聽同步強化記憶），改由玩家自己按「繼續」才結算，
  // 給足時間看清楚／聽清楚正解再往下走。
  function answer(optIdx: number) {
    if (!pending || !quiz) return;
    const correct = optIdx === quiz.answer;
    if (correct) sfxCorrect();
    else sfxWrong();
    const willStreak = correct ? game.streak + 1 : 0;
    if (willStreak > 0 && willStreak % 3 === 0) {
      setTimeout(() => sfxStreak(), 300);
    }
    setRevealed(optIdx);
    setTimeout(() => playAudio(quiz.audioId), 400);
  }

  function confirmAnswer() {
    if (!pending || revealed === null || !quiz) return;
    const correct = revealed === quiz.answer;
    setGame((g) => playCard(g, pending, correct));
    setPending(null);
    setRevealed(null);
  }

  function doAdvance() {
    if (!canAdvance(game)) return;
    sfxPlayCard();
    setGame((g) => advance(g));
  }

  // v3：硬清／謹慎探勘／補給改為先答題，答對全額、答錯半額（比照卡牌規則）。
  // 「快速通過」故意保留免答題（設計本意的高風險捷徑），直接結算。
  function doHardClear() {
    if (!canHardClear(game)) return;
    setActionRevealed(null);
    setPendingAction({ kind: "hardClear" });
  }

  function doEventChoice(choice: "fast" | "careful") {
    if (choice === "fast") {
      sfxPlayCard();
      setGame((g) => resolveEventChoice(g, "fast"));
    } else {
      setActionRevealed(null);
      setPendingAction({ kind: "eventCareful" });
    }
  }

  function doSupplyChoice(resource: Resource) {
    setActionRevealed(null);
    setPendingAction({ kind: "supply", resource });
  }

  function answerAction(optIdx: number) {
    if (!pendingAction || !actionQuiz) return;
    const correct = optIdx === actionQuiz.answer;
    if (correct) sfxCorrect();
    else sfxWrong();
    const willStreak = correct ? game.streak + 1 : 0;
    if (willStreak > 0 && willStreak % 3 === 0) {
      setTimeout(() => sfxStreak(), 300);
    }
    setActionRevealed(optIdx);
    setTimeout(() => playAudio(actionQuiz.audioId), 400);
  }

  function confirmActionAnswer() {
    if (!pendingAction || actionRevealed === null || !actionQuiz) return;
    const correct = actionRevealed === actionQuiz.answer;
    const vocabId = actionQuiz.audioId;
    if (pendingAction.kind === "hardClear") {
      setGame((g) => hardClear(g, correct, vocabId));
    } else if (pendingAction.kind === "eventCareful") {
      setGame((g) => resolveEventChoice(g, "careful", correct, vocabId));
    } else if (pendingAction.kind === "supply" && pendingAction.resource) {
      const resource = pendingAction.resource;
      setGame((g) => resolveSupplyChoice(g, resource, correct, vocabId));
    } else if (pendingAction.kind === "buildTest" && building) {
      // v6（ORDER-040）：結果已經算好了（沿用已驗證的 resolveBuildTest 規則），
      // 但先讓畫布播山羌過橋／摔落的動畫，動畫播完才真正 setGame 結算並關窗——
      // 讓「答完題」跟「看到結果」之間有一段有意義的動態呈現，不是答完立刻跳畫面。
      const result = resolveBuildTest(game, building, correct, vocabId);
      const pass = !!result.nodes[game.idx]?.cleared;
      setPendingAction(null);
      setActionRevealed(null);
      setCrossing(true);
      buildCanvasRef.current?.runCrossing(pass, () => {
        setGame(result);
        setCrossing(false);
        if (pass) setBuilding(null);
      });
      return;
    }
    setPendingAction(null);
    setActionRevealed(null);
  }

  function restart(levelId?: LevelId) {
    const target = levelId ?? game.levelId;
    if (levelId) {
      try {
        localStorage.setItem(LS_LAST_LEVEL, levelId);
      } catch {
        /* 忽略寫入失敗 */
      }
    }
    setGame(newGame(target));
    setPending(null);
    setRevealed(null);
    setConfirmRestart(false);
    setSeenChapters(-1);
    setChapterCard(null);
    setSeenStories(new Set());
    setStoryCard(null);
    setChallenge(null);
    setChallengeRevealed(null);
    setBuilding(null);
    setPendingAction(null);
    setActionRevealed(null);
  }

  // mount 前：SSR 與 client 首渲染皆輸出此骨架，確保 HTML 一致（避免 hydration mismatch）
  if (!mounted) {
    return (
      <main className="jny-page min-h-screen text-slate-100 flex">
        <SideRail active="journey" />
        <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto text-sm text-slate-500">載入山徑…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="jny-page min-h-screen text-slate-100 flex">
      {/* 電影感全頁背景（ORDER-051）：既有場景圖 fixed+cover、暗化 80%＋vignette */}
      <div className="jny-bg" style={{ backgroundImage: `url(${PAGE_BG})` }} aria-hidden />
      <AmbientAudio />
      <SideRail active="journey" />
      <div className="relative z-10 flex-1 min-w-0 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
        {/* 標題列（ORDER-051）：遊戲門面——kicker 小字＋關卡名 serif 大字金光暈＋金色分隔飾 */}
        <header className="jny-rise mb-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-amber-200/60 hover:text-amber-100">
                ◀ 模式選擇
              </Link>
              <span className="jny-badge-gold rounded-full px-2 py-0.5 text-[10px] font-bold">模式 A</span>
            </div>
            <p className={`${notoSansTC.className} mt-2 text-[11px] tracking-[0.35em] text-amber-300/85`}>峽谷行者・山徑</p>
            <h1 className={`${notoSerifTC.className} repair-title text-3xl font-black sm:text-4xl`}>{levelCfg(game).name}</h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={FRAME_DIVIDER} alt="" className="mt-2 h-2 w-44 object-contain object-left opacity-90" />
            <p className="mt-1.5 text-[11px] text-amber-100/50">
              非戰鬥。答對族語題讓行動全額生效。族語詞彙與發音為真實太魯閣語資料。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="jny-gem-chip">
              <span className="jny-gem-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ICON_DAY} width={14} height={14} alt="" />
              </span>
              <span className="font-bold">第 {game.day}/{levelCfg(game).maxDay} 日</span>
            </span>
            <span className="jny-gem-chip">
              <span className="jny-gem-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ICON_ACTION} width={14} height={14} alt="" />
              </span>
              <span className="font-bold">行動點 {game.ap}/{effectiveMaxAp(game)}</span>
            </span>
            <span className="jny-gem-chip" title="答對題數 ÷ 已答題數">
              <span className="jny-gem-icon">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ICON_HIT} width={14} height={14} alt="" />
              </span>
              <span className="font-bold">正確率 {rateLabel}</span>
            </span>
            <button
              onClick={() => setShowRules(true)}
              className="repair-secondary-btn rounded-lg px-3 py-1.5 font-bold"
            >
              規則
            </button>
            <button
              onClick={() => setConfirmRestart(true)}
              className="repair-secondary-btn rounded-lg px-3 py-1.5"
              title="重新開始一局"
            >
              重新開始
            </button>
          </div>
        </header>

        {/* 關卡選擇（ORDER-050，P2）：兩張精簡卡——第一關通關後解鎖第二關（localStorage 記錄），
            切換＝直接開新局（進度不保留，與「重新開始」同語意）。 */}
        <section className="jny-rise mb-3 grid grid-cols-2 gap-2">
          {(Object.keys(LEVELS) as LevelId[]).map((lid) => {
            const cfg = LEVELS[lid];
            const active = game.levelId === lid;
            const locked = lid === "l2" && !level2Unlocked;
            return (
              <button
                key={lid}
                onClick={() => {
                  if (locked || active) return;
                  restart(lid);
                }}
                disabled={locked}
                className={`jny-panel rounded-xl p-3 text-left transition ${
                  active
                    ? "jny-pick-active"
                    : locked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:-translate-y-0.5 hover:border-amber-300/70"
                }`}
                title={locked ? "通關第一關解鎖" : cfg.pickDesc}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={`${notoSerifTC.className} text-sm font-bold text-amber-50`}>{cfg.pickLabel}</span>
                  {active ? (
                    <span className="jny-badge-gold rounded px-1.5 py-0.5 text-[10px] font-bold">進行中</span>
                  ) : locked ? (
                    <span className="rounded border border-slate-700 bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-400">未解鎖</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-amber-100/55">
                  {locked ? "未解鎖 · 通關第一關解鎖" : cfg.pickDesc}
                </p>
              </button>
            );
          })}
        </section>

        {/* 任務面板（v3，ORDER-030）：主線目標＋節點進度＋節點故事＋這一步＋可直接操作的行動按鈕＋支線＋連擊
            視覺層級修正：搬到統計數字前面，第一眼就是「該做什麼」；面板整體放大字級（司令實測回報還是太小看不清） */}
        <section ref={questRef} className="jny-panel jny-panel-quest jny-rise mb-4 rounded-2xl p-4 sm:p-5">
          <div className="relative z-[2] flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="jny-badge-gold rounded px-2.5 py-1 text-xs font-black">主線</span>
              <span className={`${notoSerifTC.className} text-base font-bold text-amber-50`}>{levelCfg(game).mainQuest}</span>
            </div>
            <span className="text-xs text-amber-100/60">
              節點 {game.idx}/{game.nodes.length - 1} · 第 {game.day}/{levelCfg(game).maxDay} 日
            </span>
          </div>
          <div className="jny-mission relative z-[2] mt-3 flex items-start gap-2 rounded-xl px-3 py-2.5">
            <IconFlag className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">你的使命</div>
              <p className="mt-0.5 text-sm leading-relaxed text-amber-50/90">{levelCfg(game).mission}</p>
            </div>
          </div>
          {(() => {
            const hint = stepHint(game);
            const node = game.nodes[game.idx];
            const canGoAdvance = canAdvance(game);
            const canGoHardClear = canHardClear(game);
            // 行動聚光燈（ORDER-051 引導點 1）：primary 對應的那顆鈕加金色呼吸光暈＋「▶ 現在」，
            // 其餘動作降階為暗色（jny-dim）。
            const nowPill = <span className="jny-now-pill">▶ 現在</span>;
            return (
              <div ref={spotRef} className="relative z-[2] mt-3 rounded-xl border border-amber-500/20 bg-[#040c13]/75 p-3.5">
                <div className="text-xs uppercase tracking-[0.2em] text-amber-400/90 font-semibold">這一步</div>
                <div className={`${notoSerifTC.className} mt-1 text-lg font-bold text-amber-50`}>{hint.situation}</div>
                <div className="mt-1.5 text-sm leading-relaxed text-amber-100/85">{hint.todo}</div>

                {/* 常駐「前進」：脫離卡牌經濟，路段已清就能按（v2 修死局） */}
                {game.status === "playing" && node.cleared && game.idx < game.nodes.length - 1 && (
                  <button
                    onClick={doAdvance}
                    disabled={!canGoAdvance}
                    className={`repair-primary-btn relative mt-3 w-full rounded-xl px-4 py-3.5 text-base font-black tracking-[0.06em] transition ${
                      primary === "advance" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                    }`}
                  >
                    {primary === "advance" && nowPill}
                    ▶ 前進（行動點 -1）
                  </button>
                )}

                {/* 花資源硬清：bridge 未清時的替代方案（v3：一樣要答題，答對全額答錯半額）。
                    obstacle（落石）改走下面的「修復路段」動手建造玩法（v5，ORDER-036）。 */}
                {game.status === "playing" && !node.cleared && (node.type === "bridge" || node.type === "hazard") && (
                  <button
                    onClick={doHardClear}
                    disabled={!canGoHardClear}
                    className={`repair-primary-btn relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed ${
                      primary === "hazard" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                    }`}
                  >
                    {primary === "hazard" && nowPill}
                    <IconPickaxe className="w-4 h-4 shrink-0" />{" "}
                    {node.type === "hazard" ? "花資源架遮蔽硬撐（木材×2・繩索×2）" : "花資源硬清（木材×2・繩索×2）"}
                  </button>
                )}

                {/* 修復路段（v5／ORDER-053）：落石與吊橋共用動手建造，但工法目標不同。 */}
                {game.status === "playing" && !node.cleared && (node.type === "obstacle" || node.type === "bridge") && (
                  <button
                    onClick={() => setBuilding({ stone: 0, wood: 0, rope: 0 })}
                    disabled={anyModalOpen}
                    className={`repair-primary-btn relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed ${
                      primary === "repair" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                    }`}
                  >
                    {primary === "repair" && nowPill}
                    <IconHammer className="w-4 h-4 shrink-0" /> {node.type === "bridge" ? "搭建吊橋（動手接回兩岸）" : "修復路段（動手疊石架橋）"}
                  </button>
                )}

                {/* 林間捷徑選擇（事件節點是「二選一」——兩顆都是當前該按的選項，一起聚光） */}
                {game.status === "playing" && !node.cleared && node.type === "event" && (
                  <div className="relative mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1.5">
                    {primary === "event" && nowPill}
                    <button
                      onClick={() => doEventChoice("fast")}
                      className={`repair-secondary-btn flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition ${
                        primary === "event" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                      }`}
                    >
                      <IconRun className="w-3.5 h-3.5 shrink-0" /> 快速通過（壓力 +4，且路況可能反噬）
                    </button>
                    <button
                      onClick={() => doEventChoice("careful")}
                      disabled={game.res.wood < 1 || game.res.rope < 1}
                      className={`repair-secondary-btn flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-bold transition disabled:opacity-30 ${
                        primary === "event" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                      }`}
                    >
                      <IconSearch className="w-3.5 h-3.5 shrink-0" /> 謹慎探勘（耗木材1・繩索1，換糧食+1）
                    </button>
                  </div>
                )}

                {/* 山腰營地選擇（補給節點：資源選項全部聚光） */}
                {game.status === "playing" && !node.cleared && node.type === "supply" && (
                  <div className="relative mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1.5">
                    {primary === "supply" && nowPill}
                    {(Object.keys(RES_NAME) as Resource[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => doSupplyChoice(r)}
                        className={`repair-secondary-btn flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-bold transition ${
                          primary === "supply" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={COIN_IMG[r]} width={20} height={20} alt={RES_NAME[r]} />
                        {RES_NAME[r]} +3
                      </button>
                    ))}
                  </div>
                )}

                {/* 族語試煉（v7，ORDER-042）：綁節點的 TRPG 式語言檢定——每個路段一次，
                    3 題（含該節點自己的詞），通過依情境給獎勵。跟著場景走，不是懸浮功能。 */}
                {game.status === "playing" && !game.trialedNodes.includes(node.id) && (
                  <button
                    onClick={startNodeTrial}
                    disabled={anyModalOpen}
                    className={`repair-secondary-btn mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold text-sky-200 transition disabled:opacity-30 ${
                      primary !== null ? "jny-dim" : ""
                    }`}
                  >
                    <IconBook className="w-4 h-4 shrink-0" /> 族語試煉（本路段一次：{node.cleared || node.obstacle === 0 ? "通過則壓力 -1" : "通過則阻礙 -1"}）
                  </button>
                )}
              </div>
            );
          })()}
          <div className="relative z-[2] mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] text-amber-200/50">支線</span>
            {sideQuests(game).map((q) => (
              <span
                key={q.label}
                title={q.note}
                className={`inline-flex items-center gap-1 text-[11px] ${
                  q.state === "ok" ? "text-emerald-300" : q.state === "fail" ? "text-slate-600 line-through" : "text-amber-100/60"
                }`}
              >
                <span>{q.state === "ok" ? "✓" : q.state === "fail" ? "✕" : "○"}</span>
                {q.label}
              </span>
            ))}
            {game.streak > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                <IconFlame className="w-3.5 h-3.5 shrink-0" /> 連對 {game.streak}
              </span>
            )}
          </div>
        </section>

        {/* 頂部數值列（v2：壓力分級變色，危急時脈動警示） */}
        <section className="jny-rise grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatBar
            label="壓力"
            value={game.pressure}
            max={game.maxPressure}
            color={
              pressureTier(game) === "critical" ? "jny-fill-critical" : pressureTier(game) === "tense" ? "jny-fill-tense" : "jny-fill-calm"
            }
            invert
            icon={METER_PRESSURE}
            pulse={pressureTier(game) === "critical"}
            tag={pressureTier(game) === "critical" ? "危急" : pressureTier(game) === "tense" ? "緊張" : undefined}
          />
          <StatBar label="隊伍體力" value={game.teamHp} max={game.maxTeamHp} color="repair-progress-fill" icon={METER_STAMINA} />
          <div className="jny-panel relative rounded-xl p-2 pt-3 flex items-start justify-around gap-2 text-sm col-span-2">
            {/* 族語落字（決策#22）：klokah 真實詞＋發音，整區標「示範·待核」待語言部終核 */}
            <span className="absolute -top-2 right-2 z-[2] rounded border border-amber-500/40 bg-[#0b1722] px-1.5 text-[9px] text-amber-300/90">
              族語：示範·待核
            </span>
            {(Object.keys(game.res) as Resource[]).map((r) => (
              <span
                key={r}
                className="material-card relative z-[2] flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5"
                title={`${RES_NAME[r]}（示範·待核）`}
              >
                <span className="flex items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={COIN_IMG[r]} width={24} height={24} alt={RES_NAME[r]} className="inline-block" />
                  <span className="font-semibold">{game.res[r]}</span>
                </span>
                {/* 中文名稱為主要可見標籤（避免只藏在 title tooltip 裡看不到）；族語詞為輔助學習 */}
                <span className="text-[10px] text-amber-100/60">{RES_NAME[r]}</span>
                <WordChip vocabId={RES_VOCAB[r]} />
              </span>
            ))}
          </div>
        </section>

        {/* 今日事件 */}
        {game.event && (
          <section className="jny-panel jny-rise mb-3 rounded-xl p-3 text-sm">
            <span className="relative z-[2] text-amber-300 font-semibold">今日事件 · {game.event.name}</span>
            <span className="text-amber-100/50 text-xs">（{game.event.kind}）</span>
            <WordChip vocabId={game.event.vocabId} />
            <span className="text-amber-100/80"> — {game.event.desc}</span>
          </section>
        )}

        {/* 山徑節點 */}
        <section className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <span className={`${notoSansTC.className} rounded-full border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[10px] tracking-[0.2em] text-amber-300/90`}>
              {chapterForIdx(game.levelId, game.idx).chapter.kicker}
            </span>
          </div>
          <SectionHeading>山徑路線</SectionHeading>
          <div className="relative rounded-xl border border-amber-500/35 overflow-hidden shadow-[0_18px_40px_rgba(0,0,0,0.5)]">
            {/* 山徑地圖底（ORDER-015 美術，已過文化複核）＋深色 overlay 保節點可讀 */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${MAP_BASE})` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-[#030a10]/70" aria-hidden />
            <div className="relative p-3 flex flex-wrap items-stretch gap-2">
              {game.nodes.map((n, i) => {
                const here = i === game.idx;
                return (
                  <div
                    key={n.id}
                    className={`jny-node flex-1 min-w-24 rounded-xl p-2 text-center relative ${
                      here ? "jny-node-current" : n.cleared ? "jny-node-passed" : ""
                    }`}
                  >
                    {here && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src="/images/journey/token-team-v1.png"
                        width={44}
                        height={44}
                        alt="隊伍位置"
                        title="隊伍位置"
                        className="absolute -top-6 left-1/2 -translate-x-1/2 drop-shadow-lg"
                      />
                    )}
                    {/* 場景水彩底（ORDER-017，已過文化複核）＋深色 overlay 保文字可讀 */}
                    <span
                      className="absolute inset-0 rounded-xl bg-cover bg-center opacity-35"
                      style={{ backgroundImage: `url(${SCENE_IMG[n.type]})` }}
                      aria-hidden
                    />
                    <span className="absolute inset-0 rounded-xl bg-[#030a10]/45" aria-hidden />
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={NODE_IMG[n.type]} width={48} height={48} alt={n.name} className="mx-auto mt-1" />
                      <div className="text-xs font-semibold truncate">{n.name}</div>
                      <div className="flex justify-center">
                        <WordChip vocabId={n.vocabId} />
                      </div>
                      {n.type === "obstacle" || n.type === "bridge" || n.type === "hazard" ? (
                        <div className={`text-[11px] mt-1 ${n.cleared ? "text-emerald-400" : "text-rose-300"}`}>
                          {n.cleared
                            ? n.type === "hazard"
                              ? "已平息"
                              : "已通行"
                            : n.type === "bridge"
                              ? "待搭橋"
                              : n.type === "hazard"
                                ? `危害 ${n.obstacle}`
                                : `阻礙 ${n.obstacle}`}
                        </div>
                      ) : (
                        <div className="text-[11px] mt-1 text-slate-500">{n.cleared ? "可通行" : here ? "在此" : "？未探索"}</div>
                      )}
                    </div>
                </div>
                );
              })}
            </div>
            <OrnateFrame />
          </div>
        </section>

        {/* 紀錄 */}
        <section className="mb-3">
          <SectionHeading>行動紀錄</SectionHeading>
          <div className="jny-panel rounded-xl p-3 min-h-16 max-h-32 overflow-auto space-y-1 text-xs">
            {game.log.map((l) => (
              <div
                key={l.key}
                className={
                  l.tone === "good"
                    ? "text-emerald-300"
                    : l.tone === "bad"
                      ? "text-rose-300"
                      : l.tone === "sys"
                        ? "text-amber-300"
                        : "text-slate-300"
                }
              >
                {l.text}
              </div>
            ))}
          </div>
        </section>

        {/* 手牌（ORDER-051 spec 7）：行動籤改用模式 B 新卡框語彙（.hs-card 金框畫窗＋名條＋費用寶石）迷你版 */}
        <section ref={handRef}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-amber-300/70">
              行動籤（牌庫 {game.deck.length} · 棄 {game.discard.length}）
            </h2>
            <button
              ref={campRef}
              onClick={() => setGame((g) => camp(g))}
              disabled={game.status !== "playing"}
              className={`repair-primary-btn relative flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed ${
                primary === "camp" ? "jny-spotlight" : primary !== null && game.status === "playing" ? "jny-dim" : ""
              } ${campDim ? "jny-camp-raise" : ""}`}
            >
              {primary === "camp" && <span className="jny-now-pill">▶ 現在</span>}
              <IconMoon className="w-3.5 h-3.5 shrink-0" /> 紮營（收束今日）
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FRAME_DIVIDER} alt="" className="mb-3 h-2 w-40 object-contain object-left opacity-80" />
          <div className="flex flex-wrap gap-3 pt-2">
            {game.hand.map((c) => {
              const playable = canAfford(game, c);
              const eff = apCost(game, c);
              const art = CARD_ART[c.effect];
              return (
                <button
                  key={c.key}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  className={`hs-card w-36 text-left p-2 ${
                    playable ? "hs-card-playable" : "opacity-40 cursor-not-allowed"
                  }`}
                >
                  <CostGem n={eff} />
                  {eff !== c.cost && (
                    <span className="absolute -top-2 left-6 z-10 rounded-full border border-emerald-400/70 bg-emerald-900/95 px-1.5 text-[9px] font-bold text-emerald-300">
                      原{c.cost}
                    </span>
                  )}
                  {art ? (
                    <div className="relative mb-1.5 h-16 w-full overflow-hidden rounded-lg">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={art} alt={c.name} className="h-full w-full object-cover" />
                      <span className="hs-art-frame rounded-lg" aria-hidden />
                    </div>
                  ) : (
                    <div className="relative mb-1.5 flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-[#0b1722]">
                      <IconTarget className="w-6 h-6 text-amber-300/50" />
                      <span className="hs-art-frame rounded-lg" aria-hidden />
                    </div>
                  )}
                  <div className="hs-name-banner -mx-2 flex items-center justify-between px-2 py-0.5">
                    <span className={`${notoSerifTC.className} text-sm font-bold`}>{c.name}</span>
                    <span className="text-[9px] tracking-[0.15em] text-amber-200/70">{cardTypeLabel(c.type)}</span>
                  </div>
                  <div className="mt-1">
                    <WordChip vocabId={c.vocabId} />
                  </div>
                  <div className="text-[10px] text-amber-100/60 mt-1 leading-snug">{c.desc}</div>
                  {c.costRes && (
                    <div className="flex items-center gap-2 text-[10px] text-amber-300/80 mt-1">
                      <span>耗</span>
                      {Object.entries(c.costRes).map(([r, v]) => (
                        <span key={r} className="inline-flex items-center gap-0.5" title={RES_NAME[r as Resource]}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={RES_IMG[r as Resource]} width={14} height={14} alt={RES_NAME[r as Resource]} />
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                  {c.quiz && <div className="text-[10px] text-sky-300/70 mt-1">★ 需答族語題</div>}
                </button>
              );
            })}
          </div>
        </section>

        {/* 來源標示（授權洽談中）＋ 文化複核狀態 */}
        <footer className="mt-4 text-[10px] leading-relaxed text-slate-500 border-t border-slate-800 pt-2">
          {ATTRIBUTION}
          （
          <a href={SOURCE_URL} target="_blank" rel="noreferrer" className="underline hover:text-slate-300">
            {SOURCE}
          </a>
          ）· 太魯閣語 trv。正式對外發布之授權洽談中；族語於遊戲中之用法文化複核進行中。
        </footer>
        </div>
      </div>

      {/* 族語答題彈窗 */}
      {pending && quiz && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-md p-5">
            <div className="relative z-[2]">
              <div className="text-xs text-amber-300/80 mb-1">打出「{pending.name}」— 答對則行動全額生效</div>
              <h3 className={`${notoSerifTC.className} repair-title text-lg font-black mb-1`}>{quiz.prompt}</h3>
              <p className="text-[10px] text-amber-300/70 mb-3">{quiz.note}</p>
              <div className="grid gap-2">
                {quiz.options.map((opt, idx) => {
                  let cls = "border-amber-500/25 bg-[#0b1722]/90 hover:border-amber-400/60 hover:bg-[#132435]";
                  if (revealed !== null) {
                    if (idx === quiz.answer) cls = "border-emerald-400/70 bg-emerald-800/80";
                    else if (idx === revealed) cls = "border-rose-400/70 bg-rose-800/80";
                    else cls = "border-amber-500/15 bg-[#0b1722]/90 opacity-50";
                  }
                  return (
                    <button
                      key={idx}
                      disabled={revealed !== null}
                      onClick={() => answer(idx)}
                      className={`rounded-lg border px-4 py-2 text-left text-amber-50 transition ${cls}`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </button>
                  );
                })}
              </div>
              {revealed !== null && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="inline-flex items-center gap-1 text-xs text-amber-100/85">
                      {revealed === quiz.answer ? (
                        <IconCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <IconCross className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      )}
                      {revealed === quiz.answer ? "答對！行動全額生效。" : "答錯，行動以半額生效。"}
                    </p>
                    <button
                      onClick={() => playAudio(quiz.audioId)}
                      className="repair-secondary-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                      title="播放正解發音（原住民族語E樂園）"
                    >
                      <IconSpeaker className="w-3.5 h-3.5 shrink-0" /> 聽發音
                    </button>
                  </div>
                  <button
                    onClick={confirmAnswer}
                    className="repair-primary-btn rounded-lg px-4 py-1.5 text-xs font-black"
                  >
                    繼續 ▶
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 修復路段建造彈窗（v5 ORDER-036；v6 ORDER-040 換成拖拉建造畫布）：動手拖拉頁岩/橫樑/藤索，
          取代原本「花資源硬清」的單鍵答題。building 非 null 就一直渲染（含 pendingAction/crossing 期間），
          讓答題彈窗疊在上層、動畫播放時畫布仍可見；過關判定沿用已驗證的 resolveBuildTest。 */}
      {building && (() => {
        const node = game.nodes[game.idx];
        const mode = buildModeForNode(node) ?? "rockfall";
        const bridgeMode = mode === "bridge";
        const score = buildScore(building, mode);
        const tier = score >= 60 ? "safe" : score >= 35 ? "risky" : "weak";
        const textColor = tier === "safe" ? "text-emerald-400" : tier === "risky" ? "text-amber-400" : "text-rose-400";
        const interactive = !pendingAction && !crossing;
        return (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-[6px] sm:p-6">
            <div className="repair-modal w-full max-w-2xl px-5 py-6 sm:px-8 sm:py-7 my-4">
              {/* 標題區（RPG 任務面板：分類小字＋大標＋說明） */}
              <header className="relative z-[2] mb-4 text-center">
                <p className={`${notoSansTC.className} mb-1.5 text-sm font-bold tracking-[0.08em] text-amber-300`}>
                  {bridgeMode ? "章節試煉 · 把兩岸重新接起來" : "修復路段 · 這次，換你們重新排一次路"}
                </p>
                <h3 className={`${notoSerifTC.className} repair-title text-3xl font-black sm:text-4xl`}>{node.name}</h3>
                <p className="mx-auto mt-3 max-w-xl text-left text-xs leading-relaxed text-amber-100/70 sm:text-sm">
                  {bridgeMode
                    ? "兩岸還隔著急流。先在溪面安好頁岩樁，再用至少兩根橫樑接住跨距，最後以藤索固定；暴風越急，橋身就越考驗你的取捨。"
                    : "溪水沖垮了這段路。拖拉手邊的材料，把它重新接起來——頁岩固定樁可以直接點在溪面上；橫樑跟藤索則從一個節點拖到另一個節點，牽出連線。"}
                </p>
              </header>

              {/* 結構穩定度 */}
              <div className="relative z-[2] mb-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-amber-100/85">
                  <span>結構穩定度</span>
                  <span className={`text-base ${textColor}`}>{Math.min(100, score)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-500/25 shadow-[inset_0_2px_5px_rgba(0,0,0,0.45)]">
                  <div
                    className={`repair-progress-fill h-full rounded-full transition-all ${tier === "weak" ? "opacity-70" : ""}`}
                    style={{ width: `${Math.min(100, score)}%` }}
                  />
                </div>
              </div>

              {/* 大型互動操作區：俯視溪谷實景圖（ORDER-046 素材，司令 mockup 裁切、已過複核）
                  ＋ 透明 canvas 疊層負責拖拉建造與山羌過場（v6 ORDER-040 邏輯不變） */}
              <div className="relative z-[2] aspect-[803/338] w-full overflow-hidden rounded-xl border border-amber-500/50 shadow-[0_24px_42px_rgba(0,0,0,0.45),inset_0_0_38px_rgba(0,0,0,0.4)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/journey/repair/repair-river-board.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
                <BuildCanvas ref={buildCanvasRef} tool={buildTool} onUseMaterial={addMaterial} interactive={interactive} />
              </div>

              <p className="relative z-[2] mt-3 text-center text-xs tracking-[0.06em] text-amber-200/80">
                {buildTool === "stone" ? "點溪面即可放置頁岩樁" : "拖曳材料至節點或兩節點之間以搭建結構"}
                {bridgeMode && <span className="ml-2 text-amber-300/90">吊橋最低需求：橫樑×2・藤索×1</span>}
              </p>

              {/* 材料道具卡 */}
              <div className="relative z-[2] mt-3 grid grid-cols-3 gap-2.5 sm:gap-4">
                {(
                  [
                    { key: "stone" as const, name: "頁岩樁", word: "btunux", img: "/images/journey/repair/material-slate-pile.jpg", left: game.res.stone },
                    { key: "wood" as const, name: "橫樑", word: "qhuni", img: "/images/journey/repair/material-wood-beam.jpg", left: game.res.wood },
                    { key: "rope" as const, name: "藤索", word: "gasil", img: "/images/journey/repair/material-vine-rope.jpg", left: game.res.rope },
                  ]
                ).map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setBuildTool(m.key)}
                    disabled={m.left < 1}
                    className={`material-card rounded-2xl px-2 py-3 text-center disabled:opacity-35 sm:px-4 sm:py-4 ${
                      buildTool === m.key ? "selected" : ""
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.img}
                      alt=""
                      className="mx-auto mb-1.5 h-12 w-12 rounded-lg object-cover drop-shadow-[0_10px_12px_rgba(0,0,0,0.45)] sm:h-16 sm:w-16"
                    />
                    <span className={`${notoSerifTC.className} block text-sm font-black tracking-[0.08em] text-amber-50 sm:text-lg`}>
                      {m.name}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-sky-200/70 sm:text-sm">{m.word}</span>
                    <span className="mt-1 block text-[11px] text-amber-200/90 sm:text-sm">
                      剩餘 <b>{m.left}</b>
                    </span>
                  </button>
                ))}
              </div>

              {/* 說明框 */}
              <div className="relative z-[2] mt-4 rounded-xl border border-teal-700/25 bg-teal-950/40 px-4 py-3 text-xs leading-relaxed text-amber-100/75">
                <p>◈ 點溪面即可放置頁岩樁。</p>
                <p className="mt-1">
                  ◈{" "}
                  {bridgeMode
                    ? "吊橋工法：至少兩根橫樑承住跨距，再用藤索固定；石樁越多不一定越穩，留出水路才是關鍵。"
                    : building.wood === 0
                    ? "純疊石工法：省下橫樑木材，測試通過後有額外行動點獎勵。"
                    : "架橫樑能更快墊高穩定度，但這次用了木材，沒有省料獎勵。"}
                </p>
                {building.stone > 8 && (
                  <p className="mt-1 inline-flex items-center gap-1 text-rose-300">
                    <IconAlert className="w-3 h-3 shrink-0" /> 石頭堆太密，可能擋住水路，測試時有風險——大自然的路，要留給水走。
                  </p>
                )}
              </div>

              {/* 底部操作 */}
              <footer className="relative z-[2] mt-5 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-end sm:justify-between">
                <button
                  onClick={() => setBuilding(null)}
                  disabled={!interactive}
                  className="repair-secondary-btn rounded-xl px-8 py-3 text-sm font-bold tracking-[0.08em] disabled:opacity-40"
                >
                  ✦ 先不修了
                </button>
                <div className="text-left sm:text-right">
                  {building.rope < 1 && (
                    <p className="mb-1.5 text-xs font-bold text-rose-400">還沒綁緊固定，至少要用 1 個藤索。</p>
                  )}
                  {bridgeMode && building.wood < 2 && (
                    <p className="mb-1.5 text-xs font-bold text-rose-400">吊橋跨距還沒接住，至少要用 2 根橫樑。</p>
                  )}
                  <button
                    onClick={startBuildTest}
                    disabled={building.rope < 1 || (bridgeMode && building.wood < 2) || !interactive}
                    className="repair-primary-btn inline-flex w-full items-center justify-center gap-2 rounded-xl px-10 py-3 text-sm font-black tracking-[0.08em] sm:w-auto"
                  >
                    <IconFootprint className="w-4 h-4 shrink-0" /> 測試通行
                  </button>
                </div>
              </footer>
            </div>
          </div>
        );
      })()}

      {/* 族語答題彈窗（v3，ORDER-031）：硬清／謹慎探勘／補給共用，答對全額、答錯半額 */}
      {pendingAction && actionQuiz && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-md p-5">
            <div className="relative z-[2]">
              <div className="text-xs text-amber-300/80 mb-1">
                {pendingAction.kind === "hardClear" && "花資源硬清 — 答對則全額生效"}
                {pendingAction.kind === "eventCareful" && "謹慎探勘 — 答對則全額生效"}
                {pendingAction.kind === "supply" && `補給（${RES_NAME[pendingAction.resource as Resource]}）— 答對則全額生效`}
                {pendingAction.kind === "buildTest" && "測試通行前，先答一題（答對：隊伍信心加成，結構穩定度 +15）"}
              </div>
              <h3 className={`${notoSerifTC.className} repair-title text-lg font-black mb-1`}>{actionQuiz.prompt}</h3>
              <p className="text-[10px] text-amber-300/70 mb-3">{actionQuiz.note}</p>
              <div className="grid gap-2">
                {actionQuiz.options.map((opt, idx) => {
                  let cls = "border-amber-500/25 bg-[#0b1722]/90 hover:border-amber-400/60 hover:bg-[#132435]";
                  if (actionRevealed !== null) {
                    if (idx === actionQuiz.answer) cls = "border-emerald-400/70 bg-emerald-800/80";
                    else if (idx === actionRevealed) cls = "border-rose-400/70 bg-rose-800/80";
                    else cls = "border-amber-500/15 bg-[#0b1722]/90 opacity-50";
                  }
                  return (
                    <button
                      key={idx}
                      disabled={actionRevealed !== null}
                      onClick={() => answerAction(idx)}
                      className={`rounded-lg border px-4 py-2 text-left text-amber-50 transition ${cls}`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </button>
                  );
                })}
              </div>
              {actionRevealed !== null && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="inline-flex items-center gap-1 text-xs text-amber-100/85">
                      {actionRevealed === actionQuiz.answer ? (
                        <IconCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <IconCross className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      )}
                      {pendingAction.kind === "buildTest"
                        ? actionRevealed === actionQuiz.answer
                          ? "答對！穩定度 +15。"
                          : "答錯，沒有加成。"
                        : actionRevealed === actionQuiz.answer
                          ? "答對！全額生效。"
                          : "答錯，半額生效。"}
                    </p>
                    <button
                      onClick={() => playAudio(actionQuiz.audioId)}
                      className="repair-secondary-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                      title="播放正解發音（原住民族語E樂園）"
                    >
                      <IconSpeaker className="w-3.5 h-3.5 shrink-0" /> 聽發音
                    </button>
                  </div>
                  <button
                    onClick={confirmActionAnswer}
                    className="repair-primary-btn flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-black"
                  >
                    {pendingAction.kind === "buildTest" ? (
                      <>
                        <IconFootprint className="w-3.5 h-3.5 shrink-0" /> 測試通行
                      </>
                    ) : (
                      "繼續 ▶"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 族語試煉（v7，ORDER-042）：綁節點的 TRPG 式語言檢定，每節點一次，3 題（含節點自己的詞）。 */}
      {challenge && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-md p-5">
            <div className="relative z-[2]">
              <div className="flex items-center gap-1.5 text-xs text-sky-300 mb-1 font-semibold">
                <IconBook className="w-3.5 h-3.5 shrink-0" /> 族語試煉 · {game.nodes[game.idx]?.name} · 第 {challenge.idx + 1}/{challenge.quizzes.length} 題
              </div>
              <h3 className={`${notoSerifTC.className} repair-title text-lg font-black mb-1`}>{challenge.quizzes[challenge.idx].prompt}</h3>
              <p className="text-[10px] text-amber-300/70 mb-3">{challenge.quizzes[challenge.idx].note}</p>
              <div className="grid gap-2">
                {challenge.quizzes[challenge.idx].options.map((opt, idx) => {
                  const q = challenge.quizzes[challenge.idx];
                  let cls = "border-amber-500/25 bg-[#0b1722]/90 hover:border-amber-400/60 hover:bg-[#132435]";
                  if (challengeRevealed !== null) {
                    if (idx === q.answer) cls = "border-emerald-400/70 bg-emerald-800/80";
                    else if (idx === challengeRevealed) cls = "border-rose-400/70 bg-rose-800/80";
                    else cls = "border-amber-500/15 bg-[#0b1722]/90 opacity-50";
                  }
                  return (
                    <button
                      key={idx}
                      disabled={challengeRevealed !== null}
                      onClick={() => answerChallenge(idx)}
                      className={`rounded-lg border px-4 py-2 text-left text-amber-50 transition ${cls}`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </button>
                  );
                })}
              </div>
              {challengeRevealed !== null && (
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <p className="inline-flex items-center gap-1 text-xs text-amber-100/85">
                      {challengeRevealed === challenge.quizzes[challenge.idx].answer ? (
                        <IconCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <IconCross className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                      )}
                      {challengeRevealed === challenge.quizzes[challenge.idx].answer ? "答對！" : "答錯。"}
                    </p>
                    <button
                      onClick={() => playAudio(challenge.quizzes[challenge.idx].audioId)}
                      className="repair-secondary-btn flex items-center gap-1 rounded-lg px-2 py-1 text-xs"
                      title="播放正解發音（原住民族語E樂園）"
                    >
                      <IconSpeaker className="w-3.5 h-3.5 shrink-0" /> 聽發音
                    </button>
                  </div>
                  <button
                    onClick={nextChallenge}
                    className="repair-primary-btn flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-black"
                  >
                    {challenge.idx + 1 >= challenge.quizzes.length ? (
                      <>
                        <IconFlag className="w-3.5 h-3.5 shrink-0" /> 完成
                      </>
                    ) : (
                      "下一題 ▶"
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 規則面板 */}
      {showRules && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-md max-h-[85vh] overflow-y-auto p-5 text-sm">
            <div className="relative z-[2]">
            <h3 className={`${notoSerifTC.className} repair-title text-lg font-black mb-3`}>怎麼玩 · 勝敗條件</h3>
            <ul className="space-y-2 text-amber-100/85">
              <li className="flex gap-2">
                <IconFlag className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span><b>目標</b>：在第 {levelCfg(game).maxDay} 日結束前，帶隊伍抵達終點「{game.nodes[game.nodes.length - 1]?.name.replace("（目的地）", "")}」。</span>
              </li>
              <li>▶ 路段清除後，隨時可點常駐的<b>「前進」</b>（花 1 行動點）走到下一段，不需要特定卡牌。</li>
              <li className="flex gap-2">
                <IconHammer className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>落石路段是<b>動手建造</b>：點「修復路段」，用頁岩／橫樑／藤索疊出穩定度（至少要 1 藤索才能測試），或直接打「搬石」／「共同搬運」牌快速清除。純疊石不用木材完工有額外行動點獎勵。</span>
              </li>
              <li>吊橋可以打行動／協作牌清除，也可以花<b>雙倍資源「硬清」</b>——都要先答族語題，答對全額答錯半額，硬清只是省行動點、不是省答題。</li>
              <li className="flex gap-2">
                <IconQuestion className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>林間捷徑是<b>真選擇</b>：「快速通過」不用答題但壓力 +4，且兩個路段後路況會回頭反噬（壓力再 +2）；「謹慎探勘」要答題換糧食。山腰營地要補哪一種資源也要先答題，答對 +3、答錯僅 +1。</span>
              </li>
              {game.levelId === "l2" && (
                <li className="flex gap-2">
                  <IconRain className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>第二關限定・<b>環境危害</b>：暴風雨／雷擊／側風擋在路上，要用「頂風前行」「架設臨時遮蔽」「共同搬運」或花資源架遮蔽清除。<b>不清除的話，每次紮營都會持續付出代價</b>（扣體力或加壓力，依危害而異）。</span>
                </li>
              )}
              <li className="flex gap-2">
                <IconBook className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>每個路段都有一次<b>「族語試煉」</b>：3 題（含這個路段自己的詞），通過（答對 2 題以上）依情境給獎勵——路段有阻礙時阻礙 -1，否則壓力 -1。免費、不佔行動點。</span>
              </li>
              <li className="flex gap-2">
                <IconFlame className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>連續答對 3 題族語題會觸發<b>「順風」</b>，補 1 行動點。</span>
              </li>
              <li className="flex gap-2">
                <IconGauge className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span><b>壓力分級</b>：5 分以上「緊張」（紮營消耗糧食變 2）；8 分以上「危急」（行動點上限收緊為 2）。</span>
              </li>
              <li className="flex gap-2">
                <IconMoon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span><b>紮營</b>收束當日：消耗糧食（見上）；糧食不足則隊伍體力 -2；當前路段未通行則壓力 +1。</span>
              </li>
              <li className="flex gap-2">
                <IconAlert className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span><b>失敗條件</b>：壓力達 {10}（被迫折返）、或隊伍體力歸 0（耗盡）、或第 {levelCfg(game).maxDay} 日結束仍未抵達。</span>
              </li>
              <li className="flex gap-2">
                <IconPackage className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>資源：<b>糧食</b>（紮營消耗）、<b>木材／繩索</b>（搭橋）、<b>石材</b>（硬清落石）——資源列圖示下方的族語詞是真實太魯閣語，可點喇叭聽發音。</span>
              </li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setShowRules(false)}
                className="repair-primary-btn rounded-xl px-6 py-2 text-sm font-black"
              >
                知道了
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* 重新開始二次確認 */}
      {confirmRestart && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-xs p-5 text-center">
            <div className="relative z-[2]">
              <h3 className={`${notoSerifTC.className} repair-title text-base font-black mb-1`}>重新開始這一局？</h3>
              <p className="text-xs text-amber-100/60 mb-4">目前進度會全部重置，無法復原。</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => restart()}
                  className="repair-primary-btn rounded-xl px-4 py-2 text-sm font-black"
                >
                  確定重來
                </button>
                <button
                  onClick={() => setConfirmRestart(false)}
                  className="repair-secondary-btn rounded-xl px-4 py-2 text-sm font-bold"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 章節標題卡（v2）：進入新章節時的過場，沿用 /prologue 字體與 kicker 樣式，維持敘事連續。
          優先權高於故事卡（見下）——同一節點若兩者的觸發 state 剛好同時被設成非 null（effect 批次處理時序），
          章節卡在 JSX 順位優先渲染，避免兩層全螢幕蒙版疊加；玩家關掉章節卡後故事卡才顯示。 */}
      {chapterCard !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-[4px] p-4">
          <div className="repair-modal w-full max-w-md p-8 text-center">
            <div
              className={`${notoSansTC.className} mb-4 inline-block rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90`}
            >
              {chaptersOf(game.levelId)[chapterCard].kicker}
            </div>
            <div className={`${notoSerifTC.className} repair-title text-xl font-bold leading-snug sm:text-2xl`}>
              {chaptersOf(game.levelId)[chapterCard].title}
            </div>
            <p className={`${notoSansTC.className} mt-4 text-sm leading-relaxed text-amber-100/80`}>{chaptersOf(game.levelId)[chapterCard].sub}</p>
            <div className="mt-5 rounded-xl border border-amber-500/25 bg-[#050d14]/65 p-3 text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">本章任務</div>
              <p className="mt-1 text-xs leading-relaxed text-amber-50/90">{levelCfg(game).mission}</p>
            </div>
            <button
              onClick={() => setChapterCard(null)}
              className={`${notoSerifTC.className} repair-primary-btn mt-6 rounded-xl px-8 py-2.5 text-sm font-bold tracking-[0.15em] transition hover:-translate-y-0.5`}
            >
              繼續
            </button>
          </div>
        </div>
      )}

      {/* 節點故事卡（v4，ORDER-032；v5 ORDER-037 加配圖）：抵達有 NODE_STORY 的節點時彈出，樣式比照章節卡（一張一張卡，取代原本埋在面板裡的小字）。
          max-h + overflow-y-auto：部分傳說全文較長（如巨人馬威），避免固定高度裁切內文。
          chapterCard === null 才渲染：章節卡優先顯示，避免兩層全螢幕蒙版同時疊加。
          配圖沿用 ORDER-017 已通過文化複核的節點場景圖（NODE_STORY_IMG），無圖就不顯示圖片區塊，不擋文字內容。 */}
      {chapterCard === null && storyCard !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-[4px] p-4">
          <div className="repair-modal w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
            {levelCfg(game).nodeStoryImg[storyCard] && (
              <div className="relative h-40 sm:h-48 w-full overflow-hidden rounded-t-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={levelCfg(game).nodeStoryImg[storyCard]}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050d14] via-[#050d14]/10 to-transparent" />
              </div>
            )}
            <div className="relative z-[2] p-8 pt-6 text-center">
              <div
                className={`${notoSansTC.className} mb-4 inline-block rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90`}
              >
                這裡的故事
              </div>
              <p className={`${notoSansTC.className} text-left text-sm leading-relaxed text-amber-100/90 whitespace-pre-line`}>
                {levelCfg(game).nodeStory[storyCard]}
              </p>
              <div className="mt-5 rounded-xl border border-amber-500/25 bg-[#050d14]/65 p-3 text-left">
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-300/80">→ 你的下一步</div>
                <p className="mt-1 text-xs leading-relaxed text-amber-50/90">{stepHint(game).todo}</p>
              </div>
              <button
                onClick={() => setStoryCard(null)}
                className={`${notoSerifTC.className} repair-primary-btn mt-6 rounded-xl px-8 py-2.5 text-sm font-bold tracking-[0.15em] transition hover:-translate-y-0.5`}
              >
                繼續
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 勝負彈窗（v4，ORDER-033 加「這趟學了什麼」詞彙回顧——司令實測回報通關後毫無記憶點，
          原本只顯示正確率數字，玩家看完就關掉，沒有具體「我學了哪些詞」的畫面停留。
          改列出這局實際考過的每個詞（去重，取最後一次作答結果），中文＋族語＋可重播發音，
          在離開前給一次完整的視覺＋聽覺總覽。 */}
      {game.status !== "playing" && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-[4px] flex items-center justify-center p-4 z-50">
          <div className="repair-modal w-full max-w-md max-h-[85vh] overflow-y-auto p-6 text-center">
            <div className="relative z-[2]">
            <div className="flex justify-center mb-2">
              {game.status === "won" ? (
                <IconMountain className="w-10 h-10 text-emerald-400" />
              ) : (
                <IconRain className="w-10 h-10 text-slate-400" />
              )}
            </div>
            <h3 className={`${notoSerifTC.className} repair-title text-xl font-black mb-1`}>
              {game.status === "won"
                ? game.levelId === "l2"
                  ? "安全下了稜線！"
                  : "安全抵達部落！"
                : game.levelId === "l2"
                  ? "未能翻過稜線"
                  : "未能抵達部落"}
            </h3>
            <p className="text-sm text-amber-100/60 mb-4">
              {game.status === "won"
                ? `第 ${game.day} 日抵達，答題正確率 ${rateLabel}。`
                : game.pressure >= game.maxPressure
                  ? "壓力達到上限，隊伍被迫折返。"
                  : game.teamHp <= 0
                    ? "隊伍體力耗盡。"
                    : "任務天數耗盡，尚未抵達。"}
            </p>

            {/* ORDER-050（P2）：第一關通關 → 下一關預告鉤子＋直接前進第二關 */}
            {game.status === "won" && game.levelId === "l1" && level2Unlocked && (
              <div className="mb-4 rounded-xl border border-sky-700/50 bg-sky-950/30 p-3 text-left">
                <div className="text-xs uppercase tracking-wider text-sky-400 font-semibold mb-1">下一關預告</div>
                <p className="text-xs leading-relaxed text-slate-300">
                  第二關《風雨的稜線》已解鎖——暴風雨正面撲向稜線，環境危害不清除，每晚都會消耗你的隊伍。
                </p>
              </div>
            )}

            {(() => {
              const byId = new Map<string, boolean>();
              for (const { vocabId, correct } of game.wordLog) byId.set(vocabId, correct);
              const words = [...byId.entries()];
              if (words.length === 0) return null;
              return (
                <div className="mb-4 rounded-xl border border-slate-700 bg-slate-950/60 p-3 text-left">
                  <div className="text-xs uppercase tracking-wider text-emerald-400 font-semibold mb-2">
                    這趟學了什麼（{words.filter(([, ok]) => ok).length}/{words.length} 詞答對）
                  </div>
                  <div className="grid gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {words.map(([vocabId, ok]) => {
                      const entry = vocab(vocabId);
                      return (
                        <div
                          key={vocabId}
                          className="flex items-center justify-between gap-2 rounded-lg bg-slate-900/70 px-2.5 py-1.5"
                        >
                          <span className="inline-flex items-center gap-1 text-xs">
                            {ok ? (
                              <IconCheck className="w-3 h-3 shrink-0 text-emerald-400" />
                            ) : (
                              <IconCross className="w-3 h-3 shrink-0 text-rose-400" />
                            )}
                            {entry.chinese}
                            <span className="text-slate-400"> · </span>
                            <span className="font-semibold">{entry.word}</span>
                          </span>
                          <button
                            onClick={() => playAudio(vocabId)}
                            className="shrink-0 rounded bg-sky-700 hover:bg-sky-600 px-2 py-0.5 text-[10px]"
                            title="播放發音（原住民族語E樂園）"
                          >
                            <IconSpeaker className="w-3 h-3 shrink-0" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-2 justify-center flex-wrap">
              {game.status === "won" && game.levelId === "l1" && level2Unlocked && (
                <button
                  onClick={() => restart("l2")}
                  className="repair-primary-btn rounded-xl px-5 py-2 text-sm font-black"
                >
                  前進第二關 ▶
                </button>
              )}
              <button
                onClick={() => restart()}
                className={`${game.status === "won" && game.levelId === "l1" && level2Unlocked ? "repair-secondary-btn" : "repair-primary-btn"} rounded-xl px-5 py-2 text-sm font-black`}
              >
                再走一次
              </button>
              <Link href="/" className="repair-secondary-btn rounded-xl px-5 py-2 text-sm font-bold">
                回模式選擇
              </Link>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ORDER-051（引導點 4）：AP=0 紮營提示——全頁輕微降暗（pointer-events:none，不擋彈窗），
          紮營鈕以 jny-camp-raise 抬升到蒙版之上聚光 */}
      {campDim && <div className="jny-camp-overlay" aria-hidden />}

      {/* ORDER-051（引導點 3）：首次教學 coach marks——4 站逐步聚光（任務面板→行動聚光燈→手牌→紮營），
          box-shadow 挖洞聚光目標區域，各一句話，可跳過；完成後寫 localStorage 不再出現。 */}
      {coach !== null && (
        <div className="fixed inset-0 z-[70]">
          {coachRect ? (
            <div
              className="jny-coach-cutout"
              style={{ top: coachRect.top, left: coachRect.left, width: coachRect.width, height: coachRect.height }}
            />
          ) : (
            <div className="fixed inset-0 bg-[#02070c]/80" />
          )}
          <div className="fixed inset-x-0 bottom-6 z-[75] flex justify-center px-4">
            <div className="repair-modal w-full max-w-sm px-5 py-4">
              <div className="relative z-[2]">
                <div className="text-[10px] tracking-[0.25em] text-amber-300/80">新手引導 · {coach + 1}/{COACH_STEPS.length}</div>
                <div className={`${notoSerifTC.className} repair-title mt-1 text-lg font-black`}>{COACH_STEPS[coach].title}</div>
                <p className="mt-1.5 text-sm leading-relaxed text-amber-100/85">{COACH_STEPS[coach].text}</p>
                <div className="mt-3 flex justify-end gap-2">
                  <button onClick={finishCoach} className="repair-secondary-btn rounded-lg px-4 py-1.5 text-xs font-bold">
                    跳過
                  </button>
                  <button
                    onClick={() => (coach + 1 >= COACH_STEPS.length ? finishCoach() : setCoach(coach + 1))}
                    className="repair-primary-btn rounded-lg px-5 py-1.5 text-xs font-black"
                  >
                    {coach + 1 >= COACH_STEPS.length ? "開始遊戲" : "下一步 ▶"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function cardTypeLabel(t: CardType): string {
  return { action: "行動", coop: "協作", supply: "補給", watch: "守望", weave: "織圖" }[t];
}

// ORDER-051（spec 7）：行動籤費用寶石——沿用 /play 的 .hs-gem 定位與字級 class，
// 形狀比照模式 B 的藍寶石六角柱切（文化紅線：避開菱形輪廓，不觸祖靈之眼紋樣）。
function CostGem({ n }: { n: number }) {
  return (
    <span className="hs-gem hs-gem-md hs-gem-cost" aria-hidden>
      <svg viewBox="0 0 30 30" className="h-full w-full">
        <polygon points="15,1.5 27.5,8.25 27.5,21.75 15,28.5 2.5,21.75 2.5,8.25" fill="#1d4ed8" stroke="#93c5fd" strokeWidth="1.5" />
        <polygon points="15,5.5 23.5,10.2 23.5,19.8 15,24.5 6.5,19.8 6.5,10.2" fill="rgba(255,255,255,0.16)" />
      </svg>
      <span className="hs-gem-num text-white">{n}</span>
    </span>
  );
}

// 側邊導覽（ORDER-017 nav 圖示）；桌機顯示，手機隱藏。僅實作頁面為連結，其餘標「敬請期待」。
function SideRail({ active }: { active: string }) {
  return (
    <nav className="hidden sm:flex flex-col items-center gap-1 w-16 shrink-0 border-r border-slate-800/80 bg-slate-950/60 py-4 sticky top-0 h-screen">
      {NAV_ITEMS.map((it) => {
        const isActive = it.key === active;
        const inner = (
          <span
            className={`flex flex-col items-center gap-1 w-full rounded-lg py-2 transition ${
              isActive
                ? "bg-emerald-900/50 ring-1 ring-emerald-500/60"
                : it.href
                  ? "hover:bg-slate-800/70"
                  : "opacity-35"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.img} width={28} height={28} alt={it.label} />
            <span className="text-[9px] text-slate-300">{it.label}</span>
          </span>
        );
        if (it.href && !isActive) {
          return (
            <Link key={it.key} href={it.href} className="w-12" title={it.label}>
              {inner}
            </Link>
          );
        }
        return (
          <div key={it.key} className="w-12" title={it.href ? it.label : `${it.label}（敬請期待）`}>
            {inner}
          </div>
        );
      })}
    </nav>
  );
}

// 中性裝飾外框（ORDER-018）：四邊平鋪 + 四角鏡像；pointer-events:none，純裝飾疊層，不擋互動。
// 非正式織紋框，為 §16.2 之中性替代品，正式文化外框仍待真人族語老師另案複核。
function OrnateFrame() {
  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden>
      {/* 四邊：橫邊平鋪 x、直邊平鋪 y，對邊以 transform 鏡像 */}
      <span
        className="absolute inset-x-0 top-0 h-4 bg-repeat-x"
        style={{ backgroundImage: `url(${FRAME_EDGE_H})`, backgroundSize: "auto 100%" }}
      />
      <span
        className="absolute inset-x-0 bottom-0 h-4 bg-repeat-x"
        style={{ backgroundImage: `url(${FRAME_EDGE_H})`, backgroundSize: "auto 100%", transform: "scaleY(-1)" }}
      />
      <span
        className="absolute inset-y-0 left-0 w-4 bg-repeat-y"
        style={{ backgroundImage: `url(${FRAME_EDGE_V})`, backgroundSize: "100% auto" }}
      />
      <span
        className="absolute inset-y-0 right-0 w-4 bg-repeat-y"
        style={{ backgroundImage: `url(${FRAME_EDGE_V})`, backgroundSize: "100% auto", transform: "scaleX(-1)" }}
      />
      {/* 四角：左上原圖，其餘鏡像 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FRAME_CORNER} alt="" width={40} height={40} className="absolute top-0 left-0" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FRAME_CORNER} alt="" width={40} height={40} className="absolute top-0 right-0" style={{ transform: "scaleX(-1)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FRAME_CORNER} alt="" width={40} height={40} className="absolute bottom-0 left-0" style={{ transform: "scaleY(-1)" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FRAME_CORNER} alt="" width={40} height={40} className="absolute bottom-0 right-0" style={{ transform: "scale(-1,-1)" }} />
    </div>
  );
}

// 區段標題 + 中性分隔飾（ORDER-018 frame-divider；線·圓點·線，非菱形）
function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2">
      <h2 className="text-xs uppercase tracking-wider text-amber-300/70">{children}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FRAME_DIVIDER} alt="" className="mt-1 h-2 w-40 object-contain object-left opacity-80" />
    </div>
  );
}

// 顯示真實太魯閣語詞 + 發音（放在卡片按鈕內，故用 span 避免 button 巢狀；點擊不觸發卡片）
function WordChip({ vocabId }: { vocabId: string }) {
  const e = vocab(vocabId);
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-300/80">
      <span className="truncate">{e.word}</span>
      {e.hasAudio && (
        <span
          role="button"
          tabIndex={0}
          aria-label={`播放「${e.chinese}」的太魯閣語發音`}
          title="播放發音（原住民族語E樂園）"
          onClick={(ev) => {
            ev.stopPropagation();
            ev.preventDefault();
            playAudio(vocabId);
          }}
          onKeyDown={(ev) => {
            if (ev.key === "Enter" || ev.key === " ") {
              ev.stopPropagation();
              ev.preventDefault();
              playAudio(vocabId);
            }
          }}
          className="inline-flex cursor-pointer items-center rounded px-1 text-sky-300/90 hover:bg-slate-700/60"
        >
          <IconSpeaker className="w-3 h-3 shrink-0" />
        </span>
      )}
    </span>
  );
}

function StatBar({
  label,
  value,
  max,
  color,
  invert,
  icon,
  pulse,
  tag,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  invert?: boolean;
  icon?: string;
  pulse?: boolean;
  tag?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // ORDER-051（spec 4）：量表改「寶石量表」——圓形金框小徽記＋數字，條改漸層填色＋內陰影軌道
  return (
    <div className={`jny-panel rounded-xl p-2 ${pulse ? "animate-pulse !border-red-500/80" : ""}`}>
      <div className="relative z-[2] flex justify-between items-center text-[11px] mb-1">
        <span className="text-amber-100/70 flex items-center gap-1.5">
          {icon && (
            <span className="jny-gem-icon !h-5 !w-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={icon} width={12} height={12} alt="" />
            </span>
          )}
          {label}
          {tag && <span className="ml-1 rounded bg-amber-900/60 px-1 text-[10px] text-amber-300">{tag}</span>}
        </span>
        <span className={`font-bold ${invert ? "text-rose-300" : "text-emerald-300"}`}>
          {value}/{max}
        </span>
      </div>
      <div className="jny-track relative z-[2] h-2.5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
