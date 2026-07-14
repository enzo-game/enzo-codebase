// 自組牌組規則（司令 B）：一副 30 張、同名卡最多 2 張、傳說最多 1 張（爐石標準）。
// 前端牌組編輯器與引擎發牌共用這裡的常數與驗證，避免兩邊漂移。
import { CARD_BY_ID, type Card } from "@/data/cards";

export const DECK_SIZE = 30;
export const MAX_COPIES = 2;
export const MAX_LEGENDARY = 1;

/** 這張卡在一副牌裡的張數上限（傳說 1、其餘 2）。 */
export function maxCopies(card: Card): number {
  return card.rarity === "legendary" ? MAX_LEGENDARY : MAX_COPIES;
}

export type DeckCheck = { ok: true } | { ok: false; error: string };

/** 驗證一副牌（卡片 id 陣列）：張數、同名上限、卡片存在。 */
export function validateDeck(ids: string[]): DeckCheck {
  if (ids.length !== DECK_SIZE) {
    return { ok: false, error: `一副牌需要 ${DECK_SIZE} 張（目前 ${ids.length} 張）` };
  }
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    const c = CARD_BY_ID.get(id);
    if (!c) return { ok: false, error: `牌組含未知卡片：${id}` };
    if (n > maxCopies(c)) return { ok: false, error: `「${c.nameZh}」最多 ${maxCopies(c)} 張` };
  }
  return { ok: true };
}

/** 牌組是否「可以帶進對戰」（是字串陣列且通過驗證）。 */
export function isPlayableDeck(ids: unknown): ids is string[] {
  return Array.isArray(ids) && ids.every((x) => typeof x === "string") && validateDeck(ids).ok;
}

const STORAGE_KEY = "enzo-deck";

/** 讀本機存的牌組（無效/無則回 null）。 */
export function loadSavedDeck(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const ids = JSON.parse(raw) as unknown;
    return isPlayableDeck(ids) ? ids : null;
  } catch {
    return null;
  }
}

/** 存牌組到本機（呼叫端先驗證過）。 */
export function saveDeck(ids: string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage 不可用（隱私模式）就算了，這局仍可用記憶體中的牌組
  }
}
