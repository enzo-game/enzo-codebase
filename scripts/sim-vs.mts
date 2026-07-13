// 無頭「線上對戰」引擎驗證：兩體 bot 用權威 reducer 打完整局，斷言不變式與脱敏契約。
// 這是 P2 唯一能在沒有 Supabase 的情況下確實跑起來的驗證路徑。
// 執行：npx tsx scripts/sim-vs.mts
import {
  initMatch,
  applyMatchAction,
  viewFor,
  enforceDeadline,
  type MatchState,
  type Seat,
  type ClientTarget,
} from "../src/engine/match.ts";
import { spellTargetKind } from "../src/engine/game.ts";
import { HERO_HP, BOARD_MAX, HAND_MAX } from "../src/engine/types.ts";

const GAMES = 400;
const MAX_TURNS = 80;
const BOT_ACCURACY = 0.6; // bot 答題正確率

const handOf = (s: MatchState, seat: Seat) => (seat === "a" ? s.game.pHand : s.game.eHand);
const boardOf = (s: MatchState, seat: Seat) => (seat === "a" ? s.game.pBoard : s.game.eBoard);
const oppBoardOf = (s: MatchState, seat: Seat) => (seat === "a" ? s.game.eBoard : s.game.pBoard);

function must(cond: boolean, msg: string): void {
  if (!cond) throw new Error("斷言失敗：" + msg);
}

/** 雙方各自送出換牌決定（bot 換掉手上費用最高的 1 張，模擬真的會挑），把換牌階段走完。 */
function botMulligan(state: MatchState, now = 0): MatchState {
  let s = state;
  for (const seat of ["a", "b"] as Seat[]) {
    const hand = handOf(s, seat);
    const worst = hand.reduce((best, c, i) => (c.cost > hand[best].cost ? i : best), 0);
    const r = applyMatchAction(s, seat, { type: "mulligan", replaceIdx: hand.length > 0 ? [worst] : [] }, now);
    must(r.ok, "換牌應成功：" + (r.ok ? "" : r.error));
    s = (r as { ok: true; state: MatchState }).state;
  }
  return s;
}

/** bot 為一張法術挑客戶端目標；無合法目標時回傳 undefined（呼叫端負責略過必指定的牌）。 */
function botSpellTarget(s: MatchState, seat: Seat, cardKind: string): ClientTarget | undefined {
  if (cardKind === "none") return undefined;
  if (cardKind === "any") return { kind: "hero" };
  if (cardKind === "friendMinion") {
    const m = [...boardOf(s, seat)].sort((a, b) => b.attack - a.attack)[0];
    return m ? { kind: "minion", who: "you", key: m.key } : undefined;
  }
  // enemyMinion / anyMinion：打對手最強的未潛行隨從
  const m = oppBoardOf(s, seat)
    .filter((x) => !x.stealth)
    .sort((a, b) => b.attack - a.attack)[0];
  if (m) return { kind: "minion", who: "opp", key: m.key };
  if (cardKind === "anyMinion") {
    const own = [...boardOf(s, seat)].sort((a, b) => b.attack - a.attack)[0];
    return own ? { kind: "minion", who: "you", key: own.key } : undefined;
  }
  return undefined;
}

/** 檢查脱敏契約：對手手牌/牌庫不外流、題目答案不外流。 */
function assertNoLeak(s: MatchState): void {
  for (const seat of ["a", "b"] as Seat[]) {
    const v = viewFor(s, seat);
    must(!("hand" in v.opp), "opp 視角不得含 hand 陣列");
    must(typeof v.opp.handCount === "number", "opp 應只給 handCount");
    must(!("deck" in v.opp), "opp 視角不得含 deck 陣列");
    must(typeof v.opp.deckCount === "number", "opp 應只給 deckCount");
    if (v.quiz) must(!("answerIdx" in v.quiz), "題目視角不得含 answerIdx");
  }
}

