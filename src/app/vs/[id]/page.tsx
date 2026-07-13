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
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxSummon, sfxAttack, sfxArrive, sfxLose } from "@/lib/sfx";
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
  const [nowTs, setNowTs] = useState(() => Date.now());
  const channelRef = useRef<RealtimeChannel | null>(null);
  const viewRef = useRef<SeatView | null>(null); // 最新視角（給 act 內做前後 diff 觸發音效）

  const refresh = useCallback(async () => {
    try {
      setView(await fetchView(matchId));
    } catch (e) {
      setErr(msg(e));
    }
  }, [matchId]);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

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
    [busy, matchId],
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
    if (!m.canAttack || m.attack <= 0) return;
    setSelecting((s) =>
      s && s.mode === "attack" && s.attackerKey === m.key ? null : { mode: "attack", attackerKey: m.key },
    );
  }

  function onTargetHero(who: "you" | "opp") {
    if (!selecting) return;
    if (selecting.mode === "attack" && who === "opp") {
      void act({ type: "attack", attackerKey: selecting.attackerKey, target: { kind: "hero" } });
    } else if (selecting.mode === "spell" && who === "opp") {
      void act({ type: "playCard", cardId: selecting.card.id, target: { kind: "hero" } });
    }
  }
  function onTargetMinion(who: "you" | "opp", key: string) {
    if (!selecting) return;
    const target: ClientTarget = { kind: "minion", who, key };
    if (selecting.mode === "attack") {
      if (who === "opp") void act({ type: "attack", attackerKey: selecting.attackerKey, target });
    } else {
      void act({ type: "playCard", cardId: selecting.card.id, target });
    }
  }

  const highlight = targetHighlight(view, selecting);

  return (
    <main className="play-page min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <AmbientAudio />
      <BattleMusic />
      <GemDefs />
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
          onClick={() => onTargetHero("opp")}
        />

        {selecting ? (
          <div className="hs-target-callout">
            {selecting.mode === "spell"
              ? spellHint(selecting.card, view)
              : attackHint(view, selecting.attackerKey)}
          </div>
        ) : null}

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
                  onClick={() => onTargetMinion("opp", m.key)}
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
                const ready = myTurn && !quiz && m.canAttack && m.attack > 0 && selecting?.mode !== "spell";
                return (
                  <MinionToken
                    key={m.key}
                    minion={m}
                    ready={ready}
                    targetable={highlight.youMinions.has(m.key)}
                    selected={selecting?.mode === "attack" && selecting.attackerKey === m.key}
                    onClick={() =>
                      selecting?.mode === "spell" ? onTargetMinion("you", m.key) : onMyMinionClick(m)
                    }
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
          onClick={() => onTargetHero("you")}
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
      {view.phase === "over" ? <OverOverlay win={view.outcome === "win"} onExit={() => router.push("/vs")} /> : null}
    </main>
  );
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

function targetHighlight(view: SeatView, selecting: Selecting) {
  const none = { oppHero: false, youHero: false, oppMinions: new Set<string>(), youMinions: new Set<string>() };
  if (!selecting) return none;
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
function TurnBadge({ view, secondsLeft }: { view: SeatView; secondsLeft: number | null }) {
  if (view.phase === "over") return <span className="text-sm font-semibold text-neutral-300">對局結束</span>;
  const clock =
    secondsLeft != null ? (
      <span className={`ml-2 tabular-nums font-mono ${secondsLeft <= 10 ? "text-rose-400 animate-pulse" : "text-neutral-400"}`}>
        ⏳ {secondsLeft}s
      </span>
    ) : null;
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
