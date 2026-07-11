"use client";

import { useEffect, useRef, useState } from "react";

/*
 * 峽谷行者 · 山林試煉 戰鬥配樂（程式即時合成）
 * ─────────────────────────────────────────────
 * 純 Web Audio 合成的「戰鬥背景 underscore」：緩慢演進的和弦襯底（pad）
 * ＋輕微空氣噪音層＋整體緩慢 tremolo，營造沉穩的對戰氛圍。無音樂檔、無版權疑慮。
 *
 * 文化守門（Themis）：本配樂刻意使用「一般遊戲配樂語彙」的西式功能和聲
 * （Am–F–C–G 三和弦循環），**不使用五聲音階「原民風」套路、不含人聲、
 * 不模仿任何太魯閣族歌謠／口簧琴／木琴／祭儀聲響**。真實族群樂音屬文化紅線，
 * 須真人族人授權，不得由程式或 AI 假造或冒充。此處僅為抽象的中性襯底。
 *
 * 瀏覽器禁止未經使用者手勢自動播放 → 預設關閉，由按鈕點擊開啟。
 */

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

// 中性四和弦循環（Am–F–C–G），每個和弦給 3 個聲部（根／三／五音，低中頻）。
const PROGRESSION: number[][] = [
  [110.0, 130.81, 164.81], // Am : A2 C3 E3
  [87.31, 110.0, 130.81], // F  : F2 A2 C3
  [130.81, 164.81, 196.0], // C  : C3 E3 G3
  [98.0, 123.47, 146.83], // G  : G2 B2 D3
];
const CHORD_SECONDS = 4;

function IconMusicOn() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </svg>
  );
}
function IconMusicOff() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l10-2v6" />
      <circle cx="6" cy="18" r="3" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

export default function BattleMusic() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      stopRef.current?.();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function buildGraph(ctx: AudioContext, master: GainNode): () => void {
    const stops: Array<() => void> = [];

    // 整體緩慢 tremolo（讓襯底會「呼吸」，非旋律）
    const trem = ctx.createGain();
    trem.gain.value = 1;
    trem.connect(master);
    const tremLfo = ctx.createOscillator();
    tremLfo.frequency.value = 0.08;
    const tremDepth = ctx.createGain();
    tremDepth.gain.value = 0.12;
    const tremBase = ctx.createConstantSource();
    tremBase.offset.value = 0.88;
    tremLfo.connect(tremDepth);
    tremDepth.connect(trem.gain);
    tremBase.connect(trem.gain);
    tremLfo.start();
    tremBase.start();
    stops.push(() => {
      tremLfo.stop();
      tremBase.stop();
    });

    // 和弦 pad：3 聲部，經 lowpass 柔化，隨進行平滑滑音換和弦
    const padLP = ctx.createBiquadFilter();
    padLP.type = "lowpass";
    padLP.frequency.value = 900;
    padLP.Q.value = 0.4;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.16;
    padLP.connect(padGain);
    padGain.connect(trem);

    const voices = PROGRESSION[0].map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? "triangle" : "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 1 : 0.7;
      o.connect(g);
      g.connect(padLP);
      o.start();
      stops.push(() => o.stop());
      return o;
    });

    // 高八度暖聲：極輕的一層，墊出空間感（非旋律）
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = PROGRESSION[0][0] * 2;
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.05;
    shimmer.connect(shimmerGain);
    shimmerGain.connect(padGain);
    shimmer.start();
    stops.push(() => shimmer.stop());

    // 空氣噪音層：帶通高頻噪音，極輕
    const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4;
    const air = ctx.createBufferSource();
    air.buffer = buf;
    air.loop = true;
    const airBp = ctx.createBiquadFilter();
    airBp.type = "bandpass";
    airBp.frequency.value = 3200;
    airBp.Q.value = 0.6;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.035;
    air.connect(airBp);
    airBp.connect(airGain);
    airGain.connect(trem);
    air.start();
    stops.push(() => air.stop());

    // 和弦進行：定時平滑換音（setTargetAtTime 滑音，避免爆音）
    let step = 0;
    const advance = () => {
      step = (step + 1) % PROGRESSION.length;
      const chord = PROGRESSION[step];
      const now = ctx.currentTime;
      voices.forEach((o, i) => o.frequency.setTargetAtTime(chord[i], now, 0.6));
      shimmer.frequency.setTargetAtTime(chord[0] * 2, now, 0.6);
    };
    const timer = setInterval(advance, CHORD_SECONDS * 1000);
    stops.push(() => clearInterval(timer));

    return () => {
      stops.forEach((s) => {
        try {
          s();
        } catch {
          /* 已停止的節點忽略 */
        }
      });
    };
  }

  async function enable() {
    let ctx = ctxRef.current;
    if (!ctx) {
      const AC = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      ctxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      masterRef.current = master;
    }
    if (ctx.state === "suspended") await ctx.resume();
    const master = masterRef.current;
    if (!master) return;
    if (!stopRef.current) stopRef.current = buildGraph(ctx, master);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.5, now + 2); // 緩入
    setOn(true);
  }

  function disable() {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.8);
    }
    setOn(false);
  }

  return (
    <button
      type="button"
      onClick={() => (on ? disable() : enable())}
      aria-label={on ? "關閉戰鬥配樂" : "開啟戰鬥配樂"}
      title={on ? "戰鬥配樂：開（點擊靜音）" : "戰鬥配樂：關（點擊播放）"}
      className="fixed bottom-4 left-[68px] sm:left-auto sm:right-[68px] z-50 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-slate-100 shadow-lg backdrop-blur transition hover:bg-slate-800"
    >
      <span aria-hidden>{on ? <IconMusicOn /> : <IconMusicOff />}</span>
    </button>
  );
}
