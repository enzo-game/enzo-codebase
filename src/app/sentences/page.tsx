"use client";

// 句子練習 /sentences —— 中文句意 → 重組太魯閣語詞序，練習＋認識句子（非牌局）。
// 資料來源：原住民族語E樂園（原民會）「句法演練」，經 scripts/fetch-truku-sentences.mjs
// 靜態抓取為 src/data/truku-sentences.json，2024 句、4 難度 × 12 句法類別。
// 玩法：給中文句意，把打散的太魯閣語詞卡依序點回正確語序；答完（對或錯）都會
// 攤開逐字對照表，讓玩家不只是背答案，還能看懂句子怎麼組成的。

import Link from "next/link";
import { useMemo, useState } from "react";
import { Noto_Serif_TC } from "next/font/google";
import {
  LEVELS,
  SENTENCES,
  levelLabel,
  typeLabel,
  shuffle,
  pickSentences,
  type SentenceEntry,
} from "@/data/truku-sentences";

const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

const BATCH_SIZE = 10;

function playAudio(url: string) {
  try {
    new Audio(url).play().catch(() => {});
  } catch {
    // 音檔失敗不阻斷流程
  }
}

type Tile = { key: string; token: string };

function makePool(entry: SentenceEntry): Tile[] {
  return shuffle(entry.words.map((w, i) => ({ key: `${entry.id}-${i}`, token: w.token })));
}