/** 檢查數值邊界不變式。 */
function assertInvariants(s: MatchState): void {
  const g = s.game;
  must(g.playerHp <= HERO_HP && g.enemyHp <= HERO_HP, "英雄血量不得超過上限");
  must(g.pBoard.length <= BOARD_MAX && g.eBoard.length <= BOARD_MAX, "板面不得超過 7");
  must(g.pHand.length <= HAND_MAX && g.eHand.length <= HAND_MAX, "手牌不得超過 10");
  for (const seat of ["a", "b"] as Seat[]) {
    must(s.meta[seat].mana >= 0 && s.meta[seat].mana <= s.meta[seat].maxMana, "法力越界 " + seat);
  }
}

/** 讓某座位完整走完一個回合（出牌到出不起 → 攻擊 → 結束回合）。 */
function botTakeTurn(state: MatchState, seat: Seat): MatchState {
  let s = state;

  // 出牌階段
  for (let guard = 0; guard < 30; guard++) {
    if (s.winner) return s;
    const mana = s.meta[seat].mana;
    const playable = handOf(s, seat).filter((c) => c.cost <= mana);
    if (playable.length === 0) break;
    // 優先高費
    playable.sort((a, b) => b.cost - a.cost);

    let played = false;
    for (const card of playable) {
      const target =
        card.type === "spell" ? botSpellTarget(s, seat, spellTargetKind(card)) : undefined;
      const r = applyMatchAction(s, seat, { type: "playCard", cardId: card.id, target });
      if (!r.ok) continue; // 目標不合法等 → 換下一張
      s = r.state;
      assertNoLeak(s);
      // 作答
      const optCount = viewFor(s, seat).quiz?.options.length ?? 4;
      const correctIdx = s.pending!.quiz.answerIdx;
      const wrongIdx = (correctIdx + 1) % optCount;
      const ans = Math.random() < BOT_ACCURACY ? correctIdx : wrongIdx;
      const ar = applyMatchAction(s, seat, { type: "answer", optionIdx: ans });
      must(ar.ok, "作答應成功：" + (ar.ok ? "" : ar.error));
      s = (ar as { ok: true; state: MatchState }).state;
      assertInvariants(s);
      played = true;
      break;
    }
    if (!played) break;
  }
  if (s.winner) return s;

  // 攻擊階段：每隻能攻擊的隨從打一次
  for (let guard = 0; guard < 30; guard++) {
    if (s.winner) return s;
    const attacker = boardOf(s, seat).find((m) => m.canAttack && m.attack > 0);
    if (!attacker) break;
    const opp = oppBoardOf(s, seat);
    const taunts = opp.filter((m) => m.taunt && !m.stealth);
    let target: ClientTarget;
    if (taunts.length > 0) target = { kind: "minion", who: "opp", key: taunts[0].key };
    else target = { kind: "hero" };
    const r = applyMatchAction(s, seat, { type: "attack", attackerKey: attacker.key, target });
    if (!r.ok) break; // 防呆：打不動就跳出
    s = r.state;
    assertInvariants(s);
  }

  if (s.winner) return s;
  const e = applyMatchAction(s, seat, { type: "endTurn" });
  must(e.ok, "結束回合應成功");
  return (e as { ok: true; state: MatchState }).state;
}

// ───────────────────────── 跑批次 ─────────────────────────

let winA = 0;
let winB = 0;
let stalls = 0;
let turnSum = 0;
let concedeChecked = false;

for (let i = 0; i < GAMES; i++) {
  let s = initMatch();
  assertNoLeak(s);
  assertInvariants(s);
  s = botMulligan(s);
  must(s.mulligan === null, "雙方換牌完應關閉換牌階段");

  let finished = false;
  for (let t = 0; t < MAX_TURNS && !finished; t++) {
    s = botTakeTurn(s, s.current);
    if (s.winner) {
      finished = true;
      turnSum += s.turn;
      if (s.winner === "a") winA++;
      else winB++;
    }
  }
  if (!finished) stalls++;

  // 抽驗一局的認輸路徑
  if (!concedeChecked && !finished) {
    const r = applyMatchAction(s, s.current, { type: "concede" });
    must(r.ok && r.state.winner === (s.current === "a" ? "b" : "a"), "認輸應判對手勝");
    concedeChecked = true;
  }
}

