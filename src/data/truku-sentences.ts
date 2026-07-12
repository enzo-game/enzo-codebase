// 太魯閣語句法演練載入器（來源：原住民族語E樂園 klokah.tw「句法演練」，原民會）
// 資料由 scripts/fetch-truku-sentences.mjs 產出 truku-sentences.json（靜態，隨專案部署）。
// 版權：正式／商用／對外發布前須取得授權，並於畫面標示來源（見 ATTRIBUTION）。

import raw from "./truku-sentences.json";

export type SentenceWord = { token: string; gloss: string | null };

export type SentenceEntry = {
  id: number; // 句子 id（同時是音檔檔名）
  chinese: string;
  truku: string; // 完整族語句（詞間空白分隔，供顯示用）
  words: SentenceWord[]; // 逐字對照（token=族語詞，gloss=中文語意），供重組練習用
  audioUrl: string;
  level: number; // 1=初級 2=中級 3=中高級 4=高級
  type: number; // 句法類別 1..12，見 TYPES
  tid: number; // 來源課程 id
  lessonTitle: string;
};

export type LevelDef = { id: number; label: string };
export type TypeDef = { id: number; label: string };

type SentenceFile = {
  source: string;
  sourceUrl: string;
  attribution: string;
  dialect: string;
  dialectId: number;
  fetchedAt: string;
  count: number;
  levels: LevelDef[];
  types: TypeDef[];
  licenseNote: string;
  entries: SentenceEntry[];
};

const DATA = raw as SentenceFile;

export const SENTENCES: SentenceEntry[] = DATA.entries;
export const LEVELS: LevelDef[] = DATA.levels;
export const TYPES: TypeDef[] = DATA.types;
export const SOURCE = DATA.source;
export const SOURCE_URL = DATA.sourceUrl;
export const ATTRIBUTION = DATA.attribution;

export function levelLabel(level: number): string {
  return LEVELS.find((l) => l.id === level)?.label ?? `Lv${level}`;
}

export function typeLabel(type: number): string {
  return TYPES.find((t) => t.id === type)?.label ?? `類別${type}`;
}

/** Fisher-Yates 洗牌（不改動原陣列）。 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 依難度（可選）隨機取 n 句練習題，排除已練過的 id（避免同一輪連續重複）。 */
export function pickSentences(n: number, level: number | null, excludeIds: Set<number>): SentenceEntry[] {
  const pool = SENTENCES.filter((s) => (level == null || s.level === level) && !excludeIds.has(s.id));
  const base = pool.length >= n ? pool : SENTENCES.filter((s) => level == null || s.level === level);
  return shuffle(base).slice(0, n);
}

/** 隨機取一句（供戰鬥「困難」模式出句子題用）。 */
export function randomSentence(): SentenceEntry {
  return SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
}

/** 取 n 句干擾句（同難度優先，避免用句長就能猜答案；同難度不夠才放寬到全部）。
 *  依「族語句文字」去重（不只 id）——語料庫裡不同 id 偶爾共用同一句族語例句，
 *  文字相同的話就算選到也跟正解長得一模一樣，選項會等於作弊／無法作答。 */
export function sentenceDistractors(correct: SentenceEntry, n: number): SentenceEntry[] {
  const seenTruku = new Set([correct.truku]);
  function takeUnique(candidates: SentenceEntry[], need: number): SentenceEntry[] {
    const picked: SentenceEntry[] = [];
    for (const s of shuffle(candidates)) {
      if (picked.length >= need) break;
      if (seenTruku.has(s.truku)) continue;
      seenTruku.add(s.truku);
      picked.push(s);
    }
    return picked;
  }
  const sameLevel = SENTENCES.filter((s) => s.id !== correct.id && s.level === correct.level);
  const picked = takeUnique(sameLevel, n);
  if (picked.length < n) {
    const rest = SENTENCES.filter((s) => s.id !== correct.id);
    picked.push(...takeUnique(rest, n - picked.length));
  }
  return picked;
}