export default function SentencesPage() {
  const [level, setLevel] = useState<number | null>(null);
  const [seenIds, setSeenIds] = useState<Set<number>>(new Set());
  const [queue, setQueue] = useState<SentenceEntry[]>(() => pickSentences(BATCH_SIZE, null, new Set()));
  const [index, setIndex] = useState(0);
  const [pool, setPool] = useState<Tile[]>(() => makePool(queue[0]));
  const [answer, setAnswer] = useState<Tile[]>([]);
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState<number>(0);
  const [wrong, setWrong] = useState<number>(0);

  const current = queue[index];

  const isCorrect = useMemo(() => {
    if (!checked) return null;
    const given = answer.map((t) => t.token).join(" ");
    return given === current.truku;
  }, [checked, answer, current]);

  function startBatch(nextLevel: number | null) {
    const fresh = pickSentences(BATCH_SIZE, nextLevel, seenIds);
    setLevel(nextLevel);
    setQueue(fresh);
    setIndex(0);
    setPool(makePool(fresh[0]));
    setAnswer([]);
    setChecked(false);
  }

  function placeTile(tile: Tile) {
    if (checked) return;
    setPool((p) => p.filter((t) => t.key !== tile.key));
    setAnswer((a) => [...a, tile]);
  }

  function unplaceTile(tile: Tile) {
    if (checked) return;
    setAnswer((a) => a.filter((t) => t.key !== tile.key));
    setPool((p) => [...p, tile]);
  }

  function submit() {
    if (checked || answer.length === 0) return;
    const given = answer.map((t) => t.token).join(" ");
    const ok = given === current.truku;
    setChecked(true);
    if (ok) setCorrect((c) => c + 1);
    else setWrong((w) => w + 1);
  }

  function resetAnswer() {
    if (checked) return;
    setPool(makePool(current));
    setAnswer([]);
  }

  function next() {
    setSeenIds((s) => new Set(s).add(current.id));
    const nextIndex = index + 1;
    if (nextIndex < queue.length) {
      setIndex(nextIndex);
      setPool(makePool(queue[nextIndex]));
      setAnswer([]);
      setChecked(false);
      return;
    }
    // 這批練完了，抽下一批（排除本次 session 已練過的句子）
    const nextSeen = new Set(seenIds).add(current.id);
    const fresh = pickSentences(BATCH_SIZE, level, nextSeen);
    setSeenIds(nextSeen);
    setQueue(fresh);
    setIndex(0);
    setPool(makePool(fresh[0]));
    setAnswer([]);
    setChecked(false);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`${notoSerifTC.className} text-2xl font-bold text-amber-100`}>句子練習</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            看中文句意，把打散的太魯閣語詞卡點回正確順序 · 全站共 {SENTENCES.length} 句
          </p>
        </div>
        <Link
          href="/"
          className="rounded-full border border-slate-600/60 px-4 py-1.5 text-sm text-slate-300 transition hover:border-slate-400/70"
        >
          ← 回首頁
        </Link>
      </header>

      {/* 難度選擇 */}
      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-slate-500">難度</span>
        <button
          onClick={() => startBatch(null)}
          className={`rounded-full border px-3 py-1 text-xs transition ${
            level === null
              ? "border-amber-300/80 bg-amber-400/15 text-amber-100"
              : "border-slate-600/60 bg-slate-800/40 text-slate-300 hover:border-slate-400/70"
          }`}
        >
          全部
        </button>
        {LEVELS.map((l) => (
          <button
            key={l.id}
            onClick={() => startBatch(l.id)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              level === l.id
                ? "border-amber-300/80 bg-amber-400/15 text-amber-100"
                : "border-slate-600/60 bg-slate-800/40 text-slate-300 hover:border-slate-400/70"
            }`}
          >
            {l.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-400">
          答對 {correct} · 待加強 {wrong}
        </span>
      </div>

      {/* 練習卡 */}
      <section className="mt-5 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-5">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.15em] text-amber-200/70">
          <span>
            {levelLabel(current.level)} · {typeLabel(current.type)}
          </span>
          <span>
            第 {index + 1} / {queue.length} 句
          </span>
        </div>

        <p className={`${notoSerifTC.className} mt-3 text-center text-xl font-bold text-slate-50`}>
          {current.chinese}
        </p>

        {/* 作答區：已放入的詞卡，依序排列，可點掉退回 */}
        <div className="mt-5 flex min-h-[56px] flex-wrap items-center justify-center gap-2 rounded-xl border border-dashed border-slate-600/50 bg-slate-950/40 p-3">
          {answer.length === 0 && <span className="text-sm text-slate-500">點下方詞卡，依序組成太魯閣語句子</span>}
          {answer.map((t) => (
            <button
              key={t.key}
              onClick={() => unplaceTile(t)}
              disabled={checked}
              className="rounded-lg border border-amber-400/50 bg-amber-950/30 px-3 py-1.5 text-sm font-medium text-amber-100 transition hover:bg-amber-900/40 disabled:cursor-default"
            >
              {t.token}
            </button>
          ))}
        </div>

        {/* 詞卡池 */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {pool.map((t) => (
            <button
              key={t.key}
              onClick={() => placeTile(t)}
              disabled={checked}
              className="rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-1.5 text-sm text-slate-100 transition hover:border-slate-400/70 hover:bg-slate-700/60 disabled:cursor-default disabled:opacity-40"
            >
              {t.token}
            </button>
          ))}
        </div>

        {/* 動作列 */}
        <div className="mt-4 flex items-center justify-center gap-3">
          {!checked ? (
            <>
              <button
                onClick={resetAnswer}
                disabled={answer.length === 0}
                className="rounded-full border border-slate-600/60 px-4 py-1.5 text-sm text-slate-300 transition hover:border-slate-400/70 disabled:opacity-30"
              >
                清空重排
              </button>
              <button
                onClick={submit}
                disabled={pool.length > 0}
                className="rounded-full bg-amber-500 px-6 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-500"
              >
                對答案
              </button>
            </>
          ) : (
            <button
              onClick={next}
              className="rounded-full bg-emerald-600 px-6 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
            >
              下一句 →
            </button>
          )}
        </div>

        {/* 結果與逐字對照：答完（不論對錯）都攤開，讓玩家看懂句子怎麼組成 */}
        {checked && (
          <div className={`mt-5 rounded-xl border p-4 ${isCorrect ? "border-emerald-500/40 bg-emerald-950/20" : "border-rose-500/40 bg-rose-950/20"}`}>
            <p className={`text-sm font-semibold ${isCorrect ? "text-emerald-300" : "text-rose-300"}`}>
              {isCorrect ? "✓ 語序正確！" : "✕ 語序不太對，正確是："}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <p className={`${notoSerifTC.className} text-lg text-slate-50`}>{current.truku}</p>
              <button
                onClick={() => playAudio(current.audioUrl)}
                aria-label="播放發音"
                className="shrink-0 rounded-full border border-amber-400/50 px-3 py-1 text-xs text-amber-200 hover:bg-amber-900/30"
              >
                ▶ 發音
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {current.words.map((w, i) => (
                <div key={i} className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-2.5 py-1 text-center">
                  <div className="text-sm text-slate-100">{w.token}</div>
                  {w.gloss && <div className="text-[10px] text-slate-400">{w.gloss}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="mt-4 text-center text-[11px] text-slate-500">
        例句與逐字對照來自「原住民族語E樂園」（原住民族委員會）句法演練
      </p>
    </main>
  );
}
