"use client";

import Link from "next/link";
import { Noto_Serif_TC } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import { CARD_LEARNING, CARDS, TOKEN_SAPLING, Card, RARITY_COLOR, Theme } from "@/data/cards";
// 卡面美術改由單一資料來源 src/data/cardArt.ts 提供（與 /vs 線上盤面共用，避免兩份漂移）。
import { CARD_ART, HERO_ART, CARDBACK, BOARD_BG, THEME_ZH, RARITY_ZH, RARITY_GLOW } from "@/data/cardArt";
// 寶石 StatGem/GemDefs 也改由單一來源 src/lib/statGem.tsx 提供（與 /vs 共用）。
import { GemDefs, StatGem } from "@/lib/statGem";
import { audioUrl } from "@/data/truku";
import AmbientAudio from "@/components/AmbientAudio";
import BattleMusic from "@/components/BattleMusic";
import { sfxPlayCard, sfxCorrect, sfxWrong, sfxArrive, sfxLose, sfxAttack } from "@/lib/sfx";
import {
  Game,
  Minion,
  QuizState,
  Target,
  TargetKind,
  Difficulty,
  HERO_HP,
  BOARD_MAX,
  attackTargets,
  hasValidTarget,
  makeQuiz,
  makeSentenceQuiz,
  mulligan,
  newGame,
  pushLog,
  spellTargetKind,
  playCardFlow,
  attackFlow,
  startTurnFlow,
  endTurnFlow,
  enemyTurnFlow,
} from "@/engine";
import { useCombat } from "./useCombat";

// 卡名用襯線字（比照 /journey 的標題字），像收藏卡的名條
// 以卡片 id 反查完整卡片資料（出牌動畫在缺圖時改用名稱＋效果文字呈現）
const CARD_BY_ID: Record<string, Card> = Object.fromEntries(
  [...CARDS, TOKEN_SAPLING].map((c) => [c.id, c]),
);

const notoSerifTC = Noto_Serif_TC({ weight: ["700"], subsets: ["latin"], display: "swap" });

const DIFF_ZH: Record<Difficulty, string> = { easy: "簡單", normal: "普通", hard: "困難" };

// 多套對手（頭目）：中性的「山林試煉」變體，以牌組主題偏向做出不同手感。
// 文化中性——皆為自然生態意象，非擬人化祖靈/神格；難度(easy/normal/hard)另外正交控制。
const OPPONENTS: { id: string; name: string; tagline: string; theme?: Theme }[] = [
  { id: "trial", name: "山林試煉", tagline: "均衡的試煉，各類牌都有。" },
  { id: "beasts", name: "山林試煉 · 獸群", tagline: "獸群偏重，前期就壓上來。", theme: "animal" },
  { id: "forest", name: "山林試煉 · 深林", tagline: "草木叢生，嘲諷防守、後期反打。", theme: "plant" },
  { id: "storm", name: "山林試煉 · 風雨", tagline: "風雨為主，法術節奏壓制。", theme: "nature" },
];

// 新手引導步驟（互動分步教學；文字＋簡易示意圖，無 emoji）
const ONB_STEPS: { k: string; title: string; body: string }[] = [
  {
    k: "goal",
    title: "目標：打倒山林試煉",
    body: "你（織者）和對手都從 30 點生命開始。把「山林試煉」的生命打到 0，就通過試煉。",
  },
  {
    k: "quiz",
    title: "出牌先答族語題",
    body: "每打一張牌會跳出一題太魯閣族語選擇。答對 → 觸發卡片的 ★加成（更強）；答錯 → 以基礎效果打出，一樣能出牌。揭曉後自動播正確發音。",
  },
  {
    k: "mana",
    title: "法力決定你能出什麼",
    body: "每回合法力上限 +1（最多 10）。牌左上角的藍寶石是費用，法力不夠就不能出這張。",
  },
  {
    k: "attack",
    title: "隨從與攻擊",
    body: "剛打出的隨從要「下一回合」才能攻擊。輪到你時，先點自己的隨從，再點敵方隨從或英雄發動攻擊。",
  },
  {
    k: "keyword",
    title: "三個關鍵字",
    body: "嘲諷＝敵方有嘲諷隨從時必須先打它；潛行＝不能被指定攻擊；★加成＝答對題目才會生效。",
  },
];

/** 引導步驟的簡易示意圖（純樣式方塊／線稿，無 emoji） */
function OnbArt({ k }: { k: string }) {
  if (k === "goal") {
    return (
      <div className="space-y-2">
        {[
          { name: "織者（你）", w: "100%", c: "bg-emerald-500" },
          { name: "山林試煉", w: "35%", c: "bg-rose-500" },
        ].map((r) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-[11px] text-slate-300">{r.name}</span>
            <span className="relative h-3 flex-1 rounded-full bg-slate-700 overflow-hidden">
              <span className={`absolute inset-y-0 left-0 ${r.c}`} style={{ width: r.w }} />
            </span>
          </div>
        ))}
        <p className="text-center text-[11px] text-rose-300/80">把對手血條清空 → 通過</p>
      </div>
    );
  }
  if (k === "quiz") {
    return (
      <div className="mx-auto max-w-[240px] space-y-1.5">
        <p className="text-center text-[11px] text-slate-400">「三」的太魯閣族語是？</p>
        {[
          { t: "tru", ok: true },
          { t: "spat", ok: false },
        ].map((o) => (
          <div
            key={o.t}
            className={`flex items-center justify-between rounded border px-3 py-1.5 text-sm ${
              o.ok ? "border-emerald-400 bg-emerald-900/30 text-emerald-200" : "border-slate-700 text-slate-400"
            }`}
          >
            <span>{o.t}</span>
            {o.ok && <span className="text-emerald-300">✓ ★加成</span>}
          </div>
        ))}
      </div>
    );
  }
  if (k === "mana") {
    return (
      <div className="flex items-center justify-center gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`h-4 w-4 rotate-45 rounded-[3px] ${i < 4 ? "bg-sky-400" : "bg-slate-700"}`}
          />
        ))}
        <span className="ml-2 text-[11px] text-sky-200">4 / 10</span>
      </div>
    );
  }
  if (k === "attack") {
    return (
      <div className="flex items-center justify-center gap-3">
        <span className="grid h-14 w-11 place-items-center rounded-md border-2 border-emerald-400 bg-emerald-900/30 text-[10px] text-emerald-200">
          我方
        </span>
        <span className="text-2xl text-amber-300">→</span>
        <span className="grid h-14 w-11 place-items-center rounded-md border-2 border-rose-400 bg-rose-900/30 text-[10px] text-rose-200">
          敵方
        </span>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {[
        { t: "嘲諷", c: "border-orange-400 text-orange-200" },
        { t: "潛行", c: "border-slate-400 text-slate-200" },
        { t: "★加成", c: "border-amber-400 text-amber-200" },
      ].map((c) => (
        <span key={c.t} className={`rounded-full border px-3 py-1 text-xs ${c.c}`}>
          {c.t}
        </span>
      ))}
    </div>
  );
}


