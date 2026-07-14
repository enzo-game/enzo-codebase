// match_state 瘦身編解碼（司令③-A）。
// 問題：Game 的牌庫/手牌是「完整卡物件」，又因無組牌機制＝整個卡池×複本，存進 Supabase 的
// JSONB 會隨卡池變大而膨脹（現在雙方合計 ~500 個物件；卡池到 1000 張會漲到 ~1MB/步）。
// 解法：存進 DB 前把 pDeck/pHand/eDeck/eHand 從「完整卡物件」壓成「卡片 id」（string），讀回時
// 用 CARD_BY_ID 還原。牌庫/手牌的卡永遠是 CARDS 原版（不會在牌庫/手牌裡被 buff，已確認），
// 所以 id⇄物件無損。棋盤上的隨從（pBoard/eBoard）會被增益、必須保留完整物件，不動。
//
// 相容：unpack 逐張判斷——是 string 就查表還原，已是物件就原樣通過。所以「進行中的舊格式對局」
// 讀得回來、不會壞，不需作廢。查不到 id（理論上不會，卡都來自 CARDS）才丟錯，及早抓到資料問題。
import type { Card } from "@/data/cards";
import { CARD_BY_ID } from "@/data/cards";
import type { MatchState } from "@/engine/match";
import type { Game } from "@/engine/types";

type Pile = Array<string | Card>;

function packPile(pile: Card[]): Pile {
  return pile.map((c) => (c && CARD_BY_ID.has(c.id) ? c.id : c));
}

function unpackPile(pile: Pile | undefined): Card[] {
  return (pile ?? []).map((e) => {
    if (typeof e !== "string") return e; // 舊格式：已是完整卡物件
    const c = CARD_BY_ID.get(e);
    if (!c) throw new Error(`match_state 還原失敗：未知卡片 id「${e}」`);
    return c;
  });
}

/** 寫進 Supabase 前：把四疊牌壓成 id。其餘欄位（棋盤、log、pending…）原樣。 */
export function packState(state: MatchState): unknown {
  const g = state.game;
  return {
    ...state,
    game: {
      ...g,
      pDeck: packPile(g.pDeck),
      pHand: packPile(g.pHand),
      eDeck: packPile(g.eDeck),
      eHand: packPile(g.eHand),
    },
  };
}

/** 從 Supabase 讀回後：把四疊牌從 id 還原成完整卡（相容舊的完整物件格式）。 */
export function unpackState(raw: unknown): MatchState {
  const s = raw as Omit<MatchState, "game"> & { game: Omit<Game, "pDeck" | "pHand" | "eDeck" | "eHand"> & {
    pDeck: Pile; pHand: Pile; eDeck: Pile; eHand: Pile;
  } };
  const g = s.game;
  return {
    ...(s as unknown as MatchState),
    game: {
      ...(g as unknown as Game),
      pDeck: unpackPile(g.pDeck),
      pHand: unpackPile(g.pHand),
      eDeck: unpackPile(g.eDeck),
      eHand: unpackPile(g.eHand),
    },
  };
}
