// 線上對戰 P2 —— 伺服器權威（server-authoritative）雙人對局引擎。純函式、無 React。
// 只在「伺服器端」（Vercel Route Handler，service role）跑；客戶端只送意圖、收脱敏視角。
//
// 設計要點：
//  - 權威狀態沿用 game.ts 的 Game 形狀：座位 A ≡ 「player / p*」，座位 B ≡ 「enemy / e*」。
//    combat 純函式（playMinionFor / castSpell / resolveAttack / drawCards / endOfTurnEffects…）
//    本來就吃 side 參數、左右對稱，故可直接複用，不必為 PvP 重寫戰鬥規則。
//  - 法力不走 Game.pMana（那是單機玩家用），改由 MatchState.meta 為雙座位各自記錄。
//  - 出牌走兩步：playCard → 產生「待答題」pending（答案 answerIdx 只留伺服器）→ answer → 結算。
//    答對與否由伺服器比對，不信前端。
//  - 目標用「你 / 對手（you / opp）」相對表述傳入，伺服器依座位翻成權威 side，杜絕前端誤指。
//  - viewFor() 產生單一座位的脱敏視角：對手手牌/牌庫只給「張數」；pending 答案不外流。
import type { Card } from "@/data/cards";
import {
  Difficulty,
  Game,
  LogEntry,
  Minion,
  QuizState,
  Side,
  Target,
  HERO_HP,
  BOARD_MAX,
} from "./types";
import { isPlayableDeck } from "@/lib/deck";
import {
  buildDeck,
  buildDeckFromIds,
  makeQuiz,
  makeSentenceQuiz,
  playMinionFor,
  castSpell,
  resolveAttack,
  drawCards,
  endOfTurnEffects,
  spellTargetKind,
  pushLog,
  shuffle,
} from "./game";

export type Seat = "a" | "b";

/** 每座位的法力（不放進 Game，避免和單機玩家欄位混用）。 */
type Meta = { maxMana: number; mana: number };

/** 待結算的出牌：卡已選、題已出，等該座位作答。answerIdx 是伺服器機密。 */
export type Pending = {
  seat: Seat;
  cardId: string;
  target?: Target; // 已翻成權威 side 的目標
  quiz: QuizState;
};

/** 權威對局完整狀態（含雙方手牌、牌庫、答案）—— 絕不整包下發給客戶端。 */
export type MatchState = {
  game: Game; // p* = 座位 A、e* = 座位 B
  current: Seat; // 現在輪到誰
  turn: number;
  pending: Pending | null;
  meta: Record<Seat, Meta>;
  stats: Record<Seat, { correct: number; wrong: number }>;
  winner: Seat | null;
  deadline: number | null; // 現在這一回合（或換牌階段）的截止（epoch ms）；null＝不計時（如純引擎測試）
  // 開局換牌：雙方各自是否已決定（含逾時自動保留）。兩者皆 true 才轉入正式對戰；
  // null＝換牌階段已結束（正式對戰中，或此局不支援換牌的舊狀態）。
  mulligan: Record<Seat, boolean> | null;
  // 好友房共用難度（房主建房時選、整局兩人同題型）：normal/easy=單字題、hard=句子題。
  // /vs 沒有 AI，故難度只影響出題題型（不影響對手強度）。舊狀態沒有這欄時視同 normal。
  difficulty: Difficulty;
};

/** 客戶端相對目標：一律用「你 / 對手」，由伺服器翻成權威 side。 */
export type ClientTarget =
  | { kind: "hero" } // 攻擊/法術指向「對手英雄」
  | { kind: "minion"; who: "you" | "opp"; key: string };

export type MatchAction =
  | { type: "start" } // 冪等初始化（伺服器發牌）
  | { type: "mulligan"; replaceIdx: number[] } // 開局換牌：把指定索引的起手牌洗回牌庫重抽
  | { type: "playCard"; cardId: string; target?: ClientTarget }
  | { type: "answer"; optionIdx: number }
  | { type: "attack"; attackerKey: string; target: ClientTarget }
  | { type: "endTurn" }
  | { type: "concede" };