// ───────────────────────── 圖示（比照 /journey ORDER-039：全面移除表情符號）─────────────────────────
// 一律用線稿 SVG 圖示，不用彩色 emoji 圖形字元。統一 24×24 viewBox、currentColor 描邊，
// 可用 text-* class 跟著文字變色。✓ ✕ ○ ★ ▶ ◀ 等純排版符號（非彩色 emoji）維持不變。
type IconProps = { className?: string };
function IconCheck({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}
function IconCross({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}
// THEME_ZH / CARD_ART / RARITY_GLOW / RARITY_ZH 已移至 src/data/cardArt.ts（與 /vs 共用），見檔頭 import。

// 寶石 StatGem/GemDefs 已移至 src/lib/statGem.tsx（與 /vs 共用），見檔頭 import。

// BOARD_BG / CARDBACK / HERO_ART 已移至 src/data/cardArt.ts（與 /vs 共用），見檔頭 import。


/** 點了自己場上不能選成攻擊者的隨從（誤觸）時，講清楚為什麼——不要悄悄沒反應。
 *  attacksUsed>0＝這回合已經打過；否則是剛登場、還沒解除召喚失調（沒有衝鋒/突襲）。 */
function attackBlockedReason(m: Minion): string {
  const name = m.card.nameZh;
  if (m.attack <= 0) return `「${name}」攻擊力 0，這隻沒辦法出擊。`;
  if ((m.attacksUsed ?? 0) > 0) return `「${name}」這回合已經攻擊過了，不能再選它出擊。`;
  return `「${name}」剛登場，還在適應（沒有衝鋒/突襲），這回合還不能出擊。`;
}

function playAudioUrl(url: string | null | undefined) {
  if (!url) return;
  try {
    const a = new Audio(url);
    a.play().catch(() => {});
  } catch {
    // 音檔失敗不阻斷流程
  }
}

// 攻擊指示箭頭：選定攻擊者後，從該隨從畫一條發光箭頭指向滑鼠，明確表示「正在選攻擊目標」。
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
        <marker id="atk-head" markerWidth="9" markerHeight="9" refX="5" refY="4.5" orient="auto">
          <path d="M0 0 L9 4.5 L0 9 L2.4 4.5 Z" fill="#fecaca" />
        </marker>
      </defs>
      <path
        d={`M ${sx} ${sy} Q ${midX} ${midY} ${end.x} ${end.y}`}
        fill="none"
        stroke="rgba(251, 113, 133, 0.92)"
        strokeWidth="5"
        strokeLinecap="round"
        markerEnd="url(#atk-head)"
      />
    </svg>
  );
}

// ───────────────────────── 元件 ─────────────────────────

