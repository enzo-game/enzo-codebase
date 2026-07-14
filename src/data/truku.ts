// 太魯閣語詞彙載入器（來源：原住民族語E樂園 klokah.tw，原民會）
// 資料由 scripts/fetch-truku-vocab.mjs 產出 truku-vocab.json（靜態，隨專案部署）。
// 版權：正式／商用／對外發布前須取得授權，並於畫面標示來源（見 ATTRIBUTION）。

import raw from "./truku-vocab.json";

export type TrukuEntry = {
  id: string; // class-order，音檔 code（連字號）
  word: string; // 太魯閣族語
  chinese: string;
  category: string;
  level: string;
  hasAudio: boolean;
  audioUrl: string | null;
  imageCode: string;
  imageUrl: string;
  memo: string | null;
};

type TrukuFile = {
  source: string;
  sourceUrl: string;
  attribution: string;
  dialect: string;
  dialectId: number;
  fetchedAt: string;
  count: number;
  licenseNote: string;
  entries: TrukuEntry[];
};

const DATA = raw as TrukuFile;

export const VOCAB: TrukuEntry[] = DATA.entries;
export const SOURCE = DATA.source;
export const SOURCE_URL = DATA.sourceUrl;
export const ATTRIBUTION = DATA.attribution;

const byId = new Map(VOCAB.map((e) => [e.id, e]));

/** 依 id 取詞（找不到會丟錯，讓 build 期就抓到錯字）。 */
export function vocab(id: string): TrukuEntry {
  const e = byId.get(id);
  if (!e) throw new Error(`未知的太魯閣詞 id：${id}`);
  return e;
}

export function audioUrl(id: string): string | null {
  return vocab(id).audioUrl;
}

/** 從詞庫隨機抽一個詞（出牌答題用：題目不綁卡片，每次隨機出）。 */
export function randomVocab(): TrukuEntry {
  return VOCAB[Math.floor(Math.random() * VOCAB.length)];
}

/** 從詞庫隨機取 n 個干擾項（族語詞），排除正解本身。 */
export function distractors(answerId: string, n: number): TrukuEntry[] {
  const answer = vocab(answerId);
  const pool = VOCAB.filter((e) => e.word !== answer.word && e.chinese !== answer.chinese);
  // Fisher-Yates 取前 n
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