export type ApplyResult =
  | { ok: true; state: MatchState }
  | { ok: false; error: string };

const TURN_SECONDS = 90;
const TURN_MS = TURN_SECONDS * 1000;
const MULLIGAN_SECONDS = 30;
const MULLIGAN_MS = MULLIGAN_SECONDS * 1000;

/** 依 now 算這回合截止；now=0（純引擎測試不帶時間）時回 null＝不計時。 */
const deadlineFrom = (now: number): number | null => (now > 0 ? now + TURN_MS : null);
/** 換牌階段截止（比一般回合短，避免一方遲不決定卡住對手太久）。 */
const mulliganDeadlineFrom = (now: number): number | null => (now > 0 ? now + MULLIGAN_MS : null);

const sideOf = (seat: Seat): Side => (seat === "a" ? "player" : "enemy");
const other = (seat: Seat): Seat => (seat === "a" ? "b" : "a");

// ───────────────────────── 初始化 ─────────────────────────

/** 建立一局全新的權威狀態。座位 A 先手；座位 B 後手，多發 1 張補償先手優勢。
 *  now＝伺服器當前 epoch ms（用來設回合截止）；不帶（0）則不計時。
 *  difficulty＝房主建房時選的共用難度（整局兩人同題型），只影響出題題型。 */
export function initMatch(
  now = 0,
  difficulty: Difficulty = "normal",
  deckA?: string[] | null,
  deckB?: string[] | null,
): MatchState {
  // 有帶合法自組牌組（30 張、同名/傳說上限）就各自用它發牌；沒帶或不合法就回退整個卡池。
  const a = isPlayableDeck(deckA) ? buildDeckFromIds(deckA) : buildDeck();
  const b = isPlayableDeck(deckB) ? buildDeckFromIds(deckB) : buildDeck();
  const game: Game = {
    phase: "player",
    turn: 1,
    playerHp: HERO_HP,
    enemyHp: HERO_HP,
    pMaxMana: 1,
    pMana: 1,
    pDeck: a.slice(4),
    pHand: a.slice(0, 4),
    pBoard: [],
    eMaxMana: 0,
    eDeck: b.slice(4),
    eHand: b.slice(0, 4),
    eBoard: [],
    log: pushLog([], "對局開始。", "info"),
    correct: 0,
    wrong: 0,
    winner: null,
  };
  // 先手 A：第 1 回合 1 法力、不抽牌（tempo 優勢）。
  // 後手 B：maxMana 起始 0，其首回合 passTurn 後 →1 法力、抽 1 張（＝後手補 1 卡）。
  // 開局先進換牌階段：雙方各自決定要不要換掉起手牌，都決定了（或逾時自動保留）才正式開打。
  return {
    game,
    current: "a",
    turn: 1,
    pending: null,
    meta: { a: { maxMana: 1, mana: 1 }, b: { maxMana: 0, mana: 0 } },
    stats: { a: { correct: 0, wrong: 0 }, b: { correct: 0, wrong: 0 } },
    winner: null,
    deadline: mulliganDeadlineFrom(now),
    mulligan: { a: false, b: false },
    difficulty,
  };
}

// ───────────────────────── 開局換牌 ─────────────────────────

/** 把某座位手牌中選定索引的牌洗回牌庫、重抽等量（雙座位版，game.ts 的 mulligan() 只認 player 側）。 */
function mulliganFor(g: Game, seat: Seat, replaceIdx: number[]): Game {
  if (replaceIdx.length === 0) return g;
  const idxSet = new Set(replaceIdx);
  const side = sideOf(seat);
  if (side === "player") {
    const returned = g.pHand.filter((_, i) => idxSet.has(i));
    const ng: Game = { ...g, pHand: g.pHand.filter((_, i) => !idxSet.has(i)), pDeck: shuffle([...g.pDeck, ...returned]) };
    drawCards(ng, "player", returned.length);
    return ng;
  }
  const returned = g.eHand.filter((_, i) => idxSet.has(i));
  const ng: Game = { ...g, eHand: g.eHand.filter((_, i) => !idxSet.has(i)), eDeck: shuffle([...g.eDeck, ...returned]) };
  drawCards(ng, "enemy", returned.length);
  return ng;
}

