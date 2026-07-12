// fetch-truku-sentences.mjs
// 從「原住民族語E樂園 klokah.tw（原民會）」句法演練（/grmpts/）抓取太魯閣語
// （trv, dialectId=33）例句，產出靜態 JSON（src/data/truku-sentences.json），
// 隨專案部署——執行時前端不連 klokah。
//
// 用法：node scripts/fetch-truku-sentences.mjs
//
// 資料來源／版權：本例句、族語逐字對照與發音來自「原住民族語E樂園」（原住民族委員會）。
// 正式／商用／對外發布前務必取得授權，並於畫面標示來源。發音音檔為外連 klokah（hotlink）。
//
// 抓法（來自 klokah /grmpts/ 前端邏輯反推）：
//   1. GET https://web.klokah.tw/grmpts/json/{dialectId}.json
//        → { l1:{t1:[tid,...], t2:[...], ...}, l2:{...}, l3:{...}, l4:{...} }
//        （lN=難度等級，tN=句法類別，值＝該類別下每一課的 tid）
//   2. 每個 tid 一頁：GET https://web.klokah.tw/text/read_embed.php?tid={tid}&mode=1&num=1
//        → 該課全部例句（<title> 是課名；每句一個 read-num 區塊，含逐字族語＋中文＋音檔 id）
//   3. 音檔：https://web.klokah.tw/text/sound/{tid}/{sentenceId}.mp3
//
// 禮貌抓取：逐一 fetch＋固定延遲（REQUEST_DELAY_MS），不併發打站方伺服器。

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIALECT_ID = 33; // 太魯閣語 trv（dialectId，用於音檔／既有 truku-vocab.json 對齊）
const LANGUAGE_ID = 9; // 太魯閣語在 klokah /grmpts/ 用的是「語言 id」（lid），不是 dialectId
const JSON_URL = `https://web.klokah.tw/grmpts/json/${LANGUAGE_ID}.json`;
const READ_URL = (tid) => `https://web.klokah.tw/text/read_embed.php?tid=${tid}&mode=1&num=1`;
const REQUEST_DELAY_MS = 220;

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../src/data/truku-sentences.json");

const SOURCE = "原住民族語E樂園（原住民族委員會）句法演練";
const SOURCE_URL = "https://web.klokah.tw/grmpts/";

const LEVELS = [
  { id: 1, label: "初級" },
  { id: 2, label: "中級" },
  { id: 3, label: "中高級" },
  { id: 4, label: "高級" },
];
const TYPES = [
  { id: 1, label: "名詞" },
  { id: 2, label: "靜態動詞" },
  { id: 3, label: "靜態動詞(完成式)" },
  { id: 4, label: "動態動詞" },
  { id: 5, label: "存在擁有" },
  { id: 6, label: "焦點系統" },
  { id: 7, label: "時間描述詞" },
  { id: 8, label: "空間方位" },
  { id: 9, label: "代名詞" },
  { id: 10, label: "連動結構" },
  { id: 11, label: "否定句" },
  { id: 12, label: "疑問詞" },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** 解析單一 tid 頁面（一課），回傳課名與該課所有例句。 */
function parseLesson(html, tid) {
  const titleMatch = html.match(/<title>(.*?)<\/title>/);
  const title = titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : `課程 ${tid}`;

  const sentences = [];
  // 每句一個區塊：從 read-num 開始，到本句的 </div></div> 結束（非貪婪抓到下一個 read-num 或字串結尾前）
  const blockRe = /<div class='read-num'>[\s\S]*?<\/div><\/div>/g;
  let m;
  while ((m = blockRe.exec(html))) {
    const block = m[0];

    const chMatch = block.match(/<div class='read-sentence Ch' data-value=(\d+)>(.*?)<\/div>/);
    if (!chMatch) continue;
    const sentenceId = Number(chMatch[1]);
    const chinese = decodeHtmlEntities(chMatch[2].trim());

    const abMatch = block.match(/<div class='read-sentence Ab[^']*'>([\s\S]*?)(?:<br>|<button class='read-chinese-btn')/);
    const abInner = abMatch ? abMatch[1] : "";
    const words = [];
    const wordRe = /<div class='word' data-value='(.*?)'>(.*?)<\/div>/g;
    let w;
    while ((w = wordRe.exec(abInner))) {
      const gloss = decodeHtmlEntities(w[1].trim());
      const token = decodeHtmlEntities(w[2].trim());
      if (token) words.push({ token, gloss: gloss || null });
    }
    const truku = words.map((w) => w.token).join(" ");
    if (!truku || !chinese) continue;

    sentences.push({
      id: sentenceId,
      chinese,
      truku,
      words,
      audioUrl: `https://web.klokah.tw/text/sound/${tid}/${sentenceId}.mp3`,
    });
  }
  return { title, sentences };
}

async function main() {
  console.log(`抓取太魯閣語句法演練課程索引：${JSON_URL}`);
  const idxRes = await fetch(JSON_URL);
  if (!idxRes.ok) throw new Error(`課程索引抓取失敗 HTTP ${idxRes.status}`);
  const idx = await idxRes.json();

  // 蒐集所有 (level, type, tid) 待抓清單，先去重（同一 tid 理論上只會出現在一個 level×type 組合）
  const jobs = [];
  for (const lv of LEVELS) {
    const levelData = idx[`l${lv.id}`];
    if (!levelData) continue;
    for (const ty of TYPES) {
      const tids = levelData[`t${ty.id}`] ?? [];
      for (const tid of tids) {
        if (!tid) continue;
        jobs.push({ level: lv.id, type: ty.id, tid });
      }
    }
  }
  console.log(`共 ${jobs.length} 課待抓（4 難度 × 12 句法類別），每課約 10-15 句，逐一禮貌抓取…`);

  const entries = [];
  let done = 0;
  for (const job of jobs) {
    const res = await fetch(READ_URL(job.tid));
    if (!res.ok) {
      console.warn(`  ⚠ tid=${job.tid} HTTP ${res.status}，略過`);
    } else {
      const html = await res.text();
      const { title, sentences } = parseLesson(html, job.tid);
      for (const s of sentences) {
        entries.push({
          ...s,
          level: job.level,
          type: job.type,
          tid: job.tid,
          lessonTitle: title,
        });
      }
    }
    done++;
    if (done % 20 === 0 || done === jobs.length) {
      console.log(`  ${done}/${jobs.length} 課完成，累計 ${entries.length} 句`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  // 同一句子 id 若因課程重疊重複出現，去重（保留第一次）
  const seen = new Set();
  const deduped = entries.filter((e) => {
    if (seen.has(e.id)) return false;
    seen.add(e.id);
    return true;
  });

  const payload = {
    source: SOURCE,
    sourceUrl: SOURCE_URL,
    attribution: "本例句、族語逐字對照與發音由「原住民族語E樂園」（原住民族委員會）製作。",
    dialect: "太魯閣語 (Truku, trv)",
    dialectId: DIALECT_ID,
    fetchedAt: new Date().toISOString().slice(0, 10),
    count: deduped.length,
    levels: LEVELS,
    types: TYPES,
    licenseNote:
      "來源為原民會 klokah.tw 句法演練；正式／商用／對外發布前須取得授權。發音音檔為外連 klokah，非自存。",
    entries: deduped,
  };

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 1) + "\n", "utf8");
  console.log(`✅ 已寫出 ${deduped.length} 句（原始 ${entries.length} 句，去重 ${entries.length - deduped.length} 句）→ ${OUT}`);
}

main().catch((e) => {
  console.error("❌ 失敗：", e.message);
  process.exit(1);
});
