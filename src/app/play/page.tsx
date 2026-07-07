"use client";

import { useEffect, useState } from "react";
import { CARDS, Card, RARITY_COLOR, THEME_EMOJI } from "@/data/cards";
import { questionFor } from "@/data/questions";

// ───────────────────────── 型別 ─────────────────────────

type Minion = {
  key: string;
  card: Card;
  attack: number;
  health: number;
  maxHealth: number;
  canAttack: boolean;
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
  eBoard: Minion[];
  log: LogEntry[];
  correct: number;
  wrong: number;
  winner: "player" | "enemy" | null;
};

const HERO_HP = 30;
const BOARD_MAX = 7;

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
  return [{ key: uid(), text, tone }, ...log].slice(0, 10);
}

const firstNum = (s: string): number => {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
};

// 依 trukuBonus 文字推算隨從加成數值
function minionBonus(card: Card, isCorrect: boolean): { atk: number; hp: number } {
  if (!isCorrect) return { atk: 0, hp: 0 };
  const b = card.trukuBonus;
  let atk = 0;
  let hp = 0;
  if (b.includes("+2/")) atk = 2;
  else if (b.includes("+1/")) atk = 1;
  if (b.includes("/+2")) hp = 2;
  else if (b.includes("/+1")) hp = 1;
  return { atk, hp };
}

const hasCharge = (card: Card, isCorrect: boolean) =>
  isCorrect && card.trukuBonus.includes("衝鋒");

// ───────────────────────── 初始化 ─────────────────────────

function newGame(): Game {
  const p = shuffle(CARDS);
  const e = shuffle(CARDS);
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
    eDeck: e,
    eBoard: [],
    log: pushLog([], "山林試煉開始，織者出發。", "info"),
    correct: 0,
    wrong: 0,
    winner: null,
  };
}

// ───────────────────────── 玩家出牌 ─────────────────────────

function playCard(g: Game, card: Card, isCorrect: boolean): Game {
  let ng: Game = { ...g };
  const idx = ng.pHand.findIndex((c) => c.id === card.id);
  if (idx === -1 || card.cost > ng.pMana) return g;

  ng.pHand = ng.pHand.filter((_, i) => i !== idx);
  ng.pMana = ng.pMana - card.cost;
  if (isCorrect) ng.correct += 1;
  else ng.wrong += 1;

  if (card.type === "minion") {
    const bonus = minionBonus(card, isCorrect);
    const atk = (card.attack ?? 0) + bonus.atk;
    const hp = (card.health ?? 0) + bonus.hp;
    if (ng.pBoard.length < BOARD_MAX) {
      ng.pBoard = [
        ...ng.pBoard,
        {
          key: uid(),
          card,
          attack: atk,
          health: hp,
          maxHealth: hp,
          canAttack: hasCharge(card, isCorrect),
          bonus: isCorrect,
        },
      ];
    }
    ng.log = pushLog(
      ng.log,
      isCorrect
        ? `✅ ${card.nameZh}：答對！加成「${card.trukuBonus}」（${atk}/${hp}）`
        : `❌ ${card.nameZh}：答錯，基礎打出（${card.attack}/${card.health}）`,
      isCorrect ? "good" : "bad",
    );
  } else {
    ng = applySpell(ng, card, isCorrect);
  }

  return checkWinner(ng);
}

