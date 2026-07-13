// Enzo 艦隊狀態看板資料源（司令用 /status 頁）
// 更新狀態＝改這個檔。頁面 src/app/status/page.tsx 依此渲染。
// 對應純文字版：enzo-team-principal/STATUS.md

export const LAST_UPDATED = "2026-07-12";
export const PROD_URL = "https://enzo-codebase.vercel.app";

export type Stage = "done" | "wip" | "blocked" | "na";

// 誰負責推下一步（決定卡住時該找誰）
export type Owner = "司令" | "Claude" | "Themis" | "Mnemosyne" | "族人" | "Codex" | "—";

export type PipelineRow = {
  name: string;
  gen: Stage; // 生圖 Codex
  qa: Stage; // 技術驗收 Claude
  culture: Stage; // 文化複核 Themis
  lang: Stage; // 語言核定 Mnemosyne
  integrate: Stage; // 前端整合 Claude
  live: Stage; // 上線 Vercel
  blocker: string; // 現在卡在哪
  next: Owner; // 下一步等誰
};

export type ItemRow = {
  name: string;
  status: Stage;
  blocker: string;
  next: Owner;
};

export const PIPELINE_STAGES = ["生圖", "驗收", "文化", "語言", "整合", "上線"] as const;

export const artBatches: PipelineRow[] = [
  {
    name: "ORDER-015 山徑基礎 13張",
    gen: "done", qa: "done", culture: "done", lang: "na", integrate: "done", live: "done",
    blocker: "完成",
    next: "—",
  },
  {
    name: "ORDER-016 首頁 8張",
    gen: "done", qa: "done", culture: "done", lang: "na", integrate: "done", live: "done",
    blocker: "完成（PR #7 已上線）",
    next: "—",
  },
  {
    name: "ORDER-017 山徑升級 27張",
    gen: "done", qa: "done", culture: "done", lang: "na", integrate: "blocked", live: "blocked",
    blocker: "圖都好、也過複核，卡在前端整合——還沒接進 /journey",
    next: "Claude",
  },
  {
    name: "ORDER-018 中性四角外框 5張",
    gen: "wip", qa: "na", culture: "blocked", lang: "na", integrate: "blocked", live: "blocked",
    blocker: "MD 已寫好，卡在生圖——待丟 Codex",
    next: "Codex",
  },
];

// 特定敏感單項（不是整批，是某個字/某個裝飾）
export const reviewItems: ItemRow[] = [
  {
    name: "金幣族語命名 matu / sbalay / puni / lukus",
    status: "blocked",
    blocker: "逐詞核定中；sbalay（和解/真相儀式）敏感。圖面無字已放行，落字未核定不能上",
    next: "Mnemosyne",
  },
  {
    name: "卡名/節點名 elug / seejiq / btunux / hakaw / qmasan / sapah / alang",
    status: "blocked",
    blocker: "同上，逐詞核定中",
    next: "Mnemosyne",
  },
  {
    name: "正式「織紋／菱形」文化外框",
    status: "blocked",
    blocker: "規範：不得由生圖模型自行發明。目前走 ORDER-018 中性外框頂著",
    next: "族人",
  },
  {
    name: "首頁 🏹🌈 logo 是否美術化（含弓箭）",
    status: "wip",
    blocker: "若要做須先送文化複核；目前維持 emoji",
    next: "Themis",
  },
];

