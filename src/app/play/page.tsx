"use client";

import Link from "next/link";
import { Noto_Serif_TC } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import { CARD_LEARNING, Card, RARITY_COLOR, Rarity, Theme } from "@/data/cards";
import { audioUrl } from "@/data/truku";
import AmbientAudio from "@/components/AmbientAudio";
import BattleMusic from "@/components/BattleMusic";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxArrive, sfxLose, sfxAttack, sfxHit, sfxSummon } from "@/lib/sfx";
import {
  Game,
  Minion,
  QuizState,
  Target,
  TargetKind,
  Difficulty,
  HERO_HP,
  BOARD_MAX,
  attackTargets,
  checkWinner,
  endOfTurnEffects,
  hasValidTarget,
  makeQuiz,
  mulligan,
  newGame,
  playCardResolved,
  pushLog,
  resolveAttack,
  runEnemyTurn,
  spellTargetKind,
  startPlayerTurn,
} from "@/engine";

// 卡名用襯線字（比照 /journey 的標題字），像收藏卡的名條
const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

const DIFF_ZH: Record<Difficulty, string> = { easy: "簡單", normal: "普通", hard: "困難" };

// 多套對手（頭目）：中性的「山林試煉」變體，以牌組主題偏向做出不同手感。
// 文化中性——皆為自然生態意象，非擬人化祖靈/神格；難度(easy/normal/hard)另外正交控制。
const OPPONENTS: { id: string; name: string; tagline: string; theme?: Theme }[] = [
  { id: "trial", name: "山林試煉", tagline: "均衡的試煉，各類牌都有。" },
  { id: "beasts", name: "山林試煉 · 獸群", tagline: "獸群偏重，前期就壓上來。", theme: "animal" },
  { id: "forest", name: "山林試煉 · 深林", tagline: "草木叢生，嘲諷防守、後期反打。", theme: "plant" },
  { id: "storm", name: "山林試煉 · 風雨", tagline: "風雨為主，法術節奏壓制。", theme: "nature" },
];

// 新手引導步驟（互動分步教學；文字＋簡易示意圖，無 emoji）
const ONB_STEPS: { k: string; title: string; body: string }[] = [
  {
    k: "goal",
    title: "目標：打倒山林試煉",
    body: "你（織者）和對手都從 30 點生命開始。把「山林試煉」的生命打到 0，就通過試煉。",
  },
  {
    k: "quiz",
    title: "出牌先答族語題",
    body: "每打一張牌會跳出一題太魯閣族語選擇。答對 → 觸發卡片的 ★加成（更強）；答錯 → 以基礎效果打出，一樣能出牌。揭曉後自動播正確發音。",
  },
  {
    k: "mana",
    title: "法力決定你能出什麼",
    body: "每回合法力上限 +1（最多 10）。牌左上角的藍寶石是費用，法力不夠就不能出這張。",
  },
  {
    k: "attack",
    title: "隨從與攻擊",
    body: "剛打出的隨從要「下一回合」才能攻擊。輪到你時，先點自己的隨從，再點敵方隨從或英雄發動攻擊。",
  },
  {
    k: "keyword",
    title: "三個關鍵字",
    body: "嘲諷＝敵方有嘲諷隨從時必須先打它；潛行＝不能被指定攻擊；★加成＝答對題目才會生效。",
  },
];

