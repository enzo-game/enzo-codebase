// Enzo 艦隊狀態看板資料源（司令用 /status 頁）
// 更新狀態＝改這個檔。頁面 src/app/status/page.tsx 依此渲染。
// 對應純文字版：enzo-team-principal/STATUS.md

export const LAST_UPDATED = "2026-07-11";
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
    status: "wip",
    blocker: "核心邏輯＋build 已過（feature branch）；進階卡入場管道（撿卡 3 選 1）未做、待司令審 diff",
    next: "司令",
  },
];
