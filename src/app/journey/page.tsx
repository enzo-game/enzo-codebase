"use client";

import Link from "next/link";
import { Noto_Serif_TC, Noto_Sans_TC } from "next/font/google";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { vocab, audioUrl, distractors, ATTRIBUTION, SOURCE, SOURCE_URL } from "@/data/truku";
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
type NodeType = "start" | "obstacle" | "bridge" | "event" | "supply" | "destination";
type CardType = "action" | "coop" | "supply" | "watch" | "weave";
type EffectId =
  | "scout"
  | "clearStone"
  | "buildBridge"
  | "coopClear"
  | "gatherFood"
  | "reduceStress"
  | "weaveMark";

type PathNode = {
  id: string;
  name: string;
  vocabId: string; // 對應真實太魯閣語詞（klokah trv=33）
  type: NodeType;
  obstacle: number; // 需清除的阻礙點數（bridge：1 = 未搭建）
  cleared: boolean;
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

type JGame = {
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
};

type EventCard = {
  name: string;
  vocabId: string;
  kind: "天候" | "地形" | "正面" | "路段危機" | "啟程";
  pressure: number;
  desc: string;
};

// ───────────────────────── 常數 ─────────────────────────

const MAX_DAY = 7;
const HAND_LIMIT = 5;
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

const CHAPTERS: ChapterMeta[] = [
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

function chapterForIdx(idx: number): { chapter: ChapterMeta; index: number } {
  const i = CHAPTERS.findIndex((c) => idx >= c.nodeStart && idx <= c.nodeEnd);
  const index = i === -1 ? CHAPTERS.length - 1 : i;
  return { chapter: CHAPTERS[index], index };
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

function buildDeck(): JCard[] {
  const counts: Record<EffectId, number> = {
    scout: 3,
    clearStone: 3,
    buildBridge: 2,
    coopClear: 2,
    gatherFood: 2,
    reduceStress: 2,
    weaveMark: 2,
  };
  const deck: JCard[] = [];
  for (const proto of CARD_POOL) {
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

function buildNodes(): PathNode[] {
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

// ───────────────────────── 初始化 ─────────────────────────

function newGame(): JGame {
  const deck = buildDeck();
  return {
    day: 1,
    ap: 3,
    maxAp: 3,
    pressure: 3,
    maxPressure: 10,
    teamHp: 12,
    maxTeamHp: 12,
    res: { food: 6, wood: 3, stone: 2, rope: 2 },
    nodes: buildNodes(),
    idx: 0,
    hand: deck.slice(0, HAND_LIMIT),
    deck: deck.slice(HAND_LIMIT),
    discard: [],
    event: {
      name: "啟程",
      vocabId: "10-01", // 道路 elug
      kind: "啟程",
      pressure: 0,
      desc: "隊伍自立霧溪口出發，目標是安全返回部落。前方山徑待你逐段修復通行。",
    },
    coopDiscount: 0,
    status: "playing",
    log: pushLog([], "第 1 日：隊伍自立霧溪口啟程。", "sys"),
    correct: 0,
    wrong: 0,
    streak: 0,
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

function quizFor(card: JCard): Quiz {
  const ans = vocab(card.vocabId);
  const opts = shuffle([ans, ...distractors(card.vocabId, 3)]);
  return {
    prompt: `「${ans.chinese}」的太魯閣族語是？`,
    options: opts.map((o) => o.word),
    answer: opts.findIndex((o) => o.word === ans.word),
    audioId: card.vocabId,
    note: `族語詞彙與發音來源：${SOURCE}。遊戲用法之文化複核進行中。`,
  };
}

// ───────────────────────── 判定 ─────────────────────────

function settle(g: JGame): JGame {
  const ng = { ...g };
  if (ng.idx >= ng.nodes.length - 1) {
    ng.status = "won";
  } else if (ng.pressure >= ng.maxPressure || ng.teamHp <= 0) {
    ng.status = "lost";
  } else if (ng.day > MAX_DAY) {
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
    ng.log = pushLog(ng.log, `❓ 抵達「${node.name}」：請選擇如何通過。`, "sys");
  } else if (node.type === "supply") {
    ng.log = pushLog(ng.log, `📦 抵達「${node.name}」：請選擇要補給的資源。`, "sys");
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
  return settle(ng);
}

// ───────────────────────── 花資源硬清（v2：risk/reward，落石/吊橋不靠語言題的另一條路）─────────────────────────

function hardClearCost(n: PathNode): Partial<Record<Resource, number>> | null {
  if (n.type === "obstacle" && !n.cleared) return { stone: 2 };
  if (n.type === "bridge" && !n.cleared) return { wood: 2, rope: 2 };
  return null;
}

function canHardClear(g: JGame): boolean {
  if (g.status !== "playing") return false;
  const node = g.nodes[g.idx];
  const cost = node && hardClearCost(node);
  if (!cost) return false;
  return Object.entries(cost).every(([r, v]) => g.res[r as Resource] >= (v ?? 0));
}

function hardClear(g: JGame): JGame {
  if (!canHardClear(g)) return g;
  const cost = hardClearCost(g.nodes[g.idx]) as Partial<Record<Resource, number>>;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  for (const [r, v] of Object.entries(cost)) ng.res[r as Resource] -= v ?? 0;
  const node = ng.nodes[ng.idx];
  node.obstacle = 0;
  node.cleared = true;
  ng.log = pushLog(ng.log, `⛏ 花資源硬清：「${node.name}」已可通行。`, "good");
  return settle(ng);
}

// ───────────────────────── 事件／補給節點選擇（v2：真取捨，取代自動結算）─────────────────────────

function resolveEventChoice(g: JGame, choice: "fast" | "careful"): JGame {
  const node = g.nodes[g.idx];
  if (g.status !== "playing" || !node || node.type !== "event" || node.cleared) return g;
  if (choice === "careful" && (g.res.wood < 1 || g.res.rope < 1)) return g;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  const n2 = ng.nodes[ng.idx];
  n2.cleared = true;
  if (choice === "fast") {
    ng.pressure = Math.min(ng.maxPressure, ng.pressure + 2);
    ng.log = pushLog(ng.log, `🏃 「${n2.name}」快速通過：壓力 +2。`, "bad");
  } else {
    ng.res.wood -= 1;
    ng.res.rope -= 1;
    ng.res.food += 1;
    ng.log = pushLog(ng.log, `🔍 「${n2.name}」謹慎探勘：耗木材1・繩索1，沿途採得糧食 +1。`, "good");
  }
  return settle(ng);
}

function resolveSupplyChoice(g: JGame, resource: Resource): JGame {
  const node = g.nodes[g.idx];
  if (g.status !== "playing" || !node || node.type !== "supply" || node.cleared) return g;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };
  const n2 = ng.nodes[ng.idx];
  n2.cleared = true;
  ng.res[resource] += 3;
  // v2 機制移植：30% 機率額外加碼一份隨機資源（變動獎勵，避免補給永遠是同一個固定結果）
  if (Math.random() < 0.3) {
    const resources: Resource[] = ["food", "wood", "stone", "rope"];
    const bonus = resources[Math.floor(Math.random() * resources.length)];
    ng.res[bonus] += 1;
    ng.log = pushLog(
      ng.log,
      `🎒 「${n2.name}」補給：${RES_NAME[resource]} +3，意外多撿到 ${RES_NAME[bonus]} +1！`,
      "good",
    );
  } else {
    ng.log = pushLog(ng.log, `🎒 「${n2.name}」補給：${RES_NAME[resource]} +3。`, "good");
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
  const tag = card.quiz ? (correct ? "✅ 答對" : "❌ 答錯") : "▶";

  switch (card.effect) {
    case "scout": {
      // v2：巡路不再是前進唯一解（見常駐「前進」按鈕），但答對有額外獎勵（壓力 -1）
      if (node && node.cleared && ng.idx < ng.nodes.length - 1) {
        ng.idx += 1;
        ng = enterNode(ng);
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
      if (node && (node.type === "obstacle" || node.type === "bridge") && !node.cleared) {
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
  }

  // 連擊獎勵（v2）：每連對 3 題，順風而行，補 1 行動點
  if (ng.streak > 0 && ng.streak % 3 === 0) {
    const cap = effectiveMaxAp(ng);
    if (ng.ap < cap) {
      ng.ap = Math.min(cap, ng.ap + 1);
      ng.log = pushLog(ng.log, `🔥 連對 ${ng.streak} 題！順風而行，行動點 +1。`, "good");
    } else {
      ng.log = pushLog(ng.log, `🔥 連對 ${ng.streak} 題！順風而行。`, "good");
    }
  }

  return settle(ng);
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
    ng.log = pushLog(ng.log, `🌙 紮營：糧食不足，隊伍體力 -2。`, "bad");
  } else {
    ng.log = pushLog(ng.log, `🌙 紮營：消耗 ${foodCost} 糧食（剩 ${ng.res.food}）。`, "sys");
  }

  // 未處理的路段阻礙 → 壓力 +1
  const node = ng.nodes[ng.idx];
  if (node && !node.cleared) {
    ng.pressure = Math.min(ng.maxPressure, ng.pressure + 1);
    ng.log = pushLog(ng.log, `⚠ 「${node.name}」尚未通行，壓力 +1。`, "bad");
  }

  // 進入下一日
  ng.day += 1;
  ng.ap = ng.maxAp;
  ng.coopDiscount = 0;

  // 翻新事件
  const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  ng.event = ev;
  ng.pressure = Math.max(0, Math.min(ng.maxPressure, ng.pressure + ev.pressure));
  ng.log = pushLog(
    ng.log,
    `📅 第 ${ng.day} 日｜事件「${ev.name}」（${ev.kind}）：壓力 ${ev.pressure >= 0 ? "+" : ""}${ev.pressure}。${ev.desc}`,
    ev.pressure > 0 ? "bad" : "good",
  );

  // 危急（壓力≥8）：行動點上限收緊，套用今日事件後的最終壓力值判定
  ng.ap = Math.min(ng.ap, effectiveMaxAp(ng));
  if (pressureTier(ng) === "critical") {
    ng.log = pushLog(ng.log, "⚠ 情勢危急：行動點上限收緊為 2。", "bad");
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
  return [];
}

function stepHint(g: JGame): { situation: string; todo: string } {
  if (g.status === "won") return { situation: "抵達部落！", todo: "隊伍平安返家，任務完成。" };
  if (g.status === "lost") return { situation: "任務失敗", todo: "點「重新開始」再試一次。" };
  const n = g.nodes[g.idx];
  const last = g.idx >= g.nodes.length - 1;
  const apNote = g.ap <= 0 ? "　行動點用完了 → 點「紮營」換日、補行動點。" : "";
  let s: { situation: string; todo: string };
  switch (n.type) {
    case "obstacle":
    case "bridge": {
      const label = n.type === "obstacle" ? `落石擋道（剩 ${n.obstacle} 點）` : "峽谷吊橋斷裂";
      if (n.cleared) {
        s = { situation: n.type === "obstacle" ? "落石已清除" : "吊橋已完成", todo: "點「前進」。" };
      } else {
        const hasCard = g.hand.some((c) => neededEffects(n).includes(c.effect));
        const canHard = canHardClear(g);
        s = {
          situation: label,
          todo:
            !hasCard && !canHard
              ? "手牌無可用行動牌、資源也不夠硬清 → 點「紮營」換日重抽／囤資源。"
              : n.type === "obstacle"
                ? "出「搬石」／「共同搬運」答題清除，或花資源「硬清」（石材×2，免答題）。"
                : "出「搭橋」／「共同搬運」答題修復，或花資源「硬清」（木材×2・繩索×2，免答題）。",
        };
      }
      break;
    }
    case "start":
      s = { situation: "立霧溪口・出發點", todo: "點「前進」出發。" };
      break;
    case "event":
      s = n.cleared
        ? { situation: `${n.name}・已通過`, todo: "點「前進」。" }
        : { situation: n.name, todo: "選擇「快速通過」（壓力 +2）或「謹慎探勘」（耗木材/繩索各1，換糧食 +1）。" };
      break;
    case "supply":
      s = n.cleared
        ? { situation: "山腰營地・已補給", todo: "點「前進」。" }
        : { situation: "山腰營地・補給點", todo: "選一項資源，補給 +3。" };
      break;
    case "destination":
      s = { situation: last ? "部落・終點在望" : "部落", todo: "點「前進」抵達，帶所有人回家。" };
      break;
    default:
      s = { situation: n.name, todo: "點「前進」。" };
  }
  return { situation: s.situation, todo: s.todo + apNote };
}

type SideQuest = { label: string; note: string; state: "ok" | "fail" | "pending" };

function sideQuests(g: JGame): SideQuest[] {
  const won = g.status === "won";
  return [
    {
      label: "零失誤",
      note: "全程族語不答錯",
      state: g.wrong === 0 ? "ok" : "fail",
    },
    {
      label: "神速返鄉",
      note: "第 5 日前抵達",
      state: g.day > 5 ? "fail" : won ? "ok" : "pending",
    },
    {
      label: "糧草無虞",
      note: won ? "抵達時糧食 ≥ 4" : "糧食保持 ≥ 4",
      state: g.res.food >= 4 ? "ok" : won ? "fail" : "pending",
    },
  ];
}

export default function JourneyPage() {
  const [game, setGame] = useState<JGame>(() => newGame());
  const [pending, setPending] = useState<JCard | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // newGame() 內含 Math.random()（洗牌／隨機事件／uid），須在 client mount 後才渲染，
  // 否則 SSR 與 client 首次渲染的牌序不一致 → hydration mismatch。
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // 終局音效：抵達部落 / 未能抵達（中性 UI 完成音，非族樂）
  useEffect(() => {
    if (game.status === "won") sfxArrive();
    else if (game.status === "lost") sfxLose();
  }, [game.status]);

  // 章節標題卡（v2）：idx 進入新章節的第一個節點時顯示，銜接 /prologue 的章節架構
  const [chapterCard, setChapterCard] = useState<number | null>(null);
  const [seenChapters, setSeenChapters] = useState<number>(-1);
  useEffect(() => {
    if (!mounted) return;
    const { index } = chapterForIdx(game.idx);
    if (game.nodes[game.idx]?.type !== undefined && index !== seenChapters && CHAPTERS[index].nodeStart === game.idx) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChapterCard(index);
      setSeenChapters(index);
    }
  }, [mounted, game.idx, game.nodes, seenChapters]);

  const quiz = useMemo(() => (pending && pending.quiz ? quizFor(pending) : null), [pending]);
  const total = game.correct + game.wrong;
  const rate = total === 0 ? 0 : Math.round((game.correct / total) * 100);
  const rateLabel = total === 0 ? "—" : `${rate}%`;

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

  function answer(optIdx: number) {
    if (!pending || !quiz) return;
    const correct = optIdx === quiz.answer;
    if (correct) sfxCorrect();
    else sfxWrong();
    // 連擊獎勵預判：稍晚於答對音效播放，做出「更爽」的聲音層次
    const willStreak = correct ? game.streak + 1 : 0;
    if (willStreak > 0 && willStreak % 3 === 0) {
      setTimeout(() => sfxStreak(), 300);
    }
    setRevealed(optIdx);
    setTimeout(() => {
      setGame((g) => playCard(g, pending, correct));
      setPending(null);
      setRevealed(null);
    }, 850);
  }

  function doAdvance() {
    if (!canAdvance(game)) return;
    sfxPlayCard();
    setGame((g) => advance(g));
  }

  function doHardClear() {
    if (!canHardClear(game)) return;
    sfxPlayCard();
    setGame((g) => hardClear(g));
  }

  function doEventChoice(choice: "fast" | "careful") {
    sfxPlayCard();
    setGame((g) => resolveEventChoice(g, choice));
  }

  function doSupplyChoice(resource: Resource) {
    sfxPlayCard();
    setGame((g) => resolveSupplyChoice(g, resource));
  }

  function restart() {
    setGame(newGame());
    setPending(null);
    setRevealed(null);
    setConfirmRestart(false);
    setSeenChapters(-1);
    setChapterCard(null);
  }

  // mount 前：SSR 與 client 首渲染皆輸出此骨架，確保 HTML 一致（避免 hydration mismatch）
  if (!mounted) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 text-slate-100 flex">
        <SideRail active="journey" />
        <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto text-sm text-slate-500">載入山徑…</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 text-slate-100 flex">
      <AmbientAudio />
      <SideRail active="journey" />
      <div className="flex-1 min-w-0 px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto">
        {/* 標題列 */}
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
                ◀ 模式選擇
              </Link>
              <span className="text-[10px] rounded-full bg-emerald-500/80 text-black px-2 py-0.5">模式 A</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">峽谷行者 · 山徑：修復山徑</h1>
            <p className="text-[11px] text-slate-400">
              非戰鬥。答對族語題讓行動全額生效。族語詞彙與發音為真實太魯閣語資料。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-slate-800 px-2 py-1 inline-flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ICON_DAY} width={14} height={14} alt="" />第 {game.day}/{MAX_DAY} 日
            </span>
            <span className="rounded bg-sky-900/60 px-2 py-1 inline-flex items-center gap-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ICON_ACTION} width={14} height={14} alt="" />行動點 {game.ap}/{effectiveMaxAp(game)}
            </span>
            <span
              className="rounded bg-emerald-900/60 px-2 py-1 inline-flex items-center gap-1"
              title="答對題數 ÷ 已答題數"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ICON_HIT} width={14} height={14} alt="" />答題正確率 {rateLabel}
            </span>
            <button
              onClick={() => setShowRules(true)}
              className="rounded bg-slate-700 hover:bg-slate-600 px-2 py-1"
            >
              規則
            </button>
            <button
              onClick={() => setConfirmRestart(true)}
              className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-slate-300"
              title="重新開始一局"
            >
              重新開始
            </button>
          </div>
        </header>

        {/* 頂部數值列（v2：壓力分級變色，危急時脈動警示） */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatBar
            label="壓力"
            value={game.pressure}
            max={game.maxPressure}
            color={
              pressureTier(game) === "critical" ? "bg-red-500" : pressureTier(game) === "tense" ? "bg-amber-500" : "bg-rose-500"
            }
            invert
            icon={METER_PRESSURE}
            pulse={pressureTier(game) === "critical"}
            tag={pressureTier(game) === "critical" ? "危急" : pressureTier(game) === "tense" ? "緊張" : undefined}
          />
          <StatBar label="隊伍體力" value={game.teamHp} max={game.maxTeamHp} color="bg-emerald-500" icon={METER_STAMINA} />
          <div className="relative rounded-lg border border-slate-800 bg-slate-900/50 p-2 pt-3 flex items-start justify-around gap-2 text-sm col-span-2">
            {/* 族語落字（決策#22）：klokah 真實詞＋發音，整區標「示範·待核」待語言部終核 */}
            <span className="absolute -top-2 right-2 rounded bg-slate-800 px-1.5 text-[9px] text-amber-300/90 border border-slate-700">
              族語：示範·待核
            </span>
            {(Object.keys(game.res) as Resource[]).map((r) => (
              <span key={r} className="flex flex-col items-center gap-0.5" title={`${RES_NAME[r]}（示範·待核）`}>
                <span className="flex items-center gap-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={COIN_IMG[r]} width={24} height={24} alt={RES_NAME[r]} className="inline-block" />
                  <span className="font-semibold">{game.res[r]}</span>
                </span>
                {/* 中文名稱為主要可見標籤（避免只藏在 title tooltip 裡看不到）；族語詞為輔助學習 */}
                <span className="text-[10px] text-slate-400">{RES_NAME[r]}</span>
                <WordChip vocabId={RES_VOCAB[r]} />
              </span>
            ))}
          </div>
        </section>

        {/* 任務面板（v2：主線目標＋節點進度＋這一步＋可直接操作的行動按鈕＋支線＋連擊） */}
        <section className="mb-3 rounded-xl border border-emerald-800/50 bg-emerald-950/25 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="rounded bg-emerald-800/70 px-2 py-0.5 text-[11px] font-semibold text-emerald-50">主線</span>
              <span className="text-sm font-semibold">修復山徑 · 返回部落</span>
            </div>
            <span className="text-[11px] text-slate-400">
              節點 {game.idx}/{game.nodes.length - 1} · 第 {game.day}/{MAX_DAY} 日
            </span>
          </div>
          {(() => {
            const hint = stepHint(game);
            const node = game.nodes[game.idx];
            const canGoAdvance = canAdvance(game);
            const canGoHardClear = canHardClear(game);
            return (
              <div className="mt-2 rounded-lg bg-slate-950/50 p-2.5">
                <div className="text-[11px] uppercase tracking-wider text-emerald-400/80">這一步</div>
                <div className="mt-0.5 text-sm font-medium text-emerald-100">{hint.situation}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-300">{hint.todo}</div>

                {/* 常駐「前進」：脫離卡牌經濟，路段已清就能按（v2 修死局） */}
                {game.status === "playing" && node.cleared && game.idx < game.nodes.length - 1 && (
                  <button
                    onClick={doAdvance}
                    disabled={!canGoAdvance}
                    className="mt-2 w-full rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:hover:bg-emerald-700 px-3 py-2 text-sm font-semibold transition"
                  >
                    ▶ 前進（行動點 -1）
                  </button>
                )}

                {/* 花資源硬清：obstacle/bridge 未清時的免答題替代方案 */}
                {game.status === "playing" && !node.cleared && (node.type === "obstacle" || node.type === "bridge") && (
                  <button
                    onClick={doHardClear}
                    disabled={!canGoHardClear}
                    className="mt-2 w-full rounded-lg border border-amber-600/60 bg-amber-950/30 hover:bg-amber-900/40 disabled:opacity-30 px-3 py-2 text-sm font-semibold text-amber-200 transition"
                  >
                    ⛏ 花資源硬清（{node.type === "obstacle" ? "石材×2" : "木材×2・繩索×2"}，免答題）
                  </button>
                )}

                {/* 林間捷徑選擇 */}
                {game.status === "playing" && !node.cleared && node.type === "event" && (
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => doEventChoice("fast")}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 px-3 py-2 text-xs font-medium transition"
                    >
                      🏃 快速通過（壓力 +2）
                    </button>
                    <button
                      onClick={() => doEventChoice("careful")}
                      disabled={game.res.wood < 1 || game.res.rope < 1}
                      className="rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 disabled:opacity-30 px-3 py-2 text-xs font-medium transition"
                    >
                      🔍 謹慎探勘（耗木材1・繩索1，換糧食+1）
                    </button>
                  </div>
                )}

                {/* 山腰營地選擇 */}
                {game.status === "playing" && !node.cleared && node.type === "supply" && (
                  <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(RES_NAME) as Resource[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => doSupplyChoice(r)}
                        className="flex flex-col items-center gap-1 rounded-lg border border-slate-700 bg-slate-900/70 hover:bg-slate-800 px-2 py-2 text-xs font-medium transition"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={COIN_IMG[r]} width={20} height={20} alt={RES_NAME[r]} />
                        {RES_NAME[r]} +3
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-[11px] text-slate-500">支線</span>
            {sideQuests(game).map((q) => (
              <span
                key={q.label}
                title={q.note}
                className={`inline-flex items-center gap-1 text-[11px] ${
                  q.state === "ok" ? "text-emerald-300" : q.state === "fail" ? "text-slate-600 line-through" : "text-slate-400"
                }`}
              >
                <span>{q.state === "ok" ? "✓" : q.state === "fail" ? "✕" : "○"}</span>
                {q.label}
              </span>
            ))}
            {game.streak > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                🔥 連對 {game.streak}
              </span>
            )}
          </div>
        </section>

        {/* 今日事件 */}
        {game.event && (
          <section className="mb-3 rounded-xl border border-amber-700/40 bg-amber-950/20 p-3 text-sm">
            <span className="text-amber-300 font-semibold">今日事件 · {game.event.name}</span>
            <span className="text-slate-400 text-xs">（{game.event.kind}）</span>
            <WordChip vocabId={game.event.vocabId} />
            <span className="text-slate-300"> — {game.event.desc}</span>
          </section>
        )}

        {/* 山徑節點 */}
        <section className="mb-3">
          <div className="mb-1 flex items-center gap-2">
            <span className={`${notoSansTC.className} rounded-full border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-[10px] tracking-[0.2em] text-amber-300/90`}>
              {chapterForIdx(game.idx).chapter.kicker}
            </span>
          </div>
          <SectionHeading>山徑路線</SectionHeading>
          <div className="relative rounded-xl border border-slate-800 overflow-hidden">
            {/* 山徑地圖底（ORDER-015 美術，已過文化複核）＋深色 overlay 保節點可讀 */}
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${MAP_BASE})` }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-slate-950/70" aria-hidden />
            <div className="relative p-3 flex flex-wrap items-stretch gap-2">
              {game.nodes.map((n, i) => {
                const here = i === game.idx;
                return (
                  <div
                    key={n.id}
                    className={`flex-1 min-w-24 rounded-lg border-2 p-2 text-center relative ${
                      here
                        ? "border-emerald-400 bg-emerald-900/70"
                        : n.cleared
                          ? "border-slate-700 bg-slate-900/70 opacity-80"
                          : "border-slate-700 bg-slate-900/80"
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
                      className="absolute inset-0 rounded-lg bg-cover bg-center opacity-35"
                      style={{ backgroundImage: `url(${SCENE_IMG[n.type]})` }}
                      aria-hidden
                    />
                    <span className="absolute inset-0 rounded-lg bg-slate-950/45" aria-hidden />
                    <div className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={NODE_IMG[n.type]} width={48} height={48} alt={n.name} className="mx-auto mt-1" />
                      <div className="text-xs font-semibold truncate">{n.name}</div>
                      <div className="flex justify-center">
                        <WordChip vocabId={n.vocabId} />
                      </div>
                      {n.type === "obstacle" || n.type === "bridge" ? (
                        <div className={`text-[11px] mt-1 ${n.cleared ? "text-emerald-400" : "text-rose-300"}`}>
                          {n.cleared ? "已通行" : n.type === "bridge" ? "待搭橋" : `阻礙 ${n.obstacle}`}
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
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 min-h-16 max-h-32 overflow-auto space-y-1 text-xs">
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

        {/* 手牌 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-500">
              行動籤（牌庫 {game.deck.length} · 棄 {game.discard.length}）
            </h2>
            <button
              onClick={() => setGame((g) => camp(g))}
              disabled={game.status !== "playing"}
              className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 px-3 py-1 text-sm font-medium"
            >
              🌙 紮營（收束今日）
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={FRAME_DIVIDER} alt="" className="mb-2 h-2 w-40 object-contain object-left opacity-80" />
          <div className="flex flex-wrap gap-2">
            {game.hand.map((c) => {
              const playable = canAfford(game, c);
              const eff = apCost(game, c);
              const art = CARD_ART[c.effect];
              return (
                <button
                  key={c.key}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  className={`w-36 text-left rounded-xl border-2 p-2 transition ${
                    playable
                      ? "border-slate-600 bg-slate-800 hover:-translate-y-1 hover:bg-slate-700"
                      : "border-slate-800 bg-slate-900 opacity-40 cursor-not-allowed"
                  }`}
                >
                  {art && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={art} alt={c.name} className="w-full h-16 object-cover rounded-lg mb-2" />
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-sky-300 font-bold text-sm">
                      🎯{eff}
                      {eff !== c.cost && <span className="text-emerald-400 text-[10px]"> (原{c.cost})</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">{cardTypeLabel(c.type)}</span>
                  </div>
                  <div className="font-semibold text-sm mt-1">{c.name}</div>
                  <WordChip vocabId={c.vocabId} />
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">{c.desc}</div>
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            <div className="text-xs text-slate-400 mb-1">打出「{pending.name}」— 答對則行動全額生效</div>
            <h3 className="text-lg font-bold mb-1">{quiz.prompt}</h3>
            <p className="text-[10px] text-amber-300/70 mb-3">{quiz.note}</p>
            <div className="grid gap-2">
              {quiz.options.map((opt, idx) => {
                let cls = "bg-slate-800 hover:bg-slate-700";
                if (revealed !== null) {
                  if (idx === quiz.answer) cls = "bg-emerald-700";
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
              <div className="mt-3 flex items-center gap-2">
                <p className="text-xs text-slate-300">
                  {revealed === quiz.answer ? "✅ 答對！行動全額生效。" : "❌ 答錯，行動以半額生效。"}
                </p>
                <button
                  onClick={() => playAudio(quiz.audioId)}
                  className="rounded bg-sky-700 hover:bg-sky-600 px-2 py-1 text-xs"
                  title="播放正解發音（原住民族語E樂園）"
                >
                  🔊 聽發音
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 規則面板 */}
      {showRules && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5 text-sm">
            <h3 className="text-lg font-bold mb-3">怎麼玩 · 勝敗條件</h3>
            <ul className="space-y-2 text-slate-300">
              <li>🎯 <b>目標</b>：在第 {MAX_DAY} 日結束前，帶隊伍抵達終點「部落」。</li>
              <li>▶ 路段清除後，隨時可點常駐的<b>「前進」</b>（花 1 行動點）走到下一段，不需要特定卡牌。</li>
              <li>🃏 落石／吊橋可以打行動／協作牌清除（答對族語題全額生效、答錯半額），也可以花<b>雙倍資源「硬清」</b>直接清除、不用答題——省語言題但耗資源，自己選。</li>
              <li>❓ 林間捷徑／山腰營地是<b>真選擇</b>：快速通過 vs 謹慎探勘、要補哪一種資源，自己決定。</li>
              <li>🔥 連續答對 3 題族語題會觸發<b>「順風」</b>，補 1 行動點。</li>
              <li>🌡 <b>壓力分級</b>：5 分以上「緊張」（紮營消耗糧食變 2）；8 分以上「危急」（行動點上限收緊為 2）。</li>
              <li>🌙 <b>紮營</b>收束當日：消耗糧食（見上）；糧食不足則隊伍體力 -2；當前路段未通行則壓力 +1。</li>
              <li>💥 <b>失敗條件</b>：壓力達 {10}（被迫折返）、或隊伍體力歸 0（耗盡）、或第 {MAX_DAY} 日結束仍未抵達。</li>
              <li>📦 資源：<b>糧食</b>（紮營消耗）、<b>木材／繩索</b>（搭橋）、<b>石材</b>（硬清落石）——資源列圖示下方的族語詞是真實太魯閣語，可點喇叭聽發音。</li>
            </ul>
            <div className="text-right mt-4">
              <button
                onClick={() => setShowRules(false)}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-sm font-semibold"
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 重新開始二次確認 */}
      {confirmRestart && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-xs rounded-2xl bg-slate-900 border border-slate-700 p-5 text-center">
            <h3 className="text-base font-bold mb-1">重新開始這一局？</h3>
            <p className="text-xs text-slate-400 mb-4">目前進度會全部重置，無法復原。</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={restart}
                className="rounded-full bg-rose-600 hover:bg-rose-500 px-4 py-2 text-sm font-semibold"
              >
                確定重來
              </button>
              <button
                onClick={() => setConfirmRestart(false)}
                className="rounded-full bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 章節標題卡（v2）：進入新章節時的過場，沿用 /prologue 字體與 kicker 樣式，維持敘事連續 */}
      {chapterCard !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-amber-500/30 bg-slate-950/95 p-8 text-center shadow-2xl">
            <div
              className={`${notoSansTC.className} mb-4 inline-block rounded-full border border-amber-500/40 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90`}
            >
              {CHAPTERS[chapterCard].kicker}
            </div>
            <div className={`${notoSerifTC.className} text-xl font-bold leading-snug text-amber-50 sm:text-2xl`}>
              {CHAPTERS[chapterCard].title}
            </div>
            <p className={`${notoSansTC.className} mt-4 text-sm leading-relaxed text-slate-300`}>{CHAPTERS[chapterCard].sub}</p>
            <button
              onClick={() => setChapterCard(null)}
              className={`${notoSerifTC.className} mt-6 rounded-lg border-2 border-amber-500/60 bg-gradient-to-b from-[#32251766] to-[#0f1218f0] px-8 py-2.5 text-sm font-bold tracking-[0.15em] text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-300/90`}
            >
              繼續
            </button>
          </div>
        </div>
      )}

      {/* 勝負彈窗 */}
      {game.status !== "playing" && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center">
            <div className="text-4xl mb-2">{game.status === "won" ? "🏔🌈" : "🌧"}</div>
            <h3 className="text-xl font-bold mb-1">
              {game.status === "won" ? "安全抵達部落！" : "未能抵達部落"}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {game.status === "won"
                ? `第 ${game.day} 日抵達，答題正確率 ${rateLabel}。`
                : game.pressure >= game.maxPressure
                  ? "壓力達到上限，隊伍被迫折返。"
                  : game.teamHp <= 0
                    ? "隊伍體力耗盡。"
                    : "任務天數耗盡，尚未抵達。"}
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={restart}
                className="rounded-full bg-emerald-600 hover:bg-emerald-500 px-5 py-2 text-sm font-semibold"
              >
                再走一次
              </button>
              <Link href="/" className="rounded-full bg-slate-700 hover:bg-slate-600 px-5 py-2 text-sm">
                回模式選擇
              </Link>
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
      <h2 className="text-xs uppercase tracking-wider text-slate-500">{children}</h2>
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
          className="cursor-pointer rounded px-1 text-sky-300/90 hover:bg-slate-700/60"
        >
          🔊
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
  return (
    <div className={`rounded-lg border bg-slate-900/50 p-2 ${pulse ? "border-red-500/70 animate-pulse" : "border-slate-800"}`}>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-slate-400 flex items-center gap-1">
          {icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={icon} width={14} height={14} alt="" />
          )}
          {label}
          {tag && <span className="ml-1 rounded bg-amber-900/50 px-1 text-[10px] text-amber-300">{tag}</span>}
        </span>
        <span className={invert ? "text-rose-300" : "text-emerald-300"}>
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
