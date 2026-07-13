"use client";

// ORDER-060 P2–P4 —— 線上對戰盤面（爐石式外觀，套用 /play 的卡面美術）。
// 伺服器權威：只送意圖、收脱敏視角。流程：ensureAnonSession → fetchView → 訂閱 poke（+4s 輪詢）。
// 出牌兩步：點卡（法術先指定目標）→ 伺服器出題 → 作答 → 結算。
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Card } from "@/data/cards";
import type { Minion } from "@/engine/types";
import { BOARD_MAX } from "@/engine/types";
import { spellTargetKind } from "@/engine/game";
import type { SeatView, ClientTarget } from "@/engine/match";
import { ensureAnonSession, subscribeMatch, fetchView, sendAction } from "@/lib/vs";
import { supabaseConfigured } from "@/lib/supabase";
import AmbientAudio from "@/components/AmbientAudio";
import BattleMusic from "@/components/BattleMusic";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxSummon, sfxAttack, sfxHit, sfxArrive, sfxLose } from "@/lib/sfx";
import {
  GemDefs,
  HandCard,
  MinionToken,
  HeroPortrait,
  ManaStrip,
  CardBackFan,
  CardInspectModal,
  CARD_ART,
  BOARD_BG,
  type FloatFx,
} from "@/lib/cardVisual";

const HERO_HP = 30;

type Selecting = { mode: "spell"; card: Card } | { mode: "attack"; attackerKey: string } | null;

