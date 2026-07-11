"use client";

// ORDER-060 P2 —— 線上對戰盤面。伺服器權威：只送意圖、收脱敏視角。
// 流程：ensureAnonSession → fetchView 初始 → 訂閱 matches poke（+ 輪詢備援）重拉視角。
// 出牌兩步：點卡（法術先指定目標）→ 伺服器出題 → 作答 → 伺服器結算並回新視角。
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { RARITY_COLOR, type Card } from "@/data/cards";
import type { Minion } from "@/engine/types";
import { spellTargetKind } from "@/engine/game";
import type { SeatView, ClientTarget } from "@/engine/match";
import { ensureAnonSession, subscribeMatch, fetchView, sendAction } from "@/lib/vs";
import { supabaseConfigured } from "@/lib/supabase";

// 目前的指定狀態：選了一張要指定目標的法術，或選了一隻要攻擊的隨從。
type Selecting =
  | { mode: "spell"; card: Card }
  | { mode: "attack"; attackerKey: string }
  | null;

export default function BattlePage() {
  const params = useParams<{ id: string }>();
  const matchId = params.id;
  const router = useRouter();

  const [view, setView] = useState<SeatView | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [selecting, setSelecting] = useState<Selecting>(null);
  const [connected, setConnected] = useState(true); // Realtime 連線狀態
  const [nowTs, setNowTs] = useState(() => Date.now()); // 每秒跳動，用來導出倒數
  const channelRef = useRef<RealtimeChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      setView(await fetchView(matchId));
    } catch (e) {
      setErr(msg(e));
    }
  }, [matchId]);

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
    // 備援輪詢：Realtime 偶爾漏推時仍能同步（回合制，4s 足夠）；斷線時也靠它續命
    const poll = setInterval(() => void refresh(), 4000);
    return () => {
      alive = false;
      clearInterval(poll);
      channelRef.current?.unsubscribe();
    };
  }, [matchId, refresh]);

  // 每秒跳動一次（setState 在 interval callback 內，非 effect 同步呼叫）
  useEffect(() => {
    const t = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // 由 deadlineMs 與 nowTs 導出倒數秒數（純導出，不存 state）。
  // 歸零後的逾時結算不在這裡觸發：交給既有的 4s 備援輪詢打 getView → 伺服器懶執行 enforceDeadline，
  // 90s 的回合計時容得下最多 4s 的延遲，也避免在 effect 內同步呼叫 setState。
  const secondsLeft =
    view && view.phase !== "over" && view.deadlineMs != null
      ? Math.max(0, Math.ceil((view.deadlineMs - nowTs) / 1000))
      : null;

  // 送出一個意圖：樂觀地用回傳視角即時更新，並清掉指定狀態。
  const act = useCallback(
    async (action: Parameters<typeof sendAction>[1]) => {
      if (busy) return;
      setBusy(true);
      setErr("");
      try {
        setView(await sendAction(matchId, action));
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

  // ── 點手牌 ──
  function onCardClick(card: Card) {
    if (!myTurn || quiz) return;
    if (card.type === "minion") {
      void act({ type: "playCard", cardId: card.id });
      return;
    }
    const kind = spellTargetKind(card);
    if (kind === "none" || kind === "any") {
      // any：預設打對手英雄，玩家也可改點目標 → 進指定模式讓他選
      if (kind === "none") {
        void act({ type: "playCard", cardId: card.id });
        return;
      }
    }
    setSelecting({ mode: "spell", card }); // 需要或可以指定目標
  }

  // ── 點自己隨從（發動攻擊）──
  function onMyMinionClick(m: Minion) {
    if (!myTurn || quiz) return;
    if (!m.canAttack || m.attack <= 0) return;
    setSelecting((s) =>
      s && s.mode === "attack" && s.attackerKey === m.key ? null : { mode: "attack", attackerKey: m.key },
    );
  }

  // ── 點目標（英雄或隨從）──
  function onTargetHero(who: "you" | "opp") {
    if (!selecting) return;
    if (selecting.mode === "attack" && who === "opp") {
      void act({ type: "attack", attackerKey: selecting.attackerKey, target: { kind: "hero" } });
    } else if (selecting.mode === "spell") {
      // 只有 "any" 系法術能點英雄（對手英雄）
      if (who === "opp") void act({ type: "playCard", cardId: selecting.card.id, target: { kind: "hero" } });
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

  // 指定模式下，哪些目標可點（給視覺高亮）
  const highlight = targetHighlight(view, selecting);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* 頂部：回合 / 對手英雄 */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-800">
        <Link href="/vs" className="text-xs text-neutral-500 hover:text-neutral-300 underline">
          ← 大廳
        </Link>
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

      <div className="flex-1 flex flex-col justify-between max-w-5xl w-full mx-auto px-3 py-4 gap-3">
        {/* 對手 */}
        <section className="space-y-2">
          <HeroBar
            label={view.oppName || "對手"}
            hp={view.opp.hp}
            mana={view.opp.mana}
            maxMana={view.opp.maxMana}
            deckCount={view.opp.deckCount}
            handCount={view.opp.handCount}
            thinking={view.oppThinking}
            targetable={highlight.oppHero}
            onClick={() => onTargetHero("opp")}
          />
          <Board
            minions={view.opp.board}
            side="opp"
            highlightKeys={highlight.oppMinions}
            onMinion={(m) => onTargetMinion("opp", m.key)}
          />
        </section>

        {/* 戰報 */}
        <BattleLog log={view.log} />

        {/* 我方 */}
        <section className="space-y-2">
          <Board
            minions={view.you.board}
            side="you"
            selectableAttackers={myTurn && !quiz}
            selectedKey={selecting?.mode === "attack" ? selecting.attackerKey : null}
            highlightKeys={highlight.youMinions}
            onMinion={(m) =>
              selecting?.mode === "spell" ? onTargetMinion("you", m.key) : onMyMinionClick(m)
            }
          />
          <HeroBar
            label={view.youName || "你"}
            hp={view.you.hp}
            mana={view.you.mana}
            maxMana={view.you.maxMana}
            deckCount={view.you.deckCount}
            targetable={highlight.youHero}
            onClick={() => onTargetHero("you")}
          />
          <Hand cards={view.you.hand} mana={view.you.mana} enabled={myTurn && !quiz} onPlay={onCardClick} />
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-neutral-500">
              答對 {view.you.correct} · 答錯 {view.you.wrong}
              {selecting ? <span className="ml-3 text-emerald-400">選擇目標中…（再點一次取消攻擊）</span> : null}
            </p>
            <button
              onClick={() => act({ type: "endTurn" })}
              disabled={!myTurn || Boolean(quiz)}
              className="rounded-lg bg-emerald-600 enabled:hover:bg-emerald-500 px-5 py-2 text-sm font-semibold transition disabled:opacity-40"
            >
              結束回合
            </button>
          </div>
        </section>
      </div>

      {err ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-rose-900/90 border border-rose-600 text-rose-100 text-sm px-4 py-2 rounded-lg">
          {err}
        </div>
      ) : null}

      {quiz ? <QuizModal quiz={quiz} disabled={busy} onAnswer={(i) => act({ type: "answer", optionIdx: i })} /> : null}

      {view.phase === "over" ? <OverOverlay win={view.outcome === "win"} onExit={() => router.push("/vs")} /> : null}
    </main>
  );
}

// ───────────────────────── 目標高亮計算 ─────────────────────────

function targetHighlight(view: SeatView, selecting: Selecting) {
  const none = { oppHero: false, youHero: false, oppMinions: new Set<string>(), youMinions: new Set<string>() };
  if (!selecting) return none;

  if (selecting.mode === "attack") {
    // 對手有嘲諷（未潛行）→ 只能打嘲諷；否則英雄 + 未潛行隨從
    const taunts = view.opp.board.filter((m) => m.taunt && !m.stealth);
    if (taunts.length > 0) {
      return { ...none, oppMinions: new Set(taunts.map((m) => m.key)) };
    }
    return {
      ...none,
      oppHero: true,
      oppMinions: new Set(view.opp.board.filter((m) => !m.stealth).map((m) => m.key)),
    };
  }

  // 法術
  const kind = spellTargetKind(selecting.card);
  const oppSelectable = view.opp.board.filter((m) => !m.stealth).map((m) => m.key);
  const youSelectable = view.you.board.map((m) => m.key);
  switch (kind) {
    case "any":
      return { oppHero: true, youHero: false, oppMinions: new Set(oppSelectable), youMinions: new Set(youSelectable) };
    case "anyMinion":
      return { ...none, oppMinions: new Set(oppSelectable), youMinions: new Set(youSelectable) };
    case "enemyMinion":
      return { ...none, oppMinions: new Set(oppSelectable) };
    case "friendMinion":
      return { ...none, youMinions: new Set(youSelectable) };
    default:
      return none;
  }
}

// ───────────────────────── 子元件 ─────────────────────────

function TurnBadge({ view, secondsLeft }: { view: SeatView; secondsLeft: number | null }) {
  if (view.phase === "over") {
    return <span className="text-sm font-semibold text-neutral-300">對局結束</span>;
  }
  const clock =
    secondsLeft != null ? (
      <span className={`ml-2 tabular-nums font-mono ${secondsLeft <= 10 ? "text-rose-400 animate-pulse" : "text-neutral-400"}`}>
        ⏳ {secondsLeft}s
      </span>
    ) : null;
  if (view.oppThinking) {
    return (
      <span className="text-sm">
        <span className="text-amber-300 animate-pulse">對手出牌答題中…</span>
        {clock}
      </span>
    );
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

function HeroBar(props: {
  label: string;
  hp: number;
  mana: number;
  maxMana: number;
  deckCount: number;
  handCount?: number;
  thinking?: boolean;
  targetable?: boolean;
  onClick?: () => void;
}) {
  const { label, hp, mana, maxMana, deckCount, handCount, targetable, onClick } = props;
  return (
    <button
      onClick={targetable ? onClick : undefined}
      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition ${
        targetable
          ? "border-rose-400 ring-2 ring-rose-400/40 cursor-crosshair bg-neutral-900"
          : "border-neutral-800 bg-neutral-900/60 cursor-default"
      }`}
    >
      <span className="text-xs text-neutral-400 min-w-10 max-w-[7rem] truncate">{label}</span>
      <span className="text-lg font-bold text-rose-300 tabular-nums">♥ {hp}</span>
      <span className="text-sm text-sky-300 tabular-nums">◆ {mana}/{maxMana}</span>
      <span className="text-xs text-neutral-500 ml-auto tabular-nums">
        牌庫 {deckCount}
        {handCount != null ? ` · 手牌 ${handCount}` : ""}
      </span>
    </button>
  );
}

function Board(props: {
  minions: Minion[];
  side: "you" | "opp";
  selectableAttackers?: boolean;
  selectedKey?: string | null;
  highlightKeys?: Set<string>;
  onMinion?: (m: Minion) => void;
}) {
  const { minions, selectableAttackers, selectedKey, highlightKeys, onMinion } = props;
  return (
    <div className="min-h-[92px] flex items-center justify-center gap-2 flex-wrap">
      {minions.length === 0 ? (
        <span className="text-xs text-neutral-700">（無隨從）</span>
      ) : (
        minions.map((m) => {
          const highlighted = highlightKeys?.has(m.key);
          const canAttack = selectableAttackers && m.canAttack && m.attack > 0;
          return (
            <button
              key={m.key}
              onClick={() => onMinion?.(m)}
              className={`relative w-[76px] aspect-[4/5] rounded-lg border-2 ${RARITY_COLOR[m.card.rarity]} bg-neutral-900 flex flex-col items-center justify-center px-1 transition ${
                highlighted ? "ring-2 ring-rose-400 cursor-crosshair" : ""
              } ${canAttack ? "ring-2 ring-emerald-400/70 hover:brightness-110" : ""} ${
                selectedKey === m.key ? "ring-2 ring-emerald-300 -translate-y-1" : ""
              }`}
            >
              <span className="text-[10px] leading-tight text-center text-neutral-200 line-clamp-2">
                {m.card.nameZh}
              </span>
              <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-amber-500 text-neutral-950 text-[11px] font-bold flex items-center justify-center">
                {m.attack}
              </div>
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-neutral-50 text-[11px] font-bold flex items-center justify-center">
                {m.health}
              </div>
              {m.taunt ? <div className="absolute -top-1 inset-x-0 text-center text-[9px] text-amber-300">嘲諷</div> : null}
              {m.stealth ? <div className="absolute top-1 right-1 text-[9px] text-sky-300">潛</div> : null}
            </button>
          );
        })
      )}
    </div>
  );
}

function Hand(props: { cards: Card[]; mana: number; enabled: boolean; onPlay: (c: Card) => void }) {
  const { cards, mana, enabled, onPlay } = props;
  return (
    <div className="flex items-end justify-center gap-2 flex-wrap min-h-[120px]">
      {cards.map((c, i) => {
        const affordable = enabled && c.cost <= mana;
        return (
          <button
            key={`${c.id}-${i}`}
            onClick={() => onPlay(c)}
            disabled={!affordable}
            className={`hs-card ${RARITY_COLOR[c.rarity]} relative w-[108px] aspect-[5/7] rounded-lg border-2 bg-neutral-900 text-left p-2 transition ${
              affordable ? "hover:-translate-y-1.5 cursor-pointer" : "opacity-60 cursor-default"
            }`}
          >
            <div className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-sky-500 text-neutral-950 text-xs font-bold flex items-center justify-center">
              {c.cost}
            </div>
            <div className="text-[11px] font-semibold text-neutral-100 mt-3 leading-tight">{c.nameZh}</div>
            <div className="text-[9px] text-neutral-400 mt-1 leading-snug line-clamp-3">{c.effectText}</div>
            {c.type === "minion" ? (
              <div className="absolute bottom-1 inset-x-1 flex justify-between text-[11px] font-bold">
                <span className="text-amber-400">{c.attack}</span>
                <span className="text-rose-400">{c.health}</span>
              </div>
            ) : (
              <div className="absolute bottom-1 inset-x-0 text-center text-[9px] text-fuchsia-300">法術</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function QuizModal(props: { quiz: NonNullable<SeatView["quiz"]>; disabled: boolean; onAnswer: (i: number) => void }) {
  const { quiz, disabled, onAnswer } = props;
  return (
    <div className="fixed inset-0 bg-neutral-950/80 flex items-center justify-center z-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 space-y-4">
        <p className="text-sm text-neutral-400">出牌答題 · 答對觸發加成</p>
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
  const tone: Record<string, string> = {
    good: "text-emerald-300",
    bad: "text-rose-300",
    sys: "text-neutral-400",
    info: "text-sky-300",
  };
  return (
    <div className="h-16 overflow-y-auto rounded-lg bg-neutral-900/40 border border-neutral-800 px-3 py-1.5 text-[11px] leading-relaxed">
      {log.slice(0, 6).map((e) => (
        <div key={e.key} className={tone[e.tone] ?? "text-neutral-400"}>
          {e.text}
        </div>
      ))}
    </div>
  );
}

function OverOverlay({ win, onExit }: { win: boolean; onExit: () => void }) {
  return (
    <div className="fixed inset-0 bg-neutral-950/90 flex items-center justify-center z-50">
      <div className="text-center space-y-5">
        <div className={`text-5xl font-black ${win ? "text-emerald-400" : "text-neutral-400"}`}>
          {win ? "勝利" : "落敗"}
        </div>
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
