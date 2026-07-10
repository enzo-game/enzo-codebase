"use client";

import Link from "next/link";
import { Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  milletPlanted: number; // ORDER-055（小米接力）：本局紮營時沿路種下的小米數（僅第二關會種；入 localStorage 銀行）
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
// ORDER-055（小米接力）：第二關紮營時「沿路種下的小米」存入銀行（上限 3），
// 下一次「新開局」（任一關）開局糧食 +N 並清空——世代接力的機制化呈現（呼應射日傳說）。
const LS_MILLET_BANK = "cw_millet_bank";
const MILLET_BANK_CAP = 3;
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

// ───────────────────────── 傳說篇章系統（ORDER-055，Phase 1：L1＋L2）─────────────────────────
// 一關一傳說：傳說＝章節骨架。篇章文字**只用** enzo-culture/references/truku-legends-sourced.md
// 既有核准內容（大洪水／射日）改寫節錄，連接句為中性敘述，不新編傳說內容。
// 紅線：不演出審判/獵首/紋面、彩虹橋僅意象、不把傳說角色做成可操作單位、不掛 Gaya/Utux/Sisin 當機制。
// milestones＝解鎖門檻（game.idx 到達該值即解鎖下一段）：L1（6 節點）通過節點 1/3/終點；
// L2（7 節點）等比放大為通過節點 2/4/終點。
type LegendConfig = {
  name: string; // 傳說名（旅途誌／篇章卡標題）
  sourceNote: string; // 出處標注（忠於記載、標注出處原則）
  passages: string[]; // 3-4 段，每段 80-150 字
  closing: string; // 勝利畫面的傳說收束句
  intro: string; // 章節卡「本章任務」區的傳說開場句（織入使命句前）
  milestones: number[]; // 各段解鎖的 game.idx 門檻（遞增）
  img: string; // 篇章卡配圖（沿用已過文化複核的既有場景圖）
};

const LEGEND_L1: LegendConfig = {
  name: "大洪水",
  sourceNote: "傳說改寫節錄自文獻記載（臺灣原住民族事典「洪水」）；忠於記載、標注出處，文化複核進行中。",
  passages: [
    "路斷的那個晚上，老人家在火邊又說起那場遠古的大洪水——大水漫過山谷，把大地淹成一片汪洋。傳說裡，陸上的神靈各自尋路：有的升上了天，有的化成了灌木與海鳥，在浪頭上飛。",
    "傳說裡，也有神靈在大水中溺了水，化作夜空裡的星星，遠遠看著這片土地；而留下來的，就成了太魯閣族人。倖存的人們在退水後的山谷裡，一段一段找回自己的路。老人家說到這裡，總會停一停，看看天上的星。",
    "大水退去之後，山還是山，溪還是溪，只是位置都重新排過了。留下來的人沒有多說話，把路一段一段接回去，把家一戶一戶蓋回來。路會斷，水會來，但只要人還在，路就接得回來——這是大洪水留給後代的話。",
  ],
  closing: "山河重新排過——這次，換你們排了回來。",
  intro: "老人家起頭講的，是那場大洪水：山曾經倒、水曾經漫，山河整個重新排過——",
  milestones: [0, 3, 5],
  img: "/images/journey/stories/scene-start-v1.jpg",
};

const LEGEND_L2: LegendConfig = {
  name: "射日",
  sourceNote: "傳說改寫節錄自文獻記載（原住民族委員會兒童網／臺灣原住民族事典「射日」）；忠於記載、標注出處，文化複核進行中。",
  passages: [
    "上稜線前，老人家講的是射日：遠古的天上有兩個太陽，輪流照射，大地被曬得乾枯，沒有黑夜，萬物得不到休息。族人商量之後決定——派人踏上遠路，去把多出來的那個太陽射下來。",
    "射日的路途極遠，出發的人知道自己這一輩子走不到。他們揹著小孩同行，沿途種下小米和橘子——給後面接力的人留糧，也給將來回家的人留一條認得的路。一代走不完的路，就交給下一代接著走。",
    "等到太陽終於被射下來，天地有了日夜，當年出發的人早已老去。完成這件事的，是沿著前人種下的作物、一路接力走完長路的後代。回程時，沿途的小米與橘子已經結實，一路把他們送回了家。",
  ],
  closing: "長路靠接力走完——這次，換你們沿路把小米種下去。",
  intro: "老人家起頭講的，是射日的遠行：出發的人揹著孩子、沿路種下小米，把路留給後面的人——",
  milestones: [0, 4, 6],
  img: "/images/journey/stories/scene-forest-v1.jpg",
};

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
    hazard: { kind: "hp", amount: 3, text: "雨水穿透外衣帶走體溫，隊伍體力 -3" }, // ORDER-055 難度調升：2→3
  },
  {
    name: "劈裂山巔的雷擊",
    vocabId: "11-10", // bruwa 雷
    threshold: 3,
    hazard: { kind: "hp", amount: 4, text: "雷擊風險持續逼近，隊伍體力 -4" }, // ORDER-055 難度調升：3→4
  },
  {
    name: "側風亂流",
    vocabId: "10-04", // bgihur 風
    threshold: 3,
    hazard: { kind: "pressure", amount: 3, text: "側風不斷把人推離路線，壓力 +3" }, // ORDER-055 難度調升：2→3
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
    { id: "n1", name: "落石路段", vocabId: "12-05", type: "obstacle", obstacle: 3, cleared: false }, // ORDER-055 難度調升：2→3
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
  startPressure: number; // ORDER-055（難度調升）：起始壓力依關卡設定（L1 調升 3→4）
  startRes: Record<Resource, number>;
  legend: LegendConfig; // ORDER-055：一關一傳說（篇章解鎖／旅途誌／勝利收束句）
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
    startPressure: 4, // ORDER-055 難度調升：3→4
    startRes: { food: 4, wood: 3, stone: 2, rope: 2 },
    legend: LEGEND_L1,
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
    // 7 節點、兩個多點數危害＋3 點石堆：比第一關多一天，但經濟更緊（ORDER-055：糧 3→2）
    maxDay: 7,
    startPressure: 3,
    startRes: { food: 2, wood: 2, stone: 2, rope: 2 },
    legend: LEGEND_L2,
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
    pressure: cfg.startPressure,
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
    milletPlanted: 0,
  };
}