export default function BattlePage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const router = useRouter();

  const [view, setView] = useState<SeatView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState<Selecting>(null);
  const [inspect, setInspect] = useState<Card | null>(null);
  const [connected, setConnected] = useState(true);
  const [mulliganSel, setMulliganSel] = useState<Set<number>>(new Set());
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [fx, setFx] = useState<FxState>({ enter: EMPTY_SET, hit: EMPTY_SET, floats: EMPTY_FLOATS });
  const [windupKey, setWindupKey] = useState<string | null>(null); // 攻擊出手前的短暫蓄力（跟 /play 同招）
  const [lungeMap, setLungeMap] = useState<Record<string, string>>({}); // 攻擊者衝向目標的 transform
  const channelRef = useRef<RealtimeChannel | null>(null);
  const viewRef = useRef<SeatView | null>(null); // 最新視角（給 act/refresh 內做前後 diff 觸發音效/小動畫）
  const busyRef = useRef(false); // act() 動作進行中時，refresh() 拉到的更新多半是同一動作的回音，跳過動畫避免重複播
  const attackingRef = useRef(false); // 蓄力／衝刺動畫播放中（busy 還沒設 true 之前）避免重複觸發
  const elsRef = useRef<Map<string, HTMLElement>>(new Map()); // 隨從/英雄的 DOM 位置登記（算衝刺位移用，跟 /play useCombat 同招）
  const registerEl = useCallback(
    (anchor: string) => (el: HTMLElement | null) => {
      if (el) elsRef.current.set(anchor, el);
      else elsRef.current.delete(anchor);
    },
    [],
  );

  // 依前後 view diff 出的小動畫（隨從登場、受擊震動＋閃光、浮動傷害/回復數字），過場後自動清掉。
  const applyFx = useCallback((diff: FxDiff) => {
    if (diff.enterKeys.length === 0 && diff.hitKeys.length === 0 && Object.keys(diff.floats).length === 0) return;
    setFx((s) => ({
      enter: new Set([...s.enter, ...diff.enterKeys]),
      hit: new Set([...s.hit, ...diff.hitKeys]),
      floats: { ...s.floats, ...diff.floats },
    }));
    const keys = [...new Set([...diff.enterKeys, ...diff.hitKeys, ...Object.keys(diff.floats)])];
    setTimeout(() => {
      setFx((s) => {
        const enter = new Set(s.enter);
        const hit = new Set(s.hit);
        const floats = { ...s.floats };
        for (const k of keys) {
          enter.delete(k);
          hit.delete(k);
          delete floats[k];
        }
        return { enter, hit, floats };
      });
    }, 900);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchView(matchId);
      // busy 時（自己的動作還在飛）跳過：act() 拿到回應後會做同一次 diff，這裡再做會重播一次。
      if (!busyRef.current) {
        const diff = computeFx(viewRef.current, next);
        applyFx(diff);
        if (diff.hitKeys.length > 0) sfxHit();
        if (diff.enterKeys.length > 0) sfxSummon();
      }
      setView(next);
    } catch (e) {
      setErr(msg(e));
    }
  }, [matchId, applyFx]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    (async () => {
      try {
        await ensureAnonSession();
        if (!alive) return;
        await refresh();
        channelRef.current = subscribeMatch(
          matchId,
          () => void refresh(),
          (status) => setConnected(status === "SUBSCRIBED"),
        );
      } catch (e) {
        if (alive) setErr(msg(e));
      }
    })();
    const poll = setInterval(() => void refresh(), 4000);
    return () => {
      alive = false;
      clearInterval(poll);
      channelRef.current?.unsubscribe();
    };
  }, [matchId, refresh]);

  // 每秒跳動（用來導出倒數；setState 在 interval callback 內）
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const secondsLeft =
    view && view.phase !== "over" && view.deadlineMs != null
      ? Math.max(0, Math.ceil((view.deadlineMs - nowTs) / 1000))
      : null;

  const act = useCallback(
    async (action: Parameters<typeof sendAction>[1]) => {
      if (busy) return;
      setBusy(true);
      setErr("");
      const prev = viewRef.current;
      try {
        const next = await sendAction(matchId, action);
        applyFx(computeFx(prev, next)); // 隨從登場／受擊震動／浮動傷害-回復數字
        // 依動作與前後 diff 播音效
        if (action.type === "attack") {
          sfxAttack();
        } else if (action.type === "answer" && prev) {
          if (next.you.correct > prev.you.correct) sfxCorrect();
          else if (next.you.wrong > prev.you.wrong) sfxWrong();
          if (next.you.board.length > prev.you.board.length) sfxSummon();
          else sfxPlayCard();
        }
        if (next.phase === "over" && prev?.phase !== "over") {
          if (next.outcome === "win") sfxArrive();
          else sfxLose();
        }
        setView(next);
        setSelecting(null);
      } catch (e) {
        setErr(msg(e));
      } finally {
        setBusy(false);
      }
    },
    [busy, matchId, applyFx],
  );

  /** 攻擊出手：蓄力（windup）→ 衝向目標（lunge，依 DOM 位置算位移，跟 /play useCombat 同招）
   *  →送出真正的動作 → 落回原位。/play 有完整事件時間軸可以精準編排每一步，/vs 沒有那條時間軸
   *  （伺服器只回結算後的 view），這裡用「先播蓄力+衝刺、動畫尾聲才送出請求」的簡化版本近似同樣的
   *  觀感，衝刺到位後卡片停留在目標位置直到伺服器回應（受擊震動/浮動傷害才接手），落幕才彈回原位。 */
  const doAttack = useCallback(
    async (attackerKey: string, target: ClientTarget, targetAnchor: string) => {
      if (busy || attackingRef.current) return;
      attackingRef.current = true;
      const reduceMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      try {
        if (!reduceMotion) {
          setWindupKey(attackerKey);
          await sleep(150);
          const a = elsRef.current.get(attackerKey)?.getBoundingClientRect();
          const b = elsRef.current.get(targetAnchor)?.getBoundingClientRect();
          if (a && b) setLungeMap({ [attackerKey]: lungeTransform(a, b) });
          await sleep(190);
        }
        setWindupKey(null);
        await act({ type: "attack", attackerKey, target });
      } finally {
        setLungeMap({});
        attackingRef.current = false;
      }
    },
    [busy, act],
  );

  if (!supabaseConfigured) {
    return <Centered><p className="text-amber-300">後端尚未設定，無法連線對戰。</p></Centered>;
  }
  if (!view) {
    return <Centered><p className="text-neutral-400 animate-pulse">{err || "連線中…"}</p></Centered>;
  }

  const myTurn = view.yourTurn && !busy;
  const quiz = view.quiz;

  /** 一張卡目前能不能出，以及不能出的原因（詳情視窗的「出牌」鈕與手牌標示共用這份邏輯，
   *  兩處都呼叫這裡、不各自重算，避免理由文字兜不起來）。 */
  function cardPlayInfo(card: Card): { playable: boolean; reason?: string } {
    if (quiz) return { playable: false, reason: "先答完手上這題" };
    if (!myTurn) return { playable: false, reason: "還沒輪到你" };
    if (card.cost > view!.you.mana) return { playable: false, reason: "法力不足" };
    if (card.type === "minion" && view!.you.board.length >= BOARD_MAX) {
      return { playable: false, reason: "戰場已滿" };
    }
    return { playable: true };
  }

  /** 詳情視窗按「出牌」才真的送出動作／進入選目標（法術：進 selecting 模式；其餘：直接送出） */
  function confirmPlay(card: Card) {
    if (!myTurn || quiz) return;
    if (card.type === "minion") {
      void act({ type: "playCard", cardId: card.id });
      return;
    }
    const kind = spellTargetKind(card);
    if (kind === "none") {
      void act({ type: "playCard", cardId: card.id });
      return;
    }
    setSelecting({ mode: "spell", card }); // any / *Minion 需要或可指定目標
  }

  function onMyMinionClick(m: Minion) {
    if (!myTurn || quiz) return;
    if (!m.canAttack || m.attack <= 0) {
      // 點自己的隨從卻不能選成攻擊者（可能誤觸）：明講原因，不要悄悄沒反應——玩家會以為畫面壞了。
      setErr(attackBlockedReason(m));
      return;
    }
    setSelecting((s) =>
      s && s.mode === "attack" && s.attackerKey === m.key ? null : { mode: "attack", attackerKey: m.key },
    );
  }

  function onTargetHero(who: "you" | "opp") {
    if (!selecting) return;
    if (selecting.mode === "attack" && who === "opp") {
      void doAttack(selecting.attackerKey, { kind: "hero" }, heroFxKey("opp"));
    } else if (selecting.mode === "spell" && who === "opp") {
      void act({ type: "playCard", cardId: selecting.card.id, target: { kind: "hero" } });
    }
  }
  function onTargetMinion(who: "you" | "opp", key: string) {
    if (!selecting) return;
    const target: ClientTarget = { kind: "minion", who, key };
    if (selecting.mode === "attack") {
      if (who === "opp") void doAttack(selecting.attackerKey, target, key);
    } else {
      void act({ type: "playCard", cardId: selecting.card.id, target });
    }
  }

  function toggleMulligan(i: number) {
    setMulliganSel((s) => {
      const next = new Set(s);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  function confirmMulligan() {
    void act({ type: "mulligan", replaceIdx: [...mulliganSel] });
    setMulliganSel(new Set());
  }

  const highlight = targetHighlight(view, selecting, busy);

  return (
    <main className="play-page min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <AmbientAudio />
      <BattleMusic />
      <GemDefs />
      {/* play-shell：跟 /play 共用同一個寬度上限（min(100%,1560px)＋置中），避免超寬螢幕下
          hs-table 沒有上限地被撐開、隨從卡片卻是固定大小，看起來像牌「飄」在一大片空桌上。 */}
      <div className="play-shell mx-auto">
      {/* 頂部列 */}
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-neutral-800/80">
        <Link href="/vs" className="text-xs text-neutral-500 hover:text-neutral-300 underline">← 大廳</Link>
        <TurnBadge view={view} secondsLeft={secondsLeft} />
        <button
          onClick={() => act({ type: "concede" })}
          disabled={view.phase === "over" || busy}
          className="text-xs text-rose-400/80 hover:text-rose-300 underline disabled:opacity-40"
        >
          認輸
        </button>
      </div>
      {!connected && view.phase !== "over" ? (
        <div className="bg-amber-900/40 text-amber-200 text-xs text-center py-1 animate-pulse">
          連線中斷，重新連線中…（仍會自動同步）
        </div>
      ) : null}

      {/* 爐石式牌桌 */}
      <div
        className="hs-table relative overflow-hidden bg-cover bg-center"
        style={{ backgroundImage: `url(${BOARD_BG})` }}
        onClick={(e) => {
          // 已選定攻擊者或法術目標，卻點在空白戰場（沒有落在任何隨從／英雄上）＝取消這次選擇。
          if (e.target === e.currentTarget && selecting) setSelecting(null);
        }}
      >
        <div className="hs-table-shade absolute inset-0" aria-hidden />

        <CardBackFan count={view.opp.handCount} />
        <ManaStrip variant="opp" mana={view.opp.mana} maxMana={view.opp.maxMana} />
        <HeroPortrait
          variant="opp"
          name={view.oppName || "對手"}
          hp={view.opp.hp}
          maxHp={HERO_HP}
          sub={`手牌 ${view.opp.handCount} · 牌庫 ${view.opp.deckCount}`}
          targetable={highlight.oppHero}
          thinking={view.oppThinking}
          hit={fx.hit.has(heroFxKey("opp"))}
          float={fx.floats[heroFxKey("opp")]}
          onClick={() => onTargetHero("opp")}
          elRef={registerEl(heroFxKey("opp"))}
        />

        {selecting ? (
          <div className="hs-target-callout">
            {selecting.mode === "spell"
              ? spellHint(selecting.card, view)
              : attackHint(view, selecting.attackerKey)}
          </div>
        ) : null}
        {selecting?.mode === "attack" ? <AttackArrow fromKey={selecting.attackerKey} /> : null}

        <div className="hs-combat-lane relative">
          {/* 對手戰場 */}
          <section>
            <div className="hs-board-row hs-board-row-enemy min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
              {view.opp.board.length === 0 && <span className="hs-board-empty text-xs self-center px-2">對手尚無隨從。</span>}
              {view.opp.board.map((m) => (
                <MinionToken
                  key={m.key}
                  minion={m}
                  targetable={highlight.oppMinions.has(m.key)}
                  entering={fx.enter.has(m.key)}
                  hit={fx.hit.has(m.key)}
                  float={fx.floats[m.key]}
                  onClick={() => onTargetMinion("opp", m.key)}
                  elRef={registerEl(m.key)}
                />
              ))}
            </div>
          </section>
          {/* 我方戰場 */}
          <section>
            <div className="hs-board-row hs-board-row-player min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
              {view.you.board.length === 0 && <span className="hs-board-empty text-xs self-center px-2">尚無隨從，從手牌打出吧。</span>}
              {view.you.board.map((m) => {
                // 正在選法術目標時，「可攻擊」跟「是否為合法法術目標」是兩回事：ready 必須
                // 強制關掉，否則按鈕不會 disabled（MinionToken 的 disabled = !targetable && !ready），
                // 即使這隻隨從不在 highlight.youMinions 裡也照樣點得下去，點了才被伺服器 400 拒絕。
                // busy（上一個動作還在飛）也要關掉，不然隨從還亮著可攻擊，點下去被 act() 的
                // if (busy) return 悄悄吞掉、畫面完全沒反應——玩家會覺得「明明可以攻擊怎麼點不動」。
                const ready = myTurn && !quiz && !busy && m.canAttack && m.attack > 0 && selecting?.mode !== "spell";
                return (
                  <MinionToken
                    key={m.key}
                    minion={m}
                    ready={ready}
                    targetable={highlight.youMinions.has(m.key)}
                    selected={selecting?.mode === "attack" && selecting.attackerKey === m.key}
                    entering={fx.enter.has(m.key)}
                    hit={fx.hit.has(m.key)}
                    windup={windupKey === m.key}
                    float={fx.floats[m.key]}
                    onClick={() =>
                      selecting?.mode === "spell" ? onTargetMinion("you", m.key) : onMyMinionClick(m)
                    }
                    elRef={registerEl(m.key)}
                    style={lungeMap[m.key] ? { transform: lungeMap[m.key], zIndex: 40 } : undefined}
                  />
                );
              })}
            </div>
          </section>
        </div>

        <HeroPortrait
          variant="you"
          name={view.youName || "你"}
          hp={view.you.hp}
          maxHp={HERO_HP}
          sub={`答對 ${view.you.correct} · 答錯 ${view.you.wrong}`}
          targetable={highlight.youHero}
          hit={fx.hit.has(heroFxKey("you"))}
          float={fx.floats[heroFxKey("you")]}
          onClick={() => onTargetHero("you")}
          elRef={registerEl(heroFxKey("you"))}
        />
        <ManaStrip variant="you" mana={view.you.mana} maxMana={view.you.maxMana} />

        {/* 手牌 */}
        <section className="hs-hand-zone">
          <h2 className="hs-hand-label text-[11px] uppercase tracking-wider text-amber-200/60 mb-1">
            手牌（牌庫剩 {view.you.deckCount}）
            {selecting ? <span className="text-amber-300 ml-2">▶ 選擇目標中</span> : null}
          </h2>
          <div className="hs-hand-rail">
            {view.you.hand.length === 0 && <span className="text-slate-600 text-xs">手牌已空，結束回合抽牌。</span>}
            {view.you.hand.map((c, i) => {
              const dim = !myTurn || Boolean(quiz);
              // 手牌整排在「不是你回合／答題中」時只靠變暗表示，不逐張印字（太吵）；
              // 真的輪到你、單張出不起時才印具體理由。單一來源 cardPlayInfo，跟詳情視窗一致。
              const blocked = dim ? undefined : cardPlayInfo(c).reason;
              return (
                <HandCard key={`${c.id}-${i}`} card={c} dim={dim} blockedReason={blocked} onClick={() => setInspect(c)} />
              );
            })}
          </div>
        </section>

        {/* 結束回合（浮在牌桌右下） */}
        <button
          onClick={() => act({ type: "endTurn" })}
          disabled={!myTurn || Boolean(quiz)}
          className="absolute top-1/2 right-3 -translate-y-1/2 z-30 rounded-xl bg-emerald-600 enabled:hover:bg-emerald-500 px-4 py-3 text-sm font-semibold shadow-lg transition disabled:opacity-40"
        >
          結束<br />回合
        </button>
      </div>

      {/* 戰報（牌桌下方一條） */}
      <BattleLog log={view.log} />
      </div>

      {err ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-rose-900/90 border border-rose-600 text-rose-100 text-sm px-4 py-2 rounded-lg">
          {err}
        </div>
      ) : null}

      {inspect && (
        <CardInspectModal
          card={inspect}
          playable={cardPlayInfo(inspect).playable}
          blockReason={cardPlayInfo(inspect).reason}
          onClose={() => setInspect(null)}
          onPlay={() => {
            setInspect(null);
            confirmPlay(inspect);
          }}
        />
      )}
      {quiz ? (
        <QuizModal quiz={quiz} disabled={busy} secondsLeft={secondsLeft} onAnswer={(idx) => act({ type: "answer", optionIdx: idx })} />
      ) : null}
      {view.phase === "mulligan" ? (
        <MulliganModal
          view={view}
          busy={busy}
          secondsLeft={secondsLeft}
          sel={mulliganSel}
          onToggle={toggleMulligan}
          onConfirm={confirmMulligan}
        />
      ) : null}
      {view.phase === "over" ? <OverOverlay win={view.outcome === "win"} onExit={() => router.push("/vs")} /> : null}
    </main>
  );
}

// ───────────────────────── 攻擊蓄力＋衝刺（跟 /play 同款手感）─────────────────────────
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** 依攻擊者／目標的 DOM 位置算衝刺位移：移動 62% 距離＋放大，跟 /play useCombat 的
 *  computeLunge 公式一致（同一套視覺語彙，只是這裡沒有事件時間軸，靠 rect 現算）。 */
function lungeTransform(a: DOMRect, b: DOMRect): string {
  const dx = b.left + b.width / 2 - (a.left + a.width / 2);
  const dy = b.top + b.height / 2 - (a.top + a.height / 2);
  return `translate(${(dx * 0.62).toFixed(0)}px, ${(dy * 0.62).toFixed(0)}px) scale(1.1)`;
}

// ───────────────────────── 小動畫（隨從登場／受擊／浮動數字）─────────────────────────
// /play 用的是引擎產生的事件時間軸（CombatEvent/EventStep），/vs 是伺服器權威的脱敏
// snapshot、沒有那條時間軸。改用「前後 view diff」（跟既有的音效判斷同一招）推出對應的
// 小動畫——不只是自己出手時，對手回合透過輪詢/Realtime 拉到新 view 時也一樣會觸發，
// 這樣「敵方回合」才會跟 /play 一樣有登場、受擊、浮動數字可看。
type FxDiff = { enterKeys: string[]; hitKeys: string[]; floats: Record<string, FloatFx> };
type FxState = { enter: Set<string>; hit: Set<string>; floats: Record<string, FloatFx> };
const EMPTY_SET: Set<string> = new Set();
const EMPTY_FLOATS: Record<string, FloatFx> = {};
const heroFxKey = (who: "you" | "opp") => `hero:${who}`;

function computeFx(prev: SeatView | null, next: SeatView): FxDiff {
  const enterKeys: string[] = [];
  const hitKeys: string[] = [];
  const floats: Record<string, FloatFx> = {};
  if (!prev) return { enterKeys, hitKeys, floats }; // 剛連上第一次拿到 view：不補播歷史動畫

  const diffBoard = (prevBoard: Minion[], nextBoard: Minion[]) => {
    const prevByKey = new Map(prevBoard.map((m) => [m.key, m]));
    for (const m of nextBoard) {
      const before = prevByKey.get(m.key);
      if (!before) {
        enterKeys.push(m.key); // 新出現的 key＝剛登場的隨從
        continue;
      }
      if (m.health < before.health) {
        hitKeys.push(m.key);
        floats[m.key] = { text: `-${before.health - m.health}` };
      } else if (m.health > before.health) {
        floats[m.key] = { text: `+${m.health - before.health}`, heal: true };
      }
    }
  };
  diffBoard(prev.you.board, next.you.board);
  diffBoard(prev.opp.board, next.opp.board);

  const diffHero = (who: "you" | "opp", prevHp: number, nextHp: number) => {
    const key = heroFxKey(who);
    if (nextHp < prevHp) {
      hitKeys.push(key);
      floats[key] = { text: `-${prevHp - nextHp}` };
    } else if (nextHp > prevHp) {
      floats[key] = { text: `+${nextHp - prevHp}`, heal: true };
    }
  };
  diffHero("you", prev.you.hp, next.you.hp);
  diffHero("opp", prev.opp.hp, next.opp.hp);

  return { enterKeys, hitKeys, floats };
}

/** 點了自己場上不能選成攻擊者的隨從（誤觸）時，講清楚為什麼——不要悄悄沒反應。
 *  attacksUsed>0＝這回合已經打過；否則是剛登場、還沒解除召喚失調（沒有衝鋒/突襲）。 */
function attackBlockedReason(m: Minion): string {
  const name = m.card.nameZh;
  if (m.attack <= 0) return `「${name}」攻擊力 0，這隻沒辦法出擊。`;
  if ((m.attacksUsed ?? 0) > 0) return `「${name}」這回合已經攻擊過了，不能再選它出擊。`;
  return `「${name}」剛登場，還在適應（沒有衝鋒/突襲），這回合還不能出擊。`;
}

// ───────────────────────── 目標高亮 ─────────────────────────
// 選了隨從要攻擊時的具體提示：能打誰、為什麼、怎麼取消。
// 突襲（rushBound）：登場當回合不可打英雄，只能打隨從——這點必須跟嘲諷判斷一起考慮。
function attackHint(view: SeatView, attackerKey: string): string {
  const attacker = view.you.board.find((m) => m.key === attackerKey);
  const name = attacker?.card.nameZh ?? "隨從";
  const cancel = `（再點一次「${name}」可取消）`;
  const rushBound = Boolean(attacker?.rushBound);
  const taunts = view.opp.board.filter((m) => m.taunt && !m.stealth);
  if (taunts.length > 0) {
    const names = taunts.map((m) => `「${m.card.nameZh}」`).join("、");
    return `「${name}」出擊：對手有嘲諷（${names}），必須先打嘲諷的隨從，不能越過去打英雄。${cancel}`;
  }
  const oppMinions = view.opp.board.filter((m) => !m.stealth);
  if (rushBound) {
    if (oppMinions.length > 0) {
      return `「${name}」出擊：突襲登場當回合不能打臉，只能打對手的隨從——點你要打的目標。${cancel}`;
    }
    return `「${name}」出擊：突襲登場當回合不能打臉，而對手場上又沒有隨從可打，這隻這回合打不了。${cancel}`;
  }
  if (oppMinions.length > 0) {
    return `「${name}」出擊：沒有嘲諷擋路，可以打對手的隨從，或直接打對手英雄——點你要打的目標。${cancel}`;
  }
  return `「${name}」出擊：對手場上沒有隨從，直接打對手英雄吧——點對手英雄。${cancel}`;
}

// 選了要指定目標的法術時的具體提示：能打誰、為什麼、怎麼取消。
// 引擎規則（match.ts validatePlay）：any/anyMinion 的潛行限制只擋「對手」的潛行隨從，
// 我方潛行隨從一律可選——文字必須講對，不能寫成「雙方潛行都不能選」誤導玩家。
function spellHint(card: Card, view: SeatView): string {
  const name = card.nameZh;
  const cancel = `（點空白處可取消）`;
  const kind = spellTargetKind(card);
  const stealthNote = view.opp.board.some((m) => m.stealth) ? "（對手的潛行隨從不能選，我方隨從不受影響）" : "";
  const noMinionAtAll = view.you.board.length === 0 && view.opp.board.filter((m) => !m.stealth).length === 0;
  switch (kind) {
    case "any":
      return `「${name}」：可以打對手英雄，或指定任何一個隨從（不分敵我）${stealthNote}。${cancel}`;
    case "anyMinion":
      if (noMinionAtAll) {
        return `「${name}」：需要指定一個隨從（不能打英雄），但雙方場上都沒有可選目標。${cancel}`;
      }
      return `「${name}」：可以指定任何一個隨從（不分敵我，但不能打英雄）${stealthNote}。${cancel}`;
    case "enemyMinion":
      if (view.opp.board.filter((m) => !m.stealth).length === 0) {
        return `「${name}」：需要指定一個敵方隨從，但對手場上沒有可選目標（潛行隨從不算）。${cancel}`;
      }
      return `「${name}」：只能指定對手的隨從${view.opp.board.some((m) => m.stealth) ? "（潛行的不能選）" : ""}。${cancel}`;
    case "friendMinion":
      if (view.you.board.length === 0) {
        return `「${name}」：需要指定一個我方隨從，但你場上還沒有隨從。${cancel}`;
      }
      return `「${name}」：只能指定我方自己的隨從。${cancel}`;
    default:
      return `選擇「${name}」的目標`;
  }
}

// busy＝上一個動作還在飛（伺服器還沒回應）。這段時間點目標會被 act() 的 if (busy) return
// 悄悄吞掉、不會有任何錯誤提示，等同「畫面說可以點，點了卻沒反應」。與其讓玩家白點，
// busy 時直接不亮任何目標，跟「現在真的不能點」的實際狀態一致。
function targetHighlight(view: SeatView, selecting: Selecting, busy: boolean) {
  const none = { oppHero: false, youHero: false, oppMinions: new Set<string>(), youMinions: new Set<string>() };
  if (busy || !selecting) return none;
  if (selecting.mode === "attack") {
    const taunts = view.opp.board.filter((m) => m.taunt && !m.stealth);
    if (taunts.length > 0) return { ...none, oppMinions: new Set(taunts.map((m) => m.key)) };
    const attacker = view.you.board.find((m) => m.key === selecting.attackerKey);
    const oppMinions = new Set(view.opp.board.filter((m) => !m.stealth).map((m) => m.key));
    // 突襲：登場當回合不可打英雄，英雄頭像不亮起、不可點。
    return { ...none, oppHero: !attacker?.rushBound, oppMinions };
  }
  const kind = spellTargetKind(selecting.card);
  const oppSel = view.opp.board.filter((m) => !m.stealth).map((m) => m.key);
  const youSel = view.you.board.map((m) => m.key);
  switch (kind) {
    case "any":
      return { oppHero: true, youHero: false, oppMinions: new Set(oppSel), youMinions: new Set(youSel) };
    case "anyMinion":
      return { ...none, oppMinions: new Set(oppSel), youMinions: new Set(youSel) };
    case "enemyMinion":
      return { ...none, oppMinions: new Set(oppSel) };
    case "friendMinion":
      return { ...none, youMinions: new Set(youSel) };
    default:
      return none;
  }
}

// ───────────────────────── 子元件 ─────────────────────────
// 攻擊指示箭頭：選定攻擊者後，從該隨從畫一條發光箭頭指向滑鼠，明確表示「正在選攻擊目標」
// （跟 /play 的 AttackArrow 一模一樣的做法：直接 DOM query data-mkey，不透過 React ref 物件——
// 在 render 期間讀 ref.current 會被 react-hooks/refs 規則擋下來，純 DOM API 呼叫則不會）。
function AttackArrow({ fromKey }: { fromKey: string }) {
  const [end, setEnd] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => setEnd({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);
  const el = typeof document !== "undefined" ? document.querySelector<HTMLElement>(`[data-mkey="${fromKey}"]`) : null;
  const r = el?.getBoundingClientRect();
  if (!r || !end) return null;
  const sx = r.left + r.width / 2;
  const sy = r.top + r.height / 2;
  const midX = (sx + end.x) / 2;
  const midY = (sy + end.y) / 2 - 44;
  return (
    <svg className="attack-arrow" width="100%" height="100%" aria-hidden>
      <defs>
        <marker id="vs-atk-head" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto">
          <path d="M0 0 L9 4.5 L0 9 L2.4 4.5 Z" fill="#fecaca" />
        </marker>
      </defs>
      <path
        d={`M ${sx} ${sy} Q ${midX} ${midY} ${end.x} ${end.y}`}
        fill="none"
        stroke="rgba(251, 113, 133, 0.92)"
        strokeWidth="5"
        strokeLinecap="round"
        markerEnd="url(#vs-atk-head)"
      />
    </svg>
  );
}

function TurnBadge({ view, secondsLeft }: { view: SeatView; secondsLeft: number | null }) {
  if (view.phase === "over") return <span className="text-sm font-semibold text-neutral-300">對局結束</span>;
  const clock =
    secondsLeft != null ? (
      <span className={`ml-2 tabular-nums font-mono ${secondsLeft <= 10 ? "text-rose-400 animate-pulse" : "text-neutral-400"}`}>
        ⏳ {secondsLeft}s
      </span>
    ) : null;
  if (view.phase === "mulligan") {
    return (
      <span className="text-sm">
        <span className="text-sky-300">{view.mulliganPending ? "換牌階段" : "等待對手換牌…"}</span>
        {clock}
      </span>
    );
  }
  if (view.oppThinking) {
    return <span className="text-sm"><span className="text-amber-300 animate-pulse">對手出牌答題中…</span>{clock}</span>;
  }
  return (
    <span className="text-sm font-semibold">
      <span className={view.yourTurn ? "text-emerald-400" : "text-neutral-400"}>
        {view.yourTurn ? "你的回合" : "對手回合"} · 第 {view.turn} 回合
      </span>
      {clock}
    </span>
  );
}

// 開局換牌：仿 /play 的介面（點卡標記要換的牌、換掉洗回牌庫重抽等量），但雙方各自獨立決定
// （不像 /play 只有一方，這裡送出後若對手還沒決定，要顯示等待畫面，不能讓玩家以為卡住了）。
function MulliganModal({
  view,
  busy,
  secondsLeft,
  sel,
  onToggle,
  onConfirm,
}: {
  view: SeatView;
  busy: boolean;
  secondsLeft: number | null;
  sel: Set<number>;
  onToggle: (i: number) => void;
  onConfirm: () => void;
}) {
  const clock =
    secondsLeft != null ? (
      <span className={`tabular-nums font-mono text-xs ${secondsLeft <= 10 ? "text-rose-400 animate-pulse" : "text-neutral-400"}`}>
        ⏳ {secondsLeft}s
      </span>
    ) : null;

  if (!view.mulliganPending) {
    return (
      <div className="fixed inset-0 bg-neutral-950/85 flex items-center justify-center z-50 px-6">
        <div className="w-full max-w-sm rounded-2xl border border-sky-600/40 bg-neutral-900 p-6 text-center space-y-3">
          <p className="text-sky-200 animate-pulse">已送出換牌，等待對手決定…</p>
          {clock}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-neutral-950/85 flex items-center justify-center z-50 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-amber-600/40 bg-neutral-900 p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">開局換牌</p>
            <h3 className="text-lg font-bold text-amber-100">調整起手牌</h3>
          </div>
          {clock}
        </div>
        <p className="text-xs text-neutral-400">
          點選想換掉的牌（洗回牌庫、重抽等量），或直接保留全部開始。雙方各自獨立決定，只有這一次機會。
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {view.you.hand.map((c, i) => {
            const marked = sel.has(i);
            const art = CARD_ART[c.id];
            return (
              <button
                key={`${c.id}-${i}`}
                onClick={() => onToggle(i)}
                disabled={busy}
                className={`relative w-[88px] aspect-[5/7] rounded-lg overflow-hidden border-2 transition disabled:opacity-50 ${
                  marked ? "border-rose-400 opacity-70" : "border-amber-400/40 hover:border-amber-300 hover:-translate-y-0.5"
                }`}
              >
                {art ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={art} alt={c.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                ) : null}
                <span className="absolute top-1 left-1 rounded bg-black/70 px-1 text-[10px] text-sky-200">{c.cost}</span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 py-0.5 text-center text-[10px]">
                  {c.nameZh}
                </span>
                {marked && (
                  <span className="absolute inset-0 grid place-items-center bg-rose-950/40 text-sm font-bold text-rose-200">
                    換
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onConfirm}
            disabled={busy}
            className="rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-5 py-2 text-sm font-bold text-black"
          >
            {sel.size > 0 ? `換掉 ${sel.size} 張並開始 ▶` : "保留全部開始 ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 答題視窗是全螢幕遮罩，會蓋住頂部的回合倒數——但伺服器的逾時判定在背景照跑，
// 玩家正在想答案時完全看不到剩多少秒，可能答到一半就被判逾時。倒數必須帶進來一起顯示。
function QuizModal({
  quiz,
  disabled,
  secondsLeft,
  onAnswer,
}: {
  quiz: NonNullable<SeatView["quiz"]>;
  disabled: boolean;
  secondsLeft: number | null;
  onAnswer: (i: number) => void;
}) {
  const art = CARD_ART[quiz.cardId];
  return (
    <div className="fixed inset-0 bg-neutral-950/85 flex items-center justify-center z-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-amber-600/40 bg-neutral-900 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3">
          {art ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art} alt="" className="w-12 h-12 rounded-lg object-cover border border-amber-500/40" />
          ) : null}
          <p className="text-sm text-amber-200/80 flex-1">出牌答題 · 答對觸發加成</p>
          {secondsLeft != null ? (
            <span
              className={`shrink-0 tabular-nums font-mono text-sm ${
                secondsLeft <= 10 ? "text-rose-400 animate-pulse" : "text-neutral-400"
              }`}
              title="回合剩餘時間：答不完也會照樣逾時換手"
            >
              ⏳ {secondsLeft}s
            </span>
          ) : null}
        </div>
        <p className="text-lg font-semibold">{quiz.prompt}</p>
        <div className="grid grid-cols-1 gap-2">
          {quiz.options.map((opt, i) => (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className="rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 py-3 text-center font-medium tracking-wide transition disabled:opacity-50"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function BattleLog({ log }: { log: SeatView["log"] }) {
  const tone: Record<string, string> = { good: "text-emerald-300", bad: "text-rose-300", sys: "text-neutral-400", info: "text-sky-300" };
  // 懸浮在右邊、半透明（~80% 不透明），不佔版面、不擋牌桌；pointer-events-none 讓點擊穿透到底下的卡。
  return (
    <div className="vs-battle-log fixed right-2 top-[15%] z-30 w-52 max-h-[140px] overflow-y-auto rounded-lg border border-neutral-700/50 bg-neutral-950/80 backdrop-blur-sm px-3 py-2 text-[11px] leading-relaxed shadow-lg pointer-events-none">
      {log.slice(0, 5).map((e) => (
        <div key={e.key} className={tone[e.tone] ?? "text-neutral-400"}>{e.text}</div>
      ))}
    </div>
  );
}

function OverOverlay({ win, onExit }: { win: boolean; onExit: () => void }) {
  return (
    <div className="fixed inset-0 bg-neutral-950/90 flex items-center justify-center z-50">
      <div className="text-center space-y-5">
        <div className={`text-5xl font-black ${win ? "text-emerald-400" : "text-neutral-400"}`}>{win ? "勝利" : "落敗"}</div>
        <button onClick={onExit} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 font-semibold transition">
          回大廳
        </button>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-neutral-950 flex items-center justify-center">{children}</main>;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