// ───────────────────────── 開局換牌（新）抽驗 ─────────────────────────
{
  const s0 = initMatch();
  must(s0.mulligan !== null && !s0.mulligan.a && !s0.mulligan.b, "初始應在換牌階段、雙方都未決定");
  must(viewFor(s0, "a").phase === "mulligan", "換牌階段的視角 phase 應是 mulligan");
  must(viewFor(s0, "a").mulliganPending, "還沒決定時 mulliganPending 應為 true");
  must(!viewFor(s0, "a").yourTurn, "換牌階段任何座位都不該是 yourTurn");
  // 換牌階段沒結束前，正式對戰動作一律被拒
  must(!applyMatchAction(s0, "a", { type: "endTurn" }).ok, "換牌未完成時 endTurn 應被拒");
  // 換掉起手第 1 張，手牌內容應改變但張數不變
  const before = s0.game.pHand.map((c) => c.id);
  const r1 = applyMatchAction(s0, "a", { type: "mulligan", replaceIdx: [0] });
  must(r1.ok, "換牌應成功");
  const s1 = (r1 as { ok: true; state: MatchState }).state;
  must(s1.game.pHand.length === before.length, "換牌後手牌張數應不變");
  must(s1.mulligan!.a && !s1.mulligan!.b, "A 換完後只有 A 標記完成");
  must(viewFor(s1, "b").oppMulliganDone, "B 視角應看到對手（A）已完成換牌");
  must(!viewFor(s1, "a").oppMulliganDone, "A 視角：B 還沒換牌，oppMulliganDone 應為 false");
  // A 已經換過，不能再換一次
  must(!applyMatchAction(s1, "a", { type: "mulligan", replaceIdx: [] }).ok, "同一座位重複換牌應被拒");
  // 索引越界應被拒
  must(!applyMatchAction(s1, "b", { type: "mulligan", replaceIdx: [99] }).ok, "換牌索引越界應被拒");
  // B 換完（保留全部＝空陣列）→ 雙方皆完成，換牌階段關閉、進入正式對戰
  const r2 = applyMatchAction(s1, "b", { type: "mulligan", replaceIdx: [] });
  must(r2.ok, "B 換牌應成功");
  const s2 = (r2 as { ok: true; state: MatchState }).state;
  must(s2.mulligan === null, "雙方換完後應關閉換牌階段");
  must(viewFor(s2, "a").phase === "playing", "換牌結束後 phase 應變 playing");
  must(viewFor(s2, "a").yourTurn, "換牌結束後先手 A 應輪到自己");
  console.log("開局換牌：階段閘門/索引驗證/雙方完成後轉正式對戰 全數通過 ✓");
}

// ───────────────────────── 非法動作防線抽驗 ─────────────────────────
{
  const s = botMulligan(initMatch());
  // 不是你的回合
  must(!applyMatchAction(s, "b", { type: "endTurn" }).ok, "非當前座位動作應被拒");
  // 打一張不存在的牌
  must(!applyMatchAction(s, "a", { type: "playCard", cardId: "nope-999" }).ok, "不存在的卡應被拒");
  // 攻擊：開局隨從召喚失調，不能攻擊 → 這裡板面空，直接攻擊也應失敗
  must(
    !applyMatchAction(s, "a", { type: "attack", attackerKey: "x", target: { kind: "hero" } }).ok,
    "無隨從攻擊應被拒",
  );
}

