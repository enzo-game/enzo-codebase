"use client";

import Link from "next/link";
import { Noto_Serif_TC } from "next/font/google";
import { useEffect, useState } from "react";
import type { JSX } from "react";
import { CARD_LEARNING, Card, RARITY_COLOR, Rarity, Theme } from "@/data/cards";
import { audioUrl } from "@/data/truku";
import AmbientAudio from "@/components/AmbientAudio";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxArrive, sfxLose } from "@/lib/sfx";
import {
  Game,
  Minion,
  QuizState,
  Target,
  TargetKind,
  HERO_HP,
  BOARD_MAX,
  attackTargets,
  checkWinner,
  endOfTurnEffects,
  hasValidTarget,
  makeQuiz,
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
    <main className="play-page min-h-screen text-slate-100 p-3 sm:p-5">
      <AmbientAudio />
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
            <span className="rounded bg-slate-800 px-2 py-1">回合 {game.turn}</span>
            <span className="rounded bg-sky-900/60 px-2 py-1">
              法力 {game.pMana}/{game.pMaxMana}
            </span>
            <span className="rounded bg-emerald-900/60 px-2 py-1">命中 {rate}%</span>
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
            className={`hs-portrait hs-portrait-enemy transition ${enemyHeroTargetable ? "hs-hero-targetable cursor-pointer" : ""}`}
          >
            <span className="hs-portrait-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_ART.enemy} alt="山林試煉頭像" />
            </span>
            <span className="hs-portrait-name">山林試煉</span>
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
          <section className="hs-portrait hs-portrait-player">
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
                  className={`hs-card ${RARITY_GLOW[c.rarity]} w-[112px] sm:w-[132px] aspect-[5/7] shrink-0 text-left border-2 ${RARITY_COLOR[c.rarity]}
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