/** 引導步驟的簡易示意圖（純樣式方塊／線稿，無 emoji） */
function OnbArt({ k }: { k: string }) {
  if (k === "goal") {
    return (
      <div className="space-y-2">
        {[
          { name: "織者（你）", w: "100%", c: "bg-emerald-500" },
          { name: "山林試煉", w: "35%", c: "bg-rose-500" },
        ].map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-slate-300">{r.name}</span>
            <span className="relative h-3 flex-1 rounded-full bg-slate-700 overflow-hidden">
              <span className={`absolute inset-y-0 left-0 ${r.c}`} style={{ width: r.w }} />
            </span>
          </div>
        ))}
        <p className="text-center text-[11px] text-rose-300/80">把對手血條清空 → 通過</p>
      </div>
    );
  }
  if (k === "quiz") {
    return (
      <div className="mx-auto max-w-[240px] space-y-1.5">
        <p className="text-center text-[11px] text-slate-400">「三」的太魯閣族語是？</p>
        {[
          { t: "tru", ok: true },
          { t: "spat", ok: false },
        ].map((o) => (
          <div
            key={o.t}
            className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm ${
              o.ok ? "border-emerald-400 bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-400"
            }`}
          >
            <span>{o.t}</span>
            {o.ok && <span className="text-emerald-300">✓ ★加成</span>}
          </div>
        ))}
      </div>
    );
  }
  if (k === "mana") {
    return (
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rotate-45 rounded-[3px] ${i < 4 ? "bg-sky-400" : "bg-slate-700"}`}
          />
        ))}
        <span className="ml-2 text-[11px] text-sky-200">4 / 10</span>
      </div>
    );
  }
  if (k === "attack") {
    return (
      <div className="flex items-center justify-center gap-3">
        <span className="grid h-14 w-11 place-items-center rounded-md border-2 border-emerald-400 bg-emerald-900/30 text-[10px] text-emerald-200">
          我方
        </span>
        <span className="text-2xl text-amber-300">→</span>
        <span className="grid h-14 w-11 place-items-center rounded-md border-2 border-rose-400 bg-rose-900/30 text-[10px] text-rose-200">
          敵方
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {[
        { t: "嘲諷", c: "border-orange-400 text-orange-200" },
        { t: "潛行", c: "border-slate-400 text-slate-200" },
        { t: "★加成", c: "border-amber-400 text-amber-200" },
      ].map((c) => (
        <span key={c.t} className={`rounded-full border px-3 py-1 text-xs ${c.c}`}>
          {c.t}
        </span>
      ))}
    </div>
  );
}


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
const THEME_ZH: Record<Theme, string> = {
  legend: "傳說",
  animal: "動物",
  plant: "植物",
  nature: "自然",
  tool: "器物",
};

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
  "leg-l12": "/images/cards/l12-citrus.jpg",
  "leg-l13": "/images/cards/l13-road.jpg",
  "leg-n01": "/images/cards/n01-stars.jpg",
  "leg-n02": "/images/cards/n02-fog.jpg",
  "leg-n03": "/images/cards/n03-thunder.jpg",
  "leg-n04": "/images/cards/n04-moon.jpg",
  "leg-n05": "/images/cards/n05-mist.jpg",
  "leg-n06": "/images/cards/n06-lightning.jpg",
  "leg-n07": "/images/cards/n07-typhoon.jpg",
  "leg-n08": "/images/cards/n08-night-rest.jpg",
  "leg-n09": "/images/cards/n09-creek-supply.jpg",
  "leg-n10": "/images/cards/n10-headwind-pass.jpg",
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
  "leg-p06": "/images/cards/p06-after-wind-road.jpg",
  "leg-p07": "/images/cards/p07-stone-marker.jpg",
  "leg-p08": "/images/cards/p08-night-fire.jpg",
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

const GEM_LABEL: Record<GemKind, string> = {
  cost: "費",
  atk: "攻",
  hp: "命",
};

const GEM_TITLE: Record<GemKind, string> = {
  cost: "費用：打出這張牌需要的法力",
  atk: "攻擊：造成的傷害",
  hp: "生命：承受傷害的血量",
};

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
    <span
      className={`hs-gem hs-gem-${size} ${className}`}
      data-label={GEM_LABEL[kind]}
      title={`${GEM_TITLE[kind]} ${value}`}
      aria-label={`${GEM_TITLE[kind]} ${value}`}
    >
      <svg viewBox="0 0 24 24" className="block w-full h-full" aria-hidden focusable="false">
        <Shape />
      </svg>
      <span className={`hs-gem-num ${tone}`}>{value}</span>
      <span className="hs-gem-label" aria-hidden>{GEM_LABEL[kind]}</span>
    </span>
  );
}