// 簡化版法術結算（防呆，永不 crash）
function applySpell(g: Game, card: Card, isCorrect: boolean): Game {
  const ng: Game = { ...g };
  const base = card.baseEffect;
  const src = isCorrect ? `${base}；${card.trukuBonus}` : base;
  let note = "";

  // 傷害
  if (base.includes("傷害")) {
    let dmg = firstNum(base);
    if (isCorrect && /改為 ?\d+ ?傷害/.test(card.trukuBonus))
      dmg = firstNum(card.trukuBonus);
    if (base.includes("所有敵方")) {
      ng.eBoard = ng.eBoard
        .map((m) => ({ ...m, health: m.health - dmg }))
        .filter((m) => m.health > 0);
      note = `對所有山林試煉隨從造成 ${dmg} 傷害`;
    } else if (base.includes("敵方隨從") && ng.eBoard.length > 0) {
      const t = ng.eBoard[0];
      ng.eBoard = ng.eBoard
        .map((m, i) => (i === 0 ? { ...m, health: m.health - dmg } : m))
        .filter((m) => m.health > 0);
      note = `對「${t.card.nameZh}」造成 ${dmg} 傷害`;
    } else {
      ng.enemyHp = Math.max(0, ng.enemyHp - dmg);
      note = `對山林試煉造成 ${dmg} 傷害`;
    }
  }

  // 回復英雄
  if (base.includes("回復英雄")) {
    let heal = firstNum(base);
    if (isCorrect && card.trukuBonus.includes("回復")) heal += firstNum(card.trukuBonus);
    ng.playerHp = Math.min(HERO_HP, ng.playerHp + heal);
    note = note ? `${note}；回復 ${heal}` : `回復英雄 ${heal} 點`;
  }

  // 友軍增益（套用全體）
  if (src.includes("友軍") && src.includes("+")) {
    const use = isCorrect ? card.trukuBonus : base;
    const m = use.match(/\+(\d+)\/\+?(\d+)/);
    const da = m ? parseInt(m[1], 10) : firstNum(use.split("/")[0] || "0");
    const dh = m ? parseInt(m[2], 10) : 0;
    if (da || dh) {
      ng.pBoard = ng.pBoard.map((mi) => ({
        ...mi,
        attack: mi.attack + da,
        health: mi.health + dh,
        maxHealth: mi.maxHealth + dh,
      }));
      note = note ? `${note}；友軍 +${da}/+${dh}` : `友軍全體 +${da}/+${dh}`;
    }
  }

  // 抽牌
  if (src.includes("抽") && ng.pDeck.length > 0) {
    const [top, ...rest] = ng.pDeck;
    ng.pHand = [...ng.pHand, top];
    ng.pDeck = rest;
    note = note ? `${note}；抽 1 張` : "抽 1 張牌";
  }

  ng.log = pushLog(
    ng.log,
    isCorrect
      ? `✅ ${card.nameZh}：答對！${note || card.trukuBonus}`
      : `❌ ${card.nameZh}：答錯，基礎施放（${note || base}）`,
    isCorrect ? "good" : "bad",
  );
  return ng;
}

// ───────────────────────── 攻擊結算 ─────────────────────────

function resolveAttack(
  g: Game,
  attackerKey: string,
  target: { type: "hero" } | { type: "minion"; key: string },
): Game {
  const ng: Game = { ...g };
  const attacker = ng.pBoard.find((m) => m.key === attackerKey);
  if (!attacker || !attacker.canAttack) return g;

  if (target.type === "hero") {
    ng.enemyHp = Math.max(0, ng.enemyHp - attacker.attack);
    ng.pBoard = ng.pBoard.map((m) =>
      m.key === attackerKey ? { ...m, canAttack: false } : m,
    );
    ng.log = pushLog(ng.log, `⚔ ${attacker.card.nameZh} 攻擊山林試煉 ${attacker.attack} 點`, "info");
  } else {
    const t = ng.eBoard.find((m) => m.key === target.key);
    if (!t) return g;
    const aHp = attacker.health - t.attack;
    const tHp = t.health - attacker.attack;
    ng.pBoard = ng.pBoard
      .map((m) => (m.key === attackerKey ? { ...m, health: aHp, canAttack: false } : m))
      .filter((m) => m.health > 0);
    ng.eBoard = ng.eBoard
      .map((m) => (m.key === target.key ? { ...m, health: tHp } : m))
      .filter((m) => m.health > 0);
    ng.log = pushLog(
      ng.log,
      `⚔ ${attacker.card.nameZh}（${attacker.attack}/${aHp}）換 ${t.card.nameZh}（${t.attack}/${tHp}）`,
      "info",
    );
  }
  return checkWinner(ng);
}

// ───────────────────────── 系統（AI）回合 ─────────────────────────

