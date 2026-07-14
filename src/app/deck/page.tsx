"use client";

// 牌組編輯器（司令 B）：從卡池挑 30 張（同名≤2、傳說≤1）組一副牌，存本機（localStorage）。
// /play 開局會用這副牌；/vs 之後接上（B2）。左：卡池格子（點一下加入）；右：牌組清單＋費用曲線＋存檔。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CARDS, CARD_BY_ID, type Card } from "@/data/cards";
import { CARD_ART, RARITY_ZH, THEME_ZH } from "@/data/cardArt";
import { DECK_SIZE, maxCopies, validateDeck, loadSavedDeck, saveDeck } from "@/lib/deck";

const POOL = [...CARDS].sort((a, b) => a.cost - b.cost || a.nameZh.localeCompare(b.nameZh));

function costBucket(c: number): number {
  return c >= 7 ? 7 : c;
}

export default function DeckBuilder() {
  const [deck, setDeck] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const d = loadSavedDeck();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 一次性載入本機牌組
    if (d) setDeck(d);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of deck) m.set(id, (m.get(id) ?? 0) + 1);
    return m;
  }, [deck]);

  const check = validateDeck(deck);
  const curve = useMemo(() => {
    const b = Array(8).fill(0) as number[];
    for (const id of deck) {
      const c = CARD_BY_ID.get(id);
      if (c) b[costBucket(c.cost)]++;
    }
    return b;
  }, [deck]);
  const curveMax = Math.max(1, ...curve);

  function add(card: Card) {
    // 上限檢查放進 updater，用最新的 deck 判斷——否則連點多下時各自讀到過期的 counts 會超額。
    setDeck((d) => {
      if (d.length >= DECK_SIZE) return d;
      if (d.filter((x) => x === card.id).length >= maxCopies(card)) return d;
      return [...d, card.id];
    });
    setSaved(false);
  }
  function removeOne(id: string) {
    setDeck((d) => {
      const i = d.lastIndexOf(id);
      if (i < 0) return d;
      return [...d.slice(0, i), ...d.slice(i + 1)];
    });
    setSaved(false);
  }
  function onSave() {
    if (!check.ok) return;
    saveDeck(deck);
    setSaved(true);
  }
  function clearDeck() {
    setDeck([]);
    setSaved(false);
  }

  const deckList = useMemo(
    () =>
      [...counts.entries()]
        .map(([id, n]) => ({ card: CARD_BY_ID.get(id)!, n }))
        .filter((x) => x.card)
        .sort((a, b) => a.card.cost - b.card.cost || a.card.nameZh.localeCompare(b.card.nameZh)),
    [counts],
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/battle" className="text-xs text-slate-400 hover:text-slate-200 underline">← 回競技對戰</Link>
            <h1 className="text-xl font-bold">牌組編輯器</h1>
          </div>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 underline">返回首頁</Link>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          從卡池挑 {DECK_SIZE} 張組一副牌（同名最多 2 張、傳說最多 1 張）。存檔後，單機 /play 開局就會用這副牌。
        </p>

        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* 卡池 */}
          <section>
            <div className="mb-2 text-xs text-slate-500">卡池 · 點卡片加入牌組（依費用排序）</div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {POOL.map((c) => {
                const n = counts.get(c.id) ?? 0;
                const full = n >= maxCopies(c) || deck.length >= DECK_SIZE;
                const art = CARD_ART[c.id];
                return (
                  <button
                    key={c.id}
                    onClick={() => add(c)}
                    disabled={full}
                    title={`${c.nameZh}（${c.cost} 費 · ${RARITY_ZH[c.rarity]}）${full ? "・已達上限" : ""}`}
                    className={`relative aspect-[5/7] overflow-hidden rounded-lg border text-left transition ${
                      n > 0 ? "border-amber-400/70" : "border-slate-700/70 hover:border-amber-300/60"
                    } ${full ? "opacity-45 cursor-not-allowed" : "hover:-translate-y-0.5"}`}
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={c.nameZh} className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder absolute inset-0" data-theme={c.theme}>{THEME_ZH[c.theme]}</span>
                    )}
                    <span className="absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-sky-900/90 text-[11px] font-bold text-sky-100">{c.cost}</span>
                    {n > 0 && (
                      <span className="absolute right-1 top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-black">×{n}</span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1 py-0.5 text-center text-[10px]">{c.nameZh}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 牌組 */}
          <section className="lg:sticky lg:top-4 h-fit rounded-2xl border border-slate-700/70 bg-slate-900/60 p-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-bold text-amber-100">你的牌組</h2>
              <span className={`text-sm font-bold tabular-nums ${deck.length === DECK_SIZE ? "text-emerald-300" : "text-slate-300"}`}>
                {deck.length}/{DECK_SIZE}
              </span>
            </div>

            {/* 費用曲線 */}
            <div className="mt-3 flex items-end gap-1" aria-hidden>
              {curve.map((v, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] text-slate-500">{v || ""}</span>
                  <div className="w-full rounded-t bg-sky-500/70" style={{ height: `${(v / curveMax) * 48 + 2}px` }} />
                  <span className="text-[10px] text-slate-500">{i === 7 ? "7+" : i}</span>
                </div>
              ))}
            </div>

            <div className="mt-3 max-h-[46vh] overflow-y-auto pr-1">
              {deckList.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">還沒選牌，從左邊點卡片加入。</p>
              ) : (
                <ul className="space-y-1">
                  {deckList.map(({ card, n }) => (
                    <li key={card.id}>
                      <button
                        onClick={() => removeOne(card.id)}
                        title="點一下移除一張"
                        className="flex w-full items-center gap-2 rounded-md border border-slate-700/60 bg-slate-950/40 px-2 py-1 text-left text-xs hover:border-rose-400/60 hover:bg-rose-950/20"
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-900/90 text-[10px] font-bold text-sky-100">{card.cost}</span>
                        <span className="min-w-0 flex-1 truncate">{card.nameZh}</span>
                        {card.rarity === "legendary" && <span className="text-[10px] text-amber-300">傳說</span>}
                        <span className="text-amber-200">×{n}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {loaded && !check.ok && deck.length > 0 && (
              <p className="mt-2 text-[11px] text-rose-300">{check.error}</p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={onSave}
                disabled={!check.ok}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold enabled:hover:bg-emerald-500 disabled:opacity-40"
              >
                {saved ? "已存檔 ✓" : "存檔"}
              </button>
              <button onClick={clearDeck} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800">
                清空
              </button>
            </div>
            {saved && <p className="mt-2 text-center text-[11px] text-emerald-300">已存到這台裝置，去 /play 就會用這副牌。</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
