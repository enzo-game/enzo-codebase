// Enzo 艦隊狀態看板資料源（司令用 /status 頁）
// 更新狀態＝改這個檔。頁面 src/app/status/page.tsx 依此渲染。
// 對應純文字版：enzo-team-principal/STATUS.md

export const LAST_UPDATED = "2026-07-08";
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
];
