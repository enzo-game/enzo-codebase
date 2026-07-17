# ENZO 元件與素材落點盤點（Component & Asset Map）

> 給 **Codex** 的權威落點地圖。目的：讓你清楚「什麼東西放哪、命名怎麼取、哪些是你的活、哪些千萬別碰」，避免搞混。
> 更新時間：2026-07-16。若與你記憶中的舊指令衝突，**以本文件為準**。

---

## 0. 一句話總結你的任務

你（Codex）只負責**生卡面圖**，放進 `public/images/cards/`，**檔名＝卡片 id**（例如 `gen-0500.jpg`、`leg-l43.jpg`）。
任務清單在 `docs/card-art/`，**一次做一個小塊檔**。生完的圖由 Claude（工程端）登錄＋壓縮＋提交，**你不要改任何程式或 JSON**。

---

## 1. 你的活 vs 不是你的活

| | 誰負責 | 落點 |
|---|---|---|
| **卡面圖（gen-*, leg-*）** | ✅ **Codex（你）** | `public/images/cards/<id>.jpg` |
| 卡面圖登錄進遊戲（CARD_ART） | Claude 工程端（跑 `gen-cardart.mjs`） | `src/data/cardArt.generated.json` |
| 圖片壓縮 | Claude 工程端（`compress-card-art.mjs`） | 就地 |
| UI 素材（背景/圖示/面板…） | enzo-art 出圖、Claude 整合 | `public/images/{home,play,ui,...}/` |
| 遊戲程式、資料 JSON、卡表 | 工程端 | `src/` |
| 手寫基礎卡圖（a/n/p/t/l 開頭） | 早期人工，**已完成、別動** | `public/images/cards/` |

**鐵則：你只新增 `public/images/cards/<id>.jpg` 圖檔。不碰 `src/`、不碰任何 `.json`、不跑登錄腳本、不改本文件以外的 docs。**

---

## 2. 卡面圖命名鐵則（最容易搞混，看這裡）

### ✅ 你要生的新卡：檔名＝id，一字不差
- 生成卡：`gen-0001.jpg` … `gen-0799.jpg`（id 就是 `gen-0001`）
- 新傳說卡：`leg-l34.jpg` … （id 就是 `leg-l34`）
- **檔名必須跟 `docs/card-art/` 清單「檔名」欄完全一致**，否則工程端登錄不到、遊戲不顯示。

### ⛔ 不要模仿的舊命名（那是手寫基礎卡，不是你的活）
早期 149 張人工卡用「類型前綴＋序號＋英文名」，且**檔名 ≠ id**：
- `a01-muntjac.jpg`（動物）、`n05-...jpg`（自然）、`p12-...jpg`（植物）、`t03-...jpg`（器物）
- `l01-millet.jpg`（傳說）→ 對應 id 是 `leg-l01`（檔名和 id 不一樣！）
這些**已完成、已上線**，你**完全不用碰、也不要用這種命名**。你的新卡一律「檔名＝id」。

---

## 3. 卡面圖規格（每份 MD 開頭也有，這裡再列一次）

- **尺寸**：640×896（5:7 直式）JPEG
- **風格**：厚塗寫實／水彩感的台灣山林插畫，構圖飽滿，**無文字、無邊框、無浮水印**
- **文化框限（硬紅線，違反即廢）**：
  - 不畫人形／臉／手（連傳說卡也是，只畫動物、地景、器物、火光等）
  - 不畫百步蛇、不畫任何蛇
  - 不畫祭儀場景／神聖器物、不畫出草／狩獵情節
  - 不畫族群織紋、菱形祖靈眼、泛原民圖騰、羽飾、紋面
  - 器物（籃/碗/叉/盾/綁腿/樹皮布…）一律畫成**中性靜物**（擺在山林地景裡），不畫在人身上、不畫使用中
  - 傳說卡（`leg-*`）另有個別提示，嚴守「只畫自然／動物／地景，不神格化、不畫人」

---

## 4. 任務清單與目前進度（權威）

清單＝ `docs/card-art/` 的 28 個小塊檔（每檔約 30 張）＋ `docs/card-art/README.md` 索引。

### ✅ 2026-07-17：809 / 809 全數生完並上線，卡面圖任務完成！

