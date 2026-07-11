// 共用卡面美術部件 —— 從 /play 的視覺系統抽出，供 /vs 線上盤面套用同一套爐石式外觀。
// 純展示元件（無 hooks）：寶石 StatGem、卡面 HandCard、隨從 MinionToken、英雄 HeroPortrait、
// 法力條 ManaStrip、對手手牌背面 CardBackFan。樣式沿用 globals.css 的 hs-* 類。
import { Noto_Serif_TC } from "next/font/google";
import type { JSX } from "react";
import { CARD_LEARNING, RARITY_COLOR, type Card, type Rarity, type Theme } from "@/data/cards";
import type { Minion } from "@/engine/types";

const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

export const BOARD_BG = "/images/cards/board-battle.jpg";
export const CARDBACK = "/images/cards/cardback.jpg";
export const HERO_ART = { you: "/images/play/hero-weaver.jpg", opp: "/images/play/hero-trial.jpg" };

const THEME_ZH: Record<Theme, string> = {
  legend: "傳說",
  animal: "動物",
  nature: "自然",
  plant: "植物",
  tool: "器物",
};
const RARITY_ZH: Record<Rarity, string> = { common: "普通", rare: "稀有", epic: "史詩", legendary: "傳說" };
const RARITY_GLOW: Record<Rarity, string> = { common: "", rare: "", epic: "hs-glow-epic", legendary: "hs-glow-legendary" };

export const CARD_ART: Record<string, string> = {
  "leg-l01": "/images/cards/l01-millet.jpg", "leg-l02": "/images/cards/l02-bow.jpg",
  "leg-l03": "/images/cards/l03-footprint.jpg", "leg-l04": "/images/cards/l04-flashflood.jpg",
  "leg-l05": "/images/cards/l05-crystal.jpg", "leg-l06": "/images/cards/l06-twosuns.jpg",
  "leg-l07": "/images/cards/l07-rainbow.jpg", "leg-l08": "/images/cards/l08-arrow.jpg",
  "leg-l09": "/images/cards/l09-flood.jpg", "leg-l10": "/images/cards/l10-pusuqhuni.jpg",
  "leg-l11": "/images/cards/l11-mawi.jpg", "leg-l12": "/images/cards/l12-citrus.jpg",
  "leg-l13": "/images/cards/l13-road.jpg", "leg-n01": "/images/cards/n01-stars.jpg",
  "leg-n02": "/images/cards/n02-fog.jpg", "leg-n03": "/images/cards/n03-thunder.jpg",
  "leg-n04": "/images/cards/n04-moon.jpg", "leg-n05": "/images/cards/n05-mist.jpg",
  "leg-n06": "/images/cards/n06-lightning.jpg", "leg-n07": "/images/cards/n07-typhoon.jpg",
  "leg-n08": "/images/cards/n08-night-rest.jpg", "leg-n09": "/images/cards/n09-creek-supply.jpg",
  "leg-n10": "/images/cards/n10-headwind-pass.jpg", "leg-a01": "/images/cards/a01-muntjac.jpg",
  "leg-a02": "/images/cards/a02-boar.jpg", "leg-a03": "/images/cards/a03-squirrel.jpg",
  "leg-a04": "/images/cards/a04-dog.jpg", "leg-a05": "/images/cards/a05-waterbird.jpg",
  "leg-a06": "/images/cards/a06-pangolin.jpg", "leg-a07": "/images/cards/a07-leopard.jpg",
  "leg-a08": "/images/cards/a08-sambar.jpg", "leg-a09": "/images/cards/a09-bear.jpg",
  "leg-p01": "/images/cards/p01-wade.jpg", "leg-p02": "/images/cards/p02-trap.jpg",
  "leg-p03": "/images/cards/p03-mushroom.jpg", "leg-p04": "/images/cards/p04-hearth.jpg",
  "leg-p05": "/images/cards/p05-cypress.jpg", "leg-p06": "/images/cards/p06-after-wind-road.jpg",
  "leg-p07": "/images/cards/p07-stone-marker.jpg", "leg-p08": "/images/cards/p08-night-fire.jpg",
  "leg-token-sapling": "/images/cards/token-sapling.jpg",
};

// ───────────────────────── 切面寶石 ─────────────────────────
type GemKind = "cost" | "atk" | "hp";
const GEM_LABEL: Record<GemKind, string> = { cost: "費", atk: "攻", hp: "命" };
const GEM_TITLE: Record<GemKind, string> = { cost: "費用", atk: "攻擊", hp: "生命" };