export const otherLines: ItemRow[] = [
  {
    name: "模式 A /journey 灰盒",
    status: "done",
    blocker: "真實太魯閣語＋語音已上線（PR #5）",
    next: "—",
  },
  {
    name: "模式 B /play 對戰骨架",
    status: "wip",
    blocker: "美術（ORDER-009 爐石 PvE）暫緩",
    next: "司令",
  },
  {
    name: "42 語別 klokah 管線",
    status: "blocked",
    blocker: "為 UI 改版先擱置，待喊開工",
    next: "司令",
  },
  // ── 模式 A/B 開發線（ORDER-057 起）：git log 已併入 main 者標 done；未提交／未接者標 wip ──
  {
    name: "ORDER-057 模式 A 分支敘事＋WordMatch 題型（L2）",
    status: "done",
    blocker: "溪岔口二選一／跨節點呼應／霧中詞彙配對，已併入 main（e8ef39e）",
    next: "—",
  },
  {
    name: "ORDER-058 模式 B 爐石式棋盤＋8 張傳說卡＋學習筆記",
    status: "done",
    blocker: "已併入 main（e82b6a7）",
    next: "—",
  },
  {
    name: "ORDER-059／063／064 模式 B 卡池擴充（→55 張，低風險免文化審）＋AI 難度分級",
    status: "done",
    blocker: "已併入 main",
    next: "—",
  },
  {
    name: "ORDER-060 線上對戰（好友房配對）＋純戰鬥引擎抽離",
    status: "wip",
    blocker: "P0/P1（引擎抽離＋配對骨架）已併入 main；P2 線上對戰待接 Supabase（專案未接，working-tree 開發中）",
    next: "司令",
  },
  {
    name: "ORDER-061 模式 B 開場規則說明彈窗",
    status: "wip",
    blocker: "狀態待確認：registry 標 implemented-working-tree（未提交）；模式 B 首玩規則彈窗疑已由 ORDER-065 併入 main，需確認是否重複",
    next: "司令",
  },
  {
    name: "ORDER-065～068 模式 B 對戰體驗打磨（戰鬥音樂＋手感／首玩規則彈窗／mulligan＋認輸＋連勝／首玩導引／出牌音效）",
    status: "done",
    blocker: "已併入 main",
    next: "—",
  },
  {
    name: "ORDER-069 模式 B 多 AI 對手（主題牌組）",
    status: "done",
    blocker: "已併入 main（ff049c1）",
    next: "—",
  },
  {
    name: "ORDER-070 模式 A 棋盤版面 + CombatEvent 時間軸戰鬥（pt1-3）",
    status: "done",
    blocker: "已併入 main（225bb9c／4c19ae5／66e941b／47b1647）",
    next: "—",
  },
  {
    name: "ORDER-071 模式 A v3 進階技法卡＋織能引擎",
    status: "done",
    blocker: "撿卡 3 選 1 入場管道已補齊、織能接上四個小遊戲；卡名/vocabId 待 Mnemosyne+Themis 終審（TODO 標記在 CARD_POOL_ADVANCED）",
    next: "Mnemosyne",
  },
];

// ───────────────────────── 全部 ORDER 自動追蹤 ─────────────────────────
// 由 git log 生成（enzo-team-principal/scripts/gen-fleet-status.mjs，每小時 cron）。
// next 是自由字串（可能多個負責人），故不用 Owner enum。此區塊下方由腳本自動覆寫，勿手改。
export type AutoOrderRow = { order: string; name: string; status: Stage; blocker: string; next: string };