export default function PlayPage() {
  const [mounted, setMounted] = useState(false);
  // 戰鬥事件播放器：擁有顯示盤面(game)、輸入鎖(locked)與所有動畫狀態
  const combat = useCombat();
  const {
    game,
    setGame,
    locked,
    play,
    resetFx,
    floatsFor,
    heroShake,
    windupKeys,
    lungeStyle,
    impactAnchors,
    shakeMinions,
    spellFx,
    ghosts,
    banner,
    castCard,
    manaPulse,
    drawPulse,
    registerEl,
  } = combat;
  const [quiz, setQuiz] = useState<QuizState | null>(null);
  const [revealed, setRevealed] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState<{ card: Card; isCorrect: boolean } | null>(null);
  // 卡片詳情：任何時候都可彈出放大看效果／加成／學習小註（不影響出牌）
  const [inspect, setInspect] = useState<Card | null>(null);
  // 規則說明：header 的「規則」可隨時開啟的詳細條列
  const [showRules, setShowRules] = useState(false);
  // 新手引導：第一次進來的互動分步教學（localStorage 記過就不再自動彈）
  const [onboarding, setOnboarding] = useState(false);
  const [onbStep, setOnbStep] = useState(0);
  // 電腦難度：預設普通，記憶上次選擇。切換即刻套用（影響下一個系統回合）。
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  // 對手（頭目）：決定敵方牌組主題。切換＝開新局。
  const [opponentId, setOpponentId] = useState("trial");
  const [showOpponents, setShowOpponents] = useState(false);
  const opponent = OPPONENTS.find((o) => o.id === opponentId) ?? OPPONENTS[0];
  // 耐玩循環：開局換牌、連勝計數、認輸確認
  const [mulliganPhase, setMulliganPhase] = useState(false);
  const [mulliganSel, setMulliganSel] = useState<Set<number>>(new Set());
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [confirmConcede, setConfirmConcede] = useState(false);

  useEffect(() => {
    // 刻意的客戶端 mount 初始化：newGame() 內含 Math.random()，須在 client 產生以避免 SSR/CSR hydration 不一致
    /* eslint-disable react-hooks/set-state-in-effect */
    setMounted(true);
    setGame(newGame());
    setMulliganPhase(true);
    try {
      if (!localStorage.getItem("enzo-play-onboarded")) setOnboarding(true);
      const d = localStorage.getItem("enzo-play-difficulty");
      if (d === "easy" || d === "normal" || d === "hard") setDifficulty(d);
      const best = Number(localStorage.getItem("enzo-play-best-streak"));
      if (Number.isFinite(best) && best > 0) setBestStreak(best);
      const opp = OPPONENTS.find((o) => o.id === localStorage.getItem("enzo-play-opponent"));
      if (opp) {
        setOpponentId(opp.id);
        if (opp.theme) setGame(newGame(opp.theme)); // 有偏向的對手重發一次牌
      }
    } catch {
      setOnboarding(true); // localStorage 不可用（隱私模式）時仍給第一次引導
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  function closeRules() {
    setShowRules(false);
  }

  function finishOnboarding() {
    setOnboarding(false);
    setOnbStep(0);
    try {
      localStorage.setItem("enzo-play-onboarded", "1");
    } catch {
      // 記不住就算了，不阻斷開始遊戲
    }
  }

  // 終局音效：勝利 / 落敗（中性 UI 完成音，非族樂）
  const winner = game.winner;
  useEffect(() => {
    if (!winner) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    if (winner === "player") {
      sfxArrive();
      setStreak((s) => {
        const next = s + 1;
        setBestStreak((b) => {
          const best = Math.max(b, next);
          try {
            localStorage.setItem("enzo-play-best-streak", String(best));
          } catch {
            /* 記不住就算了 */
          }
          return best;
        });
        return next;
      });
    } else if (winner === "enemy") {
      sfxLose();
      setStreak(0);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [winner]);

  // 認輸確認：3 秒未再點就取消「確定認輸？」狀態，避免卡在待確認
  useEffect(() => {
    if (!confirmConcede) return;
    const t = setTimeout(() => setConfirmConcede(false), 3000);
    return () => clearTimeout(t);
  }, [confirmConcede]);

  function reset() {
    resetFx();
    setQuiz(null);
    setRevealed(null);
    setSelected(null);
    setPending(null);
    setConfirmConcede(false);
    setMulliganSel(new Set());
    setGame(newGame(opponent.theme));
    setMulliganPhase(true);
  }

  // 選對手＝開新局（敵方牌組隨主題重建）。記憶選擇。
  function pickOpponent(id: string) {
    const opp = OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0];
    setOpponentId(id);
    try {
      localStorage.setItem("enzo-play-opponent", id);
    } catch {
      // 記不住就算了
    }
    setShowOpponents(false);
    setQuiz(null);
    setRevealed(null);
    setSelected(null);
    setPending(null);
    setConfirmConcede(false);
    setMulliganSel(new Set());
    resetFx();
    setGame(newGame(opp.theme));
    setMulliganPhase(true);
  }

  // 開局換牌：把選取的牌洗回牌庫、重抽等量，然後進入對戰
  function toggleMulligan(i: number) {
    setMulliganSel((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  function confirmMulligan() {
    const idx = [...mulliganSel];
    if (idx.length > 0) setGame((g) => mulligan(g, idx));
    setMulliganSel(new Set());
    setMulliganPhase(false);
  }

  // 認輸：直接判系統獲勝（會觸發連勝歸零）。二次點擊確認，避免誤觸。
  function concede() {
    if (game.winner) return;
    if (!confirmConcede) {
      setConfirmConcede(true);
      return;
    }
    setConfirmConcede(false);
    setQuiz(null);
    setPending(null);
    setSelected(null);
    setGame((g) => ({ ...g, winner: "enemy", phase: "over" }));
  }

  function changeDifficulty(d: Difficulty) {
    setDifficulty(d);
    try {
      localStorage.setItem("enzo-play-difficulty", d);
    } catch {
      // 記不住就算了
    }
  }

  function tryPlay(card: Card) {
    if (locked || game.phase !== "player" || game.winner || pending || quiz || mulliganPhase) return;
    if (card.cost > game.pMana) return;
    if (card.type === "minion" && game.pBoard.length >= BOARD_MAX) {
      setGame((g) => ({ ...g, log: pushLog(g.log, "戰場已滿（上限 7 個隨從）。", "info") }));
      return;
    }
    const kind = spellTargetKind(card);
    if (!hasValidTarget(game, kind)) {
      setGame((g) => ({ ...g, log: pushLog(g.log, `「${card.nameZh}」目前沒有合法目標。`, "info") }));
      return;
    }
    setSelected(null);
    setRevealed(null);
    setQuiz(difficulty === "hard" ? makeSentenceQuiz(card) : makeQuiz(card));
  }

  function answer(idx: number) {
    if (!quiz || revealed !== null) return;
    const isCorrect = idx === quiz.answerIdx;
    if (isCorrect) sfxCorrect();
    else sfxWrong();
    setRevealed(idx);
    // 揭曉後自動播一次正解發音（視聽同步），結算改由玩家自己按「繼續 ▶」
    // 句子題（quiz.audioUrl）沿用 /sentences 的例句音檔；單字題沿用卡片 vocabId 查詞庫發音。
    const audio = quiz.audioUrl ?? audioUrl(quiz.card.vocabId);
    setTimeout(() => playAudioUrl(audio), 400);
  }

  /** 「繼續 ▶」：關閉答題視窗並結算出牌（需要目標的法術先進入選目標模式） */
  function continueAfterQuiz() {
    if (!quiz || revealed === null) return;
    const isCorrect = revealed === quiz.answerIdx;
    const card = quiz.card;
    setQuiz(null);
    setRevealed(null);
    sfxPlayCard();
    const kind = spellTargetKind(card);
    if (card.type === "spell" && kind !== "none") {
      setPending({ card, isCorrect });
    } else {
      void play(playCardFlow(game, card, isCorrect));
    }
  }

  function castPendingAt(target: Target) {
    if (!pending) return;
    const { card, isCorrect } = pending;
    setPending(null);
    void play(playCardFlow(game, card, isCorrect, target));
  }

  /** 一張卡目前能不能出，以及不能出的原因（詳情視窗的「出牌」鈕與手牌標示共用邏輯） */
  function cardPlayInfo(card: Card): { playable: boolean; reason: string } {
    const canAct = game.phase === "player" && !game.winner && !pending && !quiz && !locked && !mulliganPhase;
    const affordable = card.cost <= game.pMana;
    const roomOrTarget =
      card.type === "minion" ? game.pBoard.length < BOARD_MAX : hasValidTarget(game, spellTargetKind(card));
    const playable = canAct && affordable && roomOrTarget;
    let reason = "";
    if (!playable) {
      if (!canAct) reason = game.phase !== "player" ? "非我方回合" : "現在不能出牌";
      else if (!affordable) reason = "法力不足";
      else if (card.type === "minion") reason = "戰場已滿";
      else reason = "無可指定目標";
    }
    return { playable, reason };
  }

  /** 詳情視窗按「出牌」：關掉詳情，走原本的出牌流程（進答題考驗） */
  function playFromInspect() {
    if (!inspect) return;
    const card = inspect;
    setInspect(null);
    tryPlay(card);
  }

  /** 反悔：答題前關掉考驗，卡片放回手牌（尚未消耗法力，等同沒出）。答題揭曉後不可反悔，避免偷看答案。 */
  function cancelQuiz() {
    if (!quiz || revealed !== null) return;
    setQuiz(null);
    setRevealed(null);
  }

  /** 反悔：法術已答題但還沒指定目標時，取消選目標，卡片放回手牌（尚未消耗法力）。 */
  function cancelPending() {
    if (!pending) return;
    setPending(null);
  }

  const pendingKind: TargetKind = pending ? spellTargetKind(pending.card) : "none";
  const atkLegal = attackTargets(game.eBoard);

  function onPlayerMinion(key: string) {
    if (locked || game.phase !== "player" || game.winner) return;
    if (pending) {
      if (pendingKind === "friendMinion" || pendingKind === "anyMinion") {
        castPendingAt({ kind: "minion", side: "player", key });
      }
      return;
    }
    const m = game.pBoard.find((x) => x.key === key);
    if (!m) return;
    if (!m.canAttack || m.attack <= 0) {
      // 點自己場上不能選成攻擊者的隨從（可能誤觸）：講清楚為什麼，不要悄悄沒反應。
      setGame((g) => ({ ...g, log: pushLog(g.log, attackBlockedReason(m), "info") }));
      return;
    }
    setSelected((s) => (s === key ? null : key));
  }

  function onEnemyMinion(key: string) {
    if (locked || game.phase !== "player" || game.winner) return;
    const m = game.eBoard.find((x) => x.key === key);
    if (!m) return;
    if (pending) {
      if ((pendingKind === "any" || pendingKind === "anyMinion" || pendingKind === "enemyMinion") && !m.stealth) {
        castPendingAt({ kind: "minion", side: "enemy", key });
      }
      return;
    }
    if (!selected || !atkLegal.keys.has(key)) return;
    sfxAttack();
    const steps = attackFlow(game, "player", selected, { kind: "minion", side: "enemy", key });
    setSelected(null);
    void play(steps);
  }

  function onEnemyHero() {
    if (locked || game.phase !== "player" || game.winner) return;
    if (pending) {
      if (pendingKind === "any") castPendingAt({ kind: "hero" });
      return;
    }
    if (!selected || !atkLegal.heroAllowed) return;
    sfxAttack();
    const steps = attackFlow(game, "player", selected, { kind: "hero" });
    setSelected(null);
    void play(steps);
  }

  function endTurn() {
    if (locked || game.phase !== "player" || game.winner || pending || quiz || mulliganPhase) return;
    setSelected(null);
    // 一次算好整條事件序列（結束回合 → 敵方回合 → 我方新回合），交給播放器依序播放。
    const endSteps = endTurnFlow(game);
    let all = endSteps;
    const afterEnd = endSteps.length ? endSteps[endSteps.length - 1].state : game;
    if (!afterEnd.winner) {
      const enemySteps = enemyTurnFlow(afterEnd, difficulty);
      all = all.concat(enemySteps);
      const afterEnemy = enemySteps.length ? enemySteps[enemySteps.length - 1].state : afterEnd;
      if (!afterEnemy.winner) all = all.concat(startTurnFlow(afterEnemy));
    }
    void play(all);
  }

  const total = game.correct + game.wrong;
  const rate = total === 0 ? 0 : Math.round((game.correct / total) * 100);

  // 浮動傷害/治療數字（事件驅動）
  const renderFloats = (anchor: string) =>
    floatsFor(anchor).map((f) => (
      <span key={f.id} className={`dmg-float ${f.kind === "heal" ? "dmg-float-heal" : ""}`} aria-hidden>
        {f.kind === "heal" ? "+" : "-"}
        {f.amount}
      </span>
    ));

  if (!mounted) return <main className="min-h-screen bg-slate-950" />;

  const enemyHeroTargetable =
    game.phase === "player" &&
    !game.winner &&
    ((pending !== null && pendingKind === "any") || (selected !== null && !pending && atkLegal.heroAllowed));

  const enemyMinionTargetable = (m: Minion): boolean => {
    if (game.phase !== "player" || game.winner !== null) return false;
    if (pending) {
      return (
        (pendingKind === "any" || pendingKind === "anyMinion" || pendingKind === "enemyMinion") && !m.stealth
      );
    }
    return selected !== null && atkLegal.keys.has(m.key);
  };

  const friendMinionTargetable = pending !== null && (pendingKind === "friendMinion" || pendingKind === "anyMinion");

  return (
    <main className="play-page min-h-screen text-slate-100 p-2 sm:p-4">
      <AmbientAudio />
      <BattleMusic />
      <GemDefs />

      {/* ── 戰鬥動畫覆蓋層（事件驅動）── */}
      {banner && (
        <div
          className={`combat-banner ${banner.side === "player" ? "combat-banner-player" : "combat-banner-enemy"}`}
          aria-hidden
        >
          {banner.text}
        </div>
      )}
      {castCard && (
        <div className="combat-cast" aria-hidden>
          {CARD_ART[castCard.cardId] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={CARD_ART[castCard.cardId]}
              alt=""
              className={castCard.isCorrect ? "ring-2 ring-amber-300 rounded-xl" : "rounded-xl"}
            />
          ) : (
            // 缺圖卡（法術等）：也要有「打出」動畫，用名稱＋效果文字撐起一張牌，不再無聲消失
            <div className={`combat-cast-fallback ${castCard.isCorrect ? "is-correct" : ""}`}>
              <span className="combat-cast-name">{CARD_BY_ID[castCard.cardId]?.nameZh ?? "出牌"}</span>
              {CARD_BY_ID[castCard.cardId]?.effectText &&
                CARD_BY_ID[castCard.cardId].effectText !== "—" && (
                  <span className="combat-cast-effect">{CARD_BY_ID[castCard.cardId].effectText}</span>
                )}
              {castCard.isCorrect && <span className="combat-cast-bonus">★ 答對加成</span>}
            </div>
          )}
        </div>
      )}
      {spellFx && <div className={`spell-veil spell-${spellFx.vfx}`} aria-hidden />}
      {selected && !pending && !quiz && !locked && !game.winner && <AttackArrow fromKey={selected} />}
      {ghosts.map((g) => (
        <div
          key={g.id}
          className="death-ghost"
          style={{ left: g.left, top: g.top, width: g.width, height: g.height }}
          aria-hidden
        >
          {CARD_ART[g.cardId] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={CARD_ART[g.cardId]} alt="" />
          )}
        </div>
      ))}
      <div className="play-shell mx-auto">
        {/* 標題列 */}
        <header className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-200">
                ◀ 模式選擇
              </Link>
              <span className="text-[10px] rounded-full bg-sky-500/80 text-black px-2 py-0.5">
                模式 B
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold">峽谷行者 · 山林試煉（vs 系統）</h1>
            <p className="text-[11px] text-slate-400">
              傳說牌組：出牌先答太魯閣族語題（真實詞庫，揭曉後自動播發音），答對觸發加成效果。
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div
              className="flex items-center rounded border border-slate-600/60 overflow-hidden"
              role="group"
              aria-label="難度（電腦強度＋答題）"
            >
              {([
                ["easy", "簡單", "電腦較弱．答題考單字"],
                ["normal", "普通", "電腦普通．答題考單字"],
                ["hard", "困難", "電腦較強．答題改考句子（更難）"],
              ] as [Difficulty, string, string][]).map(([d, label, hint]) => (
                <button
                  key={d}
                  onClick={() => changeDifficulty(d)}
                  aria-pressed={difficulty === d}
                  title={hint}
                  className={`px-2 py-1 transition ${
                    difficulty === d
                      ? "bg-sky-500 text-black font-semibold"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {difficulty === "hard" && (
              <span
                className="rounded border border-amber-400/50 bg-amber-950/40 px-2 py-1 text-amber-200"
                title="困難模式：答題改考句子（四選一），不再是單字"
              >
                困難：答題考句子
              </span>
            )}
            <button
              onClick={() => setShowOpponents(true)}
              title="更換對手（頭目）"
              className="rounded border border-sky-500/50 bg-sky-950/40 px-2 py-1 text-sky-200 hover:bg-sky-900/50"
            >
              對手：{opponent.id === "trial" ? "均衡" : opponent.name.split("· ")[1]} ▾
            </button>
            <button
              onClick={() => setShowRules(true)}
              className="rounded border border-amber-400/40 bg-amber-950/40 px-2 py-1 text-amber-200 hover:bg-amber-900/50"
            >
              規則
            </button>
            <span className="rounded bg-slate-800 px-2 py-1">回合 {game.turn}</span>
            <span className="rounded bg-sky-900/60 px-2 py-1">
              法力 {game.pMana}/{game.pMaxMana}
            </span>
            <span className="rounded bg-emerald-900/60 px-2 py-1">命中 {rate}%</span>
            {streak > 0 && (
              <span className="rounded bg-amber-900/60 px-2 py-1 text-amber-200" title={`最佳連勝 ${bestStreak}`}>
                連勝 {streak}
              </span>
            )}
            <button
              onClick={concede}
              disabled={!!game.winner || mulliganPhase}
              className={`rounded border px-2 py-1 transition disabled:opacity-40 ${
                confirmConcede
                  ? "border-rose-400 bg-rose-900/60 text-rose-100"
                  : "border-slate-600 bg-slate-800/70 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {confirmConcede ? "確定認輸？" : "認輸"}
            </button>
          </div>
        </header>

        <div
          className="hs-table relative overflow-hidden bg-cover bg-center"
          style={{ backgroundImage: `url(${BOARD_BG})` }}
          onClick={(e) => {
            // 已選定攻擊者，卻點在空白戰場（沒有落在任何隨從／英雄上）＝放棄這次攻擊。
            if (e.target === e.currentTarget && selected) setSelected(null);
          }}
        >
          <div className="hs-table-shade absolute inset-0" aria-hidden />

          <div className="hs-opponent-hand" aria-label={`敵方手牌 ${game.eHand.length} 張`}>
            {Array.from({ length: Math.min(game.eHand.length, 7) }).map((_, i, arr) => (
              <span
                key={i}
                className="hs-cardback-mini"
                style={{
                  transform: `translateX(${(i - (arr.length - 1) / 2) * 24}px) rotate(${(i - (arr.length - 1) / 2) * 5}deg)`,
                  zIndex: i,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CARDBACK} alt="" />
              </span>
            ))}
          </div>

          <div
            className={`hs-resource-strip hs-resource-enemy ${manaPulse === "enemy" ? "mana-pulse" : ""}`}
            aria-label={`敵方法力 ${game.eMaxMana}/10`}
          >
            <span className="hs-mana-label">敵方法力</span>
            <span className="hs-mana-text">{game.eMaxMana}/10</span>
            <span className="hs-crystals" aria-hidden>
              {Array.from({ length: 10 }).map((_, i) => (
                <span key={i} className={i < game.eMaxMana ? "hs-crystal is-filled" : "hs-crystal"} />
              ))}
            </span>
          </div>

          {/* 敵方牌組：縮小成小徽章，放在法力條下方的空白區 */}
          <div className="hs-deck-badge hs-deck-badge-enemy" aria-label={`敵方牌庫剩 ${game.eDeck.length} 張`}>
            <span className="hs-deck-badge-icon" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CARDBACK} alt="" />
            </span>
            <span>{game.eDeck.length}</span>
          </div>

          {/* 系統（敵方）英雄 */}
          <button
            ref={registerEl("heroEnemy")}
            onClick={onEnemyHero}
            disabled={!enemyHeroTargetable}
            className={`hs-portrait hs-portrait-enemy relative transition ${enemyHeroTargetable ? "hs-hero-targetable hs-attack-target" : ""} ${heroShake.enemy ? "hs-hero-shake" : ""} ${impactAnchors.has("heroEnemy") ? "hs-impact" : ""}`}
          >
            {renderFloats("heroEnemy")}
            <span className="hs-portrait-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_ART.enemy} alt="山林試煉頭像" />
            </span>
            <span className="hs-portrait-name">{opponent.name}</span>
            <span className="hs-portrait-sub">手牌 {game.eHand.length} · 牌庫 {game.eDeck.length}</span>
            <span className="hs-portrait-hp">
              <span className="hs-hp-label">生命 HP</span>
              <span className="hs-hp-bar-fill" aria-hidden style={{ width: `${Math.max(0, Math.min(100, Math.round((game.enemyHp / HERO_HP) * 100)))}%` }} />
              <span className="hs-hp-value">{game.enemyHp}/{HERO_HP}</span>
            </span>
          </button>

          {(selected && !pending && atkLegal.mustTaunt) || pending ? (
            <div className="hs-target-callout">
              {selected && !pending && atkLegal.mustTaunt && "敵方有嘲諷隨從，必須先攻擊嘲諷者。"}
              {pending && (
                <span className="inline-flex flex-wrap items-center justify-center gap-2">
                  <span>
                    選擇「{pending.card.nameZh}」的目標
                    {pendingKind === "any" && "（任一隨從或敵方英雄）"}
                    {pendingKind === "anyMinion" && "（任一隨從）"}
                    {pendingKind === "enemyMinion" && "（一個敵方隨從，潛行者不可指定）"}
                    {pendingKind === "friendMinion" && "（一個友方隨從）"}
                  </span>
                  <button
                    onClick={cancelPending}
                    className="shrink-0 rounded border border-slate-500 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-700"
                  >
                    ✕ 取消
                  </button>
                </span>
              )}
            </div>
          ) : null}

          <div className="hs-combat-lane relative">
        {/* 敵方戰場 */}
        <section>
          <div className="hs-board-row hs-board-row-enemy min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
            {game.eBoard.length === 0 && (
              <span className="hs-board-empty text-xs self-center px-2">山林試煉尚無隨從。</span>
            )}
            {game.eBoard.map((e) => {
              const targetable = enemyMinionTargetable(e);
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : ""].filter(Boolean).join("·");
              return (
                <button
                  key={e.key}
                  ref={registerEl(e.key)}
                  style={lungeStyle(e.key)}
                  onClick={() => onEnemyMinion(e.key)}
                  disabled={!targetable}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}`}
                  className={`hs-token hs-token-enter w-[72px] md:w-[84px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${shakeMinions.has(e.key) ? "hs-token-hit" : ""}
                    ${windupKeys.has(e.key) ? "hs-windup" : ""}
                    ${impactAnchors.has(e.key) ? "hs-impact" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${targetable ? "hs-attack-target" : ""}`}
                >
                  {renderFloats(e.key)}
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder" data-theme={e.card.theme}>
                        {THEME_ZH[e.card.theme]}
                      </span>
                    )}
                    <span className="hs-art-frame" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
                  </span>
                  <StatGem kind="atk" value={e.attack} size="sm" className="hs-gem-atk" />
                  <StatGem
                    kind="hp"
                    value={e.health}
                    size="sm"
                    tone={e.health < e.maxHealth ? "text-rose-200" : "text-white"}
                    className="hs-gem-hp"
                  />
                </button>
              );
            })}
          </div>
        </section>

        {/* 我方戰場 */}
        <section>
          <div className="hs-board-row hs-board-row-player min-h-20 px-2 pt-2 pb-4 flex flex-wrap justify-center gap-x-3 gap-y-4">
            {game.pBoard.length === 0 && (
              <span className="hs-board-empty text-xs self-center px-2">
                尚無隨從，從手牌打出吧。
              </span>
            )}
            {game.pBoard.map((e) => {
              const ready = e.canAttack && e.attack > 0 && game.phase === "player" && !game.winner && !pending;
              const zeroAttackHint = e.attack <= 0 ? "（攻擊力 0，無法出擊）" : "";
              const spellTarget = friendMinionTargetable;
              const art = CARD_ART[e.card.id];
              const kw = [e.taunt ? "嘲諷" : "", e.stealth ? "潛行" : "", e.bonus ? "加成" : ""]
                .filter(Boolean)
                .join("·");
              return (
                <button
                  key={e.key}
                  ref={registerEl(e.key)}
                  data-mkey={e.key}
                  style={lungeStyle(e.key)}
                  onClick={() => onPlayerMinion(e.key)}
                  title={`${e.card.nameZh}${kw ? `（${kw}）` : ""}${zeroAttackHint}`}
                  className={`hs-token hs-token-enter w-[72px] md:w-[84px] aspect-[4/5] border-2 ${RARITY_COLOR[e.card.rarity]}
                    ${e.taunt ? "hs-token-taunt" : ""}
                    ${shakeMinions.has(e.key) ? "hs-token-hit" : ""}
                    ${windupKeys.has(e.key) ? "hs-windup" : ""}
                    ${impactAnchors.has(e.key) ? "hs-impact" : ""}
                    ${e.stealth ? "opacity-60 blur-[0.5px] ring-1 ring-slate-400" : ""}
                    ${ready && selected !== e.key && !spellTarget ? "hs-ready-pulse" : ""}
                    ${selected === e.key ? "ring-2 ring-amber-400 -translate-y-1" : ""}
                    ${spellTarget ? "hs-spell-target" : ""}
                    ${ready && selected !== e.key ? "hs-can-attack" : ""}
                    ${ready || spellTarget ? "cursor-pointer hover:-translate-y-0.5" : e.stealth ? "" : "opacity-70"}`}
                >
                  {renderFloats(e.key)}
                  <span className="absolute inset-0 rounded-[8px] overflow-hidden">
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={e.card.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder" data-theme={e.card.theme}>
                        {THEME_ZH[e.card.theme]}
                      </span>
                    )}
                    <span className="hs-art-frame" aria-hidden />
                    <span className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/80 to-transparent" aria-hidden />
                  </span>
                  {e.bonus && (
                    <span className="absolute -top-1.5 -right-1.5 z-10 rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black shadow">
                      ★
                    </span>
                  )}
                  {ready && selected !== e.key && !spellTarget && (
                    <span className="hs-attack-badge" aria-hidden>可攻擊</span>
                  )}
                  <StatGem kind="atk" value={e.attack} size="sm" className="hs-gem-atk" />
                  <StatGem
                    kind="hp"
                    value={e.health}
                    size="sm"
                    tone={e.health < e.maxHealth ? "text-rose-200" : "text-white"}
                    className="hs-gem-hp"
                  />
                </button>
              );
            })}
          </div>
        </section>
          </div>

          <button
            onClick={endTurn}
            disabled={locked || game.phase !== "player" || !!game.winner || !!pending || !!quiz || mulliganPhase}
            className="hs-end-turn hs-end-turn-big disabled:opacity-40"
          >
            {locked ? "對戰進行中…" : game.phase === "enemy" ? "系統行動中" : "結束回合 ▶"}
          </button>

          <button
            onClick={reset}
            className="hs-reset hs-reset-small"
          >
            重新開始
          </button>

          {/* 我方英雄 + 資源 */}
          <section
            ref={registerEl("heroPlayer")}
            className={`hs-portrait hs-portrait-player relative ${heroShake.player ? "hs-hero-shake" : ""} ${impactAnchors.has("heroPlayer") ? "hs-impact" : ""}`}
          >
            {renderFloats("heroPlayer")}
            <span className="hs-portrait-art">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={HERO_ART.player} alt="織者頭像" />
            </span>
            <span className="hs-portrait-name">織者</span>
            <span className="hs-portrait-sub">答題命中 {rate}%</span>
            <span className="hs-portrait-hp">
              <span className="hs-hp-label">生命 HP</span>
              <span className="hs-hp-bar-fill" aria-hidden style={{ width: `${Math.max(0, Math.min(100, Math.round((game.playerHp / HERO_HP) * 100)))}%` }} />
              <span className="hs-hp-value">{game.playerHp}/{HERO_HP}</span>
            </span>
          </section>

          <div
            className={`hs-resource-strip hs-resource-player ${manaPulse === "player" ? "mana-pulse" : ""} ${drawPulse === "player" ? "draw-pulse" : ""}`}
            aria-label={`我方法力 ${game.pMana}/${game.pMaxMana}`}
          >
            <span className="hs-mana-text">{game.pMana}/{game.pMaxMana}</span>
            <span className="hs-crystals" aria-hidden>
              {Array.from({ length: Math.max(game.pMaxMana, 1) }).map((_, i) => (
                <span key={i} className={i < game.pMana ? "hs-crystal is-filled" : "hs-crystal is-empty"} />
              ))}
            </span>
          </div>

        {/* 手牌 */}
        <section className="hs-hand-zone">
          <h2 className="hs-hand-label text-[11px] uppercase tracking-wider text-amber-200/60 mb-1">
            手牌（牌庫剩 {game.pDeck.length}）
            {selected && !pending && (
              <span className="text-amber-300 ml-2">▶ 已選攻擊者，點敵方目標</span>
            )}
          </h2>
          <div className="hs-hand-rail">
            {game.pHand.length === 0 && (
              <span className="text-slate-600 text-xs">手牌已空，結束回合抽牌。</span>
            )}
            {game.pHand.map((c, i) => {
              const canAct =
                game.phase === "player" && !game.winner && !pending && !quiz && !locked && !mulliganPhase;
              const affordable = c.cost <= game.pMana;
              const roomOrTarget =
                c.type === "minion" ? game.pBoard.length < BOARD_MAX : hasValidTarget(game, spellTargetKind(c));
              const playable = canAct && affordable && roomOrTarget;
              // 為什麼不能出：只在「輪到你、閒置」時標示，敵方回合不干擾
              let reason = "";
              if (canAct && !playable) {
                if (!affordable) reason = "法力不足";
                else if (c.type === "minion") reason = "戰場已滿";
                else reason = "無可指定目標";
              }
              const art = CARD_ART[c.id];
              const learningText = CARD_LEARNING[c.id];
              return (
                // 輕點卡片＝彈出詳情看效果（再從詳情裡按「出牌」才真的打出）；不能出的卡也照樣能點開看
                <button
                  key={`${c.id}-${i}`}
                  onClick={() => setInspect(c)}
                  aria-label={`${c.nameZh}，輕點看效果與出牌`}
                  className={`hs-card hs-hand-card ${RARITY_GLOW[c.rarity]} w-[132px] md:w-[164px] xl:w-[178px] aspect-[5/7] shrink-0 text-left border-2 ${RARITY_COLOR[c.rarity]} cursor-pointer
                    ${playable ? "hs-card-playable" : reason ? "hs-card-blocked" : "opacity-60"}`}
                >
                  {reason && (
                    <span className="hs-card-reason" aria-hidden>
                      {reason}
                    </span>
                  )}
                  {/* 內容層：切圓角、蓋在稀有度外框內 */}
                  <span className="absolute inset-0 rounded-[12px] overflow-hidden flex flex-col">
                    {/* 畫窗（上 55%）：金內框裱起來的肖像；缺圖用大號題材線稿 */}
                    <span className="relative h-[55%] shrink-0 rounded-t-[12px] bg-gradient-to-b from-slate-800 to-slate-900">
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={art} alt={c.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <span className="hs-art-placeholder hs-art-placeholder-card" data-theme={c.theme}>
                          {THEME_ZH[c.theme]}
                        </span>
                      )}
                      <span className="hs-art-frame" aria-hidden />
                    </span>
                    {/* 文字欄：類型／稀有度、效果、答對加成 */}
                    <span className="flex-1 flex flex-col px-1.5 pt-3.5 pb-2 text-center">
                      <span className="flex items-center justify-center gap-1 text-[8px] tracking-[0.15em] text-amber-200/70">
                        {THEME_ZH[c.theme]} · {c.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[c.rarity]}
                      </span>
                      {c.effectText !== "—" && (
                        <span title={c.effectText} className="text-[9px] leading-tight text-slate-200 mt-0.5 line-clamp-1">
                          {c.effectText}
                        </span>
                      )}
                      <span title={c.bonusText} className="text-[9px] leading-tight text-amber-300/90 mt-0.5 line-clamp-1">
                        ★ {c.bonusText}
                      </span>
                      <span title={learningText} className="hs-card-learning line-clamp-2">
                        學｜{learningText}
                      </span>
                    </span>
                  </span>
                  {/* 名條：跨在畫窗與文字欄接縫上 */}
                  <span
                    title={c.nameZh}
                    className={`${notoSerifTC.className} hs-name-banner absolute left-0 right-0 top-[55%] -translate-y-1/2 z-[5] block px-1.5 py-0.5 text-center text-[11px] font-bold truncate`}
                  >
                    {c.nameZh}
                  </span>
                  {/* 法力水晶（藍寶石切面，實際費用） */}
                  <StatGem kind="cost" value={c.cost} className="hs-gem-cost" />
                  {/* 攻／血寶石（隨從）或類型小牌（法術） */}
                  {c.type === "minion" ? (
                    <>
                      <StatGem kind="atk" value={c.attack ?? 0} className="hs-gem-atk" />
                      <StatGem kind="hp" value={c.health ?? 0} className="hs-gem-hp" />
                    </>
                  ) : (
                    <span className="hs-spell-chip">法術</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* 紀錄 */}
          <aside className="play-log-panel">
            <h2 className="text-[11px] uppercase tracking-wider text-amber-200/60 mb-2">戰鬥紀錄</h2>
            <div className="space-y-1 text-xs">
            {game.log.map((l) => (
              <div
                key={l.key}
                className={
                  l.tone === "good"
                    ? "text-emerald-300"
                    : l.tone === "bad"
                      ? "text-rose-300"
                      : l.tone === "sys"
                        ? "text-orange-300"
                        : "text-slate-400"
                }
              >
                {l.text}
              </div>
            ))}
            </div>
          </aside>
        </div>
      </div>

      {/* 選擇對手（頭目）：不同牌組主題 = 不同手感；選擇即開新局 */}
      {showOpponents && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[65]">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-sky-400/25 p-5 sm:p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-sky-200/60">選擇對手</p>
                <h3 className={`${notoSerifTC.className} text-xl font-bold text-sky-100`}>山林試煉的不同面貌</h3>
              </div>
              <button
                onClick={() => setShowOpponents(false)}
                className="text-xs text-slate-500 hover:text-slate-300 underline"
              >
                取消
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4">
              每個對手偏重不同牌組，打起來手感各異。選擇會開始新的一局。難度（簡單／普通／困難）另外調整。
            </p>
            <div className="space-y-2">
              {OPPONENTS.map((o) => {
                const active = o.id === opponentId;
                return (
                  <button
                    key={o.id}
                    onClick={() => pickOpponent(o.id)}
                    className={`w-full text-left rounded-lg border px-4 py-3 transition ${
                      active ? "border-sky-400 bg-sky-950/50" : "border-slate-700 bg-slate-800/40 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-100">{o.name}</span>
                      {active && (
                        <span className="rounded-full bg-sky-500 px-2 py-0.5 text-[10px] text-black">目前</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{o.tagline}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 新手引導：第一次進來的互動分步教學 */}
      {onboarding && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[70]">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">
                新手引導 {onbStep + 1}/{ONB_STEPS.length}
              </p>
              <button onClick={finishOnboarding} className="text-xs text-slate-500 hover:text-slate-300 underline">
                略過
              </button>
            </div>

            <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100 mb-2`}>
              {ONB_STEPS[onbStep].title}
            </h3>

            <div className="rounded-xl bg-slate-950/60 border border-slate-700/60 p-4 mb-3 min-h-[92px] flex items-center justify-center">
              <OnbArt k={ONB_STEPS[onbStep].k} />
            </div>

            <p className="text-sm text-slate-200 leading-relaxed mb-4 min-h-[3.5rem]">
              {ONB_STEPS[onbStep].body}
            </p>

            <div className="flex items-center justify-center gap-1.5 mb-4">
              {ONB_STEPS.map((s, i) => (
                <span
                  key={s.k}
                  className={`h-1.5 rounded-full transition-all ${
                    i === onbStep ? "w-5 bg-amber-400" : "w-1.5 bg-slate-600"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setOnbStep((s) => Math.max(0, s - 1))}
                disabled={onbStep === 0}
                className="rounded px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-30"
              >
                ◀ 上一步
              </button>
              {onbStep < ONB_STEPS.length - 1 ? (
                <button
                  onClick={() => setOnbStep((s) => Math.min(ONB_STEPS.length - 1, s + 1))}
                  className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
                >
                  下一步 ▶
                </button>
              ) : (
                <button
                  onClick={finishOnboarding}
                  className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
                >
                  開始試煉 ▶
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 開局換牌（mulligan）：新局開始、引導/規則關閉後彈出 */}
      {mulliganPhase && !showRules && !onboarding && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">開局換牌</p>
            <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100 mb-1`}>調整起手牌</h3>
            <p className="text-xs text-slate-400 mb-4">
              點選想換掉的牌（洗回牌庫、重抽等量），或直接保留全部開始。只有這一次機會。
            </p>
            <div className="flex flex-wrap justify-center gap-3 mb-5">
              {game.pHand.map((c, i) => {
                const marked = mulliganSel.has(i);
                const art = CARD_ART[c.id];
                return (
                  <button
                    key={`${c.id}-${i}`}
                    onClick={() => toggleMulligan(i)}
                    className={`relative w-[88px] aspect-[5/7] rounded-lg overflow-hidden border-2 transition ${
                      marked ? "border-rose-400 opacity-70" : "border-amber-400/40 hover:border-amber-300 hover:-translate-y-0.5"
                    }`}
                  >
                    {art ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={art} alt={c.nameZh} className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="hs-art-placeholder" data-theme={c.theme}>{THEME_ZH[c.theme]}</span>
                    )}
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
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">
                難度：{DIFF_ZH[difficulty]}
                {difficulty === "hard" && <span className="text-amber-400">（答題考句子）</span>}
              </span>
              <div className="flex items-center gap-3">
                <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 underline">← 返回首頁</Link>
                <button
                  onClick={confirmMulligan}
                  className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
                >
                  {mulliganSel.size > 0 ? `換掉 ${mulliganSel.size} 張並開始 ▶` : "保留全部開始 ▶"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 開場規則說明（第一次自動彈，之後可從 header「規則」再開） */}
      {showRules && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-[60]">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 border border-amber-400/25 p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-amber-200/60">怎麼玩</p>
              <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100`}>
                山林試煉 · 規則說明
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                爐石式卡牌，但每張牌出手前要先答一題太魯閣族語 — 答對就更強。
              </p>
            </div>

            <ol className="space-y-3 text-sm text-slate-200">
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">1</span>
                <span>
                  <span className="font-semibold text-amber-100">目標</span>：把「山林試煉」的生命打到 0，你就通過。你和對手都從 {HERO_HP} 點生命開始。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">2</span>
                <span>
                  <span className="font-semibold text-amber-100">出牌先答族語題</span>：每打一張牌會跳出一題族語選擇。
                  <span className="text-emerald-300">答對 → 觸發卡片的 ★加成（更強）</span>；
                  <span className="text-rose-300">答錯 → 以基礎效果打出</span>（還是能出牌）。揭曉後會自動播正確發音。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">3</span>
                <span>
                  <span className="font-semibold text-amber-100">法力</span>：每回合法力上限 +1（最多 10）。牌左上角的藍寶石是費用，法力不夠不能打。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">4</span>
                <span>
                  <span className="font-semibold text-amber-100">隨從與攻擊</span>：隨從有攻擊／生命。
                  <span className="text-rose-300 font-semibold">當回合剛打出的隨從不能立刻攻擊，要等下一回合</span>（除非牌上有「衝鋒」）。
                  輪到你時，先點自己已可攻擊的隨從（<span className="text-emerald-300 font-semibold">會發綠光並標示「可攻擊」</span>），再點敵方隨從或英雄發動攻擊。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">5</span>
                <span>
                  <span className="font-semibold text-amber-100">關鍵字</span>：
                  <span className="text-slate-100">嘲諷</span>＝敵方有嘲諷隨從時必須先打它；
                  <span className="text-slate-100">潛行</span>＝不能被指定攻擊；
                  <span className="text-amber-300">★加成</span>＝答對題目才會生效。
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-amber-500/90 text-black text-xs font-bold grid place-items-center">6</span>
                <span>
                  <span className="font-semibold text-amber-100">回合</span>：出完牌點「結束回合」，換系統行動、再抽一張牌換你。戰場最多 {BOARD_MAX} 個隨從。
                </span>
              </li>
            </ol>

            <div className="flex justify-end mt-5">
              <button
                onClick={closeRules}
                className="rounded bg-amber-500 hover:bg-amber-400 px-5 py-2 text-sm font-bold text-black"
              >
                開始試煉 ▶
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 答題考驗：戰場流程的一部分（半透明背板保留戰場、琥珀框；非跳出式視窗） */}
      {/* 卡片詳情：放大看效果／答對加成／學習小註（輕點手牌開啟，可直接出牌或關閉） */}
      {inspect && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60]"
          onClick={() => setInspect(null)}
        >
          <div
            className={`w-full max-w-sm rounded-2xl bg-slate-900 border-2 ${RARITY_COLOR[inspect.rarity]} ${RARITY_GLOW[inspect.rarity]} p-5 shadow-[0_0_60px_rgba(0,0,0,0.6)]`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className={`${notoSerifTC.className} text-xl font-bold text-amber-100`}>{inspect.nameZh}</h3>
                <p className="text-[11px] tracking-[0.15em] text-amber-200/70">
                  {THEME_ZH[inspect.theme]} · {inspect.type === "minion" ? "隨從" : "法術"} · {RARITY_ZH[inspect.rarity]}
                </p>
              </div>
              <button
                onClick={() => setInspect(null)}
                aria-label="關閉卡片詳情"
                className="shrink-0 rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100"
              >
                ✕ 關閉
              </button>
            </div>
            {CARD_ART[inspect.id] && (
              <div className="relative rounded-xl overflow-hidden mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CARD_ART[inspect.id]} alt={inspect.nameZh} className="w-full h-44 object-cover" />
                <span className="hs-art-frame" aria-hidden />
              </div>
            )}
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded bg-sky-950/60 border border-sky-500/40 px-2 py-1 text-sky-200">法力 {inspect.cost}</span>
              {inspect.type === "minion" && (
                <>
                  <span className="rounded bg-amber-950/60 border border-amber-500/40 px-2 py-1 text-amber-200">攻擊 {inspect.attack ?? 0}</span>
                  <span className="rounded bg-rose-950/60 border border-rose-500/40 px-2 py-1 text-rose-200">生命 {inspect.health ?? 0}</span>
                </>
              )}
            </div>
            {inspect.effectText !== "—" && (
              <p className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm leading-relaxed text-slate-100 mb-2">
                <span className="font-semibold text-slate-300">效果：</span>{inspect.effectText}
              </p>
            )}
            <p className="rounded-lg border border-amber-500/30 bg-amber-950/25 px-3 py-2 text-sm leading-relaxed text-amber-100/90 mb-2">
              <span className="font-semibold text-amber-200">★ 答對加成：</span>{inspect.bonusText}
            </p>
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-xs leading-relaxed text-emerald-100/90">
              <span className="font-semibold text-emerald-200">學習小註：</span>{CARD_LEARNING[inspect.id]}
            </p>
            {(() => {
              const info = cardPlayInfo(inspect);
              return (
                <div className="mt-4 flex items-center justify-end gap-3">
                  {!info.playable && info.reason && (
                    <span className="text-xs text-slate-400">{info.reason}</span>
                  )}
                  <button
                    onClick={() => setInspect(null)}
                    className="rounded px-4 py-2 text-sm text-slate-300 hover:text-slate-100"
                  >
                    關閉
                  </button>
                  <button
                    onClick={playFromInspect}
                    disabled={!info.playable}
                    className={`rounded px-5 py-2 text-sm font-semibold ${
                      info.playable
                        ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                        : "bg-slate-800 text-slate-500 cursor-not-allowed"
                    }`}
                  >
                    出牌 ▶
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {quiz && (
        <div className="combat-quiz-scrim fixed inset-0 bg-black/45 backdrop-blur-[3px] flex items-center justify-center p-4 z-50">
          <div className="combat-quiz-panel w-full max-w-md rounded-2xl bg-slate-900/95 border border-amber-400/30 p-5 shadow-[0_0_60px_rgba(0,0,0,0.6)]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-amber-200/70">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-hidden />
                出牌考驗 · 答對觸發加成{quiz.kind === "sentence" ? "（困難 · 句子題）" : ""}
              </div>
              {revealed === null && (
                <button
                  onClick={cancelQuiz}
                  className="shrink-0 rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                >
                  ✕ 取消（放回手牌）
                </button>
              )}
            </div>
            {CARD_ART[quiz.card.id] && (
              <div className="relative rounded-xl overflow-hidden mb-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={CARD_ART[quiz.card.id]}
                  alt={quiz.card.nameZh}
                  className="w-full h-40 object-cover"
                />
                {/* 與手牌畫窗同款的金內框（收藏卡裱框感） */}
                <span className="hs-art-frame" aria-hidden />
              </div>
            )}
            <div className="text-xs text-slate-400 mb-1">
              打出「{quiz.card.nameZh}」— 答對觸發加成「{quiz.card.bonusText}」
            </div>
            <p className="rounded-lg border border-amber-400/25 bg-amber-950/20 px-3 py-2 text-xs leading-relaxed text-amber-100/90 mb-3">
              <span className="font-semibold text-amber-200">卡片學習小註：</span>
              {CARD_LEARNING[quiz.card.id]}
            </p>
            <h3 className="text-lg font-bold mb-4">{quiz.prompt}</h3>
            <div className="grid gap-2">
              {quiz.options.map((opt, idx) => {
                let cls = "bg-slate-800 hover:bg-slate-700";
                if (revealed !== null) {
                  if (idx === quiz.answerIdx) cls = "bg-emerald-700";
                  else if (idx === revealed) cls = "bg-rose-700";
                  else cls = "bg-slate-800 opacity-60";
                }
                return (
                  <button
                    key={idx}
                    disabled={revealed !== null}
                    onClick={() => answer(idx)}
                    className={`rounded-lg px-4 py-2 text-left ${cls}`}
                  >
                    {String.fromCharCode(65 + idx)}. {opt}
                  </button>
                );
              })}
            </div>
            {revealed !== null && (
              <div className="mt-3">
                <p className="text-xs text-slate-300 flex items-start gap-1">
                  {revealed === quiz.answerIdx ? (
                    <IconCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                  ) : (
                    <IconCross className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
                  )}
                  <span>
                    {revealed === quiz.answerIdx ? "答對！觸發加成效果。" : "答錯，以基礎效果打出。"}
                    「{quiz.chinese}」= {quiz.word}
                  </span>
                </p>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={continueAfterQuiz}
                    className="rounded bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-sm font-medium"
                  >
                    繼續 ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 勝敗彈窗（等動畫播完再彈） */}
      {game.winner && !locked && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-6 text-center">
            <div className="flex justify-center mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={game.winner === "player" ? HERO_ART.player : HERO_ART.enemy}
                alt={game.winner === "player" ? "通過山林試煉" : "山林試煉未過"}
                className="w-16 h-16 rounded-full object-cover border border-amber-300/50 shadow-lg"
              />
            </div>
            <h3
              className={`hs-result-title text-2xl font-bold mb-1 ${
                game.winner === "player" ? "text-amber-300" : "text-slate-300"
              }`}
            >
              {game.winner === "player" ? `通過${opponent.name}！` : `${opponent.name}未過`}
            </h3>
            <p className="text-sm text-slate-400 mb-3">
              命中率 {rate}%（答對 {game.correct} · 答錯 {game.wrong}）
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs mb-4">
              <span className="rounded bg-slate-800 px-2 py-1 text-slate-300">難度 {DIFF_ZH[difficulty]}</span>
              {game.winner === "player" && streak > 0 && (
                <span className="rounded bg-amber-900/60 px-2 py-1 text-amber-200">連勝 {streak}</span>
              )}
              {bestStreak > 0 && (
                <span className="rounded bg-slate-800 px-2 py-1 text-slate-400">最佳連勝 {bestStreak}</span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={reset}
                className="rounded bg-sky-600 hover:bg-sky-500 px-5 py-2 font-medium"
              >
                再挑戰一次
              </button>
              <Link href="/" className="text-xs text-slate-400 hover:text-slate-200 underline">返回首頁</Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
