// 卡池擴充生成器（司令：往 1000 張）。批次生成「安全題材」卡——動物／植物／自然／器物，
// 觀察得到的自然世界，非神聖／傳說題材（legend 主題與 Gaya/Utux/Sisin 一律不自動生成，走文化複核）。
// 規則：重用引擎現有效果與關鍵字、依費用平衡數值、決定性（同輸入同輸出，可重現 build）、
// 去重（跳過已存在的卡名）、每張配一個真實 vocabId（/collection 會 vocab() 查，需有效）。
// 產出 src/data/cards.generated.json，由 cards.ts 併進 CARDS。
//
// 往 1000 張：把更多「已審核」的安全題材主題名字加進下面的 SUBJECTS 再跑一次即可。
import { readFileSync, writeFileSync } from "node:fs";

const existing = new Set(
  [...readFileSync("src/data/cards.ts", "utf8").matchAll(/nameZh: "([^"]+)"/g)].map((m) => m[1]),
);
const vocabIds = JSON.parse(readFileSync("src/data/truku-vocab.json", "utf8")).entries.map((e) => e.id);

// ── 安全題材主題名（真實台灣山林自然物，避開神聖/禁忌/占卜鳥類）。type: m=隨從 s=法術 ──
const SUBJECTS = [
  // 動物（哺乳）
  ["石虎", "animal", "m"], ["白鼻心", "animal", "m"], ["鼬獾", "animal", "m"], ["黃喉貂", "animal", "m"],
  ["台灣野兔", "animal", "m"], ["赤腹松鼠", "animal", "m"], ["長鬃山羊", "animal", "m"], ["水獺", "animal", "m"],
  // 動物（鳥，非占卜靈鳥）
  ["五色鳥", "animal", "m"], ["綠繡眼", "animal", "m"], ["翠鳥", "animal", "m"], ["夜鷺", "animal", "m"],
  ["白鷺鷥", "animal", "m"], ["大冠鷲", "animal", "m"], ["帝雉", "animal", "m"], ["藍腹鷴", "animal", "m"],
  ["環頸雉", "animal", "m"], ["竹雞", "animal", "m"], ["台灣藍鵲", "animal", "m"], ["小雨燕", "animal", "m"],
  // 動物（魚蟲兩棲）
  ["香魚", "animal", "m"], ["苦花", "animal", "m"], ["何氏棘魞", "animal", "m"], ["溪哥仔", "animal", "m"],
  ["獨角仙", "animal", "m"], ["鍬形蟲", "animal", "m"], ["螢火蟲", "animal", "m"], ["蜻蜓", "animal", "m"],
  ["竹節蟲", "animal", "m"], ["紋白蝶", "animal", "m"], ["莫氏樹蛙", "animal", "m"], ["盤古蟾蜍", "animal", "m"],
  // 植物（樹）
  ["台灣杉", "plant", "m"], ["台灣扁柏", "plant", "m"], ["台灣二葉松", "plant", "m"], ["玉山圓柏", "plant", "m"],
  ["昆欄樹", "plant", "m"], ["牛樟", "plant", "m"], ["烏心石", "plant", "m"], ["楓香", "plant", "m"],
  ["青楓", "plant", "m"], ["台灣櫸", "plant", "m"], ["構樹", "plant", "m"], ["山黃麻", "plant", "m"],
  // 植物（花草蕨）
  ["森氏杜鵑", "plant", "m"], ["玉山薄雪草", "plant", "m"], ["阿里山龍膽", "plant", "m"], ["台灣一葉蘭", "plant", "m"],
  ["筆筒樹", "plant", "m"], ["月桃", "plant", "m"], ["五節芒", "plant", "m"], ["血桐", "plant", "m"],
  ["山棕", "plant", "m"], ["黃藤", "plant", "m"], ["台灣馬醉木", "plant", "m"], ["昭和草", "plant", "m"],
  // 器物（工具/食物）
  ["竹筒飯", "tool", "m"], ["醃肉", "tool", "m"], ["藤編籃", "tool", "m"], ["苧麻線", "tool", "m"],
  ["木臼", "tool", "m"], ["竹杯", "tool", "m"], ["骨針", "tool", "m"], ["石斧", "tool", "m"],
  ["魚簍", "tool", "m"], ["蜂蠟", "tool", "m"], ["火種", "tool", "m"], ["獸皮", "tool", "m"],
  // 自然/天氣/地景（多做法術）
  ["晨霧", "nature", "s"], ["山風", "nature", "s"], ["雷雨", "nature", "s"], ["冰雹", "nature", "s"],
  ["寒流", "nature", "s"], ["土石流", "nature", "s"], ["山崩", "nature", "s"], ["湍流", "nature", "s"],
  ["深潭", "nature", "s"], ["斷崖", "nature", "s"], ["雲海", "nature", "s"], ["霜降", "nature", "s"],
  ["溪水暴漲後", "nature", "s"], ["山谷回音", "nature", "s"], ["夜霧", "nature", "s"], ["朝陽初露", "nature", "s"],
];

