// 掃 public/images/cards 底下「已生成」的新卡圖（生成卡 gen-* 與新傳說 leg-l34 起），
// 產出 src/data/cardArt.generated.json（id -> 路徑），由 cardArt.ts 併進 CARD_ART。
// 原本 147 張手寫登錄的不動、不重複。Codex 陸續生更多圖後，重跑這支即可「增量登錄」，
// 沒圖的卡照樣顯示主題佔位圖。
import { readdirSync, writeFileSync } from "node:fs";

const DIR = "public/images/cards/";
const map = {};
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".jpg")) continue;
  const id = f.replace(/\.jpg$/, "");
  // 只登錄生成卡與新傳說(l34 以後)；原本 147 張(含 l01–l33、p*/n*/a*/l* 原始圖)已在 cardArt.ts 手寫。
  if (/^gen-\d+$/.test(id) || /^leg-l(3[4-9]|[4-9]\d)$/.test(id)) {
    map[id] = `/images/cards/${f}`;
  }
}
const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]));
writeFileSync("src/data/cardArt.generated.json", JSON.stringify(sorted, null, 2) + "\n");
console.log(`登錄 ${Object.keys(sorted).length} 張已生成/新傳說卡圖`);
