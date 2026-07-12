// 卡面美術「單一資料來源」——/play 單機盤面與 /vs 線上盤面共用，避免兩份 CARD_ART 漂移。
// 純資料（無 JSX / 無 next/font），可被任何元件 import。新卡加圖只改這裡，兩邊自動同步。
// 卡面圖 ORDER-044（enzo-culture 複核 35/35 通過）；沒有對應圖的卡維持純文字版型（UI 須容忍缺圖）。
import type { Rarity, Theme } from "@/data/cards";

export const THEME_ZH: Record<Theme, string> = {
  legend: "傳說",
  animal: "動物",
  plant: "植物",
  nature: "自然",
  tool: "器物",
};

export const RARITY_ZH: Record<Rarity, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史詩",
  legendary: "傳說",
};

// 稀有度 → 卡框光暈（史詩靜態紫暈、傳說琥珀呼吸暈；樣式見 globals.css .hs-glow-*）
export const RARITY_GLOW: Record<Rarity, string> = {
  common: "",
  rare: "",
  epic: "hs-glow-epic",
  legendary: "hs-glow-legendary",
};

export const BOARD_BG = "/images/cards/board-battle.jpg";
export const CARDBACK = "/images/cards/cardback.jpg";
export const HERO_ART = {
  enemy: "/images/play/hero-trial.jpg",
  player: "/images/play/hero-weaver.jpg",
};

export const CARD_ART: Record<string, string> = {
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
