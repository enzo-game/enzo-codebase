"use client";

import { useEffect, useRef, useState } from "react";

/*
 * 峽谷行者 環境配樂（程式即時合成）
 * ─────────────────────────────────────────────
 * 純 Web Audio 合成的「自然環境氛圍」：山風（低通噪音＋緩慢 LFO 掃頻）
 * ＋溪流（帶通高頻噪音）＋極輕的低頻襯底 drone。無音樂檔、無版權疑慮。
 *
 * 文化守門（Themis）：本配樂刻意「不使用任何旋律／人聲／五聲音階『原民風』套路」。
 * 真正的太魯閣族傳統歌謠、祭儀吟唱屬文化紅線，須真人族人授權，
 * 不得由程式或 AI 假造或冒充族樂。此處僅為抽象的自然環境音。
 *
 * 瀏覽器禁止未經使用者手勢自動播放 → 預設關閉，由右下角按鈕點擊開啟。
 */

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

// 線稿 SVG 圖示（無 emoji，ORDER-039）：喇叭開／喇叭靜音
function IconSpeakerOn() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16.3 8.7a5 5 0 010 6.6" />
      <path d="M19 6a9 9 0 010 12" />
    </svg>
  );
}
function IconSpeakerOff() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6h4l5 4V5L8 9H4z" />
      <path d="M16 9l5 6M21 9l-5 6" />
    </svg>
  );
}

export default function AmbientAudio() {
  const [on, setOn] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopRef = useRef<(() => void) | null>(null);

  // 卸載時停掉節點並關閉 AudioContext（button 本身 server/client 一致，無需 mount gate）
  useEffect(() => {
    return () => {
      stopRef.current?.();
      ctxRef.current?.close().catch(() => {});
    };
  }, []);

  function buildGraph(ctx: AudioContext, master: GainNode): () => void {
    const stops: Array<() => void> = [];

    // 4 秒粉紅噪音緩衝，循環播放
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.15;
    }

    // 山風：低通 + 緩慢 LFO 掃 cutoff（陣風感）
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const windLP = ctx.createBiquadFilter();
    windLP.type = "lowpass";
    windLP.frequency.value = 480;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 280;
    lfo.connect(lfoGain);
    lfoGain.connect(windLP.frequency);
    wind.connect(windLP);
    windLP.connect(windGain);
    windGain.connect(master);
    wind.start();
    lfo.start();
    stops.push(() => {
      wind.stop();
      lfo.stop();
    });

    // 溪流：帶通高頻噪音（低音量水聲）
    const stream = ctx.createBufferSource();
    stream.buffer = buf;
    stream.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 2200;
    bp.Q.value = 0.7;
    const streamGain = ctx.createGain();
    streamGain.gain.value = 0.1;
    stream.connect(bp);
    bp.connect(streamGain);
    streamGain.connect(master);
    stream.start();
    stops.push(() => stream.stop());

    // 低頻襯底 drone：微失諧正弦，極輕（襯托山谷空間感，非旋律）
    const droneLP = ctx.createBiquadFilter();
    droneLP.type = "lowpass";
    droneLP.frequency.value = 400;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.045;
    droneGain.connect(droneLP);
    droneLP.connect(master);
    [110, 110.4, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.value = i === 2 ? 0.4 : 1;
      o.connect(g);
      g.connect(droneGain);
      o.start();
      stops.push(() => o.stop());
    });

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
    master.gain.linearRampToValueAtTime(0.18, now + 1.5); // 緩入
    setOn(true);
  }

  function disable() {
    const ctx = ctxRef.current;
    const master = masterRef.current;
    if (ctx && master) {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(0, now + 0.6); // 緩出
    }
    setOn(false);
  }

  return (
    <button
      type="button"
      onClick={() => (on ? disable() : enable())}
      aria-label={on ? "關閉環境配樂" : "開啟環境配樂"}
      title={on ? "環境配樂：開（點擊靜音）" : "環境配樂：關（點擊播放）"}
      className="fixed bottom-4 right-4 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 bg-slate-900/80 text-lg shadow-lg backdrop-blur transition hover:bg-slate-800"
    >
      <span aria-hidden>{on ? <IconSpeakerOn /> : <IconSpeakerOff />}</span>
    </button>
  );
}
