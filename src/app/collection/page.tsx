"use client";

// 卡牌圖鑑 /collection —— 比照爐石戰記 hsreplay.net/cards 的可篩選卡表。
// 純展示：把 src/data/cards.ts 的全部卡牌用 /play 同一套 HandCard 卡面攤開來瀏覽，
// 依費用曲線排序，支援搜尋（卡名／族語詞／中文）與費用、類型、稀有度、主題、關鍵字篩選，
// 點卡開細節面板（效果、答對加成、族語詞、學習小註）。不改任何對戰邏輯。

import Link from "next/link";
import { useMemo, useState } from "react";
import { Noto_Serif_TC } from "next/font/google";
import {
  CARDS,
  CARD_LEARNING,
  type Card,
  type CardType,
  type Keyword,
  type Rarity,
  type Theme,
} from "@/data/cards";
import { vocab } from "@/data/truku";
import { GemDefs, HandCard } from "@/lib/cardVisual";

const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

const THEME_ZH: Record<Theme, string> = {
  legend: "傳說",
  animal: "動物",
  nature: "自然",
  plant: "植物",
  tool: "器物",
};
const RARITY_ZH: Record<Rarity, string> = { common: "普通", rare: "稀有", epic: "史詩", legendary: "傳說" };
const TYPE_ZH: Record<CardType, string> = { minion: "隨從", spell: "法術" };
const KEYWORD_ZH: Record<Keyword, string> = {
  taunt: "嘲諷",
  stealth: "潛行",
  charge: "衝鋒",
  divineShield: "石鎧",
  lifesteal: "汲取",
  windfury: "疾風",
  rush: "突襲",
};
const KEYWORD_ORDER: Keyword[] = ["taunt", "stealth", "charge", "divineShield", "lifesteal", "windfury", "rush"];

const RARITY_DOT: Record<Rarity, string> = {
  common: "bg-slate-300",
  rare: "bg-sky-400",
  epic: "bg-fuchsia-400",
  legendary: "bg-amber-400",
};

const THEME_ORDER: Theme[] = ["legend", "nature", "animal", "plant", "tool"];
const RARITY_ORDER: Rarity[] = ["common", "rare", "epic", "legendary"];
const COST_BUCKETS = [0, 1, 2, 3, 4, 5, 6, 7] as const; // 7 = 7+

type Filters = {
  q: string;
  cost: number | null; // COST_BUCKETS 值；7 代表 7+
  type: CardType | null;
  rarity: Rarity | null;
  theme: Theme | null;
  keyword: Keyword | null;
};

const EMPTY: Filters = { q: "", cost: null, type: null, rarity: null, theme: null, keyword: null };