const BOARD_BG = "/images/cards/board-battle.jpg";
const CARDBACK = "/images/cards/cardback.jpg";
const HERO_ART = {
  enemy: "/images/play/hero-trial.jpg",
  player: "/images/play/hero-weaver.jpg",
};


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
  // 規則說明：header 的「規則」可隨時開啟的詳細條列
  const [showRules, setShowRules] = useState(false);
  // 新手引導：第一次進來的互動分步教學（localStorage 記過就不再自動彈）
  const [onboarding, setOnboarding] = useState(false);
  const [onbStep, setOnbStep] = useState(0);
  // 電腦難度：預設普通，記憶上次選擇。切換即刻套用（影響下一個系統回合）。
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  // 對手（頭目）：決定敵方牌組主題。切換＝開新局。
  const [opponentId, setOpponentId] = useState("trial");
  const [showOpponents, setShowOpponents] = useState(false);
  const opponent = OPPONENTS.find((o) => o.id === opponentId) ?? OPPONENTS[0];
  // 耐玩循環：開局換牌、連勝計數、認輸確認
  const [mulliganPhase, setMulliganPhase] = useState(false);
  const [mulliganSel, setMulliganSel] = useState<Set<number>>(new Set());
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [confirmConcede, setConfirmConcede] = useState(false);

  useEffect(() => {
    // 刻意的客戶端 mount 初始化：newGame() 內含 Math.random()，須在 client 產生以避免 SSR/CSR hydration 不一致
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setGame(newGame());
    setMulliganPhase(true);
    try {
      if (!localStorage.getItem("enzo-play-onboarded")) setOnboarding(true);
      const d = localStorage.getItem("enzo-play-difficulty");
      if (d === "easy" || d === "normal" || d === "hard") setDifficulty(d);
      const best = Number(localStorage.getItem("enzo-play-best-streak"));
      if (Number.isFinite(best) && best > 0) setBestStreak(best);
      const opp = OPPONENTS.find((o) => o.id === localStorage.getItem("enzo-play-opponent"));
      if (opp) {
        setOpponentId(opp.id);
        if (opp.theme) setGame(newGame(opp.theme)); // 有偏向的對手重發一次牌
      }
    } catch {
      setOnboarding(true); // localStorage 不可用（隱私模式）時仍給第一次引導
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function closeRules() {
    setShowRules(false);
  }

  function finishOnboarding() {
    setOnboarding(false);
    setOnbStep(0);
    try {
      localStorage.setItem("enzo-play-onboarded", "1");
    } catch {
      // 記不住就算了，不阻斷開始遊戲
    }
  }

  // 終局音效：勝利 / 落敗（中性 UI 完成音，非族樂）
  const winner = game.winner;
  useEffect(() => {
    if (!winner) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (winner === "player") {
      sfxArrive();
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => {
          const best = Math.max(b, next);
          try {
            localStorage.setItem("enzo-play-best-streak", String(best));
          } catch {
            /* 記不住就算了 */
          }
          return best;
        });
        return next;
      });
    } else if (winner === "enemy") {
      sfxLose();
      setStreak(0);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [winner]);

  // ── 打擊感（ORDER-065）：以「前後盤面差異」推導浮動傷害數字、受擊震動、登場音 ──
  // 集中在一個 effect 比較 prevGame vs game：英雄/隨從掉血 → 冒 -N、抖動、播受擊音；敵方新隨從 → 登場音。
  const [heroShake, setHeroShake] = useState({ player: false, enemy: false });
  const [floats, setFloats] = useState<{ id: number; anchor: string; dmg: number }[]>([]);
  const prevGameRef = useRef<Game | null>(null);
  const fxId = useRef(0);

  useEffect(() => {
    const prev = prevGameRef.current;
    prevGameRef.current = game;
    if (!prev) return;

    /* eslint-disable react-hooks/set-state-in-effect */
    const spawned: { id: number; anchor: string; dmg: number }[] = [];
    let hit = false;

    if (game.enemyHp < prev.enemyHp) {
      spawned.push({ id: ++fxId.current, anchor: "heroEnemy", dmg: prev.enemyHp - game.enemyHp });
      setHeroShake((s) => ({ ...s, enemy: true }));
      hit = true;
    }
    if (game.playerHp < prev.playerHp) {
      spawned.push({ id: ++fxId.current, anchor: "heroPlayer", dmg: prev.playerHp - game.playerHp });
      setHeroShake((s) => ({ ...s, player: true }));
      hit = true;
    }

    const prevE = new Map(prev.eBoard.map((m) => [m.key, m.health]));
    for (const m of game.eBoard) {
      const ph = prevE.get(m.key);
      if (ph !== undefined && m.health < ph) {
        spawned.push({ id: ++fxId.current, anchor: m.key, dmg: ph - m.health });
        hit = true;
      }
    }
    const prevP = new Map(prev.pBoard.map((m) => [m.key, m.health]));
    for (const m of game.pBoard) {
      const ph = prevP.get(m.key);
      if (ph !== undefined && m.health < ph) {
        spawned.push({ id: ++fxId.current, anchor: m.key, dmg: ph - m.health });
        hit = true;
      }
    }

    const prevEKeys = new Set(prev.eBoard.map((m) => m.key));
    if (game.eBoard.some((m) => !prevEKeys.has(m.key))) sfxSummon();

    if (spawned.length > 0) {
      setFloats((f) => [...f, ...spawned]);
      const ids = new Set(spawned.map((s) => s.id));
      setTimeout(() => setFloats((f) => f.filter((x) => !ids.has(x.id))), 850);
    }
    if (hit) sfxHit();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [game]);

  useEffect(() => {
    if (!heroShake.player && !heroShake.enemy) return;
    const t = setTimeout(() => setHeroShake({ player: false, enemy: false }), 420);
    return () => clearTimeout(t);
  }, [heroShake]);

  // 認輸確認：3 秒未再點就取消「確定認輸？」狀態，避免卡在待確認
  useEffect(() => {
    if (!confirmConcede) return;
    const t = setTimeout(() => setConfirmConcede(false), 3000);
    return () => clearTimeout(t);
  }, [confirmConcede]);

  const hitKeys = new Set(
    floats.filter((f) => f.anchor !== "heroEnemy" && f.anchor !== "heroPlayer").map((f) => f.anchor),
  );
  const floatsFor = (anchor: string) => floats.filter((f) => f.anchor === anchor);

  function reset() {
    setQuiz(null);
    setRevealed(null);
    setSelected(null);
    setPending(null);
    setConfirmConcede(false);
    setMulliganSel(new Set());
    setGame(newGame(opponent.theme));
    setMulliganPhase(true);
  }

  // 選對手＝開新局（敵方牌組隨主題重建）。記憶選擇。
  function pickOpponent(id: string) {
    const opp = OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0];
    setOpponentId(id);
    try {
      localStorage.setItem("enzo-play-opponent", id);
    } catch {
      // 記不住就算了
    }
    setShowOpponents(false);
    setQuiz(null);
    setRevealed(null);
    setSelected(null);
    setPending(null);
    setConfirmConcede(false);
    setMulliganSel(new Set());
    setGame(newGame(opp.theme));
    setMulliganPhase(true);
  }

  // 開局換牌：把選取的牌洗回牌庫、重抽等量，然後進入對戰
  function toggleMulligan(i: number) {
    setMulliganSel((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  function confirmMulligan() {
    const idx = [...mulliganSel];
    if (idx.length > 0) setGame((g) => mulligan(g, idx));
    setMulliganSel(new Set());
    setMulliganPhase(false);
  }

  // 認輸：直接判系統獲勝（會觸發連勝歸零）。二次點擊確認，避免誤觸。
  function concede() {
    if (game.winner) return;
    if (!confirmConcede) {
      setConfirmConcede(true);
      return;
    }
    setConfirmConcede(false);
    setQuiz(null);
    setPending(null);
    setSelected(null);
    setGame((g) => ({ ...g, winner: "enemy", phase: "over" }));
  }

  function changeDifficulty(d: Difficulty) {
    setDifficulty(d);
    try {
      localStorage.setItem("enzo-play-difficulty", d);
    } catch {
      // 記不住就算了
    }
  }

  function tryPlay(card: Card) {
    if (game.phase !== "player" || game.winner || pending || quiz || mulliganPhase) return;
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
    sfxAttack();
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
    sfxAttack();
    setGame((g) => resolveAttack(g, "player", selected, { kind: "hero" }));
    setSelected(null);
  }

  function endTurn() {
    if (game.phase !== "player" || game.winner || pending || quiz || mulliganPhase) return;
    setSelected(null);
    setGame((g) => {
      const afterEot = checkWinner(endOfTurnEffects(g, "player"));
      return { ...afterEot, phase: afterEot.winner ? "over" : "enemy" };
    });
    setTimeout(() => {
      setGame((g) => {
        if (g.winner) return g;
        const afterEnemy = runEnemyTurn(g, difficulty);
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
    <main className="play-page min-h-screen text-slate-100 p-2 sm:p-4">
      <AmbientAudio />
      <BattleMusic />
      <GemDefs />
      <div className="play-shell mx-auto">
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
            <h1 className="text-lg sm:text-xl font-bold">峽谷行者 · 山林試煉（vs 系統）</h1>
            <p className="text-[11px] text-slate-400">
              傳說牌組：出牌先答太魯閣族語題（真實詞庫，揭曉後自動播發音），答對觸發加成效果。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div
              className="flex items-center rounded border border-slate-600/60 overflow-hidden"
              role="group"
              aria-label="電腦難度"
            >
              {([
                ["easy", "簡單"],
                ["normal", "普通"],
                ["hard", "困難"],
              ] as [Difficulty, string][]).map(([d, label]) => (
                <button
                  key={d}
                  onClick={() => changeDifficulty(d)}
                  aria-pressed={difficulty === d}
                  className={`px-2 py-1 transition ${
                    difficulty === d
                      ? "bg-sky-500 text-black font-semibold"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowOpponents(true)}
              title="更換對手（頭目）"
              className="rounded border border-sky-500/50 bg-sky-950/40 px-2 py-1 text-sky-200 hover:bg-sky-900/50"
            >
              對手：{opponent.id === "trial" ? "均衡" : opponent.name.split("· ")[1]} ▾
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="rounded border border-amber-400/40 bg-amber-950/40 px-2 py-1 text-amber-200 hover:bg-amber-900/50"
            >
              規則
            </button>
            <span className="rounded bg-slate-800 px-2 py-1">回合 {game.turn}</span>
            <span className="rounded bg-sky-900/60 px-2 py-1">
              法力 {game.pMana}/{game.pMaxMana}
            </span>
            <span className="rounded bg-emerald-900/60 px-2 py-1">命中 {rate}%</span>
            {streak > 0 && (
              <span className="rounded bg-amber-900/60 px-2 py-1 text-amber-200" title={`最佳連勝 ${bestStreak}`}>
                連勝 {streak}
              </span>
            )}
            <button
              onClick={concede}
              disabled={!!game.winner || mulliganPhase}
              className={`rounded border px-2 py-1 transition disabled:opacity-40 ${
                confirmConcede
                  ? "border-rose-400 bg-rose-900/60 text-rose-100"
                  : "border-slate-600 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {confirmConcede ? "確定認輸？" : "認輸"}
            </button>
          </div>
        </header>

        <div
          className="hs-table relative overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: `url(${BOARD_BG})` }}
        >
          <div className="hs-table-shade absolute inset-0" aria-hidden />

          <div className="hs-opponent-hand" aria-label={`敵方手牌 ${game.eHand.length} 張`}>
            {Array.from({ length: Math.min(game.eHand.length, 7) }).map((_, i, arr) => (
              <span
                key={i}
                className="hs-cardback-mini"
                style={{
                  transform: `translateX(${(i - (arr.length - 1) / 2) * 16}px) rotate(${(i - (arr.length - 1) / 2) * 5}deg)`,
                  zIndex: i,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CARDBACK} alt="" />
              </span>
            ))}
          </div>

          <div className="hs-resource-strip hs-resource-enemy" aria-label={`敵方法力 ${game.eMaxMana}/10`}>
            <span className="hs-mana-label">敵方法力</span>
            <span className="hs-mana-text">{game.eMaxMana}/10</span>
            <span className="hs-crystals" aria-hidden>
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className={i < game.eMaxMana ? "hs-crystal is-filled" : "hs-crystal"} />
              ))}
            </span>
          </div>

          {/* 系統（敵方）英雄 */}
          <button
            onClick={onEnemyHero}
            disabled={!enemyHeroTargetable}
            className={`hs-portrait hs-portrait-enemy relative transition ${enemyHeroTargetable ? "hs-hero-targetable cursor-pointer" : ""} ${heroShake.enemy ? "hs-hero-shake" : ""}`}
          >
            {floatsFor("heroEnemy").map((f) => (
              <span key={f.id} className="dmg-float" aria-hidden>
                -{f.dmg}
              </span>
            ))}
            <span className="hs-portrait-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_ART.enemy} alt="山林試煉頭像" />
            </span>
            <span className="hs-portrait-name">{opponent.name}</span>
            <span className="hs-portrait-sub">手牌 {game.eHand.length} · 牌庫 {game.eDeck.length}</span>
            <span className="hs-portrait-hp">
              <span className="hs-hp-label">生命 HP</span>
              <span className="hs-hp-value">{game.enemyHp}/{HERO_HP}</span>
            </span>
          </button>

          {(selected && !pending && atkLegal.mustTaunt) || pending ? (
            <div className="hs-target-callout">
              {selected && !pending && atkLegal.mustTaunt && "敵方有嘲諷隨從，必須先攻擊嘲諷者。"}
              {pending && (
                <>
                  選擇「{pending.card.nameZh}」的目標
                  {pendingKind === "any" && "（任一隨從或敵方英雄）"}
                  {pendingKind === "anyMinion" && "（任一隨從）"}
                  {pendingKind === "enemyMinion" && "（一個敵方隨從，潛行者不可指定）"}
                  {pendingKind === "friendMinion" && "（一個友方隨從）"}
                </>
              )}
            </div>
          ) : null}

          <div className="hs-combat-lane relative">
        {/* 敵方戰場 */}
        <section>
          <div className="hs-board-row hs-board-row-enemy min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
            {game.eBoard.length === 0 && (
              <span className="hs-board-empty text-xs self-center px-2">山林試煉尚無隨從。</span>
            )}
            {game.eBoard.map((e) => {
              const targetable = enemyMinionTargetable(e);
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : ""].filter(Boolean).join("·");
              return (
                <button
                  key={e.key}
                  onClick={() => onEnemyMinion(e.key)}
                  disabled={!targetable}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}`}
                  className={`hs-token hs-token-enter w-[86px] md:w-[102px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${hitKeys.has(e.key) ? "hs-token-hit" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${targetable ? "hover:ring-2 hover:ring-rose-400 cursor-pointer" : ""}`}
                >
                  {floatsFor(e.key).map((f) => (
                    <span key={f.id} className="dmg-float" aria-hidden>
                      -{f.dmg}
                    </span>
                  ))}
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder">
                        {THEME_ZH[e.card.theme]}
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
          <div className="hs-board-row hs-board-row-player min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
            {game.pBoard.length === 0 && (
              <span className="hs-board-empty text-xs self-center px-2">
                尚無隨從，從手牌打出吧。
              </span>
            )}
            {game.pBoard.map((e) => {
              const ready = e.canAttack && game.phase === "player" && !game.winner && !pending;
              const spellTarget = friendMinionTargetable;
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : "", e.bonus ? "加成" : ""]
                .filter(Boolean)
                .join("·");
              return (
                <button
                  key={e.key}
                  onClick={() => onPlayerMinion(e.key)}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}`}
                  className={`hs-token hs-token-enter w-[86px] md:w-[102px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${hitKeys.has(e.key) ? "hs-token-hit" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${ready && selected !== e.key && !spellTarget ? "hs-ready-pulse" : ""}
                    ${selected === e.key ? "ring-2 ring-amber-400 -translate-y-1" : ""}
                    ${spellTarget ? "ring-2 ring-emerald-400 cursor-pointer" : ""}
                    ${ready || spellTarget ? "cursor-pointer hover:-translate-y-0.5" : e.stealth ? "" : "opacity-70"}`}
                >
                  {floatsFor(e.key).map((f) => (
                    <span key={f.id} className="dmg-float" aria-hidden>
                      -{f.dmg}
                    </span>
                  ))}
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder">
                        {THEME_ZH[e.card.theme]}
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

          <button
            onClick={endTurn}
            disabled={game.phase !== "player" || !!game.winner || !!pending || !!quiz}
            className="hs-end-turn hs-end-turn-big disabled:opacity-40"
          >
            {game.phase === "enemy" ? "系統行動中" : "結束回合 ▶"}
          </button>

          <button
            onClick={reset}
            className="hs-reset hs-reset-small"
          >
            重新開始
          </button>

          {/* 我方英雄 + 資源 */}
          <section className={`hs-portrait hs-portrait-player relative ${heroShake.player ? "hs-hero-shake" : ""}`}>
            {floatsFor("heroPlayer").map((f) => (
              <span key={f.id} className="dmg-float" aria-hidden>
                -{f.dmg}
              </span>
            ))}
            <span className="hs-portrait-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_ART.player} alt="織者頭像" />
            </span>
            <span className="hs-portrait-name">織者</span>
            <span className="hs-portrait-sub">答題命中 {rate}%</span>
            <span className="hs-portrait-hp">
              <span className="hs-hp-label">生命 HP</span>
              <span className="hs-hp-value">{game.playerHp}/{HERO_HP}</span>
            </span>
          </section>

          <div className="hs-resource-strip hs-resource-player" aria-label={`我方法力 ${game.pMana}/${game.pMaxMana}`}>
            <span className="hs-mana-label">我方法力</span>
            <span className="hs-mana-text">{game.pMana}/{game.pMaxMana}</span>
            <span className="hs-crystals" aria-hidden>
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className={i < game.pMana ? "hs-crystal is-filled" : i < game.pMaxMana ? "hs-crystal is-empty" : "hs-crystal"} />
              ))}
            </span>
          </div>

        {/* 手牌 */}
        <section className="hs-hand-zone">
          <h2 className="hs-hand-label text-[11px] uppercase tracking-wider text-amber-200/60 mb-1">
            手牌（牌庫剩 {game.pDeck.length}）
            {selected && !pending && (
              <span className="text-amber-300 ml-2">▶ 已選攻擊者，點敵方目標</span>
            )}
          </h2>
          <div className="hs-hand-rail flex gap-x-3 gap-y-4 pt-3 pb-3">
            {game.pHand.length === 0 && (
              <span className="text-slate-600 text-xs">手牌已空，結束回合抽牌。</span>
            )}
            {game.pHand.map((c, i) => {
              const playable =
                c.cost <= game.pMana && game.phase === "player" && !game.winner && !pending && !quiz;
              const art = CARD_ART[c.id];
              const learningText = CARD_LEARNING[c.id];
              return (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  title={`${c.nameZh}\n學習小註：${learningText}`}
                  className={`hs-card ${RARITY_GLOW[c.rarity]} w-[132px] md:w-[164px] xl:w-[178px] aspect-[5/7] shrink-0 text-left border-2 ${RARITY_COLOR[c.rarity]}
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
                        <span className="hs-art-placeholder hs-art-placeholder-card">
                          {THEME_ZH[c.theme]}
                        </span>
                      )}
                      <span className="hs-art-frame" aria-hidden />
                    </span>
                    {/* 文字欄：類型／稀有度、效果、答對加成 */}
                    <span className="flex-1 flex flex-col px-1.5 pt-3.5 pb-2 text-center">
                      <span className="flex items-center justify-center gap-1 text-[8px] tracking-[0.15em] text-amber-200/70">
                        {THEME_ZH[c.theme]} · {c.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[c.rarity]}
                      </span>
                      {c.effectText !== "—" && (
                        <span title={c.effectText} className="text-[9px] leading-tight text-slate-200 mt-0.5 line-clamp-1">
                          {c.effectText}
                        </span>
                      )}
                      <span title={c.bonusText} className="text-[9px] leading-tight text-amber-300/90 mt-0.5 line-clamp-1">
                        ★ {c.bonusText}
                      </span>
                      <span title={learningText} className="hs-card-learning line-clamp-2">
                        學｜{learningText}
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
          <aside className="play-log-panel">
            <h2 className="text-[11px] uppercase tracking-wider text-amber-200/60 mb-2">戰鬥紀錄</h2>
            <div className="space-y-1 text-xs">
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
          </aside>
        </div>
      </div>

      {/* 選擇對手（頭目）：不同牌組主題 = 不同手感；選擇即開新局 */}
      {showOpponents && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[65]">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-sky-400/25 p-5 sm:p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/60">選擇對手</p>
                <h3 className={`${notoSerifTC.className} text-xl font-bold text-sky-100`}>山林試煉的不同面貌</h3>
              </div>
              <button
                onClick={() => setShowOpponents(false)}
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                取消
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              每個對手偏重不同牌組，打起來手感各異。選擇會開始新的一局。難度（簡單／普通／困難）另外調整。
            </p>
            <div className="space-y-2">
              {OPPONENTS.map((o) => {
                const active = o.id === opponentId;
                return (
                  <button
                    key={o.id}
                    onClick={() => pickOpponent(o.id)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                      active ? "border-sky-400 bg-sky-950/50" : "border-slate-700 bg-slate-800/40 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{o.name}</span>
                      {active && (
                        <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] text-black">目前</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{o.tagline}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 新手引導：第一次進來的互動分步教學 */}
      {onboarding && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                新手引導 {onbStep + 1}/{ONB_STEPS.length}
              </p>
              <button onClick={finishOnboarding} className="text-xs text-slate-500 hover:text-slate-300 underline">
                略過
              </button>
            </div>

            <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100 mb-2`}>
              {ONB_STEPS[onbStep].title}
            </h3>

            <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-4 mb-3 min-h-[92px] flex items-center justify-center">
              <OnbArt k={ONB_STEPS[onbStep].k} />
            </div>

            <p className="text-sm text-slate-200 leading-relaxed mb-4 min-h-[3.5rem]">
              {ONB_STEPS[onbStep].body}
            </p>

            <div className="flex items-center justify-center gap-1.5 mb-4">
              {ONB_STEPS.map((s, i) => (
                <span
                  key={s.k}
                  className={`h-1.5 rounded-full transition-all ${
                    i === onbStep ? "w-5 bg-amber-400" : "w-1.5 bg-slate-600"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setOnbStep((s) => Math.max(0, s - 1))}
                disabled={onbStep === 0}
                className="rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30"
              >
                ◀ 上一步
              </button>
              {onbStep < ONB_STEPS.length - 1 ? (
                <button
                  onClick={() => setOnbStep((s) => Math.min(ONB_STEPS.length - 1, s + 1))}
                  className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
                >
                  下一步 ▶
                </button>
              ) : (
                <button
                  onClick={finishOnboarding}
                  className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
                >
                  開始試煉 ▶
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 開局換牌（mulligan）：新局開始、引導/規則關閉後彈出 */}
      {mulliganPhase && !showRules && !onboarding && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">開局換牌</p>
            <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100 mb-1`}>調整起手牌</h3>
            <p className="text-xs text-slate-400 mb-4">
              點選想換掉的牌（洗回牌庫、重抽等量），或直接保留全部開始。只有這一次機會。
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-5">
              {game.pHand.map((c, i) => {
                const marked = mulliganSel.has(i);
                const art = CARD_ART[c.id];
                return (
                  <button
                    key={`${c.id}-${i}`}
                    onClick={() => toggleMulligan(i)}
                    className={`relative w-[88px] aspect-[5/7] rounded-lg overflow-hidden border-2 transition ${
                      marked ? "border-rose-400 opacity-70" : "border-amber-400/40 hover:border-amber-300 hover:-translate-y-0.5"
                    }`}
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={c.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder">{THEME_ZH[c.theme]}</span>
                    )}
                    <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[10px] text-sky-200">{c.cost}</span>
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 py-0.5 text-center text-[10px]">
                      {c.nameZh}
                    </span>
                    {marked && (
                      <span className="absolute inset-0 grid place-items-center bg-rose-950/40 text-sm font-bold text-rose-200">
                        換
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">難度：{DIFF_ZH[difficulty]}</span>
              <button
                onClick={confirmMulligan}
                className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
              >
                {mulliganSel.size > 0 ? `換掉 ${mulliganSel.size} 張並開始 ▶` : "保留全部開始 ▶"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 開場規則說明（第一次自動彈，之後可從 header「規則」再開） */}
      {showRules && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">怎麼玩</p>
              <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100`}>
                山林試煉 · 規則說明
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                爐石式卡牌，但每張牌出手前要先答一題太魯閣族語 — 答對就更強。
              </p>
            </div>

            <ol className="space-y-3 text-sm text-slate-200">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">1</span>
                <span>
                  <span className="font-semibold text-amber-100">目標</span>：把「山林試煉」的生命打到 0，你就通過。你和對手都從 {HERO_HP} 點生命開始。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">2</span>
                <span>
                  <span className="font-semibold text-amber-100">出牌先答族語題</span>：每打一張牌會跳出一題族語選擇。
                  <span className="text-emerald-300">答對 → 觸發卡片的 ★加成（更強）</span>；
                  <span className="text-rose-300">答錯 → 以基礎效果打出</span>（還是能出牌）。揭曉後會自動播正確發音。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">3</span>
                <span>
                  <span className="font-semibold text-amber-100">法力</span>：每回合法力上限 +1（最多 10）。牌左上角的藍寶石是費用，法力不夠不能打。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">4</span>
                <span>
                  <span className="font-semibold text-amber-100">隨從與攻擊</span>：隨從有攻擊／生命，剛打出的隨從要「下一回合」才能攻擊。輪到你時，先點自己的隨從、再點敵方隨從或英雄發動攻擊。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">5</span>
                <span>
                  <span className="font-semibold text-amber-100">關鍵字</span>：
                  <span className="text-slate-100">嘲諷</span>＝敵方有嘲諷隨從時必須先打它；
                  <span className="text-slate-100">潛行</span>＝不能被指定攻擊；
                  <span className="text-amber-300">★加成</span>＝答對題目才會生效。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">6</span>
                <span>
                  <span className="font-semibold text-amber-100">回合</span>：出完牌點「結束回合」，換系統行動、再抽一張牌換你。戰場最多 {BOARD_MAX} 個隨從。
                </span>
              </li>
            </ol>

            <div className="flex justify-end mt-5">
              <button
                onClick={closeRules}
                className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
              >
                開始試煉 ▶
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="rounded-lg border border-amber-400/25 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100/90 mb-3">
              <span className="font-semibold text-amber-200">卡片學習小註：</span>
              {CARD_LEARNING[quiz.card.id]}
            </p>
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
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={game.winner === "player" ? HERO_ART.player : HERO_ART.enemy}
                alt={game.winner === "player" ? "通過山林試煉" : "山林試煉未過"}
                className="w-16 h-16 rounded-full object-cover border border-amber-300/50 shadow-lg"
              />
            </div>
            <h3
              className={`hs-result-title text-2xl font-bold mb-1 ${
                game.winner === "player" ? "text-amber-300" : "text-slate-300"
              }`}
            >
              {game.winner === "player" ? `通過${opponent.name}！` : `${opponent.name}未過`}
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              命中率 {rate}%（答對 {game.correct} · 答錯 {game.wrong}）
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs mb-4">
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">難度 {DIFF_ZH[difficulty]}</span>
              {game.winner === "player" && streak > 0 && (
                <span className="rounded bg-amber-900/60 px-2 py-1 text-amber-200">連勝 {streak}</span>
              )}
              {bestStreak > 0 && (
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-400">最佳連勝 {bestStreak}</span>
              )}
            </div>
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
