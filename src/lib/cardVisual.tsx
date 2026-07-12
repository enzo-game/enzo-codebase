// 共用卡面美術部件 —— 從 /play 的視覺系統抽出，供 /vs 線上盤面套用同一套爐石式外觀。
// 純展示元件（無 hooks）：寶石 StatGem、卡面 HandCard、隨從 MinionToken、英雄 HeroPortrait、
// 法力條 ManaStrip、對手手牌背面 CardBackFan。樣式沿用 globals.css 的 hs-* 類。
import { Noto_Serif_TC } from "next/font/google";
import { CARD_LEARNING, RARITY_COLOR, type Card } from "@/data/cards";
import type { Minion } from "@/engine/types";
// 卡面美術資料改由 src/data/cardArt.ts 單一來源提供（與 /play 共用，避免兩份漂移）。
import { CARD_ART, HERO_ART, CARDBACK, BOARD_BG, THEME_ZH, RARITY_ZH, RARITY_GLOW } from "@/data/cardArt";
// 寶石 StatGem/GemDefs 也改由單一來源 src/lib/statGem.tsx 提供（與 /play 共用）。
import { GemDefs, StatGem } from "@/lib/statGem";

// 再匯出，讓 /vs 盤面沿用既有的 @/lib/cardVisual import 路徑。
export { CARD_ART, BOARD_BG, GemDefs, StatGem };

const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

// ───────────────────────── 手牌卡面 ─────────────────────────
export function HandCard({ card, dim, blockedReason, onClick }: {
  card: Card; dim?: boolean; blockedReason?: string; onClick?: () => void;
}) {
  const art = CARD_ART[card.id];
  const learningText = CARD_LEARNING[card.id];
  const playable = !dim && !blockedReason;
  return (
    <button
      onClick={onClick}
      disabled={!playable}
      aria-label={`${card.nameZh}${learningText ? `。學習小註：${learningText}` : ""}`}
      className={`hs-card hs-hand-card ${RARITY_GLOW[card.rarity]} w-[120px] md:w-[150px] aspect-[5/7] shrink-0 text-left border-2 ${RARITY_COLOR[card.rarity]}
        ${playable ? "hs-card-playable cursor-pointer" : blockedReason ? "hs-card-blocked cursor-not-allowed" : "opacity-45"}`}
    >
      {blockedReason ? <span className="hs-card-reason" aria-hidden>{blockedReason}</span> : null}
      <span className="absolute inset-0 rounded-[12px] overflow-hidden flex flex-col">
        <span className="relative h-[55%] shrink-0 rounded-t-[12px] bg-gradient-to-b from-slate-800 to-slate-900">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt={card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <span className="hs-art-placeholder hs-art-placeholder-card" data-theme={card.theme}>{THEME_ZH[card.theme]}</span>
          )}
          <span className="hs-art-frame" aria-hidden />
        </span>
        <span className="flex-1 flex flex-col px-1.5 pt-3.5 pb-2 text-center">
          <span className="flex items-center justify-center gap-1 text-[8px] tracking-[0.15em] text-amber-200/70">
            {THEME_ZH[card.theme]} · {card.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[card.rarity]}
          </span>
          {card.effectText !== "—" && (
            <span title={card.effectText} className="text-[9px] leading-tight text-slate-200 mt-0.5 line-clamp-1">{card.effectText}</span>
          )}
          <span title={card.bonusText} className="text-[9px] leading-tight text-amber-300/90 mt-0.5 line-clamp-1">★ {card.bonusText}</span>
          {learningText ? <span title={learningText} className="hs-card-learning line-clamp-2">學｜{learningText}</span> : null}
        </span>
      </span>
      <span title={card.nameZh} className={`${notoSerifTC.className} hs-name-banner absolute left-0 right-0 top-[55%] -translate-y-1/2 z-[5] block px-1.5 py-0.5 text-center text-[11px] font-bold truncate`}>
        {card.nameZh}
      </span>
      <StatGem kind="cost" value={card.cost} className="hs-gem-cost" />
      {card.type === "minion" ? (
        <>
          <StatGem kind="atk" value={card.attack ?? 0} className="hs-gem-atk" />
          <StatGem kind="hp" value={card.health ?? 0} className="hs-gem-hp" />
        </>
      ) : (
        <span className="hs-spell-chip">法術</span>
      )}
    </button>
  );
}