/** 雙方都決定完換牌（或逾時自動保留）：關閉換牌階段、開正式對戰的第一個回合截止。 */
function finishMulliganPhase(s: MatchState, now: number): MatchState {
  return {
    ...s,
    mulligan: null,
    game: { ...s.game, log: pushLog(s.game.log, "換牌階段結束，對局正式開始。", "info") },
    deadline: deadlineFrom(now),
  };
}

// ───────────────────────── 目標翻譯 ─────────────────────────

/** 客戶端「你 / 對手」目標 → 權威 side 目標（依動作者座位）。 */
function toAuthTarget(seat: Seat, t: ClientTarget | undefined): Target | undefined {
  if (!t) return undefined;
  if (t.kind === "hero") return { kind: "hero" };
  // you = 自己座位的 side；opp = 對手座位的 side
  const side: Side = t.who === "you" ? sideOf(seat) : sideOf(other(seat));
  return { kind: "minion", side, key: t.key };
}

const boardOf = (g: Game, side: Side) => (side === "player" ? g.pBoard : g.eBoard);
const handOf = (g: Game, seat: Seat) => (seat === "a" ? g.pHand : g.eHand);

// ───────────────────────── 出牌合法性（座位視角）─────────────────────────

/** 該座位此刻能否合法出這張牌（費用、板面、法術目標）。回傳 null=可，字串=不可原因。 */
function validatePlay(s: MatchState, seat: Seat, card: Card, target?: Target): string | null {
  if (s.meta[seat].mana < card.cost) return "法力不足";
  const g = s.game;
  const mySide = sideOf(seat);
  if (card.type === "minion") {
    if (boardOf(g, mySide).length >= BOARD_MAX) return "我方隨從已滿";
    return null;
  }
  // 法術目標檢查
  const kind = spellTargetKind(card);
  if (kind === "none" || kind === "any") return null; // any 至少能打對手英雄
  if (!target || target.kind !== "minion") return "需要指定一個隨從目標";
  const t = boardOf(g, target.side).find((m) => m.key === target.key);
  if (!t) return "目標不存在";
  const enemySide = sideOf(other(seat));
  if (kind === "enemyMinion" && (target.side !== enemySide || t.stealth)) return "目標不合法";
  if (kind === "friendMinion" && target.side !== mySide) return "只能指定我方隨從";
  if (kind === "anyMinion" && target.side === enemySide && t.stealth) return "潛行目標不可指定";
  return null;
}

// ───────────────────────── 回合轉換 ─────────────────────────

/** 交棒給對手並開始其回合：加費、抽牌、隨從解除召喚失調、重設回合截止、清掉未結算出牌。 */
function passTurn(s: MatchState, now = 0): MatchState {
  const from = s.current;
  const to = other(from);
  // 先結算離場座位的「回合結束」效果
  let g = endOfTurnEffects(s.game, sideOf(from));

  const toSide = sideOf(to);
  const nm = Math.min(s.meta[to].maxMana + 1, 10);
  const meta: Record<Seat, Meta> = {
    ...s.meta,
    [to]: { maxMana: nm, mana: nm },
  } as Record<Seat, Meta>;

  // 該座位隨從回復攻擊權、抽 1 張
  g = {
    ...g,
    pBoard: toSide === "player" ? g.pBoard.map((m) => ({ ...m, canAttack: true, attacksUsed: 0, rushBound: false })) : g.pBoard,
    eBoard: toSide === "enemy" ? g.eBoard.map((m) => ({ ...m, canAttack: true, attacksUsed: 0, rushBound: false })) : g.eBoard,
  };
  const g2 = { ...g, pDeck: [...g.pDeck], pHand: [...g.pHand], eDeck: [...g.eDeck], eHand: [...g.eHand] };
  drawCards(g2, toSide, 1);
  const turn = s.turn + 1;
  g2.turn = turn;
  g2.phase = toSide;
  // 用 織者/山林試煉（＝A/B 的 side 記名），讓 desensitizeLog 依觀看者換成「你/對手」。
  g2.log = pushLog(g2.log, `── 換 ${to === "a" ? "織者" : "山林試煉"} 回合（第 ${turn} 回合）──`, "info");

  return { ...s, game: g2, current: to, turn, meta, pending: null, deadline: deadlineFrom(now) };
}

