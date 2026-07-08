// fetch-truku-vocab.mjs
// 從「原住民族語E樂園 klokah.tw（原民會）」抓取太魯閣語（trv, dialectId=33）詞彙，
// 產出靜態 JSON（src/data/truku-vocab.json），隨專案部署 —— 執行時前端不連 klokah XML。
//
// 用法：node scripts/fetch-truku-vocab.mjs
//
// 資料來源／版權：本詞彙、圖卡與發音來自「原住民族語E樂園」（原住民族委員會）。
// 正式／商用／對外發布前務必取得授權，並於畫面標示來源。發音音檔為外連 klokah（hotlink）。
//
// 圖／音 URL 規則（來自 klokah 接法配方）：
//   圖：https://klokah.tw/competition/vocabulary/picture/{class}_{order}.jpg   （底線，語言無關，不帶 dialectId）
//   音：https://web.klokah.tw/vocabulary/audio/word/33/{class}-{order}.wav      （連字號，逐語別，帶 dialectId=33）

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIALECT_ID = 33; // 太魯閣語 trv
const VOCAB_XML = `https://klokah.tw/competition/vocabulary/xml/${DIALECT_ID}/vocabulary.xml`;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/truku-vocab.json");

const SOURCE = "原住民族語E樂園（原住民族委員會）";
const SOURCE_URL = "https://klokah.tw";

function tag(block, name) {
  const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (m) return m[1].trim();
  // 自閉合空標籤 <memo />
  return "";
}

function audioUrl(cls, order) {
  return `https://web.klokah.tw/vocabulary/audio/word/${DIALECT_ID}/${cls}-${order}.wav`;
}
function imageUrl(cls, order) {
  return `https://klokah.tw/competition/vocabulary/picture/${cls}_${order}.jpg`;
}

async function main() {
  console.log(`抓取太魯閣語詞彙 XML：${VOCAB_XML}`);
  const res = await fetch(VOCAB_XML);
  if (!res.ok) throw new Error(`klokah XML 抓取失敗 HTTP ${res.status}`);
  const xml = await res.text();

  const blocks = xml.match(/<vocabulary>[\s\S]*?<\/vocabulary>/g) ?? [];
  const entries = [];
  for (const b of blocks) {
    const cls = tag(b, "class");
    const order = tag(b, "order");
    const word = tag(b, "aboriginal");
    const chinese = tag(b, "chinese");
    if (!word || word === "無此詞彙" || !chinese) continue; // 略過空詞
    const hasAudio = tag(b, "sound") === "1";
    entries.push({
      id: `${cls}-${order}`, // 音檔 code（連字號）
      word, // 太魯閣族語
      chinese,
      category: cls,
      level: tag(b, "level"),
      hasAudio,
      audioUrl: hasAudio ? audioUrl(cls, order) : null,
      imageCode: `${cls}_${order}`, // 圖 code（底線）
      imageUrl: imageUrl(cls, order),
      memo: tag(b, "memo") || null,
    });
  }

  const payload = {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    attribution: "本遊戲之單詞、圖卡與發音由「原住民族語E樂園」（原住民族委員會）製作。",
    dialect: "太魯閣語 (Truku, trv)",
    dialectId: DIALECT_ID,
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: entries.length,
    licenseNote:
      "來源為原民會 klokah.tw；正式／商用／對外發布前須取得授權。發音音檔為外連 klokah，非自存。",
    entries,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 1) + "\n", "utf8");
  console.log(`✅ 已寫出 ${entries.length} 詞 → ${OUT}`);
}

main().catch((e) => {
  console.error("❌ 失敗：", e.message);
  process.exit(1);
});
