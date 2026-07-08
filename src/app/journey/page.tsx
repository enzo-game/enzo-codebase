"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { vocab, audioUrl, distractors, ATTRIBUTION, SOURCE, SOURCE_URL } from "@/data/truku";

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
const NODE_IMG: Record<NodeType, string> = {
  start: "/images/journey/node-normal-v1.png",
  obstacle: "/images/journey/node-rockfall-v1.png",
  bridge: "/images/journey/node-bridge-v1.png",
  event: "/images/journey/node-event-v1.png",
  supply: "/images/journey/node-supply-v1.png",
  destination: "/images/journey/node-destination-v1.png",
};
const MAP_BASE = "/images/journey/board-journey-map-base-v1.jpg";

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
  { name: "巡路", vocabId: "25-10", cost: 1, type: "action", effect: "scout", quiz: true, desc: "前進 1 格（需目前路段已通行）。" },
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

function buildNodes(): PathNode[] {
  // vocabId：河流10-07 石頭12-05 橋樑12-07 道路10-01 家12-01 部落24-04
  return [
    { id: "n0", name: "立霧溪口（起點）", vocabId: "10-07", type: "start", obstacle: 0, cleared: true },
    { id: "n1", name: "落石路段", vocabId: "12-05", type: "obstacle", obstacle: 2, cleared: false },
    { id: "n2", name: "峽谷吊橋", vocabId: "12-07", type: "bridge", obstacle: 1, cleared: false },
    { id: "n3", name: "林間捷徑", vocabId: "10-01", type: "event", obstacle: 0, cleared: false },
    { id: "n4", name: "山腰營地", vocabId: "12-01", type: "supply", obstacle: 0, cleared: false },
    { id: "n5", name: "部落（目的地）", vocabId: "24-04", type: "destination", obstacle: 0, cleared: false },
  ];
}

const EVENTS: EventCard[] = [
  // vocabId：風10-04 河流10-07 太陽11-02 石頭12-05 獵物16-08 雲11-12
  { name: "風起雲湧", vocabId: "10-04", kind: "天候", pressure: 1, desc: "山風漸強，隊伍步伐放緩。" },
  { name: "溪水上升", vocabId: "10-07", kind: "地形", pressure: 1, desc: "溪水漲起，橋段更難通行。" },
  { name: "好天氣", vocabId: "11-02", kind: "正面", pressure: -1, desc: "天色轉晴，士氣回升。" },
  { name: "落石再起", vocabId: "12-05", kind: "路段危機", pressure: 1, desc: "碎石不時滑落。" },
  { name: "山林餽贈", vocabId: "16-08", kind: "正面", pressure: -1, desc: "沿途採得野菜與山產。" },
  { name: "濃霧起", vocabId: "11-12", kind: "天候", pressure: 1, desc: "白霧壟罩，視線受阻。" },
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
  };
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

