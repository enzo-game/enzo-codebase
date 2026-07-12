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
  // ── 傳說擴充第一波：射日長路（低風險，採旅程物件與地景）──
  { id: "leg-l12", nameZh: "遠行的柑橘", type: "minion", cost: 1, attack: 1, health: 2, rarity: "common", theme: "legend", vocabId: "08-08", effect: "draw1", effectText: "戰吼：抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-l13", nameZh: "接力的道路", type: "spell", cost: 2, rarity: "common", theme: "legend", vocabId: "10-01", effect: "draw1", effectText: "抽 1 張牌", bonusText: "再抽 1 張" },
  // ── 自然力 ──
  { id: "leg-n01", nameZh: "星空", type: "spell", cost: 1, rarity: "common", theme: "nature", vocabId: "11-05", effect: "draw1", effectText: "抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-n02", nameZh: "濃霧", type: "spell", cost: 2, rarity: "rare", theme: "nature", vocabId: "11-12", effect: "allFriendStealth", effectText: "我方所有隨從獲得潛行", bonusText: "各 +0/+1" },
  { id: "leg-n03", nameZh: "雷聲", type: "spell", cost: 3, rarity: "common", theme: "nature", vocabId: "11-10", effect: "dmgEnemyHero3", effectText: "對敵方英雄造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-n04", nameZh: "月光", type: "spell", cost: 3, rarity: "rare", theme: "nature", vocabId: "11-03", effect: "draw2", effectText: "抽 2 張牌", bonusText: "再抽 1 張" },
  { id: "leg-n05", nameZh: "山嵐", type: "minion", cost: 3, attack: 2, health: 2, rarity: "common", theme: "nature", vocabId: "10-04", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-n06", nameZh: "閃電", type: "spell", cost: 5, rarity: "rare", theme: "nature", vocabId: "11-14", effect: "dmgAny5", effectText: "對一個目標造成 5 點傷害", bonusText: "改為 6 點" },
  { id: "leg-n07", nameZh: "颱風", type: "spell", cost: 8, rarity: "epic", theme: "nature", vocabId: "11-21", effect: "aoeEnemy3", effectText: "對所有敵方隨從造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-n08", nameZh: "休息的夜", type: "spell", cost: 2, rarity: "rare", theme: "nature", vocabId: "13-22", effect: "allFriendStealth", effectText: "我方所有隨從獲得潛行", bonusText: "各 +0/+1" },
  { id: "leg-n09", nameZh: "溪畔補給", type: "minion", cost: 2, attack: 1, health: 3, rarity: "common", theme: "nature", vocabId: "10-03", effect: "healHero1", effectText: "回合結束：回復我方英雄 1", bonusText: "改為回復 2" },
  { id: "leg-n10", nameZh: "山口逆風", type: "spell", cost: 3, rarity: "rare", theme: "nature", vocabId: "10-04", effect: "shuffleBackEnemy", effectText: "將一個敵方隨從洗回敵方牌庫", bonusText: "額外抽 1 張" },
  { id: "leg-n11", nameZh: "退水河床", type: "spell", cost: 3, rarity: "rare", theme: "nature", vocabId: "11-31", effect: "aoeEnemy2", effectText: "對所有敵方隨從造成 2 點傷害", bonusText: "改為 3 點" },
  { id: "leg-n12", nameZh: "瀑布", type: "spell", cost: 2, rarity: "common", theme: "nature", vocabId: "10-20", effect: "dmgAny2", effectText: "造成 2 點傷害（任一目標）", bonusText: "改為 3 點" },
  { id: "leg-n13", nameZh: "冬夜", type: "spell", cost: 3, rarity: "common", theme: "nature", vocabId: "11-08", effect: "dmgEnemyHero3", effectText: "對敵方英雄造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-n14", nameZh: "地震", type: "spell", cost: 4, rarity: "rare", theme: "nature", vocabId: "11-19", effect: "dmgMinion4", effectText: "對一個隨從造成 4 點傷害", bonusText: "改為 5 點" },
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
  { id: "leg-a10", nameZh: "貓頭鷹", type: "minion", cost: 3, attack: 2, health: 3, rarity: "common", theme: "animal", vocabId: "07-13", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a11", nameZh: "烏龜", type: "minion", cost: 2, attack: 1, health: 4, rarity: "common", theme: "animal", vocabId: "07-18", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a12", nameZh: "青蛙", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-12", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a13", nameZh: "山羊", type: "minion", cost: 4, attack: 4, health: 4, rarity: "common", theme: "animal", vocabId: "07-04", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a14", nameZh: "溪魚", type: "minion", cost: 2, attack: 2, health: 3, rarity: "common", theme: "animal", vocabId: "07-07", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  // ── 植物與器物（純器物，無人物）──
  { id: "leg-p01", nameZh: "涉水而過", type: "spell", cost: 1, rarity: "common", theme: "tool", vocabId: "26-61", effect: "buffFriend11", effectText: "一個友方隨從 +1/+1", bonusText: "並獲得衝鋒" },
  { id: "leg-p02", nameZh: "石壓陷阱", type: "spell", cost: 2, rarity: "common", theme: "tool", vocabId: "16-09", effect: "dmgEnemyMinion3", effectText: "對一個敵方隨從造成 3 點傷害", bonusText: "改為 4 點" },
  { id: "leg-p03", nameZh: "香菇", type: "minion", cost: 2, attack: 1, health: 4, rarity: "common", theme: "plant", vocabId: "08-18", effectText: "—", bonusText: "獲得嘲諷", bonusKeywords: ["taunt"] },
  { id: "leg-p04", nameZh: "火塘", type: "spell", cost: 3, rarity: "common", theme: "tool", vocabId: "30-39", effect: "healHero5", effectText: "回復我方英雄 5 點", bonusText: "額外回復 3 點" },
  { id: "leg-p05", nameZh: "千年檜木", type: "minion", cost: 5, attack: 2, health: 8, rarity: "rare", theme: "plant", vocabId: "08-03", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+3", bonusStats: { atk: 0, hp: 3 } },
  { id: "leg-p06", nameZh: "風停後的路", type: "spell", cost: 2, rarity: "common", theme: "tool", vocabId: "11-31", effect: "buffFriend11", effectText: "一個友方隨從 +1/+1", bonusText: "並獲得衝鋒" },
  { id: "leg-p07", nameZh: "石堆路標", type: "minion", cost: 3, attack: 1, health: 5, rarity: "common", theme: "tool", vocabId: "12-11", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+1", bonusStats: { atk: 0, hp: 1 } },
  { id: "leg-p08", nameZh: "火光守夜", type: "spell", cost: 3, rarity: "common", theme: "tool", vocabId: "30-33", effect: "healHero5", effectText: "回復我方英雄 5 點", bonusText: "額外回復 3 點" },
  { id: "leg-p09", nameZh: "樹根護徑", type: "minion", cost: 4, attack: 2, health: 6, rarity: "common", theme: "plant", vocabId: "08-28", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-p10", nameZh: "竹林", type: "minion", cost: 4, attack: 3, health: 5, rarity: "common", theme: "plant", vocabId: "08-14", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-p11", nameZh: "落葉鋪路", type: "spell", cost: 1, rarity: "common", theme: "plant", vocabId: "08-06", effect: "buffFriend11", effectText: "一個友方隨從 +1/+1", bonusText: "並獲得衝鋒" },
  { id: "leg-p12", nameZh: "蕨徑", type: "minion", cost: 2, attack: 1, health: 3, rarity: "common", theme: "plant", vocabId: "08-21", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-p13", nameZh: "花開", type: "spell", cost: 3, rarity: "common", theme: "plant", vocabId: "08-09", effect: "healHero5", effectText: "回復我方英雄 5 點", bonusText: "額外回復 3 點" },

  // ══════════════════════════════════════════════════════════════
  // ORDER-078 雙人對戰擴充 Batch 1 · 山林動物（24，只用引擎現有 effect；vocabId 全查證）
  // ══════════════════════════════════════════════════════════════
  { id: "leg-a15", nameZh: "山貓", type: "minion", cost: 2, attack: 2, health: 2, rarity: "common", theme: "animal", vocabId: "07-05", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a16", nameZh: "獼猴", type: "minion", cost: 3, attack: 3, health: 2, rarity: "common", theme: "animal", vocabId: "07-09", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a17", nameZh: "老鷹", type: "minion", cost: 4, attack: 4, health: 3, rarity: "rare", theme: "animal", vocabId: "07-54", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a18", nameZh: "松鼠", type: "minion", cost: 1, attack: 1, health: 2, rarity: "common", theme: "animal", vocabId: "07-30", effect: "draw1", effectText: "戰吼：抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-a19", nameZh: "蝴蝶", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-27", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a20", nameZh: "蜜蜂", type: "minion", cost: 2, attack: 2, health: 1, rarity: "common", theme: "animal", vocabId: "07-35", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a21", nameZh: "虎頭蜂", type: "minion", cost: 3, attack: 3, health: 2, rarity: "rare", theme: "animal", vocabId: "07-59", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a22", nameZh: "螃蟹", type: "minion", cost: 2, attack: 1, health: 4, rarity: "common", theme: "animal", vocabId: "07-46", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a23", nameZh: "溪蝦", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-42", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a24", nameZh: "野鴨", type: "minion", cost: 2, attack: 2, health: 3, rarity: "common", theme: "animal", vocabId: "07-38", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a25", nameZh: "鵝", type: "minion", cost: 3, attack: 2, health: 4, rarity: "common", theme: "animal", vocabId: "07-56", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a26", nameZh: "雞", type: "minion", cost: 1, attack: 1, health: 2, rarity: "common", theme: "animal", vocabId: "07-08", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a27", nameZh: "麻雀", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-52", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a28", nameZh: "鴿子", type: "minion", cost: 2, attack: 2, health: 2, rarity: "common", theme: "animal", vocabId: "07-16", effect: "draw1", effectText: "戰吼：抽 1 張牌", bonusText: "再抽 1 張" },
  { id: "leg-a29", nameZh: "田間鼠", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-11", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a30", nameZh: "田鼠", type: "minion", cost: 2, attack: 2, health: 2, rarity: "common", theme: "animal", vocabId: "07-31", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a31", nameZh: "蝸牛", type: "minion", cost: 2, attack: 0, health: 5, rarity: "common", theme: "animal", vocabId: "07-51", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a32", nameZh: "螞蟻", type: "minion", cost: 2, attack: 1, health: 3, rarity: "common", theme: "animal", vocabId: "07-55", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+0/+2", bonusStats: { atk: 0, hp: 2 } },
  { id: "leg-a33", nameZh: "蝙蝠", type: "minion", cost: 3, attack: 3, health: 2, rarity: "rare", theme: "animal", vocabId: "07-50", keywords: ["stealth"], effectText: "潛行", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a34", nameZh: "烏鴉", type: "minion", cost: 3, attack: 3, health: 3, rarity: "common", theme: "animal", vocabId: "07-62", effectText: "—", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a35", nameZh: "水牛", type: "minion", cost: 5, attack: 4, health: 6, rarity: "rare", theme: "animal", vocabId: "07-10", keywords: ["taunt"], effectText: "嘲諷", bonusText: "+1/+1", bonusStats: { atk: 1, hp: 1 } },
  { id: "leg-a36", nameZh: "馬", type: "minion", cost: 4, attack: 4, health: 4, rarity: "rare", theme: "animal", vocabId: "07-44", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a37", nameZh: "幼犬", type: "minion", cost: 1, attack: 1, health: 1, rarity: "common", theme: "animal", vocabId: "07-63", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
  { id: "leg-a38", nameZh: "山鳥", type: "minion", cost: 2, attack: 2, health: 2, rarity: "common", theme: "animal", vocabId: "07-06", keywords: ["charge"], effectText: "衝鋒", bonusText: "+1/+0", bonusStats: { atk: 1, hp: 0 } },
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

/** 玩家看到卡片時的學習小註：傳說牌標出故事來源；自然/動物/器物牌標出詞彙與山林生活脈絡。 */
export const CARD_LEARNING: Record<string, string> = {
  "leg-l01": "射日傳說裡，遠行者沿途種下作物，象徵長路上的補給與接力。",
  "leg-l02": "射日傳說以遠行與弓箭為核心意象，這張牌連到「弓」的族語詞。",
  "leg-l03": "馬威傳說常以巨大腳步解釋地景，這張牌取「留下痕跡」的安全意象。",
  "leg-l04": "大洪水傳說提醒人與水勢、山路之間的關係，這裡用溪水暴漲呈現阻路。",
  "leg-l05": "馬威故事中族人用燒紅石頭智取巨人，這張牌取器物與火光意象。",
  "leg-l06": "射日傳說說遠古曾有兩個太陽，使大地無法休息。",
  "leg-l07": "彩虹橋是敏感信仰意象；遊戲只保留彩虹作為連結與守望的畫面。",
  "leg-l08": "射日傳說強調長途任務與世代接力，不演出人物神聖化。",
  "leg-l09": "大洪水傳說連到災後倖存與重建，牌面只呈現自然力量。",
  "leg-l10": "Pusu Qhuni 是石木起源意象；卡片以巨岩與樹的保護感呈現。",
  "leg-l11": "馬威是地景傳說角色；此牌保留故事感，後續仍建議文化複核。",
  "leg-l12": "射日長路版本：沿途留下柑橘，讓後來的人能接著走。",
  "leg-l13": "射日傳說不是一人完成，而是把路交給下一代繼續走。",
  "leg-n01": "星空連到夜晚與方向感，也呼應洪水傳說中的星辰意象。",
  "leg-n02": "山林濃霧會改變視線與行路節奏，是山徑生活常見自然條件。",
  "leg-n03": "雷聲是天候詞彙，讓玩家從聲音與天氣學族語。",
  "leg-n04": "月光與夜路相連，讓玩家學會自然時間與光線詞彙。",
  "leg-n05": "山嵐是山谷裡的風與霧，連到行路時的遮蔽感。",
  "leg-n06": "閃電是天候詞彙，牌效用瞬間傷害表現它的速度。",
  "leg-n07": "颱風連到山路中斷與重建，呼應旅程模式的修路主題。",
  "leg-n08": "射日之後世界重新有夜晚，休息也成為旅程的一部分。",
  "leg-n09": "小溪是山路補給與過路地景，讓玩家學到溪流相關詞彙。",
  "leg-n10": "山口逆風把風變成路上的阻力，學的是自然與地形的關係。",
  "leg-n11": "大洪水退去後，河床重新顯露；牌面只呈現水勢消退的地景，不涉儀式。",
  "leg-n12": "瀑布是峽谷地景詞彙，水勢衝擊的力量在牌面轉成對目標的傷害。",
  "leg-n13": "冬夜是季節與天候詞彙，寒冬直逼讓玩家從氣候感受學族語。",
  "leg-n14": "地震是自然現象詞彙，大地搖動的力量在牌面轉成對隨從的衝擊。",
  "leg-a01": "山羌是台灣山林動物，卡牌用快速行動讓玩家記住牠的敏捷。",
  "leg-a02": "山豬是常見山林動物詞彙，牌面作為基礎戰力而非傳說角色。",
  "leg-a03": "飛鼠連到夜間山林生態，玩家同時學動物詞與抽牌節奏。",
  "leg-a04": "獵犬屬於山林生活與狩獵工具脈絡，避免描寫禁忌或暴力儀式。",
  "leg-a05": "水鳥連到溪流與濕地環境，是從地景學動物詞的一張牌。",
  "leg-a06": "穿山甲是山林動物詞彙，厚實身形轉成嘲諷防守。",
  "leg-a07": "雲豹是山林象徵性動物，潛行效果表現牠的隱密而非神化。",
  "leg-a08": "水鹿連到山林大型動物，牌面保留自然生態學習點。",
  "leg-a09": "黑熊是山林重要動物，卡牌以防守提醒玩家尊重山林距離。",
  "leg-a10": "貓頭鷹是夜行性山林鳥類，潛行效果連到牠夜間無聲狩獵的習性。",
  "leg-a11": "烏龜是常見動物詞彙，厚殼轉成嘲諷防守，讓玩家從防禦記住牠。",
  "leg-a12": "青蛙是溪畔常見動物，一躍而出的衝鋒表現牠的彈跳。",
  "leg-a13": "山羊是山區常見動物，穩健的身形轉成牌面上的中堅戰力。",
  "leg-a14": "溪魚連到溪流生態與飲食詞彙，是從水域環境學動物詞的一張牌。",
  "leg-p01": "涉水而過是山路經驗，也讓玩家學會行動與地形相關語感。",
  "leg-p02": "石壓陷阱是器物詞彙；遊戲只作工具牌，不描寫禁忌狩獵細節。",
  "leg-p03": "香菇連到森林裡可見的植物與食材詞彙。",
  "leg-p04": "火塘代表休息與取暖，不作儀式演出，只保留生活場景。",
  "leg-p05": "檜木連到山林植物與長久守護感，卡牌用高生命值呈現。",
  "leg-p06": "雨停後路才重新可走，這張牌連到修路與同行的旅程主題。",
  "leg-p07": "石堆可作山路標記；牌面避免祭壇化，只呈現自然路標。",
  "leg-p08": "火光守夜是夜路中的安全與陪伴，學的是光明與守望意象。",
  "leg-p09": "山徑旁的樹根抓住土石、護住路基；以植物與地形呈現，不神聖化樹木本身。",
  "leg-p10": "竹子是山林常見植物，成林後如牆，卡牌用嘲諷呈現遮蔽與阻擋。",
  "leg-p11": "落葉鋪在山徑上，連到行走與植物詞彙，是從地景學語感的一張牌。",
  "leg-p12": "蕨類是山林常見地被植物，成叢護徑，卡牌用嘲諷呈現遮蔽。",
  "leg-p13": "花朵連到植物與季節詞彙，綻放的意象在牌面轉成回復與生機。",
  "leg-token-sapling": "幼樹連到 Pusu Qhuni 的樹木意象，也提醒牌面以植物代替人物神聖化。",
  // ── ORDER-078 擴充 Batch 1 · 山林動物（24）──
  "leg-a15": "山貓行動隱密，潛行效果連到牠夜間無聲的獵食習性。",
  "leg-a16": "獼猴是山林常見動物，靈活攀跳的身手轉成牌面的衝鋒。",
  "leg-a17": "老鷹盤旋高空、俯衝迅捷，衝鋒效果表現牠的速度。",
  "leg-a18": "松鼠在林間穿梭儲糧，抽牌呼應牠收集食物的習性。",
  "leg-a19": "蝴蝶輕巧難捉，潛行效果連到牠翩飛的身影。",
  "leg-a20": "蜜蜂群飛採蜜，快速的螫刺轉成牌面的衝鋒。",
  "leg-a21": "虎頭蜂是山林中需要保持距離的昆蟲，兇猛突襲轉成衝鋒。",
  "leg-a22": "螃蟹在溪石間橫行，硬殼護身轉成嘲諷防守。",
  "leg-a23": "溪蝦連到溪流生態與飲食詞彙，是從水域環境學動物詞的一張牌。",
  "leg-a24": "野鴨連到溪流與濕地環境，是從水邊學動物詞的一張牌。",
  "leg-a25": "鵝會鳴叫看守，警戒的性子轉成牌面的嘲諷防守。",
  "leg-a26": "雞是聚落常見家禽，基礎戰力讓玩家從日常生活學族語。",
  "leg-a27": "麻雀成群快飛，靈巧的身影轉成牌面的衝鋒。",
  "leg-a28": "鴿子善於認路歸巢，抽牌呼應牠傳訊帶回的意象。",
  "leg-a29": "老鼠善於藏身，潛行效果連到牠隱密的行動。",
  "leg-a30": "田鼠在田間打洞穿行，潛行效果連到牠隱蔽的習性。",
  "leg-a31": "蝸牛背殼緩行，厚殼護身轉成嘲諷防守。",
  "leg-a32": "螞蟻群聚築巢、分工合作，眾多身形轉成嘲諷防守。",
  "leg-a33": "蝙蝠夜間無聲飛行，潛行效果連到牠黑暗中的行動。",
  "leg-a34": "烏鴉是山林常見鳥類，牌面只作自然生態的鳥，不做凶兆敘事。",
  "leg-a35": "水牛體壯力大，穩健的身形轉成嘲諷防守的中堅戰力。",
  "leg-a36": "馬奔行迅捷，衝鋒效果表現牠的速度。",
  "leg-a37": "幼犬活潑好動，一衝而出的衝鋒表現牠的朝氣。",
  "leg-a38": "山鳥掠飛林間，衝鋒效果表現牠的敏捷。",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "border-slate-400",
  rare: "border-sky-400",
  epic: "border-fuchsia-400",
  legendary: "border-amber-400",
};

// build 期驗證：所有卡的 vocabId 必須存在於詞庫（vocab() 對未知 id 會丟錯）
for (const c of [...CARDS, TOKEN_SAPLING]) {
  vocab(c.vocabId);
  if (!CARD_LEARNING[c.id]) throw new Error(`缺少卡片學習小註：${c.id}`);
}
