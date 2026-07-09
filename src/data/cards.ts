// Enzo《傳說牌組》卡表（依 enzo-game-design/docs/card-design-v3-legends.md，ORDER-043）
// v1 卡表全數淘汰（文化紅線盤點：Utux、出草、百步蛇、人物刻板卡、虛構靈體均不再使用）。
// 詞彙綁定：vocabId 對應 src/data/truku-vocab.json（klokah 太魯閣語，含發音），
// 檔尾以 vocab() 逐一驗證，錯字在 build 期即失敗。

import { vocab } from "@/data/truku";

export type CardType = "minion" | "spell";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Theme = "legend" | "animal" | "nature" | "plant" | "tool";
export type Keyword = "taunt" | "stealth" | "charge";

export interface Card {
  id: string;
  nameZh: string;
  type: CardType;
  cost: number;
  attack?: number;
  health?: number;
  rarity: Rarity;
  theme: Theme;
  /** 已查證的太魯閣語詞 id，驅動出牌答題 */
  vocabId: string;
  keywords?: Keyword[];
  /** 基礎效果（給玩家看的文字） */
  effectText: string;
  /** 答對加成（給玩家看的文字） */
  bonusText: string;
  /** 機器效果 id（引擎解讀；純關鍵字隨從不需要） */
  effect?: string;
  /** 答對時的數值加成（隨從） */
  bonusStats?: { atk: number; hp: number };
  /** 答對時額外獲得的關鍵字（隨從） */
  bonusKeywords?: Keyword[];
}

