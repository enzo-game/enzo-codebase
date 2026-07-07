// 示範題庫（DEMO_PLACEHOLDER）— 來源：enzo-language-truku/data/demo-questions.json
// 選項為明確標示的佔位字串，不是真實太魯閣族語。
// 正式題庫將由語言部從 hunter.db 產出並取代本檔。

export interface Question {
  vocabId: string; // 對應 card.id
  prompt: string;
  options: string[]; // 4 選項
  answer: number; // 正解索引 0–3
  explanation: string;
  difficulty: 1 | 2 | 3;
}

const OPTS = ["族語選項 A（示範）", "族語選項 B（示範）", "族語選項 C（示範）", "族語選項 D（示範）"];
const EXP = "示範資料，正解待語言部從 hunter.db 填入。";

export const QUESTIONS: Question[] = [
  { vocabId: "enzo-001", prompt: "「山豬」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-002", prompt: "「山羌」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-003", prompt: "「帝雉」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-004", prompt: "「黑熊」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-005", prompt: "「獵犬」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-006", prompt: "「小米」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-007", prompt: "「苧麻」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-008", prompt: "「樟樹」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-009", prompt: "「溪流」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-010", prompt: "「山嵐」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-011", prompt: "「獵人」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-012", prompt: "「織布」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-013", prompt: "「頭目」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 3 },
  { vocabId: "enzo-014", prompt: "「祖靈」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 3 },
  { vocabId: "enzo-015", prompt: "「弓箭」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-016", prompt: "「陷阱」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-017", prompt: "「獵刀」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-018", prompt: "「火塘」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-019", prompt: "「號令」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-020", prompt: "「彩虹橋」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 3 },
  { vocabId: "enzo-021", prompt: "「飛鼠」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-022", prompt: "「水鹿」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-023", prompt: "「百步蛇」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 3 },
  { vocabId: "enzo-024", prompt: "「香菇」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-025", prompt: "「藤蔓」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-026", prompt: "「月光」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-027", prompt: "「烈日」的太魯閣族語是？", options: OPTS, answer: 2, explanation: EXP, difficulty: 3 },
  { vocabId: "enzo-028", prompt: "「巫醫」的太魯閣族語是？", options: OPTS, answer: 3, explanation: EXP, difficulty: 2 },
  { vocabId: "enzo-029", prompt: "「勇士」的太魯閣族語是？", options: OPTS, answer: 0, explanation: EXP, difficulty: 1 },
  { vocabId: "enzo-030", prompt: "「織布機」的太魯閣族語是？", options: OPTS, answer: 1, explanation: EXP, difficulty: 2 },
];

export function questionFor(cardId: string): Question | undefined {
  return QUESTIONS.find((q) => q.vocabId === cardId);
}
