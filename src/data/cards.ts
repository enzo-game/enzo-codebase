// Enzo 首發 20 張卡（依 enzo-game-design/docs/card-design-v1.md）
// 詞彙綁定 (truku) 由 enzo-language-truku 提供，本檔僅含卡牌機制數值。

export type CardType = "minion" | "spell";
export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Theme = "animal" | "plant" | "nature" | "tool" | "person";

export interface Card {
  id: string;
  nameZh: string;
  type: CardType;
  cost: number;
  attack?: number;
  health?: number;
  rarity: Rarity;
  theme: Theme;
  difficulty: 1 | 2 | 3;
  baseEffect: string;
  trukuBonus: string;
}

export const CARDS: Card[] = [
  { id: "enzo-001", nameZh: "山豬", type: "minion", cost: 2, attack: 3, health: 2, rarity: "common", theme: "animal", difficulty: 1, baseEffect: "無", trukuBonus: "+0/+1" },
  { id: "enzo-002", nameZh: "山羌", type: "minion", cost: 1, attack: 2, health: 1, rarity: "common", theme: "animal", difficulty: 1, baseEffect: "無", trukuBonus: "+1/+0" },
  { id: "enzo-003", nameZh: "帝雉", type: "minion", cost: 3, attack: 2, health: 4, rarity: "common", theme: "animal", difficulty: 1, baseEffect: "無", trukuBonus: "獲得嘲諷" },
  { id: "enzo-004", nameZh: "黑熊", type: "minion", cost: 6, attack: 6, health: 6, rarity: "rare", theme: "animal", difficulty: 2, baseEffect: "無", trukuBonus: "+2/+2" },
  { id: "enzo-005", nameZh: "獵犬", type: "minion", cost: 2, attack: 2, health: 3, rarity: "common", theme: "animal", difficulty: 1, baseEffect: "無", trukuBonus: "戰吼：抽 1 張牌" },
  { id: "enzo-006", nameZh: "小米", type: "minion", cost: 1, attack: 1, health: 3, rarity: "common", theme: "plant", difficulty: 1, baseEffect: "無", trukuBonus: "回復英雄 2 點" },
  { id: "enzo-007", nameZh: "苧麻", type: "minion", cost: 3, attack: 3, health: 3, rarity: "common", theme: "plant", difficulty: 1, baseEffect: "無", trukuBonus: "戰吼：友軍 +1 生命" },
  { id: "enzo-008", nameZh: "樟樹精靈", type: "minion", cost: 5, attack: 4, health: 5, rarity: "rare", theme: "plant", difficulty: 2, baseEffect: "無", trukuBonus: "戰吼：召喚 1/1 樹苗" },
  { id: "enzo-009", nameZh: "溪流之靈", type: "minion", cost: 4, attack: 3, health: 4, rarity: "rare", theme: "nature", difficulty: 2, baseEffect: "無", trukuBonus: "戰吼：凍結一個敵方隨從" },
  { id: "enzo-010", nameZh: "山嵐", type: "minion", cost: 3, attack: 2, health: 2, rarity: "common", theme: "nature", difficulty: 1, baseEffect: "無", trukuBonus: "潛行" },
  { id: "enzo-011", nameZh: "獵人", type: "minion", cost: 4, attack: 4, health: 3, rarity: "rare", theme: "person", difficulty: 2, baseEffect: "無", trukuBonus: "戰吼：對敵方隨從造成 2 傷害" },
  { id: "enzo-012", nameZh: "織女", type: "minion", cost: 3, attack: 2, health: 4, rarity: "rare", theme: "person", difficulty: 2, baseEffect: "無", trukuBonus: "回合結束友軍 +0/+1" },
  { id: "enzo-013", nameZh: "頭目 Rudan", type: "minion", cost: 7, attack: 6, health: 7, rarity: "epic", theme: "person", difficulty: 3, baseEffect: "無", trukuBonus: "戰吼：所有友軍 +1/+1" },
  { id: "enzo-014", nameZh: "祖靈 Utux", type: "minion", cost: 9, attack: 8, health: 8, rarity: "legendary", theme: "person", difficulty: 3, baseEffect: "無", trukuBonus: "戰吼：復活一個死亡隨從" },
  { id: "enzo-015", nameZh: "弓箭", type: "spell", cost: 1, rarity: "common", theme: "tool", difficulty: 1, baseEffect: "造成 2 傷害", trukuBonus: "改為 3 傷害" },
  { id: "enzo-016", nameZh: "陷阱", type: "spell", cost: 2, rarity: "common", theme: "tool", difficulty: 1, baseEffect: "對敵方隨從造成 3 傷害", trukuBonus: "額外抽 1 張牌" },
  { id: "enzo-017", nameZh: "獵刀", type: "spell", cost: 2, rarity: "common", theme: "tool", difficulty: 1, baseEffect: "友軍 +2/+0", trukuBonus: "改為 +2/+2" },
  { id: "enzo-018", nameZh: "火塘", type: "spell", cost: 3, rarity: "rare", theme: "tool", difficulty: 2, baseEffect: "回復英雄 5 點", trukuBonus: "額外回復 3 點" },
  { id: "enzo-019", nameZh: "出草號令", type: "spell", cost: 4, rarity: "rare", theme: "nature", difficulty: 2, baseEffect: "所有友軍 +1/+0", trukuBonus: "改為 +1/+1" },
  { id: "enzo-020", nameZh: "彩虹橋 Hakaw Utux", type: "spell", cost: 6, rarity: "epic", theme: "nature", difficulty: 3, baseEffect: "對所有敵方隨從造成 3 傷害", trukuBonus: "英雄回復 5 點" },
];

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "border-slate-400",
  rare: "border-sky-400",
  epic: "border-fuchsia-400",
  legendary: "border-amber-400",
};

export const THEME_EMOJI: Record<Theme, string> = {
  animal: "🐗",
  plant: "🌿",
  nature: "⛰️",
  tool: "🏹",
  person: "🧑",
};