// ───────────────────────── 卡片詳情（點手牌先看效果，按「出牌」才進答題）─────────────────────────
// 比照 /play（PR #80）的「輕點看效果／出牌」機制，供 /vs 共用同一套反悔流程。
export function CardInspectModal({ card, playable, blockReason, onClose, onPlay }: {
  card: Card; playable: boolean; blockReason?: string; onClose: () => void; onPlay: () => void;
}) {
  const art = CARD_ART[card.id];
  const learningText = CARD_LEARNING[card.id];
  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60]"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl bg-slate-900 border-2 ${RARITY_COLOR[card.rarity]} ${RARITY_GLOW[card.rarity]} p-5 shadow-[0_0_60px_rgba(0,0,0,0.6)]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100`}>{card.nameZh}</h3>
            <p className="text-[11px] tracking-[0.15em] text-amber-200/70">
              {THEME_ZH[card.theme]} · {card.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[card.rarity]}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="關閉卡片詳情"
            className="shrink-0 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
          >
            ✕ 關閉
          </button>
        </div>
        {art && (
          <div className="relative rounded-xl overflow-hidden mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={art} alt={card.nameZh} className="w-full h-44 object-cover" />
            <span className="hs-art-frame" aria-hidden />
          </div>
        )}
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-sky-950/60 border border-sky-500/40 px-2 py-1 text-sky-200">法力 {card.cost}</span>
          {card.type === "minion" && (
            <>
              <span className="rounded bg-amber-950/60 border border-amber-500/40 px-2 py-1 text-amber-200">攻擊 {card.attack ?? 0}</span>
              <span className="rounded bg-rose-950/60 border border-rose-500/40 px-2 py-1 text-rose-200">生命 {card.health ?? 0}</span>
            </>
          )}
        </div>
        {card.effectText !== "—" && (
          <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm leading-relaxed text-slate-100 mb-2">
            <span className="font-semibold text-slate-300">效果：</span>{card.effectText}
          </p>
        )}
        <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm leading-relaxed text-amber-100/90 mb-2">
          <span className="font-semibold text-amber-200">★ 答對加成：</span>{card.bonusText}
        </p>
        {learningText && (
          <p className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs leading-relaxed text-emerald-100/90">
            <span className="font-semibold text-emerald-200">學習小註：</span>{learningText}
          </p>
        )}
        <div className="mt-4 flex items-center justify-end gap-3">
          {!playable && blockReason && <span className="text-xs text-slate-400">{blockReason}</span>}
          <button onClick={onClose} className="rounded px-4 py-2 text-sm text-slate-300 hover:text-slate-100">
            關閉
          </button>
          <button
            onClick={onPlay}
            disabled={!playable}
            className={`rounded px-5 py-2 text-sm font-semibold ${
              playable ? "bg-amber-500 text-slate-950 hover:bg-amber-400" : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            出牌 ▶
          </button>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────── 戰場隨從 ─────────────────────────
export function MinionToken({ minion, targetable, ready, selected, onClick }: {
  minion: Minion; targetable?: boolean; ready?: boolean; selected?: boolean; onClick?: () => void;
}) {
  const art = CARD_ART[minion.card.id];
  const kw = [minion.taunt ? "嘲諷" : "", minion.stealth ? "潛行" : ""].filter(Boolean).join("·");
  return (
    <button
      onClick={onClick}
      disabled={!targetable && !ready}
      title={`${minion.card.nameZh}${kw ? `（${kw}）` : ""}`}
      className={`hs-token hs-token-enter w-[72px] md:w-[84px] aspect-[4/5] border-2 ${RARITY_COLOR[minion.card.rarity]}
        ${minion.taunt ? "hs-token-taunt" : ""}
        ${minion.stealth ? "opacity-70 ring-1 ring-slate-400" : ""}
        ${targetable ? "hs-attack-target cursor-crosshair" : ""}
        ${ready ? "ring-2 ring-emerald-400/70 cursor-pointer" : ""}
        ${selected ? "ring-2 ring-emerald-300 -translate-y-1" : ""}`}
    >
      <span className="absolute inset-0 rounded-[8px] overflow-hidden">
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt={minion.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <span className="hs-art-placeholder" data-theme={minion.card.theme}>{THEME_ZH[minion.card.theme]}</span>
        )}
        <span className="hs-art-frame" aria-hidden />
        <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
      </span>
      <StatGem kind="atk" value={minion.attack} size="sm" className="hs-gem-atk" />
      <StatGem kind="hp" value={minion.health} size="sm" tone={minion.health < minion.maxHealth ? "text-rose-200" : "text-white"} className="hs-gem-hp" />
      {minion.taunt ? <span className="absolute -top-2 inset-x-0 text-center text-[9px] text-amber-300">嘲諷</span> : null}
      {minion.stealth ? <span className="absolute top-0.5 right-0.5 text-[9px] text-sky-300">潛</span> : null}
    </button>
  );
}

// ───────────────────────── 英雄肖像 ─────────────────────────
export function HeroPortrait({ variant, name, hp, maxHp, sub, targetable, thinking, onClick }: {
  variant: "opp" | "you"; name: string; hp: number; maxHp: number; sub: string;
  targetable?: boolean; thinking?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={targetable ? onClick : undefined}
      disabled={!targetable}
      className={`hs-portrait hs-portrait-${variant === "opp" ? "enemy" : "player"} relative transition ${targetable ? "hs-hero-targetable hs-attack-target cursor-crosshair" : ""}`}
    >
      <span className="hs-portrait-art">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={variant === "you" ? HERO_ART.player : HERO_ART.enemy} alt={name} />
      </span>
      <span className="hs-portrait-name">{name}{thinking ? " · 思考中…" : ""}</span>
      <span className="hs-portrait-sub">{sub}</span>
      <span className="hs-portrait-hp">
        <span className="hs-hp-label">生命 HP</span>
        <span className="hs-hp-value">{hp}/{maxHp}</span>
      </span>
    </button>
  );
}

export function ManaStrip({ variant, mana, maxMana }: { variant: "opp" | "you"; mana: number; maxMana: number }) {
  return (
    <div className={`hs-resource-strip hs-resource-${variant === "opp" ? "enemy" : "player"}`} aria-label={`法力 ${mana}/${maxMana}`}>
      {variant === "opp" ? <span className="hs-mana-label">對手法力</span> : null}
      <span className="hs-mana-text">{mana}/{maxMana}</span>
      <span className="hs-crystals" aria-hidden>
        {Array.from({ length: Math.max(maxMana, 1) }).map((_, i) => (
          <span key={i} className={i < mana ? "hs-crystal is-filled" : "hs-crystal is-empty"} />
        ))}
      </span>
    </div>
  );
}

export function CardBackFan({ count }: { count: number }) {
  const n = Math.min(count, 8);
  return (
    <div className="hs-opponent-hand" aria-label={`對手手牌 ${count} 張`}>
      {Array.from({ length: n }).map((_, i, arr) => (
        <span key={i} className="hs-cardback-mini" style={{ transform: `translateX(${(i - (arr.length - 1) / 2) * 22}px) rotate(${(i - (arr.length - 1) / 2) * 5}deg)`, zIndex: i }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CARDBACK} alt="" />
        </span>
      ))}
    </div>
  );
}