| 批次 | 小塊檔 | 狀態 |
|---|---|---|
| 批次 1 | `batch-1-part-01..07` | ✅ 完成上線（194） |
| 批次 2 | `batch-2-part-01..06` | ✅ 完成上線（175） |
| 批次 3 | `batch-3-part-01..05` | ✅ 完成上線（150） |
| 批次 4 | `batch-4-part-01..05` | ✅ 完成上線（140） |
| 批次 5 | `batch-5-part-01..05` | ✅ 完成上線（150） |

**目前不需要再生任何卡面圖。** 若之後司令新增卡或要求重生某張，才會有新任務——屆時仍照本文件規格與命名。
詳細現況另見 `docs/card-art-status-report.md`。

> ⚠️ **尺寸教訓（下次務必照規格）**：最終批（gen-0453 之後）有部分輸出成 1060×1484、甚至 946×1662（偏瘦）等非標準尺寸，工程端得逐張縮放/裁切才能用。**規格是 640×896（5:7）**，請務必照 §3 輸出，不要出高解析或其他比例。

---

## 5. 完整素材落點地圖（給你全局感，但只有 §1 標「Codex」的是你的活）

```
public/images/
├── cards/            ← 卡面圖【你的主戰場】
│   ├── gen-0001.jpg … gen-0799.jpg   （生成卡，Codex）
│   ├── leg-l34.jpg …                  （新傳說卡，Codex；檔名＝id）
│   ├── a01-*.jpg n*-*.jpg p*-*.jpg t*-*.jpg l*-*.jpg  （手寫基礎卡，已完成，別動）
│   ├── cardback.jpg / token-sapling.jpg / board-battle.jpg （特殊，別動）
├── home/             ← 首頁/入口 UI（背景、模式徽章、特色圖）enzo-art＋Claude，別動
├── play/             ← /play 盤面（board-altar, hero-*）別動
├── guide/            ← 關鍵字/類型圖示（kw-*, type-*）別動
├── brand/            ← logo，別動
├── journey/          ← /journey 劇情模式的整套素材（cards/coins/frames/nav/scene/…）別動
├── ui/leaderboard/   ← 天梯背景（目前只留 leaderboard-bg-mountain-night-v1.jpg）別動
└── vs/leaderboard/   ← 舊檔（leaderboard-bg.jpg, -concept.jpg），無程式引用，忽略
```

```
src/                  ← 程式與資料，【Codex 一律不碰】
├── app/…/page.tsx    （頁面：home / battle / play / vs / deck / collection / journey / strategy / prologue / guide / status）
├── data/
│   ├── cards.ts + cards.generated.json         （卡表）
│   ├── cardArt.ts + cardArt.generated.json     （卡面圖登錄；gen-cardart.mjs 產生）
│   ├── cardLearning.generated.json             （學習小註）
│   └── truku*.ts / truku-vocab.json …          （族語詞庫/例句）
└── engine/           （對戰引擎）

scripts/              ← 工程端管線，【Codex 不用跑】
├── gen-cards.mjs        （產卡表＋產 docs/card-art/ 清單）
├── gen-cardart.mjs      （掃 cards/ 圖檔→登錄 cardArt.generated.json）
└── compress-card-art.mjs（就地壓縮卡圖）

docs/
├── card-art/                    ← 你的任務清單（28 小塊檔＋README）
├── card-art-status-report.md    ← 生圖現況
└── component-asset-map.md       ← 本文件
```

---

## 6. 生圖後的交接管線（你只做第 1 步）

1. **Codex**：把每張存成 `public/images/cards/<id>.jpg`（檔名＝id，同名已存在就跳過）。做完一個小塊檔就回報「batch-X-part-YY 好了」。
2. **Claude 工程端**：驗圖（格式/壞檔/主題/文化框限，傳說卡與蛇字名逐張看）→ 跑 `gen-cardart.mjs` 登錄 → `compress-card-art.mjs` 壓縮 → 開 PR → 合併 → Vercel 部署。

你**不需要**動 `cardArt.generated.json`、不需要跑任何腳本、不需要開 PR。生圖 + 回報即可。

---

## 7. 一分鐘檢查表（送出前自問）

- [ ] 檔名是不是 `<id>.jpg`、跟清單「檔名」欄一模一樣？
- [ ] 尺寸 640×896、JPEG？
- [ ] 有沒有文字/邊框/浮水印？（要無）
- [ ] 有沒有人形/臉/手、蛇、祭儀、織紋圖騰、紋面？（要全無）
- [ ] 器物是不是中性靜物、沒畫在人身上？
- [ ] 只動了 `public/images/cards/`、沒碰 `src/` 或任何 `.json`？