// 到達新節點的即時效果
function enterNode(g: JGame): JGame {
  const ng: JGame = { ...g, nodes: g.nodes.map((n) => ({ ...n })), res: { ...g.res } };
  const node = ng.nodes[ng.idx];
  if (!node) return ng;
  if (node.type === "supply" && !node.cleared) {
    ng.res.food += 2;
    ng.res.rope += 1;
    node.cleared = true;
    ng.log = pushLog(ng.log, `📦 ${node.name}：補給 +2 糧食、+1 繩索。`, "good");
  } else if (node.type === "event" && !node.cleared) {
    node.cleared = true;
    ng.pressure = Math.max(0, ng.pressure - 1);
    ng.log = pushLog(ng.log, `❓ ${node.name}：捷徑順利通過，壓力 -1。`, "good");
  } else if (node.type === "start" || node.type === "destination") {
    node.cleared = true;
  }
  return ng;
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
    if (correct) ng.correct += 1;
    else ng.wrong += 1;
  }

  const node = ng.nodes[ng.idx];
  const tag = card.quiz ? (correct ? "✅ 答對" : "❌ 答錯") : "▶";

  switch (card.effect) {
    case "scout": {
      if (node && node.cleared && ng.idx < ng.nodes.length - 1) {
        ng.idx += 1;
        ng = enterNode(ng);
        ng.log = pushLog(ng.log, `${tag}｜巡路：前進至「${ng.nodes[ng.idx].name}」。`, correct ? "good" : "info");
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
      ng.log = pushLog(ng.log, `▶｜整理物資：糧食 +2（${ng.res.food}）。`, "good");
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

  return settle(ng);
}

// ───────────────────────── 紮營（結束當日）─────────────────────────

function camp(g: JGame): JGame {
  if (g.status !== "playing") return g;
  const ng: JGame = { ...g, res: { ...g.res }, nodes: g.nodes.map((n) => ({ ...n })) };

  // 消耗糧食
  ng.res.food -= 1;
  if (ng.res.food < 0) {
    ng.res.food = 0;
    ng.teamHp = Math.max(0, ng.teamHp - 2);
    ng.log = pushLog(ng.log, "🌙 紮營：糧食不足，隊伍體力 -2。", "bad");
  } else {
    ng.log = pushLog(ng.log, `🌙 紮營：消耗 1 糧食（剩 ${ng.res.food}）。`, "sys");
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

export default function JourneyPage() {
  const [game, setGame] = useState<JGame>(() => newGame());
  const [pending, setPending] = useState<JCard | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

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
      setGame((g) => playCard(g, card, true));
    }
  }

  function answer(optIdx: number) {
    if (!pending || !quiz) return;
    const correct = optIdx === quiz.answer;
    setRevealed(optIdx);
    setTimeout(() => {
      setGame((g) => playCard(g, pending, correct));
      setPending(null);
      setRevealed(null);
    }, 850);
  }

  function restart() {
    setGame(newGame());
    setPending(null);
    setRevealed(null);
    setConfirmRestart(false);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 text-slate-100 px-4 sm:px-6 py-6">
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
            <h1 className="text-xl sm:text-2xl font-bold">Enzo · 山徑：修復山徑</h1>
            <p className="text-[11px] text-slate-400">
              非戰鬥。答對族語題讓行動全額生效。族語詞彙與發音為真實太魯閣語資料。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded bg-slate-800 px-2 py-1">
              第 {game.day}/{MAX_DAY} 日
            </span>
            <span className="rounded bg-sky-900/60 px-2 py-1">
              行動點 {game.ap}/{game.maxAp}
            </span>
            <span className="rounded bg-emerald-900/60 px-2 py-1" title="答對題數 ÷ 已答題數">
              答題正確率 {rateLabel}
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

        {/* 頂部數值列 */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <StatBar label="壓力" value={game.pressure} max={game.maxPressure} color="bg-rose-500" invert />
          <StatBar label="隊伍體力" value={game.teamHp} max={game.maxTeamHp} color="bg-emerald-500" />
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2 flex items-center justify-around gap-2 text-sm col-span-2">
            {(Object.keys(game.res) as Resource[]).map((r) => (
              <span key={r} className="flex items-center gap-1" title={RES_NAME[r]}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={RES_IMG[r]} width={22} height={22} alt={RES_NAME[r]} className="inline-block" />
                <span className="font-semibold">{game.res[r]}</span>
              </span>
            ))}
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
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">山徑路線</h2>
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
                );
              })}
            </div>
          </div>
        </section>

        {/* 紀錄 */}
        <section className="mb-3">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">行動紀錄</h2>
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
          <div className="flex flex-wrap gap-2">
            {game.hand.map((c) => {
              const playable = canAfford(game, c);
              const eff = apCost(game, c);
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
              <li>🃏 每回合有 <b>行動點</b>，打行動／協作牌前要答對族語題，行動才全額生效（答錯半額）。</li>
              <li>🌙 <b>紮營</b>收束當日：消耗 <b>1 糧食</b>；糧食不足則隊伍體力 -2；當前路段未通行則壓力 +1。</li>
              <li>💥 <b>失敗條件</b>：壓力達 {10}（被迫折返）、或隊伍體力歸 0（耗盡）、或第 {MAX_DAY} 日結束仍未抵達。</li>
              <li>📦 資源：糧食（紮營消耗）、木材／繩索（搭橋）、石材（修橋、加固落石）。</li>
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
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  invert?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-slate-400">{label}</span>
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