export function GemDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="gemSapphire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" /><stop offset="0.55" stopColor="#0284c7" /><stop offset="1" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="gemAmber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" /><stop offset="0.55" stopColor="#f59e0b" /><stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="gemRuby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb7185" /><stop offset="0.55" stopColor="#e11d48" /><stop offset="1" stopColor="#9f1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function GemShapeCost() {
  return (<>
    <polygon points="12,0.8 21.5,6.6 21.5,17.4 12,23.2 2.5,17.4 2.5,6.6" fill="#0c2f45" stroke="#bae6fd" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
    <polygon points="12,2.8 19.7,7.6 19.7,16.4 12,21.2 4.3,16.4 4.3,7.6" fill="url(#gemSapphire)" />
    <polygon points="12,2.8 4.3,7.6 12,12.2" fill="#ffffff" opacity="0.34" /><polygon points="12,2.8 19.7,7.6 12,12.2" fill="#ffffff" opacity="0.18" />
    <polygon points="4.3,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.14" /><polygon points="19.7,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.26" />
    <circle cx="8.2" cy="6.6" r="1.2" fill="#ffffff" opacity="0.9" />
  </>);
}
function GemShapeAtk() {
  return (<>
    <polygon points="6,1.2 18,1.2 23.3,12 18,22.8 6,22.8 0.7,12" fill="#5b3308" stroke="#fde68a" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
    <polygon points="7.1,3.1 16.9,3.1 21.2,12 16.9,20.9 7.1,20.9 2.8,12" fill="url(#gemAmber)" />
    <polygon points="7.1,3.1 16.9,3.1 12,12" fill="#ffffff" opacity="0.3" /><polygon points="7.1,3.1 2.8,12 12,12" fill="#ffffff" opacity="0.16" />
    <polygon points="2.8,12 7.1,20.9 12,12" fill="#000000" opacity="0.14" /><polygon points="7.1,20.9 16.9,20.9 12,12" fill="#000000" opacity="0.26" />
    <polygon points="21.2,12 16.9,20.9 12,12" fill="#000000" opacity="0.18" /><circle cx="8.6" cy="6" r="1.2" fill="#ffffff" opacity="0.9" />
  </>);
}
function GemShapeHp() {
  return (<>
    <path d="M12 0.8 L21.6 4.6 V11.4 C21.6 17.5 12 23.2 12 23.2 C12 23.2 2.4 17.5 2.4 11.4 V4.6 Z" fill="#4c0519" stroke="#fecdd3" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
    <path d="M12 2.8 L19.7 5.9 V11.2 C19.7 16.2 12 20.9 12 20.9 C12 20.9 4.3 16.2 4.3 11.2 V5.9 Z" fill="url(#gemRuby)" />
    <polygon points="12,2.8 4.3,5.9 12,11.6" fill="#ffffff" opacity="0.32" /><polygon points="12,2.8 19.7,5.9 12,11.6" fill="#ffffff" opacity="0.16" />
    <polygon points="4.3,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.14" /><polygon points="19.7,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.26" />
    <circle cx="8.4" cy="6.4" r="1.2" fill="#ffffff" opacity="0.9" />
  </>);
}
const GEM_SHAPE: Record<GemKind, () => JSX.Element> = { cost: GemShapeCost, atk: GemShapeAtk, hp: GemShapeHp };

export function StatGem({ kind, value, size = "md", tone = "text-white", className = "" }: {
  kind: GemKind; value: number; size?: "md" | "sm"; tone?: string; className?: string;
}) {
  const Shape = GEM_SHAPE[kind];
  return (
    <span className={`hs-gem hs-gem-${size} ${className}`} data-label={GEM_LABEL[kind]} title={`${GEM_TITLE[kind]} ${value}`} aria-label={`${GEM_TITLE[kind]} ${value}`}>
      <svg viewBox="0 0 24 24" className="block w-full h-full" aria-hidden focusable="false"><Shape /></svg>
      <span className={`hs-gem-num ${tone}`}>{value}</span>
      <span className="hs-gem-label" aria-hidden>{GEM_LABEL[kind]}</span>
    </span>
  );
}

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
        <img src={HERO_ART[variant]} alt={name} />
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
