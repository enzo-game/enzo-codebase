"use client";

// 戰鬥事件播放器（ORDER-070）：擁有「顯示用盤面」與所有動畫狀態，
// 逐一播放引擎產出的 EventStep[]，播放期間鎖定輸入（locked）。
// 邏輯（結果）由 engine 決定，這裡只負責「依事件序列播放動畫並套用快照」。
import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { newGame, type CombatEvent, type EventStep, type Game, type Side, type SpellVfx } from "@/engine";
import { sfxSummon, sfxHit } from "@/lib/sfx";

type Anchor = string;
export type FloatFx = { id: number; anchor: Anchor; kind: "dmg" | "heal"; amount: number };
export type Ghost = { id: number; cardId: string; left: number; top: number; width: number; height: number };
export type Banner = { text: string; side: Side } | null;
export type SpellFxState = { id: number; vfx: SpellVfx; anchors: Anchor[] } | null;

const D = {
  cardPlay: 320,
  summon: 230,
  spell: 440,
  windup: 150,
  lunge: 190,
  impact: 120,
  damage: 200,
  heal: 200,
  death: 500,
  draw: 240,
  mana: 220,
  turnStart: 560,
  turnEnd: 260,
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useCombat(makeInitial: () => Game = newGame) {
  const [game, setGame] = useState<Game>(makeInitial);
  const [locked, setLocked] = useState(false);

  const [floats, setFloats] = useState<FloatFx[]>([]);
  const [heroShake, setHeroShake] = useState({ player: false, enemy: false });
  const [windupKeys, setWindupKeys] = useState<Set<string>>(new Set());
  const [lunge, setLunge] = useState<Record<string, string>>({});
  const [impactAnchors, setImpactAnchors] = useState<Set<string>>(new Set());
  const [shakeMinions, setShakeMinions] = useState<Set<string>>(new Set());
  const [spellFx, setSpellFx] = useState<SpellFxState>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [banner, setBanner] = useState<Banner>(null);
  const [castCard, setCastCard] = useState<{ cardId: string; side: Side; isCorrect: boolean } | null>(null);
  const [manaPulse, setManaPulse] = useState<Side | null>(null);
  const [drawPulse, setDrawPulse] = useState<Side | null>(null);

  const idc = useRef(0);
  const nextId = () => ++idc.current;
  const elsRef = useRef<Map<string, HTMLElement>>(new Map());
  const rectsRef = useRef<Map<string, DOMRect>>(new Map());
  const minionCardRef = useRef<Map<string, string>>(new Map());
  const reduce = useRef(false);

  useEffect(() => {
    reduce.current = prefersReducedMotion();
  }, []);

  // 記住每個隨從的 cardId（供死亡殘影取圖）；只增不刪，死亡後仍查得到。
  useEffect(() => {
    for (const m of [...game.pBoard, ...game.eBoard]) minionCardRef.current.set(m.key, m.card.id);
  }, [game]);

  const registerEl = useCallback((anchor: string) => {
    return (el: HTMLElement | null) => {
      if (el) elsRef.current.set(anchor, el);
      else elsRef.current.delete(anchor);
    };
  }, []);

  const snapshotRects = () => {
    for (const [anchor, el] of elsRef.current) rectsRef.current.set(anchor, el.getBoundingClientRect());
  };

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, reduce.current ? Math.min(ms, 24) : ms));

  const spawnFloat = (anchor: Anchor, kind: "dmg" | "heal", amount: number) => {
    const id = nextId();
    setFloats((f) => [...f, { id, anchor, kind, amount }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== id)), 850);
  };

  const shakeAnchor = (anchor: Anchor) => {
    if (anchor === "heroPlayer") {
      setHeroShake((s) => ({ ...s, player: true }));
      setTimeout(() => setHeroShake((s) => ({ ...s, player: false })), 420);
    } else if (anchor === "heroEnemy") {
      setHeroShake((s) => ({ ...s, enemy: true }));
      setTimeout(() => setHeroShake((s) => ({ ...s, enemy: false })), 420);
    } else {
      setShakeMinions((s) => new Set(s).add(anchor));
      setTimeout(
        () =>
          setShakeMinions((s) => {
            const n = new Set(s);
            n.delete(anchor);
            return n;
          }),
        360,
      );
    }
  };

  const spawnGhost = (key: string) => {
    if (reduce.current) return;
    const rect = rectsRef.current.get(key);
    const cardId = minionCardRef.current.get(key);
    if (!rect || !cardId) return;
    const id = nextId();
    setGhosts((g) => [
      ...g,
      { id, cardId, left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    ]);
    setTimeout(() => setGhosts((g) => g.filter((x) => x.id !== id)), 560);
  };

  const computeLunge = (key: string, targetAnchor: Anchor): string => {
    snapshotRects();
    const a = rectsRef.current.get(key);
    const b = rectsRef.current.get(targetAnchor);
    if (!a || !b) return "translateY(-8px) scale(1.06)";
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    return `translate(${(dx * 0.62).toFixed(0)}px, ${(dy * 0.62).toFixed(0)}px) scale(1.1)`;
  };

  async function runEvent(ev: CombatEvent, state: Game) {
    switch (ev.t) {
      case "CARD_PLAY":
        setCastCard({ cardId: ev.cardId, side: ev.side, isCorrect: ev.isCorrect });
        setGame(state);
        await wait(D.cardPlay);
        setCastCard(null);
        break;
      case "SUMMON":
        setGame(state);
        sfxSummon();
        await wait(D.summon);
        break;
      case "SPELL":
        setGame(state);
        setSpellFx({ id: nextId(), vfx: ev.vfx, anchors: ev.anchors });
        await wait(D.spell);
        setSpellFx(null);
        break;
      case "ATTACK_WINDUP":
        setWindupKeys((s) => new Set(s).add(ev.key));
        await wait(D.windup);
        break;
      case "ATTACK_LUNGE":
        if (!reduce.current) setLunge((l) => ({ ...l, [ev.key]: computeLunge(ev.key, ev.target) }));
        await wait(D.lunge);
        break;
      case "IMPACT":
        snapshotRects(); // 在移除死亡隨從前先抓位置，供死亡殘影定位
        setGame(state);
        setWindupKeys(new Set());
        setLunge({});
        setImpactAnchors((s) => new Set(s).add(ev.anchor));
        sfxHit();
        await wait(D.impact);
        setImpactAnchors((s) => {
          const n = new Set(s);
          n.delete(ev.anchor);
          return n;
        });
        break;
      case "DAMAGE":
        spawnFloat(ev.anchor, "dmg", ev.amount);
        shakeAnchor(ev.anchor);
        await wait(D.damage);
        break;
      case "HEAL":
        spawnFloat(ev.anchor, "heal", ev.amount);
        await wait(D.heal);
        break;
      case "DEATH":
        spawnGhost(ev.key);
        await wait(D.death);
        break;
      case "DRAW":
        setGame(state);
        setDrawPulse(ev.side);
        await wait(D.draw);
        setDrawPulse(null);
        break;
      case "MANA_REFRESH":
        setGame(state);
        setManaPulse(ev.side);
        await wait(D.mana);
        setManaPulse(null);
        break;
      case "TURN_START":
        setGame(state);
        setBanner({ text: ev.side === "player" ? "你的回合" : "敵方回合", side: ev.side });
        await wait(D.turnStart);
        setBanner(null);
        break;
      case "TURN_END":
        setGame(state);
        await wait(D.turnEnd);
        break;
    }
  }

  const playingRef = useRef(false);

  const play = useCallback(async (steps: EventStep[]): Promise<void> => {
    if (steps.length === 0 || playingRef.current) return;
    playingRef.current = true;
    setLocked(true);
    for (const step of steps) {
      // eslint-disable-next-line no-await-in-loop
      await runEvent(step.event, step.state);
    }
    setLocked(false);
    playingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetFx = useCallback(() => {
    setFloats([]);
    setHeroShake({ player: false, enemy: false });
    setWindupKeys(new Set());
    setLunge({});
    setImpactAnchors(new Set());
    setShakeMinions(new Set());
    setSpellFx(null);
    setGhosts([]);
    setBanner(null);
    setCastCard(null);
    setManaPulse(null);
    setDrawPulse(null);
    elsRef.current.clear();
    rectsRef.current.clear();
    minionCardRef.current.clear();
  }, []);

  const floatsFor = (anchor: string) => floats.filter((f) => f.anchor === anchor);
  const lungeStyle = (key: string): CSSProperties | undefined =>
    lunge[key] ? { transform: lunge[key], zIndex: 40 } : undefined;

  return {
    game,
    setGame,
    locked,
    play,
    resetFx,
    // fx getters
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
  };
}