// ───────────────────────── 回合逾時（伺服器懶執行）─────────────────────────

/** 若現在（now）已過本回合截止，就自動結束當前座位的回合（丟棄未結算出牌）。
 *  由 Route Handler 在每次 view/action 前呼叫；回傳是否真的發生逾時。純函式、時間由外部注入。 */
export function enforceDeadline(s: MatchState, now: number): { state: MatchState; timedOut: boolean } {
  if (s.winner || s.deadline == null || now < s.deadline) return { state: s, timedOut: false };

  if (s.mulligan) {
    // 換牌逾時：還沒決定的座位自動保留全部起手牌，直接進正式對戰，不卡對手。
    const mulligan: Record<Seat, boolean> = { a: true, b: true };
    const withLog: MatchState = {
      ...s,
      mulligan,
      game: { ...s.game, log: pushLog(s.game.log, "⏰ 換牌逾時，雙方自動保留起手牌，對局開始。", "sys") },
    };
    return { state: finishMulliganPhase(withLog, now), timedOut: true };
  }

  const lostName = s.current === "a" ? "織者" : "山林試煉";
  const withLog: MatchState = {
    ...s,
    game: { ...s.game, log: pushLog(s.game.log, `⏰ ${lostName} 逾時，自動結束回合`, "sys") },
  };
  return { state: passTurn(withLog, now), timedOut: true };
}

// ───────────────────────── 主 reducer ─────────────────────────

export function applyMatchAction(s: MatchState, seat: Seat, action: MatchAction, now = 0): ApplyResult {
  if (action.type === "start") {
    // start 冪等：狀態已存在就原樣回傳（真正建立在 route handler 以 initMatch 做）
    return { ok: true, state: s };
  }

  if (s.winner) return { ok: false, error: "對局已結束" };

  // 認輸不受回合限制
  if (action.type === "concede") {
    const win = other(seat);
    const g = {
      ...s.game,
      winner: sideOf(win),
      phase: "over" as const,
      log: pushLog(s.game.log, `${seat === "a" ? "織者" : "山林試煉"} 認輸。`, "sys"),
    };
    return { ok: true, state: { ...s, game: g, winner: win } };
  }

  // 開局換牌：雙方各自獨立決定，不看 current（跟回合誰輪到誰無關）
  if (action.type === "mulligan") {
    if (!s.mulligan) return { ok: false, error: "換牌階段已經結束" };
    if (s.mulligan[seat]) return { ok: false, error: "你已經換過牌了" };
    const hand = handOf(s.game, seat);
    const replaceIdx = [...new Set(action.replaceIdx)];
    if (replaceIdx.some((i) => !Number.isInteger(i) || i < 0 || i >= hand.length)) {
      return { ok: false, error: "換牌索引不合法" };
    }
    const game = mulliganFor(s.game, seat, replaceIdx);
    const mulligan: Record<Seat, boolean> = { ...s.mulligan, [seat]: true };
    const next: MatchState = { ...s, game, mulligan };
    return { ok: true, state: mulligan.a && mulligan.b ? finishMulliganPhase(next, now) : next };
  }
  if (s.mulligan) return { ok: false, error: "請先完成換牌" };

  // 作答：只驗 pending 歸屬，不看 current（pending.seat 一定是當前行動者）
  if (action.type === "answer") {
    const p = s.pending;
    if (!p) return { ok: false, error: "沒有待答的題目" };
    if (p.seat !== seat) return { ok: false, error: "不是你的題目" };
    return resolvePending(s, p, action.optionIdx);
  }

  // 其餘動作都需輪到你、且沒有卡在待答
  if (seat !== s.current) return { ok: false, error: "還沒輪到你" };
  if (s.pending) return { ok: false, error: "請先完成出牌答題" };

  switch (action.type) {
    case "playCard": {
      const card = handOf(s.game, seat).find((c) => c.id === action.cardId);
      if (!card) return { ok: false, error: "手牌沒有這張卡" };
      const target = toAuthTarget(seat, action.target);
      const bad = validatePlay(s, seat, card, target);
      if (bad) return { ok: false, error: bad };
      // 出題，進入待答（此時尚未扣費、尚未移除手牌）。共用難度 hard＝句子題、其餘＝單字題。
      const quiz = s.difficulty === "hard" ? makeSentenceQuiz(card) : makeQuiz(card);
      return { ok: true, state: { ...s, pending: { seat, cardId: card.id, target, quiz } } };
    }

    case "attack": {
      const target = toAuthTarget(seat, action.target);
      if (!target) return { ok: false, error: "缺少攻擊目標" };
      const before = s.game;
      const after = resolveAttack(before, sideOf(seat), action.attackerKey, target);
      if (after === before) return { ok: false, error: "攻擊不合法（目標/嘲諷/尚不可攻擊）" };
      return { ok: true, state: syncWinner({ ...s, game: after }) };
    }

    case "endTurn": {
      return { ok: true, state: syncWinner(passTurn(s, now)) };
    }
  }
  return { ok: false, error: "未知動作" };
}