function runEnemyTurn(g: Game): Game {
  let ng: Game = { ...g };
  ng.eMaxMana = Math.min(ng.eMaxMana + 1, 10);
  let mana = ng.eMaxMana;

  // 既有隨從解除失調
  ng.eBoard = ng.eBoard.map((m) => ({ ...m, canAttack: true }));

  // 出牌：從牌庫挑出得起、費用最高的隨從
  const deck = [...ng.eDeck];
  let played = true;
  while (played && ng.eBoard.length < BOARD_MAX) {
    played = false;
    const affordable = deck
      .map((c, i) => ({ c, i }))
      .filter((x) => x.c.type === "minion" && x.c.cost <= mana)
      .sort((a, b) => b.c.cost - a.c.cost);
    if (affordable.length > 0) {
      const { c, i } = affordable[0];
      deck.splice(i, 1);
      mana -= c.cost;
      ng.eBoard = [
        ...ng.eBoard,
        {
          key: uid(),
          card: c,
          attack: c.attack ?? 0,
          health: c.health ?? 0,
          maxHealth: c.health ?? 0,
          canAttack: false,
          bonus: false,
        },
      ];
      ng.log = pushLog(ng.log, `🏔 山林試煉派出「${c.nameZh}」（${c.attack}/${c.health}）`, "sys");
      played = true;
    }
  }
  ng.eDeck = deck;

  // 攻擊：威脅大的玩家隨從優先換血，否則打臉
  const attackers = ng.eBoard.filter((m) => m.canAttack);
  for (const atk of attackers) {
    if (ng.winner) break;
    const cur = ng.eBoard.find((m) => m.key === atk.key);
    if (!cur || !cur.canAttack) continue;

    const threats = [...ng.pBoard].sort((a, b) => b.attack - a.attack);
    const threat = threats.find((t) => t.attack >= 3);
    if (threat) {
      const aHp = cur.health - threat.attack;
      const tHp = threat.health - cur.attack;
      ng.eBoard = ng.eBoard
        .map((m) => (m.key === cur.key ? { ...m, health: aHp, canAttack: false } : m))
        .filter((m) => m.health > 0);
      ng.pBoard = ng.pBoard
        .map((m) => (m.key === threat.key ? { ...m, health: tHp } : m))
        .filter((m) => m.health > 0);
      ng.log = pushLog(
        ng.log,
        `🗡 ${cur.card.nameZh}（${cur.attack}/${aHp}）換 ${threat.card.nameZh}（${threat.attack}/${tHp}）`,
        "sys",
      );
    } else {
      ng.playerHp = Math.max(0, ng.playerHp - cur.attack);
      ng.eBoard = ng.eBoard.map((m) =>
        m.key === cur.key ? { ...m, canAttack: false } : m,
      );
      ng.log = pushLog(ng.log, `🗡 ${cur.card.nameZh} 攻擊織者 ${cur.attack} 點`, "sys");
    }
    ng = checkWinner(ng);
  }
  return ng;
}

function startPlayerTurn(g: Game): Game {
  const ng: Game = { ...g };
  ng.turn += 1;
  ng.phase = "player";
  ng.pMaxMana = Math.min(ng.pMaxMana + 1, 10);
  ng.pMana = ng.pMaxMana;
  ng.pBoard = ng.pBoard.map((m) => ({ ...m, canAttack: true }));
  if (ng.pDeck.length > 0) {
    const [top, ...rest] = ng.pDeck;
    ng.pHand = [...ng.pHand, top];
    ng.pDeck = rest;
  }
  ng.log = pushLog(ng.log, `── 第 ${ng.turn} 回合 ──`, "info");
  return ng;
}

function checkWinner(g: Game): Game {
  if (g.enemyHp <= 0) return { ...g, winner: "player", phase: "over" };
  if (g.playerHp <= 0) return { ...g, winner: "enemy", phase: "over" };
  return g;
}