export const CARDS: Card[] = [
  // ── 傳說系列（5 則核准傳說）──
  { id: "leg-l01", nameZh: "沿路小米", type: "minion", cost: 1, attack: 0, health: 3, rarity: "rare", theme: "legend", vocabId: "21-18", effect: "healHero1", effectText: "回合結束：回復我方英雄 1", bonusText: "改為回復 2" },
  { id: "leg-l02", nameZh: "獵弓", type: "spell", cost: 2, rarity: "common", theme: "legend", vocabId: "16-01", effect: "dmgAny2", effectText: "造成 2 點傷害（任一目標）", bonusText: "改為 3 點" },
  { id: "leg-l03", nameZh: "馬威的腳印", type: "spell", cost: 2, rarity: "rare", theme: "legend", vocabId: "10-12", effect: "friendTaunt03", effectText: "一個友方隨從獲得嘲諷與 +0/+3", bonusText: "額外 +0/+2" },
  { id: "leg-l04", nameZh: "溪水暴漲", type: "spell", cost: 3, rarity: "rare", theme: "legend", vocabId: "10-07", effect: "shuffleBackEnemy", effectText: "將一個敵方隨從洗回敵方牌庫", bonusText: "額外抽 1 張" },
  { id: "leg-l05", nameZh: "燒紅的水晶石", type: "spell", cost: 4, rarity: "rare", theme: "legend", vocabId: "11-17", effect: "dmgMinion4", effectText: "對一個隨從造成 4 點傷害", bonusText: "改為 5 點" },
  { id: "leg-l06", nameZh: "二日當空", type: "spell", cost: 5, rarity: "epic", theme: "legend", vocabId: "11-02", effect: "twoSuns", effectText: "對敵方英雄造成 4 點傷害，所有隨從（雙方）受 1 點", bonusText: "我方隨從免疫這 1 點" },
  { id: "leg-l07", nameZh: "彩虹當空", type: "spell", cost: 6, rarity: "epic", theme: "legend", vocabId: "11-28", effect: "healHero8", effectText: "回復我方英雄 8 點", bonusText: "額外抽 1 張" },
  { id: "leg-l08", nameZh: "射日之箭", type: "spell", cost: 6, rarity: "epic", theme: "legend", vocabId: "16-03", effect: "dmgAny8", effectText: "造成 8 點傷害（任一目標）", bonusText: "答對退 1 費" },
  { id: "leg-l09", nameZh: "大洪水", type: "spell", cost: 7, rarity: "epic", theme: "legend", vocabId: "11-24", effect: "floodAll4", effectText: "對所有隨從（不分敵我）造成 4 點傷害", bonusText: "我方英雄回復 3" },
  { id: "leg-l10", nameZh: "Pusu Qhuni 巨岩", type: "minion", cost: 7, attack: 3, health: 12, rarity: "legendary", theme: "legend", vocabId: "08-25", keywords: ["taunt"], effect: "summonSapling1", effectText: "嘲諷；戰吼：召喚一個 2/2 幼樹", bonusText: "改召喚兩個" },
  { id: "leg-l11", nameZh: "沉睡的馬威", type: "minion", cost: 9, attack: 8, health: 8, rarity: "legendary", theme: "legend", vocabId: "10-22", effect: "aoeEnemy2", effectText: "戰吼：對所有敵方隨從造成 2 點", bonusText: "改為 3 點" },
  // ── 自然力 ──
  { id: "leg-n01", nameZh: "星空", type: "spell", cost: 1, rarity: "common", theme: "nature", vocabId: "11-05", effect: "draw1", effectText: "抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-n02", nameZh: "濃霧", type: "spell", cost: 2, rarity: "rare", theme: "nature", vocabId: "11-12", effect: "allFriendStealth", effectText: "我方所有隨從獲得潛行", bonusText: "各 +0/+1" },
  { id: "leg-n03", nameZh: "雷聲", type: "spell", cost: 3, rarity: "common", theme: "nature", vocabId: "11-10", effect: "dmgEnemyHero3", effectText: "對敵方英雄造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-n04", nameZh: "月光", type: "spell", cost: 3, rarity: "rare", theme: "nature", vocabId: "11-03", effect: "draw2", effectText: "抽 2 張牌", bonusText: "再抽 1 張" },
  { id: "leg-n05", nameZh: "山嵐", type: "minion", cost: 3, attack: 2, health: 2, rarity: "common", theme: "nature", vocabId: "10-04", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-n06", nameZh: "閃電", type: "spell", cost: 5, rarity: "rare", theme: "nature", vocabId: "11-14", effect: "dmgAny5", effectText: "對一個目標造成 5 點傷害", bonusText: "改為 6 點" },
  { id: "leg-n07", nameZh: "颱風", type: "spell", cost: 8, rarity: "epic", theme: "nature", vocabId: "11-21", effect: "aoeEnemy3", effectText: "對所有敵方隨從造成 3 點傷害", bonusText: "改為 4 點" },
  // ── 山林動物 ──
  { id: "leg-a01", nameZh: "山羌", type: "minion", cost: 1, attack: 2, health: 1, rarity: "common", theme: "animal", vocabId: "07-24", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a02", nameZh: "山豬", type: "minion", cost: 2, attack: 3, health: 2, rarity: "common", theme: "animal", vocabId: "07-15", effectText: "—", bonusText: "+0/+1", bonusStats: { atk: 0, hp: 1 } },
  { id: "leg-a03", nameZh: "飛鼠", type: "minion", cost: 2, attack: 2, health: 2, rarity: "common", theme: "animal", vocabId: "07-20", effect: "draw1", effectText: "戰吼：抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-a04", nameZh: "獵犬", type: "minion", cost: 2, attack: 2, health: 3, rarity: "common", theme: "animal", vocabId: "07-03", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a05", nameZh: "水鳥", type: "minion", cost: 3, attack: 2, health: 4, rarity: "common", theme: "animal", vocabId: "07-57", effectText: "—", bonusText: "獲得嘲諷", bonusKeywords: ["taunt"] },
  { id: "leg-a06", nameZh: "穿山甲", type: "minion", cost: 3, attack: 2, health: 5, rarity: "common", theme: "animal", vocabId: "07-14", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a07", nameZh: "雲豹", type: "minion", cost: 5, attack: 5, health: 4, rarity: "epic", theme: "animal", vocabId: "07-21", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a08", nameZh: "水鹿", type: "minion", cost: 5, attack: 5, health: 5, rarity: "rare", theme: "animal", vocabId: "07-22", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a09", nameZh: "黑熊", type: "minion", cost: 6, attack: 6, health: 6, rarity: "rare", theme: "animal", vocabId: "07-23", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  // ── 植物與器物（純器物，無人物）──
  { id: "leg-p01", nameZh: "涉水而過", type: "spell", cost: 1, rarity: "common", theme: "tool", vocabId: "26-61", effect: "buffFriend11", effectText: "一個友方隨從 +1/+1", bonusText: "並獲得衝鋒" },
  { id: "leg-p02", nameZh: "石壓陷阱", type: "spell", cost: 2, rarity: "common", theme: "tool", vocabId: "16-09", effect: "dmgEnemyMinion3", effectText: "對一個敵方隨從造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-p03", nameZh: "香菇", type: "minion", cost: 2, attack: 1, health: 4, rarity: "common", theme: "plant", vocabId: "08-18", effectText: "—", bonusText: "獲得嘲諷", bonusKeywords: ["taunt"] },
  { id: "leg-p04", nameZh: "火塘", type: "spell", cost: 3, rarity: "common", theme: "tool", vocabId: "30-39", effect: "healHero5", effectText: "回復我方英雄 5 點", bonusText: "額外回復 3 點" },
  { id: "leg-p05", nameZh: "千年檜木", type: "minion", cost: 5, attack: 2, health: 8, rarity: "rare", theme: "plant", vocabId: "08-03", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+3", bonusStats: { atk: 0, hp: 3 } },
];

// 幼樹 token（不入牌庫，僅由 Pusu Qhuni 戰吼召喚）
export const TOKEN_SAPLING: Card = {
  id: "leg-token-sapling",
  nameZh: "幼樹",
  type: "minion",
  cost: 0,
  attack: 2,
  health: 2,
  rarity: "common",
  theme: "plant",
  vocabId: "08-03",
  effectText: "—",
  bonusText: "—",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "border-slate-400",
  rare: "border-sky-400",
  epic: "border-fuchsia-400",
  legendary: "border-amber-400",
};

// build 期驗證：所有卡的 vocabId 必須存在於詞庫（vocab() 對未知 id 會丟錯）
for (const c of [...CARDS, TOKEN_SAPLING]) vocab(c.vocabId);