// 隨從數值曲線：總值 ≈ cost*2+1，攻守均分。關鍵字微調（嘲諷偏血、衝鋒/突襲偏攻且少 1 總值）。
function minionStats(cost, kw) {
  let total = cost * 2 + 1;
  if (kw === "charge" || kw === "rush" || kw === "windfury") total -= 1;
  let atk = Math.round(total / 2);
  let hp = total - atk;
  if (kw === "taunt" || kw === "divineShield") { hp += 1; atk = Math.max(1, atk - 1); }
  return { atk: Math.max(1, atk), hp: Math.max(1, hp) };
}

const KW_TEXT = { taunt: "嘲諷", stealth: "潛行", charge: "衝鋒", rush: "突襲", divineShield: "石鎧", lifesteal: "汲取", windfury: "疾風" };
// 各主題可帶的關鍵字池（含 null=無關鍵字的普通隨從）。
const KW_BY_THEME = {
  animal: [null, "charge", "rush", "stealth", "windfury", null],
  plant: [null, "taunt", "divineShield", "taunt", null, null],
  tool: [null, "lifesteal", "taunt", "divineShield", null, null],
};

// 法術：直接沿用現有已知可運作的 (effect, 文字, 加成) 組合，只換名字/主題，確保加成機制正確。
const SPELL_KINDS = [
  { cost: 1, effect: "buffFriend11", text: "給一個友方隨從 +1/+1", bonus: "改為 +2/+2" },
  { cost: 2, effect: "dmgEnemyMinion3", text: "對一個敵方隨從造成 3 點傷害", bonus: "改為 4 點" },
  { cost: 3, effect: "aoeEnemy2", text: "對所有敵方隨從造成 2 點傷害", bonus: "改為 3 點" },
  { cost: 3, effect: "draw2", text: "抽 2 張牌", bonus: "再抽 1 張" },
  { cost: 3, effect: "dmgMinion4", text: "對一個隨從造成 4 點傷害", bonus: "改為 5 點" },
  { cost: 4, effect: "dmgAny5", text: "造成 5 點傷害（任一目標）", bonus: "改為 6 點" },
  { cost: 4, effect: "healHero5", text: "回復我方英雄 5 點", bonus: "額外抽 1 張" },
  { cost: 5, effect: "aoeEnemy3", text: "對所有敵方隨從造成 3 點傷害", bonus: "改為 4 點" },
];

// 稀有度：多數普通、部分稀有、少量史詩；不自動生成傳說。
function rarityFor(i) {
  const r = i % 15;
  if (r === 0) return "epic";
  if (r <= 4) return "rare";
  return "common";
}

// 學習小註（每張卡都需要；簡短、準確、非神聖題材）。
const LEARN_BY_THEME = {
  animal: (n) => `「${n}」是台灣山林裡的動物，從生態觀察認識牠。`,
  plant: (n) => `「${n}」是台灣山林的植物，從山林植被認識牠。`,
  nature: (n) => `「${n}」是山林中的自然現象與地景，學自然與地形的語感。`,
  tool: (n) => `「${n}」是山林生活的器物或食材，連到日常生活脈絡。`,
};

const cards = [];
const learn = {};
let mi = 0, si = 0, vi = 0;
SUBJECTS.forEach((sub, idx) => {
  const [name, theme, kind] = sub;
  if (existing.has(name)) return; // 去重：跳過已存在卡名
  const id = `gen-${String(idx + 1).padStart(4, "0")}`;
  const vocabId = vocabIds[vi++ % vocabIds.length];
  const rarity = rarityFor(idx);
  learn[id] = (LEARN_BY_THEME[theme] ?? LEARN_BY_THEME.nature)(name);
  if (kind === "s") {
    const k = SPELL_KINDS[si++ % SPELL_KINDS.length];
    cards.push({ id, nameZh: name, type: "spell", cost: k.cost, rarity, theme, vocabId, effect: k.effect, effectText: k.text, bonusText: k.bonus });
  } else {
    // 隨從：費用在 1..7 間依序分布（偏中低費）
    const costPattern = [2, 1, 3, 2, 4, 3, 2, 5, 4, 3, 6, 2, 4, 7, 3];
    const cost = costPattern[mi % costPattern.length];
    const kwPool = KW_BY_THEME[theme] ?? [null];
    const kw = kwPool[mi % kwPool.length];
    mi++;
    const { atk, hp } = minionStats(cost, kw);
    const card = { id, nameZh: name, type: "minion", cost, attack: atk, health: hp, rarity, theme, vocabId,
      effectText: kw ? KW_TEXT[kw] : "—",
      bonusText: kw === "taunt" ? "+0/+2" : "+1/+1",
      bonusStats: kw === "taunt" ? { atk: 0, hp: 2 } : { atk: 1, hp: 1 } };
    if (kw) card.keywords = [kw];
    cards.push(card);
  }
});

writeFileSync("src/data/cards.generated.json", JSON.stringify(cards, null, 2) + "\n");
writeFileSync("src/data/cardLearning.generated.json", JSON.stringify(learn, null, 2) + "\n");
const byRarity = cards.reduce((a, c) => ((a[c.rarity] = (a[c.rarity] || 0) + 1), a), {});
const byType = cards.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {});
console.log(`生成 ${cards.length} 張（去重後）| 型別 ${JSON.stringify(byType)} | 稀有度 ${JSON.stringify(byRarity)}`);
