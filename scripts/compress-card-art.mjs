// 卡面圖批次壓縮：JPEG q78（mozjpeg），原地覆寫、只在變小時才寫、保留尺寸。
// 實測約省 55–60%（14MB→~6MB），肉眼無明顯損失。之後擴充卡池（往 1000 張）時，
// 美術把新圖丟進 public/images/cards/ 後跑這支即可，控制部署體積。
//
// 用法：
//   node scripts/compress-card-art.mjs                 # 壓全部 jpg
//   node scripts/compress-card-art.mjs p09-root-path.jpg n11-riverbed.jpg   # 只壓指定檔
import sharp from "sharp";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DIR = "public/images/cards/";
const QUALITY = 78;

const args = process.argv.slice(2);
const files = args.length
  ? args.map((a) => (a.includes("/") ? a : DIR + a))
  : readdirSync(DIR).filter((f) => f.endsWith(".jpg")).map((f) => DIR + f);

let before = 0, after = 0, changed = 0, skipped = 0;
for (const p of files) {
  const src = readFileSync(p);
  before += src.length;
  const out = await sharp(src).jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  if (out.length < src.length) {
    writeFileSync(p, out);
    after += out.length;
    changed++;
  } else {
    after += src.length;
    skipped++;
  }
}
console.log(`處理 ${files.length} 張 | 壓縮 ${changed}、略過 ${skipped}`);
console.log(
  `總大小 ${(before / 1048576).toFixed(1)}MB → ${(after / 1048576).toFixed(1)}MB` +
    (before ? `（省 ${(100 * (before - after) / before).toFixed(0)}%）` : ""),
);