// ───────────────────────── 元件 ─────────────────────────

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  const [game, setGame] = useState<Game>(() => newGame());
  const [quizCard, setQuizCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    setGame(newGame());
  }, []);

  function reset() {
    setQuizCard(null);
    setRevealed(null);
    setSelected(null);
    setGame(newGame());
  }

  function tryPlay(card: Card) {
    if (game.phase !== "player" || game.winner) return;
    if (card.cost > game.pMana) return;
    setSelected(null);
    setRevealed(null);
    setQuizCard(card);
  }

  function answer(idx: number) {
    if (!quizCard) return;
    const q = questionFor(quizCard.id);
    const isCorrect = q ? idx === q.answer : false;
    setRevealed(idx);
    const card = quizCard;
    setTimeout(() => {
      setGame((g) => playCard(g, card, isCorrect));
      setQuizCard(null);
      setRevealed(null);
    }, 850);
  }

  function onPlayerMinion(key: string) {
    if (game.phase !== "player" || game.winner) return;
    const m = game.pBoard.find((x) => x.key === key);
    if (!m || !m.canAttack) return;
    setSelected((s) => (s === key ? null : key));
  }

  function onEnemyMinion(key: string) {
    if (!selected || game.phase !== "player") return;
    setGame((g) => resolveAttack(g, selected, { type: "minion", key }));
    setSelected(null);
  }

  function onEnemyHero() {
    if (!selected || game.phase !== "player") return;
    setGame((g) => resolveAttack(g, selected, { type: "hero" }));
    setSelected(null);
  }

  function endTurn() {
    if (game.phase !== "player" || game.winner) return;
    setSelected(null);
    setGame((g) => ({ ...g, phase: "enemy" }));
    setTimeout(() => {
      setGame((g) => {
        if (g.winner) return g;
        const afterEnemy = runEnemyTurn(g);
        if (afterEnemy.winner) return afterEnemy;
        return startPlayerTurn(afterEnemy);
      });
    }, 700);
  }

  const q = quizCard ? questionFor(quizCard.id) : undefined;
  const total = game.correct + game.wrong;
  const rate = total === 0 ? 0 : Math.round((game.correct / total) * 100);

  if (!mounted) return <main className="min-h-screen bg-slate-950" />;

  const enemyTargetable = selected !== null && game.phase === "player";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 p-3 sm:p-5">
      <div className="max-w-5xl mx-auto">
        {/* 標題列 */}
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Enzo · 山林試煉（vs 系統）</h1>
            <p className="text-[11px] text-slate-400">
              出牌答對太魯閣族語題觸發加成。示範題庫為佔位資料，正式族語內容待語言部填入。
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
            disabled={!enemyTargetable}
            className={`w-full flex items-center justify-between rounded-xl border px-3 py-2 transition
              ${enemyTargetable ? "border-rose-400 bg-rose-950/40 hover:bg-rose-900/50 cursor-pointer" : "border-slate-800 bg-slate-900/50"}`}
          >
            <span className="text-sm font-semibold">🏔 山林試煉（系統）</span>
            <span className="text-rose-300 font-bold">❤ {game.enemyHp}/{HERO_HP}</span>
          </button>
        </section>

        {/* 敵方戰場 */}
        <section className="mb-2">
          <div className="min-h-24 rounded-xl border border-rose-900/40 bg-rose-950/10 p-2 flex flex-wrap gap-2">
            {game.eBoard.length === 0 && (
              <span className="text-slate-600 text-xs self-center px-2">山林試煉尚無隨從。</span>
            )}
            {game.eBoard.map((e) => (
              <button
                key={e.key}
                onClick={() => onEnemyMinion(e.key)}
                disabled={!enemyTargetable}
                className={`w-20 rounded-lg border-2 ${RARITY_COLOR[e.card.rarity]} bg-slate-800 p-1.5 text-center transition
                  ${enemyTargetable ? "hover:ring-2 hover:ring-rose-400 cursor-pointer" : ""}`}
              >
                <div className="text-base">{THEME_EMOJI[e.card.theme]}</div>
                <div className="text-[10px] font-semibold truncate">{e.card.nameZh}</div>
                <div className="flex justify-between text-[11px] mt-0.5">
                  <span className="text-amber-300">⚔{e.attack}</span>
                  <span className="text-rose-300">❤{e.health}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* 我方戰場 */}
        <section className="mb-2">
          <div className="min-h-24 rounded-xl border border-sky-900/40 bg-sky-950/10 p-2 flex flex-wrap gap-2">
            {game.pBoard.length === 0 && (
              <span className="text-slate-600 text-xs self-center px-2">
                尚無隨從，從手牌打出吧。
              </span>
            )}
            {game.pBoard.map((e) => {
              const ready = e.canAttack && game.phase === "player" && !game.winner;
              return (
                <button
                  key={e.key}
                  onClick={() => onPlayerMinion(e.key)}
                  className={`w-20 rounded-lg border-2 ${RARITY_COLOR[e.card.rarity]} bg-slate-800 p-1.5 text-center relative transition
                    ${selected === e.key ? "ring-2 ring-amber-400 -translate-y-1" : ""}
                    ${ready ? "cursor-pointer hover:-translate-y-0.5" : "opacity-70"}`}
                >
                  {e.bonus && (
                    <span className="absolute -top-2 -right-1 text-[9px] bg-amber-500 text-black rounded-full px-1">
                      加成
                    </span>
                  )}
                  {ready && (
                    <span className="absolute -top-2 -left-1 text-[9px] bg-emerald-500 text-black rounded-full px-1">
                      可攻
                    </span>
                  )}
                  <div className="text-base">{THEME_EMOJI[e.card.theme]}</div>
                  <div className="text-[10px] font-semibold truncate">{e.card.nameZh}</div>
                  <div className="flex justify-between text-[11px] mt-0.5">
                    <span className="text-amber-300">⚔{e.attack}</span>
                    <span className="text-rose-300">❤{e.health}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 我方英雄 + 控制 */}
        <section className="mb-2 flex items-center justify-between rounded-xl border border-sky-400/40 bg-sky-950/30 px-3 py-2">
          <span className="text-sm font-semibold">🧑 織者（你）</span>
          <div className="flex items-center gap-3">
            <span className="text-sky-300 font-bold">❤ {game.playerHp}/{HERO_HP}</span>
            <button
              onClick={endTurn}
              disabled={game.phase !== "player" || !!game.winner}
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
            {selected && <span className="text-amber-300 ml-2">▶ 已選攻擊者，點敵方目標</span>}
          </h2>
          <div className="flex flex-wrap gap-2">
            {game.pHand.length === 0 && (
              <span className="text-slate-600 text-xs">手牌已空，結束回合抽牌。</span>
            )}
            {game.pHand.map((c, i) => {
              const playable =
                c.cost <= game.pMana && game.phase === "player" && !game.winner;
              return (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  className={`w-28 text-left rounded-xl border-2 ${RARITY_COLOR[c.rarity]} p-2 transition
                    ${playable ? "bg-slate-800 hover:-translate-y-1 hover:bg-slate-700" : "bg-slate-900 opacity-40 cursor-not-allowed"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sky-300 font-bold text-sm">💎{c.cost}</span>
                    <span className="text-base">{THEME_EMOJI[c.theme]}</span>
                  </div>
                  <div className="font-semibold text-xs mt-1 truncate">{c.nameZh}</div>
                  <div className="text-[9px] text-slate-400">
                    {c.type === "minion" ? "隨從" : "法術"} · {"⭐".repeat(c.difficulty)}
                  </div>
                  {c.type === "minion" ? (
                    <div className="flex justify-between text-[11px] mt-1">
                      <span className="text-amber-300">⚔{c.attack}</span>
                      <span className="text-rose-300">❤{c.health}</span>
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-300 mt-1 line-clamp-2">
                      {c.baseEffect}
                    </div>
                  )}
                  <div className="text-[9px] text-amber-300/80 mt-1 line-clamp-2">
                    ★ {c.trukuBonus}
                  </div>
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

      {/* 答題彈窗 */}
      {quizCard && q && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 p-5">
            <div className="text-xs text-slate-400 mb-1">
              打出「{quizCard.nameZh}」— 答對觸發加成「{quizCard.trukuBonus}」
            </div>
            <h3 className="text-lg font-bold mb-4">{q.prompt}</h3>
            <div className="grid gap-2">
              {q.options.map((opt, idx) => {
                let cls = "bg-slate-800 hover:bg-slate-700";
                if (revealed !== null) {
                  if (idx === q.answer) cls = "bg-emerald-700";
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
              <p className="text-xs text-slate-300 mt-3">
                {revealed === q.answer ? "✅ 答對！" : "❌ 答錯。"} {q.explanation}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 勝敗彈窗 */}
      {game.winner && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center">
            <div className="text-4xl mb-2">{game.winner === "player" ? "🏔️" : "🌧️"}</div>
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