// ───────────────────────── 換牌逾時（P3 同招）抽驗 ─────────────────────────
{
  const T0 = 1_000_000;
  const s0 = initMatch(T0);
  must(s0.deadline === T0 + 30_000, "initMatch 應設換牌階段截止（比一般回合短）");
  must(!enforceDeadline(s0, T0 + 1000).timedOut, "未到換牌截止不應逾時");
  const mTo = enforceDeadline(s0, T0 + 30_000 + 1);
  must(mTo.timedOut, "換牌過截止應逾時");
  must(mTo.state.mulligan === null, "換牌逾時後應自動關閉換牌階段（雙方視同保留全部起手牌）");
  must(mTo.state.game.pHand.length === s0.game.pHand.length, "換牌逾時保留起手牌，張數不變");
  must(viewFor(mTo.state, "a").phase === "playing", "換牌逾時後 phase 應變 playing");
  console.log("換牌逾時：自動保留起手牌、轉入正式對戰 全數通過 ✓");
}

// ───────────────────────── 回合逾時（P3）抽驗 ─────────────────────────
{
  const T0 = 1_000_000;
  let s = botMulligan(initMatch(T0), T0);
  must(s.deadline === T0 + 90_000, "雙方換牌完成後應設正式回合截止");
  // 未到截止 → 不逾時
  must(!enforceDeadline(s, T0 + 1000).timedOut, "未到截止不應逾時");
  // A 選了一張牌卡在待答，然後逾時 → 該回合作廢、換 B、pending 清掉、手牌沒少
  // 只挑不用另外指定目標的牌（隨從／none／any 法術），避免抽到需要 enemyMinion/friendMinion
  // 目標的法術卻沒帶 target 而被 validatePlay 拒絕（跟這裡要驗的逾時邏輯無關，是既有潛在
  // flaky 點：buildDeck 洗牌吃隨機數，這段之前的換牌測試一多消耗隨機數就更容易抽到這種牌）。
  const handBefore = s.game.pHand.length;
  const playable = s.game.pHand.find(
    (c) => c.cost <= s.meta.a.mana && (c.type === "minion" || spellTargetKind(c) === "none" || spellTargetKind(c) === "any"),
  )?.id;
  if (playable) {
    const r = applyMatchAction(s, "a", { type: "playCard", cardId: playable }, T0);
    must(r.ok, "playCard 應成功");
    s = (r as { ok: true; state: MatchState }).state;
    must(s.pending != null, "應進入待答");
  }
  const to = enforceDeadline(s, T0 + 90_000 + 1);
  must(to.timedOut, "過截止應逾時");
  must(to.state.current === "b", "逾時應換對手回合");
  must(to.state.pending === null, "逾時應丟棄未結算出牌");
  must(to.state.game.pHand.length === handBefore, "逾時不應扣掉未打出的手牌");
  must(to.state.deadline === T0 + 90_000 + 1 + 90_000, "逾時後應重設新回合截止");
  // 逾時後對方視角：換它的回合、拿得到新的 deadlineMs
  const vb = viewFor(to.state, "b");
  must(vb.yourTurn, "逾時後應輪到 B");
  must(typeof vb.deadlineMs === "number", "應下發 deadlineMs 供倒數");
  console.log("回合逾時（P3）：截止設定/懶執行/清待答/重設/脱敏 全數通過 ✓");
}

const decided = winA + winB;
console.log("── 線上對戰引擎無頭驗證 ──");
console.log(`對局數：${GAMES}`);
console.log(`分出勝負：${decided}（先手A ${winA} / 後手B ${winB}）`);
console.log(`先手A 勝率：${((winA / decided) * 100).toFixed(1)}%`);
console.log(`平均回合數：${(turnSum / decided).toFixed(1)}`);
console.log(`超過 ${MAX_TURNS} 回合未分勝負：${stalls}`);
console.log(`認輸路徑抽驗：${concedeChecked ? "已驗" : "（無 stall 局可驗）"}`);
console.log("不變式 / 脱敏契約 / 非法動作防線：全數通過 ✓");