/** 結算待答的出牌：扣費、移除手牌、依對錯結算隨從/法術。 */
function resolvePending(s: MatchState, p: Pending, optionIdx: number): ApplyResult {
  const seat = p.seat;
  const hand = handOf(s.game, seat);
  const card = hand.find((c) => c.id === p.cardId);
  if (!card) return { ok: false, error: "手牌已無此卡" };
  if (s.meta[seat].mana < card.cost) return { ok: false, error: "法力不足" };

  const isCorrect = optionIdx === p.quiz.answerIdx;
  const mySide = sideOf(seat);

  // 扣費 + 移除手牌（在 game 上）
  let g: Game = { ...s.game, pHand: [...s.game.pHand], eHand: [...s.game.eHand] };
  if (seat === "a") g.pHand = g.pHand.filter((c) => c.id !== card.id);
  else g.eHand = g.eHand.filter((c) => c.id !== card.id);

  // 結算
  g = card.type === "minion"
    ? playMinionFor(g, mySide, card, isCorrect)
    : castSpell(g, mySide, card, isCorrect, p.target);

  const meta: Record<Seat, Meta> = {
    ...s.meta,
    [seat]: { ...s.meta[seat], mana: s.meta[seat].mana - card.cost },
  } as Record<Seat, Meta>;
  const stats: Record<Seat, { correct: number; wrong: number }> = {
    ...s.stats,
    [seat]: {
      correct: s.stats[seat].correct + (isCorrect ? 1 : 0),
      wrong: s.stats[seat].wrong + (isCorrect ? 0 : 1),
    },
  } as Record<Seat, { correct: number; wrong: number }>;

  return { ok: true, state: syncWinner({ ...s, game: g, meta, stats, pending: null }) };
}

/** 把 game.winner（player/enemy）同步回 MatchState.winner（a/b）。 */
function syncWinner(s: MatchState): MatchState {
  if (s.winner) return s;
  const w = s.game.winner;
  if (!w) return s;
  return { ...s, winner: w === "player" ? "a" : "b" };
}

// ───────────────────────── 脱敏視角 ─────────────────────────

export type PublicMinion = Minion;

