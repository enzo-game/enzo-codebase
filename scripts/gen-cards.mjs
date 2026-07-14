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
  // ── 批次1 擴充（往 ~180；仍為安全題材、真實台灣山林物、避紅線）──
  // 動物（哺乳/鳥/兩棲爬蟲/魚蟲）
  ["梅花鹿", "animal", "m"], ["麝香貓", "animal", "m"], ["食蟹獴", "animal", "m"], ["白面鼯鼠", "animal", "m"], ["條紋松鼠", "animal", "m"],
  ["白頭翁", "animal", "m"], ["樹鵲", "animal", "m"], ["朱鸝", "animal", "m"], ["青背山雀", "animal", "m"], ["紫嘯鶇", "animal", "m"],
  ["鉛色水鶇", "animal", "m"], ["河烏", "animal", "m"], ["小啄木", "animal", "m"], ["灰喉山椒鳥", "animal", "m"], ["黑枕藍鶲", "animal", "m"],
  ["栗背林鴝", "animal", "m"], ["火冠戴菊", "animal", "m"], ["黃山雀", "animal", "m"], ["攀木蜥蜴", "animal", "m"], ["麗紋石龍子", "animal", "m"],
  ["台灣草蜥", "animal", "m"], ["台北樹蛙", "animal", "m"], ["梭德氏赤蛙", "animal", "m"], ["斯文豪氏赤蛙", "animal", "m"], ["中國樹蟾", "animal", "m"],
  ["台灣石賓", "animal", "m"], ["爬岩鰍", "animal", "m"], ["明潭吻鰕虎", "animal", "m"], ["澤蟹", "animal", "m"], ["沼蝦", "animal", "m"],
  ["青斑蝶", "animal", "m"], ["大紫蛺蝶", "animal", "m"], ["台灣寬尾鳳蝶", "animal", "m"], ["黃裳鳳蝶", "animal", "m"], ["台灣爺蟬", "animal", "m"],
  ["熊蟬", "animal", "m"], ["紡織娘", "animal", "m"], ["天牛", "animal", "m"], ["螳螂", "animal", "m"], ["金龜子", "animal", "m"], ["瓢蟲", "animal", "m"],
  // 植物（樹/花草/菌）
  ["紅檜", "plant", "m"], ["五葉松", "plant", "m"], ["台灣肖楠", "plant", "m"], ["鐵杉", "plant", "m"], ["冷杉", "plant", "m"],
  ["茄苳", "plant", "m"], ["樟樹", "plant", "m"], ["相思樹", "plant", "m"], ["九芎", "plant", "m"], ["台灣赤楊", "plant", "m"],
  ["山桐子", "plant", "m"], ["山枇杷", "plant", "m"], ["玉山杜鵑", "plant", "m"], ["紅毛杜鵑", "plant", "m"], ["山芙蓉", "plant", "m"],
  ["玉山金梅", "plant", "m"], ["高山沙參", "plant", "m"], ["咸豐草", "plant", "m"], ["台灣澤蘭", "plant", "m"], ["鴨跖草", "plant", "m"],
  ["通泉草", "plant", "m"], ["兔兒菜", "plant", "m"], ["山萵苣", "plant", "m"], ["靈芝", "plant", "m"], ["猴頭菇", "plant", "m"], ["珊瑚菇", "plant", "m"],
  // 器物（工具/食物/材料）
  ["木杵", "tool", "m"], ["陶罐", "tool", "m"], ["陶碗", "tool", "m"], ["竹筏", "tool", "m"], ["藤橋", "tool", "m"],
  ["獨木橋", "tool", "m"], ["背簍", "tool", "m"], ["網袋", "tool", "m"], ["火把", "tool", "m"], ["口簧琴", "tool", "m"],
  ["木梳", "tool", "m"], ["藤帽", "tool", "m"], ["樹皮衣", "tool", "m"], ["苧麻布", "tool", "m"], ["小米糕", "tool", "m"],
  ["醃魚", "tool", "m"], ["竹笛", "tool", "m"], ["石鍋", "tool", "m"], ["木盾", "tool", "m"], ["竹編", "tool", "m"],
  // 自然/地景/天氣（法術）
  ["稜線", "nature", "s"], ["埡口", "nature", "s"], ["河階", "nature", "s"], ["湧泉", "nature", "s"], ["曲流", "nature", "s"],
  ["壺穴", "nature", "s"], ["潮間帶", "nature", "s"], ["珊瑚礁", "nature", "s"], ["海蝕洞", "nature", "s"], ["積雨雲", "nature", "s"],
  ["流星雨", "nature", "s"], ["銀河", "nature", "s"], ["晚霞", "nature", "s"], ["曙光", "nature", "s"], ["崩壁", "nature", "s"],
  ["沖積扇", "nature", "s"], ["伏流", "nature", "s"], ["沙洲", "nature", "s"],
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