function costBucket(cost: number) {
  return cost >= 7 ? 7 : cost;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-amber-300/80 bg-amber-400/15 text-amber-100"
          : "border-slate-600/60 bg-slate-800/40 text-slate-300 hover:border-slate-400/70 hover:text-slate-100"
      }`}
    >
      {children}
    </button>
  );
}

function CardDetail({ card, onClose }: { card: Card; onClose: () => void }) {
  const v = vocab(card.vocabId);
  const learning = CARD_LEARNING[card.id];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-2xl border border-slate-600/60 bg-slate-900/95 p-6 md:flex-row md:items-start"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="關閉"
          className="absolute right-3 top-3 rounded-full border border-slate-600/60 px-2 py-0.5 text-sm text-slate-300 hover:text-white"
        >
          ✕
        </button>
        <div className="mx-auto shrink-0">
          <HandCard card={card} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`${notoSerifTC.className} text-xl font-bold text-amber-100`}>{card.nameZh}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className={`inline-block h-2 w-2 rounded-full ${RARITY_DOT[card.rarity]}`} />
            <span>{RARITY_ZH[card.rarity]}</span>
            <span className="text-slate-500">·</span>
            <span>{THEME_ZH[card.theme]}</span>
            <span className="text-slate-500">·</span>
            <span>{TYPE_ZH[card.type]}</span>
            <span className="text-slate-500">·</span>
            <span>{card.cost} 費</span>
            {card.type === "minion" && (
              <>
                <span className="text-slate-500">·</span>
                <span>{card.attack ?? 0}/{card.health ?? 0}</span>
              </>
            )}
            {card.keywords?.map((k) => (
              <span key={k} className="rounded-full border border-slate-600/60 px-2 py-0.5 text-[11px] text-slate-200">
                {KEYWORD_ZH[k]}
              </span>
            ))}
          </div>

          {card.effectText !== "—" && (
            <p className="mt-3 text-sm leading-relaxed text-slate-200">{card.effectText}</p>
          )}
          <p className="mt-1 text-sm leading-relaxed text-amber-300/90">★ 答對加成：{card.bonusText}</p>

          <div className="mt-4 rounded-lg border border-emerald-800/40 bg-emerald-950/30 p-3">
            <div className="text-[11px] tracking-widest text-emerald-300/80">族語詞</div>
            <div className="mt-0.5 text-base font-semibold text-emerald-100">
              {v.word} <span className="text-sm font-normal text-slate-300">— {v.chinese}</span>
            </div>
            {v.hasAudio && v.audioUrl && (
              <audio controls src={v.audioUrl} className="mt-2 h-8 w-full">
                <track kind="captions" />
              </audio>
            )}
          </div>

          {learning && (
            <div className="mt-3 rounded-lg border border-slate-700/50 bg-slate-800/40 p-3 text-sm leading-relaxed text-slate-300">
              <span className="text-amber-200/80">學｜</span>
              {learning}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CollectionPage() {
  const [f, setF] = useState<Filters>(EMPTY);
  const [selected, setSelected] = useState<Card | null>(null);

  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return CARDS.filter((c) => {
      if (f.cost !== null && costBucket(c.cost) !== f.cost) return false;
      if (f.type && c.type !== f.type) return false;
      if (f.rarity && c.rarity !== f.rarity) return false;
      if (f.theme && c.theme !== f.theme) return false;
      if (f.keyword && !(c.keywords ?? []).includes(f.keyword)) return false;
      if (q) {
        const v = vocab(c.vocabId);
        const hay = `${c.nameZh} ${v.word} ${v.chinese} ${c.effectText} ${c.bonusText}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => a.cost - b.cost || a.nameZh.localeCompare(b.nameZh, "zh-Hant"));
  }, [f]);

  const dirty = f !== EMPTY && JSON.stringify(f) !== JSON.stringify(EMPTY);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 text-slate-100">
      <GemDefs />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`${notoSerifTC.className} text-2xl font-bold text-amber-100`}>卡牌圖鑑</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            全 {CARDS.length} 張卡 · 傳說、自然、山林動物、山徑器物 · 每張綁定一個太魯閣族語詞
          </p>
        </div>
        <Link
          href="/play"
          className="rounded-full border border-emerald-500/50 px-4 py-1.5 text-sm text-emerald-100 transition hover:border-emerald-300/80"
        >
          開始對戰 →
        </Link>
      </header>

      {/* 篩選列 */}
      <section className="mt-5 space-y-3 rounded-2xl border border-slate-700/50 bg-slate-900/40 p-4">
        <input
          value={f.q}
          onChange={(e) => setF((s) => ({ ...s, q: e.target.value }))}
          placeholder="搜尋卡名、族語詞、中文、效果…"
          className="w-full rounded-lg border border-slate-600/60 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-amber-300/60 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">費用</span>
          {COST_BUCKETS.map((c) => (
            <Pill key={c} active={f.cost === c} onClick={() => setF((s) => ({ ...s, cost: s.cost === c ? null : c }))}>
              {c === 7 ? "7+" : c}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">類型</span>
          {(["minion", "spell"] as CardType[]).map((t) => (
            <Pill key={t} active={f.type === t} onClick={() => setF((s) => ({ ...s, type: s.type === t ? null : t }))}>
              {TYPE_ZH[t]}
            </Pill>
          ))}
          <span className="ml-3 mr-1 text-xs text-slate-500">稀有度</span>
          {RARITY_ORDER.map((r) => (
            <Pill key={r} active={f.rarity === r} onClick={() => setF((s) => ({ ...s, rarity: s.rarity === r ? null : r }))}>
              <span className={`mr-1 inline-block h-2 w-2 rounded-full ${RARITY_DOT[r]}`} />
              {RARITY_ZH[r]}
            </Pill>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-slate-500">主題</span>
          {THEME_ORDER.map((t) => (
            <Pill key={t} active={f.theme === t} onClick={() => setF((s) => ({ ...s, theme: s.theme === t ? null : t }))}>
              {THEME_ZH[t]}
            </Pill>
          ))}
          <span className="ml-3 mr-1 text-xs text-slate-500">關鍵字</span>
          {KEYWORD_ORDER.map((k) => (
            <Pill key={k} active={f.keyword === k} onClick={() => setF((s) => ({ ...s, keyword: s.keyword === k ? null : k }))}>
              {KEYWORD_ZH[k]}
            </Pill>
          ))}
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400">符合 {filtered.length} 張</span>
          {dirty && (
            <button onClick={() => setF(EMPTY)} className="text-xs text-slate-400 underline hover:text-slate-200">
              清除篩選
            </button>
          )}
        </div>
      </section>

      {/* 卡牌格 */}
      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-slate-500">沒有符合條件的卡牌。</p>
      ) : (
        <div className="mt-6 grid grid-cols-2 justify-items-center gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {filtered.map((c) => (
            <HandCard key={c.id} card={c} onClick={() => setSelected(c)} />
          ))}
        </div>
      )}

      {selected && <CardDetail card={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