// AUTO-ORDERS-START （由 scripts/gen-fleet-status.mjs 自動生成，勿手改此區塊）
export const autoOrders: AutoOrderRow[] = [
  { order: "ORDER-087", name: "六個爐石式關鍵字機制（石鎧/亡語/疾風/突襲/汲取/法術增幅）", status: "done", blocker: "已上線｜2026-07-12｜PR#67", next: "—" },
  { order: "ORDER-086", name: "卡牌圖鑑 /collection（司令指示：卡牌內容比照爐石戰記）", status: "done", blocker: "已上線｜2026-07-12｜PR#69", next: "—" },
  { order: "ORDER-085", name: "英雄改小圓頭像＋角落小血量徽章，不再擋牌", status: "done", blocker: "已上線｜2026-07-12｜PR#66", next: "—" },
  { order: "ORDER-084", name: "線上對戰盤面套上 .play-page 排版，血條不再擋牌；戰報懸浮右側半透明", status: "done", blocker: "已上線｜2026-07-12｜PR#64", next: "—" },
  { order: "ORDER-083", name: "可攻擊隨從加「可攻擊」明示標籤", status: "done", blocker: "已上線｜2026-07-12｜PR#62", next: "—" },
  { order: "ORDER-082", name: "HP portrait to bottom-right, End Turn to center-right, rules explain summoning sickness", status: "done", blocker: "已上線｜2026-07-12｜PR#61", next: "—" },
  { order: "ORDER-081", name: "light layout variance + cross-run vocab review system", status: "done", blocker: "已上線｜2026-07-12｜PR#60", next: "—" },
  { order: "ORDER-080", name: "wire first-play coach marks + differentiated daily events", status: "done", blocker: "已上線｜2026-07-12｜PR#58", next: "—" },
  { order: "ORDER-079", name: "fun overhaul — RockClear minigame, real AP economy, no printed answers", status: "done", blocker: "已上線｜2026-07-11｜PR#57", next: "—" },
  { order: "ORDER-078", name: "ORDER-078/079 Batch 2-6 卡牌資料＋卡面美術 68 張上線", status: "done", blocker: "已上線｜2026-07-13｜PR#79", next: "—" },
  { order: "ORDER-076", name: "themed fallback for cards without art", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-075", name: "align battlefield layout to reference mockup", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-074", name: "remove stray hand-rail scrollbar", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-073", name: "stop summoned minion overlapping the hand", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-072", name: "subtler hand hover + low-contrast theme placeholder", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-071", name: "模式 A 核心循環 v3：卡組成長 + 織能引擎（解「玩法太簡單」）", status: "done", blocker: "已上線｜2026-07-12｜PR#59", next: "—" },
  { order: "ORDER-070", name: "inline quiz, hand hover-zoom, mobile fix, handoff", status: "done", blocker: "已上線｜2026-07-11｜PR#51", next: "—" },
  { order: "ORDER-069", name: "multiple AI opponents with themed decks", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-068", name: "crisper card-play 咔嗒 snap sound", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-067", name: "interactive first-run onboarding", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-066", name: "replayability — mulligan, concede, win streak", status: "done", blocker: "已上線｜2026-07-11", next: "—" },
  { order: "ORDER-065", name: "battle music + combat juice", status: "done", blocker: "已上線｜2026-07-11｜PR#50", next: "—" },
  { order: "ORDER-064", name: "AI difficulty tiers easy/normal/hard", status: "done", blocker: "已上線｜2026-07-11｜PR#49", next: "—" },
  { order: "ORDER-063", name: "+6 low-risk cards, no culture-review needed", status: "done", blocker: "已上線｜2026-07-11｜PR#48", next: "—" },
  { order: "ORDER-060", name: "法術指定目標提示也比照攻擊具體化", status: "wip", blocker: "P0/P1 已上線；P2 線上對戰待接 Supabase", next: "Hermes" },
  { order: "ORDER-059", name: "add 2 low-risk legend-safe cards 退水河床 / 樹根護徑", status: "done", blocker: "已上線｜2026-07-10", next: "—" },
  { order: "ORDER-058", name: "Hearthstone-style board + 8 legend cards + learning notes", status: "done", blocker: "已上線｜2026-07-10", next: "—" },
  { order: "ORDER-057", name: "branching narrative + WordMatch per-level quiz type", status: "done", blocker: "已上線｜2026-07-10", next: "—" },
  { order: "ORDER-056", name: "remove obstacle build minigame, front-load first legend passage", status: "done", blocker: "已上線｜2026-07-10｜PR#47", next: "—" },
  { order: "ORDER-055", name: "legend chapter system + 小米接力 + difficulty pass", status: "done", blocker: "已上線｜2026-07-10｜PR#46", next: "—" },
  { order: "ORDER-054", name: "replace bridge drag-build with audio-first 聽音搭板 minigame", status: "done", blocker: "已上線｜2026-07-10｜PR#45", next: "—" },
  { order: "ORDER-051", name: "Epic visual overhaul + action spotlight guidance + bridge build variant", status: "done", blocker: "已上線｜2026-07-10｜PR#44", next: "—" },
  { order: "ORDER-049", name: "Hearthstone-style card frames + faceted gem stats", status: "done", blocker: "已上線｜2026-07-10｜PR#42", next: "—" },
  { order: "ORDER-048", name: "Tighten Mode A economy per boredom review P1", status: "done", blocker: "已上線｜2026-07-10｜PR#39", next: "—" },
  { order: "ORDER-044", name: "Add ORDER-044 card art to /play battle page", status: "done", blocker: "已上線｜2026-07-10｜PR#40", next: "—" },
  { order: "ORDER-043", name: "Replace v1 cards with Legends set and Hearthstone-style engine in /play", status: "done", blocker: "已上線｜2026-07-10｜PR#38", next: "—" },
  { order: "ORDER-031", name: "補上答題閘門——硬清/謹慎探勘/補給不再能繞過族語題（ORDER-031）", status: "done", blocker: "已上線｜2026-07-09｜PR#26", next: "—" },
  { order: "ORDER-030", name: "任務面板放大 + 節點故事上線（ORDER-030）", status: "done", blocker: "已上線｜2026-07-09｜PR#25", next: "—" },
  { order: "ORDER-028", name: "機制移植——事件節點隨機池（ORDER-028 第二項）", status: "done", blocker: "已上線｜2026-07-09｜PR#23", next: "—" },
  { order: "ORDER-026", name: "序幕氛圍特效層——微光粒子／山霧流動／祖靈光點（ORDER-026）", status: "done", blocker: "已上線｜2026-07-09｜PR#20", next: "—" },
  { order: "ORDER-025", name: "融入 5 則有出處太魯閣族傳說（ORDER-025，司令核准）", status: "done", blocker: "已上線｜2026-07-09｜PR#19", next: "—" },
  { order: "ORDER-024", name: "任務面板——主線目標＋這一步該做什麼＋支線（ORDER-024）", status: "done", blocker: "已上線｜2026-07-09｜PR#18", next: "—" },
  { order: "ORDER-023", name: "序幕頁 /prologue（故事帶入）", status: "done", blocker: "已上線｜2026-07-09｜PR#16", next: "—" },
  { order: "ORDER-022", name: "首頁刪副標＋入口動態化", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-021", name: "資源金幣族語落字（決策#22 執行）", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-020", name: "UI 音效（配樂升級第一波）", status: "done", blocker: "已上線｜2026-07-09｜PR#13", next: "—" },
  { order: "ORDER-019", name: "品牌更名（峽谷行者 Canyon Walker）＋環境配樂", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-018", name: "中性裝飾外框（§16.2 菱形織紋紅線之中性替代）", status: "done", blocker: "已上線｜2026-07-08｜PR#11", next: "—" },
  { order: "ORDER-017", name: "山徑 /journey 介面升級（圖1，承 ORDER-015）（美術部分）", status: "done", blocker: "已上線｜2026-07-08｜PR#9", next: "—" },
  { order: "ORDER-016", name: "《山徑織圖》模式 A 文化把關（地名 / 敘事框架 / 角色）", status: "done", blocker: "已上線｜2026-07-08｜PR#7", next: "—" },
  { order: "ORDER-015", name: "模式 A 山徑介面美術 MD（《山徑織圖》，全 placeholder 先行） 已完成", status: "done", blocker: "已上線｜2026-07-08｜PR#4", next: "—" },
  { order: "ORDER-014", name: "模式 A 山徑灰盒 MVP（/journey，《山徑織圖》單關 + 族語答題閘門）", status: "done", blocker: "已上線｜PR#3（早期單，commit 未掛號）", next: "—" },
  { order: "ORDER-013", name: "《山徑織圖》整理為「模式 A」正式機制規格 + 族語答題閘門設計", status: "done", blocker: "完成（設計規格單）", next: "—" },
  { order: "ORDER-012", name: "雙模式架構：模式選擇 + 山徑劇情模式（模式 A）", status: "done", blocker: "已上線｜PR#3（早期單，commit 未掛號）", next: "—" },
  { order: "ORDER-011", name: "/play 從單人練習擴成「vs 系統」對戰迴圈", status: "done", blocker: "已上線（早期單，commit 未掛號）", next: "—" },
  { order: "ORDER-010", name: "卡池擴充（30→60）+ 導入文化牌系 + UI 概念整合", status: "wip", blocker: "進行中", next: "Calypso" },
  { order: "ORDER-009", name: "建立 Codex 生圖管線 + 產出首批生圖 MD", status: "wip", blocker: "進行中", next: "Codex" },
  { order: "ORDER-008", name: "以 hunter.db 真實詞彙與題庫替換示範佔位（30 張卡）", status: "wip", blocker: "進行中", next: "Mnemosyne" },
  { order: "ORDER-007", name: "30 張卡命名與題材的文化審查", status: "wip", blocker: "進行中", next: "Themis" },
  { order: "ORDER-005", name: "將第 21–30 張卡接入前端（達成 MVP 30 張牌組）", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-004", name: "補齊 MVP 卡表至 30 張", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-003", name: "出牌答題原型（/play）+ 首頁", status: "done", blocker: "已上線｜2026-07-07", next: "—" },
  { order: "ORDER-002", name: "建立詞彙管線與 20 卡綁定槽", status: "done", blocker: "完成（非程式單）", next: "—" },
  { order: "ORDER-001", name: "設計首發卡牌（20 張）", status: "done", blocker: "完成（非程式單）", next: "—" },
];
// AUTO-ORDERS-END