const THEME_ZH_MD = { animal: "動物", plant: "植物", nature: "自然", tool: "器物", legend: "傳說" };
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

// ── 美術生成 MD（給 Codex 生圖用）：每張一列，含檔名與美術提示 ──
const STYLE = "厚塗寫實／水彩感的台灣山林插畫，5:7 直式，構圖飽滿，無文字、無邊框、無浮水印。";
const GUARD = "不畫人形、不畫神聖器物或祭儀場景、不畫百步蛇。";
function artPrompt(name, theme) {
  const body = {
    animal: `一隻「${name}」在牠的自然棲地（溪流／森林／草叢），晨光與山霧的台灣山林背景`,
    plant: `「${name}」的植株特寫，襯台灣山林地景與自然光影`,
    nature: `「${name}」的台灣山林地景或天氣景象，開闊有氣勢`,
    tool: `山林生活的器物「${name}」（木／竹／藤／獸皮／陶等材質）的靜物特寫，襯部落生活地景`,
  }[theme] ?? `「${name}」的台灣山林意象`;
  return `${body}。${STYLE}${GUARD}`;
}
// 手寫傳說卡（art-less，一併列入本批請 Codex 生圖）；提示謹守地景/自然、不畫人形。
const LEGEND_ROWS = [
  ["leg-l34", "飛魚報汛", "傳說", `隨黑潮而來的飛魚群躍出海面，遠方是蘭嶼海岸線的清晨；${STYLE}只畫魚群與海景，不畫人形、不涉祭儀。`],
  ["leg-l35", "拼板舟", "傳說", `一艘達悟族傳統拼板舟停在礫石海灘，船身有紅白黑幾何彩繪，背景晨光海岸；${STYLE}只畫船體工藝與海景，不畫人形、不涉下水祭儀。`],
  ["leg-l36", "銜穀種的鳥", "傳說", `一隻小鳥口銜一串飽滿穀穗，飛越山田上空，晨光地景；${STYLE}只畫鳥與穀穗，不畫人形。`],
  ["leg-l37", "避洪的玉山", "傳說", `大水漫過谷地、遠處玉山高峰露出雲海之上的地景，光線由陰轉晴；${STYLE}只畫高山避洪的地景，不畫人形。`],
  ["leg-l38", "楓紅的山", "傳說", `深秋滿山楓紅的台灣中海拔山林，葉片隨風飄落，層層山巒；${STYLE}只畫楓紅地景，不畫人形。`],
];
const rowsGen = cards.map((c) => `| ${c.id} | ${c.nameZh} | ${THEME_ZH_MD[c.theme]} | ${c.type === "spell" ? "法術" : "隨從"} | ${c.id}.jpg | ${artPrompt(c.nameZh, c.theme)} |`);
const rowsLeg = LEGEND_ROWS.map(([id, name, , p]) => `| ${id} | ${name} | 傳說 | — | ${id}.jpg | ${p} |`);
const md = `# 峽谷行者 · 卡面美術生成 批次 1（共 ${cards.length + LEGEND_ROWS.length} 張）

給 Codex／繪圖：請依下表生成卡面圖。**風格統一**：${STYLE}**文化框限**：${GUARD}
**輸出**：每張存成 \`public/images/cards/<檔名>\`（檔名見下表），完成後由工程端登錄進 \`CARD_ART\`。
生成後建議跑 \`node scripts/compress-card-art.mjs\` 壓縮再進 repo（或改放 R2）。

| id | 卡名 | 主題 | 類型 | 檔名 | 美術提示 |
|----|------|------|------|------|----------|
${[...rowsLeg, ...rowsGen].join("\n")}
`;
writeFileSync("docs/card-art-batch-1.md", md);
const byRarity = cards.reduce((a, c) => ((a[c.rarity] = (a[c.rarity] || 0) + 1), a), {});
const byType = cards.reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {});
console.log(`生成 ${cards.length} 張（去重後）| 型別 ${JSON.stringify(byType)} | 稀有度 ${JSON.stringify(byRarity)}`);