// ORDER-055（傳說篇章）：目前已解鎖的篇章段數（依 idx 過門檻累計，純函式、可重算不需另存 state）
function unlockedLegendCount(g: JGame): number {
  return levelCfg(g).legend.milestones.filter((m) => g.idx >= m).length;
}

// ORDER-055（難度調升）：答錯卡牌效果由半額改 40%（向下取整、至少 1）
function wrongAmt(full: number): number {
  return Math.max(1, Math.floor(full * 0.4));
}

// ORDER-055（勝利畫面）：本局難度評分＝天數餘裕（每日 15、上限 30）＋正確率（上限 50）＋
// 傳說收集完整度（上限 20），總分 0-100，給重玩追分目標。
function difficultyScore(g: JGame): {
  total: number;
  daysPts: number;
  accPts: number;
  legendPts: number;
  daysSpare: number;
  ratePct: number;
  collected: number;
  totalPassages: number;
} {
  const cfg = levelCfg(g);
  const daysSpare = Math.max(0, cfg.maxDay - g.day);
  const daysPts = Math.min(30, daysSpare * 15);
  const answered = g.correct + g.wrong;
  const ratePct = answered === 0 ? 0 : Math.round((g.correct / answered) * 100);
  const accPts = Math.round(ratePct * 0.5);
  const collected = unlockedLegendCount(g);
  const totalPassages = cfg.legend.passages.length;
  const legendPts = totalPassages === 0 ? 0 : Math.round((collected / totalPassages) * 20);
  return { total: daysPts + accPts + legendPts, daysPts, accPts, legendPts, daysSpare, ratePct, collected, totalPassages };
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
    // ORDER-055（難度調升）：答錯由半額改 40%（向下取整、至少 1）
    const amt = wrongAmt(node.obstacle);
    node.obstacle = Math.max(0, node.obstacle - amt);
    if (node.obstacle === 0) node.cleared = true;
    ng.log = pushLog(ng.log, `✕ 答錯｜花資源硬清：資源已耗，僅清 ${amt} 點（剩 ${node.obstacle}）。`, "info");
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

// ───────────────────────── 聽音搭板（ORDER-054：吊橋語言優先小遊戲）─────────────────────────
// 司令回饋 ORDER-053 的吊橋拖拉建造「不太OK」——改成語言優先：過斷橋＝釘回五塊板，
// 每塊板＝一個族語詞，先聽真實發音再選中文意思（既有題型的反向）。錯了先教再走：
// 第一次錯給提示（揭示族語書寫、壓力 +1）、第二次錯直接教正解，板子照樣補上（補強樣式）。
// 中性框架：隊伍邊過橋邊喊出聽到的詞，不掛任何信仰概念。
// ORDER-055（難度調升）：搭板 5→6 塊。
const BRIDGE_PLANKS = 6;

// 聽音搭板的選項：正解的中文意思 + 3 個干擾詞的中文意思（distractors 已保證中文不重複）
function bridgeListenOptions(vocabId: string): { chinese: string; correct: boolean }[] {
  const ans = vocab(vocabId);
  return shuffle([
    { chinese: ans.chinese, correct: true },
    ...distractors(vocabId, 3).map((d) => ({ chinese: d.chinese, correct: false })),
  ]);
}

// 全部板釘完後的純結算（比照其他 reducer：複製狀態→清節點→記錄→settle）。
// results 每塊板一筆，correct＝是否「第一次就聽對」；至多錯 1 詞給壓力 -1 的加成。
function resolveBridgeListen(g: JGame, results: { vocabId: string; correct: boolean }[]): JGame {
  const node = g.nodes[g.idx];
  if (g.status !== "playing" || !node || node.type !== "bridge" || node.cleared) return g;
  const ng: JGame = { ...g, nodes: g.nodes.map((n) => ({ ...n })) };
  ng.wordLog = [...ng.wordLog, ...results];
  const correctCount = results.filter((r) => r.correct).length;
  ng.correct += correctCount;
  ng.wrong += results.length - correctCount;
  const n2 = ng.nodes[ng.idx];
  n2.obstacle = 0;
  n2.cleared = true;
  ng.log = pushLog(ng.log, `✓ 聽音搭板：${BRIDGE_PLANKS} 塊板都釘穩了，隊伍踏著自己念出來的路過了橋。`, "good");
  if (correctCount >= results.length - 1) {
    ng.pressure = Math.max(0, ng.pressure - 1);
    ng.log = pushLog(ng.log, `一次就聽懂 ${correctCount}/${results.length} 個詞——腳步跟發音一樣穩，壓力 -1！`, "good");
  }
  return settle(ng);
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
    // ORDER-055（難度調升）：試煉未過改小懲罰——壓力 +1（原本只記錄不懲罰）
    ng.pressure = Math.min(ng.maxPressure, ng.pressure + 1);
    ng.log = pushLog(ng.log, `族語試煉 ${correctCount}/${total}：這幾個詞還不熟，隊伍腳步亂了一拍——壓力 +1，路上再多念幾次。`, "bad");
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
      const amt = correct ? 2 : wrongAmt(2);
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
      const amt = correct ? full : wrongAmt(full);
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
      const amt = correct ? 3 : wrongAmt(3);
      ng.pressure = Math.max(0, ng.pressure - amt);
      ng.log = pushLog(ng.log, `${tag}｜守望：壓力 -${amt}（${ng.pressure}/${ng.maxPressure}）。`, correct ? "good" : "info");
      break;
    }
    case "weaveMark": {
      const amt = correct ? 2 : wrongAmt(2);
      ng.pressure = Math.max(0, ng.pressure - amt);
      ng.coopDiscount = 1;
      ng.log = pushLog(ng.log, `${tag}｜分工合作：壓力 -${amt}，下一張牌行動點 -1。`, correct ? "good" : "info");
      break;
    }
    // ORDER-050（P2 第二關）：環境危害清除牌（改編自設計文件第一章 RESOLVE_ACTION）
    case "braceWind": {
      const amt = correct ? 2 : wrongAmt(2);
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
      const amt = correct ? 2 : wrongAmt(2);
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

  // ORDER-055（小米接力，僅第二關）：扣完糧後若仍有 ≥2 糧，隊伍沿路種下 1 糧的小米——
  // 呼應射日傳說「沿途種下小米，留給後面接力的人」；存入 localStorage 銀行（上限 3，
  // 由 UI 層 effect 同步寫入），下一次新開局（任一關）開局糧食 +N。
  if (ng.levelId === "l2" && ng.res.food >= 2 && ng.milletPlanted < MILLET_BANK_CAP) {
    ng.res.food -= 1;
    ng.milletPlanted += 1;
    ng.log = pushLog(
      ng.log,
      `沿路種下一把小米（糧食 -1）——留給後面接力的人，下一局開局糧食 +1（本局已種 ${ng.milletPlanted}，上限 ${MILLET_BANK_CAP}）。`,
      "good",
    );
  }

  // 未處理的路段阻礙 → 壓力 +2（ORDER-055 難度調升：+1→+2）；環境危害（ORDER-050，P2）→
  // 套用該危害的 ongoingPenalty（設計文件第一章：ENVIRONMENT_HAZARD 未清除，每回合結束持續付出代價）
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
      ng.pressure = Math.min(ng.maxPressure, ng.pressure + 2);
      ng.log = pushLog(ng.log, `「${node.name}」尚未通行，壓力 +2。`, "bad");
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

// ORDER-055（小米接力）：新開局時把小米銀行一次領出——開局糧食 +N 並清空銀行。
// 只在 client 端（mount 後的 effect／事件處理）呼叫，SSR 期間不觸碰 localStorage。
function consumeMilletBank(g: JGame): JGame {
  try {
    const bank = Math.max(0, Math.min(MILLET_BANK_CAP, parseInt(localStorage.getItem(LS_MILLET_BANK) ?? "0", 10) || 0));
    if (bank <= 0) return g;
    localStorage.removeItem(LS_MILLET_BANK);
    return {
      ...g,
      res: { ...g.res, food: g.res.food + bank },
      log: pushLog(g.log, `前人沿路種下的小米，已在路邊結了穗——開局糧食 +${bank}。`, "good"),
    };
  } catch {
    return g;
  }
}

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
    case "obstacle": {
      if (n.cleared) {
        s = { situation: "落石已清除", todo: "按「前進」，繼續上路（行動點 -1）。" };
      } else {
        const hasCard = g.hand.some((c) => neededEffects(n).includes(c.effect));
        const canHard = canHardClear(g);
        s = {
          situation: `落石擋道（剩 ${n.obstacle} 點）`,
          todo:
            !hasCard && !canHard
              ? "先按「紮營」換日重抽手牌、囤資源——手上沒有可用行動牌，石材也不夠硬清（花資源硬清需石材×2）。"
              : "把落石清掉——出「搬石」／「共同搬運」牌，或花資源硬清（石材×2，需答族語題）。",
        };
      }
      break;
    }
    case "bridge": {
      // ORDER-054：吊橋主打「聽音搭板」語言小遊戲，出牌／硬清仍是替代路線
      if (n.cleared) {
        s = { situation: "吊橋已完成", todo: "按「前進」，繼續上路（行動點 -1）。" };
      } else {
        const hasCard = g.hand.some((c) => neededEffects(n).includes(c.effect));
        const canListen = g.res.wood >= 1 && g.res.rope >= 1;
        s = {
          situation: "峽谷吊橋斷裂",
          todo:
            !hasCard && !canListen && !canHardClear(g)
              ? "先按「紮營」換日重抽手牌、囤資源——手上沒有可用行動牌，木材／繩索也不夠搭板（聽音搭板要木材1・繩索1）。"
              : "聽音搭板，一塊一塊把橋接回來——點「聽音搭板（族語過橋）」（耗木材1・繩索1），聽發音選出意思，釘穩六塊板；也可出「搭橋」／「共同搬運」牌，或花資源硬清（木材×2・繩索×2）。",
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
// 判定優先序：終局→無；當前節點未清（落石/危害→花資源硬清；吊橋→聽音搭板；事件→兩選項；補給→資源選項）；
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
  // ORDER-055：初始化只跑一次（StrictMode 開發模式 effect 會重跑——小米銀行是「讀完即清」的
  // 消耗性狀態，第二次重跑會讀到 0 並蓋掉加成，故用 ref 擋掉重複初始化）。
  const initedRef = useRef(false);
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;
    // mount 後讀取解鎖狀態與上次選擇的關卡（皆在 client 端，SSR 期間不觸碰 localStorage）
    let unlocked = false;
    let lvl: LevelId = "l1";
    try {
      unlocked = localStorage.getItem(LS_LEVEL2_UNLOCKED) === "1";
      if (unlocked && localStorage.getItem(LS_LAST_LEVEL) === "l2") lvl = "l2";
    } catch {
      /* localStorage 不可用（隱私模式等）：維持預設第一關 */
    }
    if (unlocked) setLevel2Unlocked(true);
    // 開局套用小米銀行（ORDER-055 小米接力：上一局沿路種下的小米，這一局開局糧 +N）
    setGame(consumeMilletBank(newGame(lvl)));
    setMounted(true);
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

  // 節點故事過場卡狀態（司令指示「一張一張卡」比較好看，取代原本埋在面板裡的斜體小字）。
  // 觸發 effect 見下方（移到 legend state 之後，才能讓故事卡讓路給尚未播出的開場傳說）。
  const [storyCard, setStoryCard] = useState<string | null>(null);
  const [seenStories, setSeenStories] = useState<Set<string>>(new Set());

  // ─────────── 傳說篇章（ORDER-055；ORDER-056 前置首段）：里程碑解鎖 → 全螢幕篇章卡 → 旅途誌可重讀 ───────────
  // unlockedLegendCount 是 idx 的純函式；seenLegendCount 記「已彈出過幾段」，兩者差額就是待展示的篇章。
  // ORDER-056：第一段傳說里程碑改為 idx 0（開局即解鎖），要在「章節卡之後、起點故事卡與教學之前」插播，
  // 所以把 legend state 上移到故事卡 effect 之前，讓故事卡能讓路給尚未播出的開場傳說。
  // 篇章卡 z 序最高，最終段（抵達終點）會蓋在勝利彈窗之上，玩家先讀完收束段再看到勝利結算。
  const [legendCard, setLegendCard] = useState<number | null>(null);
  const [seenLegendCount, setSeenLegendCount] = useState(0);
  const [showJournal, setShowJournal] = useState(false);
  const unlockedLegend = unlockedLegendCount(game);
  // 開場傳說第一段「待播且尚未播出」：起點（idx 0）、還沒彈過任何篇章、且已解鎖至少一段（里程碑[0]=0）。
  const openingLegendPending = game.idx === 0 && seenLegendCount === 0 && unlockedLegend > 0;

  // 節點故事過場卡：抵達有 NODE_STORY 的節點時，彈出跟章節卡同樣的全螢幕過場。
  // 依賴 chapterCard／legendCard 才觸發，讓三種全螢幕卡不會同時疊加；ORDER-056：開場時起點故事卡
  // 還要讓路給尚未播出的第一段傳說（openingLegendPending），確保順序是 章節卡 → 傳說首段 → 起點故事卡。
  useEffect(() => {
    if (!mounted || chapterCard !== null || legendCard !== null || openingLegendPending) return;
    const node = game.nodes[game.idx];
    if (!node) return;
    const story = levelCfg(game).nodeStory[node.vocabId];
    if (story && !seenStories.has(node.vocabId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStoryCard(node.vocabId);
      setSeenStories((prev) => new Set(prev).add(node.vocabId));
    }
  }, [mounted, chapterCard, legendCard, openingLegendPending, game, seenStories]);

  useEffect(() => {
    if (!mounted || legendCard !== null) return;
    // 章節卡／故事卡「即將」在本節點觸發時也先讓路——effect 在同一個 commit 讀到的都是更新前的 state，
    // 只看 null 會多卡同時疊開。ORDER-056：開場第一段（openingLegend）例外——只讓章節卡、不讓起點故事卡
    // （故事卡 effect 已改為等它先播），達成 章節卡 → 傳說首段 → 起點故事卡 的順序。
    // 終局例外：抵達終點時勝利彈窗會蓋住故事卡（既有行為），最終段直接以 z-[60] 蓋在勝利彈窗上呈現。
    const { index: chIdx } = chapterForIdx(game.levelId, game.idx);
    const chapterDue = chIdx !== seenChapters && chaptersOf(game.levelId)[chIdx].nodeStart === game.idx;
    const node = game.nodes[game.idx];
    const storyDue = !!node && !!levelCfg(game).nodeStory[node.vocabId] && !seenStories.has(node.vocabId);
    const openingLegend = game.idx === 0 && seenLegendCount === 0;
    if (
      game.status === "playing" &&
      (chapterCard !== null || chapterDue || (!openingLegend && (storyCard !== null || storyDue)))
    )
      return;
    if (unlockedLegend > seenLegendCount) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setLegendCard(seenLegendCount);
      setSeenLegendCount(seenLegendCount + 1);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [mounted, chapterCard, storyCard, legendCard, unlockedLegend, seenLegendCount, game, seenChapters, seenStories]);

  // ORDER-055（小米接力）：本局新種下的小米同步進 localStorage 銀行（上限 3）。
  // ref 記「已同步到第幾株」，restart 時歸零；只增不減，重複 render 不會重複入帳。
  const milletSyncedRef = useRef(0);
  useEffect(() => {
    const planted = game.milletPlanted;
    if (planted <= milletSyncedRef.current) return;
    const delta = planted - milletSyncedRef.current;
    milletSyncedRef.current = planted;
    try {
      const bank = Math.max(0, parseInt(localStorage.getItem(LS_MILLET_BANK) ?? "0", 10) || 0);
      localStorage.setItem(LS_MILLET_BANK, String(Math.min(MILLET_BANK_CAP, bank + delta)));
    } catch {
      /* 忽略寫入失敗 */
    }
  }, [game.milletPlanted]);

  const quiz = useMemo(() => (pending && pending.quiz ? quizFor(pending) : null), [pending]);

  // v3（ORDER-031）：非卡牌動作的答題閘門（硬清／謹慎探勘／補給）——共用同一套隨機詞庫題型
  const [pendingAction, setPendingAction] = useState<{
    kind: "hardClear" | "eventCareful" | "supply";
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

  // ORDER-054：聽音搭板（吊橋語言優先小遊戲）——六塊板＝六個詞（ORDER-055：5→6），聽真實發音選中文意思。
  // phase：listen＝作答中；reveal＝答對短暫顯示後自動下一塊；teach＝第二次答錯的教學揭示（按鈕續行）；
  // crossing＝全部板完成的過橋短過場。planks 記每塊板是釘穩（solid）還是補強（patched，第二次錯）。
  type BridgeListen = {
    ids: string[];
    idx: number;
    options: { chinese: string; correct: boolean }[];
    misses: number;
    wrongPicks: number[];
    planks: ("solid" | "patched")[];
    results: { vocabId: string; correct: boolean }[];
    phase: "listen" | "reveal" | "teach" | "crossing";
    revealPick: number | null;
  };
  const [bridgeListen, setBridgeListen] = useState<BridgeListen | null>(null);
  const anyModalOpen =
    !!pending ||
    !!pendingAction ||
    chapterCard !== null ||
    storyCard !== null ||
    showRules ||
    confirmRestart ||
    !!challenge ||
    !!bridgeListen ||
    legendCard !== null ||
    showJournal;

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

  // ─────────── 聽音搭板（ORDER-054）：開始／作答／續行／中止 ───────────

  const canStartBridgeListen = game.res.wood >= 1 && game.res.rope >= 1;

  function startBridgeListen() {
    const node = game.nodes[game.idx];
    if (game.status !== "playing" || anyModalOpen || !node || node.type !== "bridge" || node.cleared) return;
    if (!canStartBridgeListen) return; // 按鈕已 disabled，面板另有資源不足提示
    // 開始即扣料（木材1・繩索1）——與遊戲其他機制一致：花下去就是花下去了，中途離開不退
    setGame((g) => ({
      ...g,
      res: { ...g.res, wood: g.res.wood - 1, rope: g.res.rope - 1 },
      log: pushLog(g.log, `聽音搭板開始：耗木材 1・繩索 1。聽準每個詞，把 ${BRIDGE_PLANKS} 塊板釘回去。`, "sys"),
    }));
    // 從完整已驗證詞庫抽 5 個不重複的詞
    const ids = new Set<string>();
    while (ids.size < Math.min(BRIDGE_PLANKS, VOCAB.length)) ids.add(randomVocabId());
    const list = [...ids];
    setBridgeListen({
      ids: list,
      idx: 0,
      options: bridgeListenOptions(list[0]),
      misses: 0,
      wrongPicks: [],
      planks: [],
      results: [],
      phase: "listen",
      revealPick: null,
    });
  }

  function answerBridgeListen(i: number) {
    if (!bridgeListen || bridgeListen.phase !== "listen" || bridgeListen.wrongPicks.includes(i)) return;
    const bl = bridgeListen;
    const vocabId = bl.ids[bl.idx];
    if (bl.options[i].correct) {
      sfxCorrect();
      setBridgeListen({
        ...bl,
        planks: [...bl.planks, "solid"],
        results: [...bl.results, { vocabId, correct: bl.misses === 0 }],
        phase: "reveal",
        revealPick: i,
      });
    } else {
      sfxWrong();
      if (bl.misses === 0) {
        // 第一次錯：壓力 +1，揭示族語書寫當提示、重播發音，讓玩家在剩下的選項裡再選
        setGame((g) => settle({ ...g, pressure: Math.min(g.maxPressure, g.pressure + 1) }));
        setBridgeListen({ ...bl, misses: 1, wrongPicks: [...bl.wrongPicks, i] });
        setTimeout(() => playAudio(vocabId), 350);
      } else {
        // 第二次錯：教學揭示正解（詞＋中文），板子照樣補上（補強樣式），不懲罰迴圈
        setBridgeListen({
          ...bl,
          planks: [...bl.planks, "patched"],
          results: [...bl.results, { vocabId, correct: false }],
          phase: "teach",
          wrongPicks: [...bl.wrongPicks, i],
          revealPick: i,
        });
      }
    }
  }

  function nextBridgePlank() {
    setBridgeListen((bl) => {
      if (!bl || (bl.phase !== "reveal" && bl.phase !== "teach")) return bl;
      if (bl.idx + 1 >= bl.ids.length) return { ...bl, phase: "crossing" };
      const nextId = bl.ids[bl.idx + 1];
      return {
        ...bl,
        idx: bl.idx + 1,
        options: bridgeListenOptions(nextId),
        misses: 0,
        wrongPicks: [],
        phase: "listen",
        revealPick: null,
      };
    });
  }

  function abortBridgeListen() {
    if (!bridgeListen || bridgeListen.phase === "crossing") return;
    setBridgeListen(null);
    setGame((g) => settle({ ...g, log: pushLog(g.log, "先不搭了：材料已耗在橋頭，搭板進度得重來。", "info") }));
  }

  // 每塊板的題目開始時自動播一次發音（延遲約 300ms，避免跟開窗動畫打架）
  const blRunKey = bridgeListen ? bridgeListen.ids.join(",") : null;
  const blIdx = bridgeListen ? bridgeListen.idx : -1;
  useEffect(() => {
    if (!blRunKey || blIdx < 0) return;
    const id = blRunKey.split(",")[blIdx];
    const t = setTimeout(() => playAudio(id), 300);
    return () => clearTimeout(t);
  }, [blRunKey, blIdx]);

  // 答對的短暫揭示後自動進下一塊板（教學揭示 teach 則等玩家自己按）
  const blPhase = bridgeListen?.phase ?? null;
  useEffect(() => {
    if (blPhase !== "reveal") return;
    const t = setTimeout(() => nextBridgePlank(), 900);
    return () => clearTimeout(t);
  }, [blPhase, blIdx]);

  // 過橋短過場：隊伍標記滑過橋面（CSS 動畫），播抵達音效，結束後才真正結算清節點
  useEffect(() => {
    if (blPhase !== "crossing" || !bridgeListen) return;
    sfxArrive();
    const results = bridgeListen.results;
    const t = setTimeout(() => {
      setGame((g) => resolveBridgeListen(g, results));
      setBridgeListen(null);
    }, 1700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blPhase]);

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
    // ORDER-055：新開局領出小米銀行（開局糧 +N），並歸零本局的篇章／小米同步狀態
    milletSyncedRef.current = 0;
    setGame(consumeMilletBank(newGame(target)));
    setPending(null);
    setRevealed(null);
    setConfirmRestart(false);
    setSeenChapters(-1);
    setChapterCard(null);
    setSeenStories(new Set());
    setStoryCard(null);
    setChallenge(null);
    setChallengeRevealed(null);
    setBridgeListen(null);
    setPendingAction(null);
    setActionRevealed(null);
    setLegendCard(null);
    setSeenLegendCount(0);
    setShowJournal(false);
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-100/60">
                節點 {game.idx}/{game.nodes.length - 1} · 第 {game.day}/{levelCfg(game).maxDay} 日
              </span>
              {/* 旅途誌（ORDER-055）：已解鎖的傳說篇章可隨時重讀；未解鎖顯示「尚未走到」 */}
              <button
                onClick={() => setShowJournal(true)}
                className="repair-secondary-btn flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold"
                title={`旅途誌：《${levelCfg(game).legend.name}》傳說篇章 ${unlockedLegend}/${levelCfg(game).legend.passages.length}`}
              >
                <IconBook className="w-3.5 h-3.5 shrink-0" /> 旅途誌 {unlockedLegend}/{levelCfg(game).legend.passages.length}
              </button>
            </div>
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

                {/* 花資源硬清（ORDER-056：落石也走這條）：落石／吊橋／危害未清時的資源解——一樣要答族語題，答對全額答錯半額。
                    落石＝石材×2、吊橋／危害＝木材×2・繩索×2。落石節點的聚光燈落在這顆鈕（primary==="repair" 且落石）。 */}
                {game.status === "playing" &&
                  !node.cleared &&
                  (node.type === "bridge" || node.type === "hazard" || node.type === "obstacle") &&
                  (() => {
                    const hardClearSpot = primary === "hazard" || (primary === "repair" && node.type === "obstacle");
                    return (
                      <button
                        onClick={doHardClear}
                        disabled={!canGoHardClear}
                        className={`repair-primary-btn relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed ${
                          hardClearSpot ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                        }`}
                      >
                        {hardClearSpot && nowPill}
                        <IconPickaxe className="w-4 h-4 shrink-0" />{" "}
                        {node.type === "hazard"
                          ? "花資源架遮蔽硬撐（木材×2・繩索×2）"
                          : node.type === "obstacle"
                            ? "花資源硬清（石材×2）"
                            : "花資源硬清（木材×2・繩索×2）"}
                      </button>
                    );
                  })()}

                {/* 聽音搭板（ORDER-054）：吊橋的語言優先小遊戲——聽真實發音、選中文意思，六塊板釘穩即過橋。
                    出「搭橋」牌與「花資源硬清」仍是替代路線（見上／手牌），照舊不動。 */}
                {game.status === "playing" && !node.cleared && node.type === "bridge" && (
                  <>
                    <button
                      onClick={startBridgeListen}
                      disabled={anyModalOpen || !canStartBridgeListen}
                      className={`repair-primary-btn relative mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        primary === "repair" ? "jny-spotlight" : primary !== null ? "jny-dim" : ""
                      }`}
                    >
                      {primary === "repair" && nowPill}
                      <IconSpeaker className="w-4 h-4 shrink-0" /> 聽音搭板（族語過橋・耗木材1・繩索1）
                    </button>
                    {!canStartBridgeListen && (
                      <p className="mt-1.5 text-[11px] leading-snug text-rose-300">
                        木材或繩索不足（各需 1）——先紮營囤料，或出「搭橋」／「共同搬運」牌、花資源硬清過橋。
                      </p>
                    )}
                  </>
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
            {/* 小米接力計數（ORDER-055，僅第二關）：本局沿路種下的小米＝下一局的開局糧 */}
            {game.levelId === "l2" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300/85" title="紮營時糧食仍有 2 以上，就會沿路種下 1 糧的小米——下一局開局糧食 +1（上限 3）">
                <IconPackage className="w-3.5 h-3.5 shrink-0" /> 小米接力：本局已種 {game.milletPlanted}/{MILLET_BANK_CAP}
              </span>
            )}
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

      {/* 聽音搭板彈窗（ORDER-054）：吊橋語言優先小遊戲——上方 SVG 橋跨隨進度補板，
          下方聽真實發音選中文意思（既有題型的反向）。錯了先教再走：第一次錯給族語書寫提示＋壓力+1，
          第二次錯教學揭示正解、板子補強照釘。全部板完成後播過橋短過場才真正結算。 */}
      {bridgeListen && (() => {
        const bl = bridgeListen;
        const node = game.nodes[game.idx];
        const entry = vocab(bl.ids[Math.min(bl.idx, bl.ids.length - 1)]);
        const crossingNow = bl.phase === "crossing";
        // 板位沿走道垂弧分佈（純示意幾何，非物理）——ORDER-055：5→6 塊板
        const slots: { x: number; y: number; rot: number }[] = [
          { x: 78, y: 79.5, rot: -8 },
          { x: 115, y: 83, rot: -4.5 },
          { x: 152, y: 85, rot: -1.5 },
          { x: 189, y: 85, rot: 1.5 },
          { x: 226, y: 83, rot: 4.5 },
          { x: 263, y: 79.5, rot: 8 },
        ];
        const upperY = [49.5, 52, 53.5, 53.5, 52, 49.5];
        return (
          <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/75 p-3 backdrop-blur-[6px] sm:p-6">
            <div className="repair-modal w-full max-w-md px-5 py-6 my-4 sm:px-7">
              <header className="relative z-[2] mb-3 text-center">
                <p className={`${notoSansTC.className} mb-1 text-sm font-bold tracking-[0.08em] text-amber-300`}>
                  聽音搭板 · 族語過橋
                </p>
                <h3 className={`${notoSerifTC.className} repair-title text-2xl font-black sm:text-3xl`}>{node.name}</h3>
                <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-amber-100/70">
                  隊伍一邊釘板一邊喊出聽到的詞——聽準一個詞，就釘穩一塊板。
                </p>
              </header>

              {/* 橋跨示意圖：兩岸＋雙索＋五個板位，釘上的板以 build-pop 彈入；補強板歪斜示意 */}
              <div className="relative z-[2] overflow-hidden rounded-xl border border-amber-500/40 bg-[#050d14]/80">
                <svg viewBox="0 0 340 130" className="block h-auto w-full" aria-hidden>
                  {/* 兩岸 */}
                  <path d="M0 40 L44 44 L40 130 L0 130 Z" fill="#243244" stroke="#3b4d63" strokeWidth="1.5" />
                  <path d="M340 40 L296 44 L300 130 L340 130 Z" fill="#243244" stroke="#3b4d63" strokeWidth="1.5" />
                  {/* 溪谷水面 */}
                  <path d="M40 130 L42 112 Q170 122 298 112 L300 130 Z" fill="#0c2233" opacity="0.9" />
                  {/* 上扶手索與走道索 */}
                  <path d="M44 46 Q170 62 296 46" fill="none" stroke="#a3a3a3" strokeWidth="2" strokeDasharray="4 3" />
                  <path d="M44 74 Q170 96 296 74" fill="none" stroke="#a3a3a3" strokeWidth="2.5" />
                  {/* 吊索（板位對應的垂直細索） */}
                  {slots.map((s, i) => (
                    <line key={`h${i}`} x1={s.x} y1={upperY[i]} x2={s.x} y2={s.y - 5} stroke="#8b8b8b" strokeWidth="1" />
                  ))}
                  {/* 板位：未釘＝虛線框；釘穩＝金木色實板；補強＝歪斜暗色板 */}
                  {slots.map((s, i) => {
                    const placed = bl.planks[i];
                    if (!placed) {
                      return (
                        <rect
                          key={`s${i}`}
                          x={s.x - 15}
                          y={s.y - 4.5}
                          width="30"
                          height="9"
                          rx="2"
                          fill="none"
                          stroke="#7a6134"
                          strokeWidth="1.2"
                          strokeDasharray="3 3"
                          transform={`rotate(${s.rot} ${s.x} ${s.y})`}
                        />
                      );
                    }
                    const patched = placed === "patched";
                    return (
                      <g key={`s${i}`} transform={`rotate(${s.rot + (patched ? 9 : 0)} ${s.x} ${s.y})`}>
                        <rect
                          className="build-pop"
                          x={s.x - 15}
                          y={s.y - 4.5}
                          width="30"
                          height="9"
                          rx="2"
                          fill={patched ? "#7c5a1f" : "#b45309"}
                          stroke={patched ? "#facc15" : "#78350f"}
                          strokeWidth="1.5"
                          strokeDasharray={patched ? "4 2" : undefined}
                        />
                      </g>
                    );
                  })}
                </svg>
                {/* 過橋短過場：隊伍標記從左岸滑到右岸（CSS 動畫，見 .bl-cross-token） */}
                {crossingNow && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/images/journey/token-team-v1.png"
                    width={40}
                    height={40}
                    alt="隊伍過橋"
                    className="bl-cross-token absolute top-[34%] drop-shadow-lg"
                  />
                )}
              </div>

              {crossingNow ? (
                <p className="relative z-[2] mt-4 text-center text-sm font-bold text-emerald-300">
                  {BRIDGE_PLANKS} 塊板都釘穩了——隊伍踏著自己念出來的路過橋……
                </p>
              ) : (
                <>
                  <div className="relative z-[2] mt-3 flex items-center justify-between">
                    <span className={`${notoSerifTC.className} text-base font-bold text-amber-50`}>
                      第 {Math.min(bl.idx + 1, BRIDGE_PLANKS)}/{BRIDGE_PLANKS} 塊板
                    </span>
                    <span className="text-[10px] text-amber-300/70">聽發音，選出它的中文意思</span>
                  </div>
                  <div className="relative z-[2] mt-2 flex justify-center">
                    <button
                      onClick={() => playAudio(bl.ids[bl.idx])}
                      className="repair-secondary-btn flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold tracking-[0.06em]"
                      title="重播這個詞的發音（原住民族語E樂園）"
                    >
                      <IconSpeaker className="w-6 h-6 shrink-0" /> 再聽一次
                    </button>
                  </div>
                  {bl.phase === "listen" && bl.misses > 0 && (
                    <p className="relative z-[2] mt-2 rounded-lg border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs leading-relaxed text-rose-200">
                      ✕ 還差一點——這個音寫作「<b className="text-amber-200">{entry.word}</b>」（壓力 +1）。再聽一次，在剩下的選項裡選出它的意思。
                    </p>
                  )}
                  <div className="relative z-[2] mt-3 grid gap-2">
                    {bl.options.map((opt, idx) => {
                      let cls = "border-amber-500/25 bg-[#0b1722]/90 hover:border-amber-400/60 hover:bg-[#132435]";
                      if (bl.phase !== "listen") {
                        if (opt.correct) cls = "border-emerald-400/70 bg-emerald-800/80";
                        else if (idx === bl.revealPick || bl.wrongPicks.includes(idx)) cls = "border-rose-400/70 bg-rose-800/80";
                        else cls = "border-amber-500/15 bg-[#0b1722]/90 opacity-50";
                      } else if (bl.wrongPicks.includes(idx)) {
                        cls = "border-rose-400/60 bg-rose-900/60 opacity-60 cursor-not-allowed";
                      }
                      return (
                        <button
                          key={idx}
                          disabled={bl.phase !== "listen" || bl.wrongPicks.includes(idx)}
                          onClick={() => answerBridgeListen(idx)}
                          className={`rounded-lg border px-4 py-2 text-left text-amber-50 transition ${cls}`}
                        >
                          {String.fromCharCode(65 + idx)}. {opt.chinese}
                        </button>
                      );
                    })}
                  </div>
                  {bl.phase === "reveal" && (
                    <p className="relative z-[2] mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-300">
                      <IconCheck className="w-4 h-4 shrink-0" /> 釘穩了！「{entry.word}」＝「{entry.chinese}」。
                    </p>
                  )}
                  {bl.phase === "teach" && (
                    <div className="relative z-[2] mt-3 rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2.5">
                      <p className="text-xs leading-relaxed text-amber-100/90">
                        記下來：這個音是「<b className="text-amber-200">{entry.word}</b>」，意思是「
                        <b className="text-emerald-300">{entry.chinese}</b>」。這塊板先補強釘上，路照樣走。
                      </p>
                      <div className="mt-2 text-right">
                        <button
                          onClick={nextBridgePlank}
                          className="repair-primary-btn rounded-lg px-5 py-1.5 text-xs font-black"
                        >
                          {bl.idx + 1 >= BRIDGE_PLANKS ? "踏上橋 ▶" : "下一塊 ▶"}
                        </button>
                      </div>
                    </div>
                  )}
                  <footer className="relative z-[2] mt-4 flex items-center justify-between gap-2">
                    <button
                      onClick={abortBridgeListen}
                      className="repair-secondary-btn rounded-xl px-5 py-2 text-xs font-bold"
                    >
                      ✦ 先不搭了
                    </button>
                    <span className="text-right text-[10px] leading-snug text-amber-100/45">
                      中途離開：材料不退，搭板進度重來。
                    </span>
                  </footer>
                </>
              )}
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
                      {actionRevealed === actionQuiz.answer ? "答對！全額生效。" : "答錯，半額生效。"}
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
                    繼續 ▶
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
                <span>落石路段：打<b>「搬石」／「共同搬運」</b>牌快速清除，或花<b>資源硬清</b>（石材×2，一樣要答族語題，答對全額、答錯半額）。</span>
              </li>
              <li className="flex gap-2">
                <IconSpeaker className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>吊橋主打<b>「聽音搭板」</b>：耗木材1・繩索1，聽六個族語真實發音、選出中文意思，聽準一個詞就釘穩一塊板。答錯先給族語書寫提示（壓力 +1）再選一次；再錯會直接教你正解，板子補強照釘、不卡關。也可打「搭橋」／「共同搬運」牌，或花<b>雙倍資源「硬清」</b>（一樣要答族語題）。</span>
              </li>
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
              {game.levelId === "l2" && (
                <li className="flex gap-2">
                  <IconPackage className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                  <span>第二關限定・<b>小米接力</b>：紮營扣完糧後若仍有 2 以上糧食，隊伍會沿路種下 1 糧的小米——<b>下一局（任一關）開局糧食 +1</b>（最多存 3），像射日傳說裡留給後面接力的人。</span>
                </li>
              )}
              <li className="flex gap-2">
                <IconBook className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span><b>傳說篇章</b>：通過路上的里程碑會解鎖本章傳說的下一段，收進「旅途誌」（任務面板右上角）可隨時重讀；全部收集完，勝利結算的難度評分更高。</span>
              </li>
              <li className="flex gap-2">
                <IconBook className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" />
                <span>每個路段都有一次<b>「族語試煉」</b>：3 題（含這個路段自己的詞），通過（答對 2 題以上）依情境給獎勵——路段有阻礙時阻礙 -1，否則壓力 -1；<b>未通過則壓力 +1</b>。不佔行動點。</span>
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
                <span><b>紮營</b>收束當日：消耗糧食（見上）；糧食不足則隊伍體力 -2；當前路段未通行則壓力 +2。</span>
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
              {/* ORDER-055：傳說開場句織入本章任務（首章）——傳說是章節骨架，不是外掛花絮 */}
              {chapterCard === 0 && (
                <p className="mt-1 text-xs leading-relaxed text-amber-200/85">{levelCfg(game).legend.intro}</p>
              )}
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

            {/* ORDER-055：勝利結算——本章傳說收集＋收束句＋本局難度評分（給重玩追分目標） */}
            {game.status === "won" && (() => {
              const legend = levelCfg(game).legend;
              const ds = difficultyScore(game);
              return (
                <div className="mb-4 rounded-xl border border-amber-700/50 bg-amber-950/25 p-3 text-left">
                  <div className="text-xs uppercase tracking-wider text-amber-400 font-semibold mb-1">
                    本章傳說《{legend.name}》：已收集 {ds.collected}/{ds.totalPassages} 段
                  </div>
                  <p className={`${notoSansTC.className} text-sm leading-relaxed text-amber-100/90`}>{legend.closing}</p>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wider text-sky-400 font-semibold">本局難度評分</span>
                    <span className={`${notoSerifTC.className} text-lg font-black text-amber-200`}>{ds.total}/100</span>
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-slate-300">
                    <li>・天數餘裕 +{ds.daysPts}（提前 {ds.daysSpare} 日抵達，每日 15 分、上限 30）</li>
                    <li>・答題正確率 +{ds.accPts}（{ds.ratePct}%，上限 50）</li>
                    <li>・傳說收集 +{ds.legendPts}（{ds.collected}/{ds.totalPassages} 段，上限 20）</li>
                  </ul>
                </div>
              );
            })()}

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

      {/* 傳說篇章卡（ORDER-055）：節點里程碑解鎖時的全螢幕過場，沿用故事卡外觀（配圖＋徽章＋內文）。
          z-[60] 高於勝利彈窗：最終段在抵達終點時解鎖，先讀完收束段、關掉後才看到勝利結算。
          文字只用已核准傳說（大洪水／射日）改寫節錄，出處標注於卡末。 */}
      {legendCard !== null && (() => {
        const legend = levelCfg(game).legend;
        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-[4px] p-4">
            <div className="repair-modal w-full max-w-md max-h-[85vh] overflow-y-auto overflow-x-hidden">
              <div className="relative h-40 sm:h-48 w-full overflow-hidden rounded-t-3xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={legend.img} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050d14] via-[#050d14]/10 to-transparent" />
              </div>
              <div className="relative z-[2] p-8 pt-6 text-center">
                <div
                  className={`${notoSansTC.className} mb-3 inline-block rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90`}
                >
                  傳說・第 {legendCard + 1} 段
                </div>
                <div className={`${notoSerifTC.className} repair-title text-xl font-bold`}>{legend.name}</div>
                <p className={`${notoSansTC.className} mt-4 text-left text-sm leading-relaxed text-amber-100/90`}>
                  {legend.passages[legendCard]}
                </p>
                <p className="mt-3 text-left text-[10px] leading-snug text-amber-300/60">{legend.sourceNote}</p>
                <button
                  onClick={() => setLegendCard(null)}
                  className={`${notoSerifTC.className} repair-primary-btn mt-5 rounded-xl px-8 py-2.5 text-sm font-bold tracking-[0.15em] transition hover:-translate-y-0.5`}
                >
                  收進旅途誌 ▶
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 旅途誌（ORDER-055）：已解鎖的傳說篇章可隨時重讀；未解鎖段顯示「尚未走到」。 */}
      {showJournal && (() => {
        const legend = levelCfg(game).legend;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-[4px] p-4">
            <div className="repair-modal w-full max-w-md max-h-[85vh] overflow-y-auto p-5">
              <div className="relative z-[2]">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300 mb-1">
                  <IconBook className="w-4 h-4 shrink-0" /> 旅途誌 · 本章傳說《{legend.name}》
                </div>
                <p className="text-[11px] text-amber-100/60 mb-3">
                  沿路走過的里程碑，會解鎖傳說的下一段——已收集 {unlockedLegend}/{legend.passages.length} 段。
                </p>
                <div className="space-y-2.5">
                  {legend.passages.map((p, i) => {
                    const open = i < unlockedLegend;
                    return (
                      <div
                        key={i}
                        className={`rounded-xl border p-3 ${
                          open ? "border-amber-500/30 bg-[#0b1722]/85" : "border-slate-700/60 bg-slate-950/60"
                        }`}
                      >
                        <div className={`text-[10px] font-black tracking-[0.2em] ${open ? "text-amber-300/85" : "text-slate-500"}`}>
                          第 {i + 1} 段
                        </div>
                        {open ? (
                          <p className={`${notoSansTC.className} mt-1 text-xs leading-relaxed text-amber-100/90`}>{p}</p>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">尚未走到——繼續往前，路會把故事講完。</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-3 text-[10px] leading-snug text-amber-300/60">{legend.sourceNote}</p>
                <div className="text-right mt-3">
                  <button
                    onClick={() => setShowJournal(false)}
                    className="repair-primary-btn rounded-xl px-6 py-2 text-sm font-black"
                  >
                    收起
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

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
