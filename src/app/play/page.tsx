"use client";

import { useEffect, useMemo, useState } from "react";
import { CARDS, Card, RARITY_COLOR, THEME_EMOJI } from "@/data/cards";
import { questionFor } from "@/data/questions";

type BoardEntry = {
  key: string;
  card: Card;
  attack: number;
  health: number;
  bonus: boolean;
};

type LogEntry = { key: string; text: string; good: boolean };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  const [deck, setDeck] = useState<Card[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [board, setBoard] = useState<BoardEntry[]>([]);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [turn, setTurn] = useState(1);
  const [maxMana, setMaxMana] = useState(1);
  const [mana, setMana] = useState(1);
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [quizCard, setQuizCard] = useState<Card | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);

  function reset() {
    const shuffled = shuffle(CARDS);
    setHand(shuffled.slice(0, 4));
    setDeck(shuffled.slice(4));
    setBoard([]);
    setLog([]);
    setTurn(1);
    setMaxMana(1);
    setMana(1);
    setCorrect(0);
    setWrong(0);
    setQuizCard(null);
    setRevealed(null);
  }

  useEffect(() => {
    setMounted(true);
    reset();
  }, []);

  const uid = () => Math.random().toString(36).slice(2);

  function endTurn() {
    const nextMax = Math.min(maxMana + 1, 10);
    setTurn((t) => t + 1);
    setMaxMana(nextMax);
    setMana(nextMax);
    setDeck((d) => {
      if (d.length === 0) return d;
      const [top, ...rest] = d;
      setHand((h) => [...h, top]);
      return rest;
    });
  }

  function tryPlay(card: Card) {
    if (card.cost > mana) return;
    setRevealed(null);
    setQuizCard(card);
  }

  function answer(idx: number) {
    if (!quizCard) return;
    const q = questionFor(quizCard.id);
    const isCorrect = q ? idx === q.answer : false;
    setRevealed(idx);

    // 結算：延遲一下讓玩家看到正解回饋
    setTimeout(() => {
      const card = quizCard;
      setMana((m) => m - card.cost);
      setHand((h) => {
        const i = h.findIndex((c) => c.id === card.id);
        if (i === -1) return h;
        const copy = [...h];
        copy.splice(i, 1);
        return copy;
      });

      if (card.type === "minion") {
        const bonusAtk = isCorrect && card.trukuBonus.includes("+1/") ? 1 : 0;
        const bonusHp =
          isCorrect && (card.trukuBonus.includes("/+1") || card.trukuBonus.includes("/+2"))
            ? card.trukuBonus.includes("/+2")
              ? 2
              : 1
            : 0;
        const bonusAtk2 = isCorrect && card.trukuBonus.includes("+2/") ? 2 : bonusAtk;
        setBoard((b) => [
          ...b,
          {
            key: uid(),
            card,
            attack: (card.attack ?? 0) + bonusAtk2,
            health: (card.health ?? 0) + bonusHp,
            bonus: isCorrect,
          },
        ]);
      }

      setLog((l) =>
        [
          {
            key: uid(),
            good: isCorrect,
            text: isCorrect
              ? `✅ ${card.nameZh}：答對！觸發族語加成「${card.trukuBonus}」`
              : `❌ ${card.nameZh}：答錯，以基礎數值打出（${card.baseEffect}）`,
          },
          ...l,
        ].slice(0, 8),
      );

      if (isCorrect) setCorrect((c) => c + 1);
      else setWrong((w) => w + 1);

      setQuizCard(null);
      setRevealed(null);
    }, 850);
  }

  const total = correct + wrong;
  const rate = total === 0 ? 0 : Math.round((correct / total) * 100);
  const q = useMemo(() => (quizCard ? questionFor(quizCard.id) : undefined), [quizCard]);

  if (!mounted) {
    return <main className="min-h-screen bg-slate-950" />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 text-slate-100 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <header className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-bold">Enzo · 練習模式</h1>
            <p className="text-xs text-slate-400">
              出牌時答對太魯閣族語題可觸發加成。示範題庫為佔位資料，正式族語內容待語言部填入。
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="rounded bg-slate-800 px-3 py-1">回合 {turn}</span>
            <span className="rounded bg-sky-900/60 px-3 py-1">
              法力 {mana}/{maxMana}
            </span>
            <span className="rounded bg-emerald-900/60 px-3 py-1">
              答對 {correct} · 答錯 {wrong} · 命中 {rate}%
            </span>
          </div>
        </header>

        {/* 戰場 */}
        <section className="mb-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">戰場（隨從）</h2>
          <div className="min-h-28 rounded-xl border border-slate-800 bg-slate-900/50 p-3 flex flex-wrap gap-2">
            {board.length === 0 && (
              <span className="text-slate-600 text-sm self-center">尚無隨從，從手牌打出吧。</span>
            )}
            {board.map((e) => (
              <div
                key={e.key}
                className={`w-24 rounded-lg border-2 ${RARITY_COLOR[e.card.rarity]} bg-slate-800 p-2 text-center relative`}
              >
                {e.bonus && (
                  <span className="absolute -top-2 -right-2 text-[10px] bg-amber-500 text-black rounded-full px-1">
                    加成
                  </span>
                )}
                <div className="text-lg">{THEME_EMOJI[e.card.theme]}</div>
                <div className="text-xs font-semibold truncate">{e.card.nameZh}</div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-amber-300">⚔{e.attack}</span>
                  <span className="text-rose-300">❤{e.health}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 紀錄 */}
        <section className="mb-4">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 mb-2">出牌紀錄</h2>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 min-h-16 space-y-1 text-sm">
            {log.length === 0 && <span className="text-slate-600">（尚無）</span>}
            {log.map((l) => (
              <div key={l.key} className={l.good ? "text-emerald-300" : "text-rose-300"}>
                {l.text}
              </div>
            ))}
          </div>
        </section>

        {/* 手牌 */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs uppercase tracking-wider text-slate-500">
              手牌（牌庫剩 {deck.length}）
            </h2>
            <div className="flex gap-2">
              <button
                onClick={endTurn}
                className="rounded bg-sky-600 hover:bg-sky-500 px-3 py-1 text-sm font-medium"
              >
                結束回合 ▶
              </button>
              <button
                onClick={reset}
                className="rounded bg-slate-700 hover:bg-slate-600 px-3 py-1 text-sm"
              >
                重新開始
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {hand.length === 0 && (
              <span className="text-slate-600 text-sm">手牌已空，結束回合抽牌。</span>
            )}
            {hand.map((c, i) => {
              const playable = c.cost <= mana;
              return (
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => tryPlay(c)}
                  disabled={!playable}
                  className={`w-32 text-left rounded-xl border-2 ${RARITY_COLOR[c.rarity]} p-2 transition
                    ${playable ? "bg-slate-800 hover:-translate-y-1 hover:bg-slate-700" : "bg-slate-900 opacity-40 cursor-not-allowed"}`}
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sky-300 font-bold text-sm">💎{c.cost}</span>
                    <span className="text-lg">{THEME_EMOJI[c.theme]}</span>
                  </div>
                  <div className="font-semibold text-sm mt-1 truncate">{c.nameZh}</div>
                  <div className="text-[10px] text-slate-400">
                    {c.type === "minion" ? "隨從" : "法術"} · 難度 {"⭐".repeat(c.difficulty)}
                  </div>
                  {c.type === "minion" ? (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-amber-300">⚔{c.attack}</span>
                      <span className="text-rose-300">❤{c.health}</span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-300 mt-1 line-clamp-2">{c.baseEffect}</div>
                  )}
                  <div className="text-[10px] text-amber-300/80 mt-1 line-clamp-2">
                    ★ {c.trukuBonus}
                  </div>
                </button>
              );
            })}
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
    </main>
  );
}