export type SeatView = {
  seat: Seat;
  yourTurn: boolean;
  turn: number;
  phase: "mulligan" | "playing" | "over";
  outcome: "win" | "lose" | null;
  // 換牌階段限定：我是否還沒決定（true＝該顯示換牌視窗）、對手是否已經決定（顯示「等待對手」）。
  mulliganPending: boolean;
  oppMulliganDone: boolean;
  you: {
    hp: number;
    mana: number;
    maxMana: number;
    hand: Card[];
    board: Minion[];
    deckCount: number;
    correct: number;
    wrong: number;
  };
  opp: {
    hp: number;
    mana: number;
    maxMana: number;
    handCount: number; // 只給張數，內容保密
    board: Minion[];
    deckCount: number;
  };
  // 只有題目擁有者才拿得到選項；答案(answerIdx)永不下發
  quiz: { cardId: string; prompt: string; options: string[]; chinese: string } | null;
  oppThinking: boolean; // 對手正在答題
  log: LogEntry[];
  deadlineMs: number | null; // 本回合截止（epoch ms）；client 用來倒數。null＝不計時
  turnSeconds: number; // 一回合總秒數（給進度環當分母）
  // P4：雙方顯示名稱。引擎純函式不碰 DB，由 matchServer 讀 profiles 後注入（undefined＝不顯示）。
  youName?: string;
  oppName?: string;
  difficulty: Difficulty; // 這局共用難度（房主選）；UI 顯示「困難：句子題」等
};

/** 把權威狀態脱敏成「某座位」看到的視角。這是唯一會下發到客戶端的東西。 */
export function viewFor(s: MatchState, seat: Seat): SeatView {
  const g = s.game;
  const meImP = seat === "a"; // 我是不是 p-side
  const myHp = meImP ? g.playerHp : g.enemyHp;
  const oppHp = meImP ? g.enemyHp : g.playerHp;
  const myHand = meImP ? g.pHand : g.eHand;
  const oppHand = meImP ? g.eHand : g.pHand;
  const myBoard = meImP ? g.pBoard : g.eBoard;
  const oppBoard = meImP ? g.eBoard : g.pBoard;
  const myDeck = meImP ? g.pDeck : g.eDeck;
  const oppDeck = meImP ? g.eDeck : g.pDeck;
  const oppSeat = other(seat);

  const mine = s.pending && s.pending.seat === seat ? s.pending : null;
  const oppPending = s.pending && s.pending.seat !== seat ? s.pending : null;

  return {
    seat,
    yourTurn: !s.mulligan && s.current === seat && !s.pending,
    turn: s.turn,
    phase: s.winner ? "over" : s.mulligan ? "mulligan" : "playing",
    outcome: s.winner ? (s.winner === seat ? "win" : "lose") : null,
    mulliganPending: Boolean(s.mulligan && !s.mulligan[seat]),
    oppMulliganDone: Boolean(s.mulligan && s.mulligan[oppSeat]),
    difficulty: s.difficulty ?? "normal",
    you: {
      hp: myHp,
      mana: s.meta[seat].mana,
      maxMana: s.meta[seat].maxMana,
      hand: myHand,
      board: myBoard,
      deckCount: myDeck.length,
      correct: s.stats[seat].correct,
      wrong: s.stats[seat].wrong,
    },
    opp: {
      hp: oppHp,
      mana: s.meta[oppSeat].mana,
      maxMana: s.meta[oppSeat].maxMana,
      handCount: oppHand.length,
      board: oppBoard,
      deckCount: oppDeck.length,
    },
    quiz: mine
      ? {
          cardId: mine.cardId,
          prompt: mine.quiz.prompt,
          options: mine.quiz.options,
          chinese: mine.quiz.chinese,
        }
      : null,
    oppThinking: Boolean(oppPending),
    log: desensitizeLog(g.log, seat),
    deadlineMs: s.winner ? null : s.deadline,
    turnSeconds: TURN_SECONDS,
  };
}

/** 戰報脱敏：combat 純函式的日誌以「織者=p-side＝座位A」「山林試煉=e-side＝座位B」記名，
 *  依觀看座位換成「你 / 對手」。卡名不含這兩個詞，字串替換安全。 */
function desensitizeLog(log: LogEntry[], seat: Seat): LogEntry[] {
  const aWord = seat === "a" ? "你" : "對手";
  const bWord = seat === "a" ? "對手" : "你";
  return log.map((e) => ({
    ...e,
    text: e.text.split("織者").join(aWord).split("山林試煉").join(bWord),
  }));
}
