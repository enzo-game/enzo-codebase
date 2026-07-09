"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import AmbientAudio from "@/components/AmbientAudio";

/*
 * 峽谷行者 · 序幕（/prologue）
 * ─────────────────────────────────────────────
 * 電影式滾動敘事，逐字打字進場，帶玩家進入「模式 A 山徑」的動機與世界。
 *
 * 敘事：融入 5 則**有出處**的太魯閣族傳說（Pusu Qhuni 石生起源／大洪水／射日／
 * 彩虹橋 Hakaw Utux 意象／巨人）。來源見 enzo-culture/references/truku-legends-sourced.md，
 * 司令 2026-07-09 核准。忠於文獻改編、標注出處；彩虹橋僅取「連結此世與祖先」之意象，
 * 不演出審判／獵首／紋面等神聖細節。族語專名待 Mnemosyne 對拼寫。
 */

type Chapter = {
  bg: string;
  kicker?: string;
  title: string; // 逐字打字（\n 換行）
  sub?: string; // 打字完後淡入
  dim?: string;
};

const CHAPTERS: Chapter[] = [
  {
    // Pusu Qhuni 石生起源
    bg: "/images/home/home-bg-night-mountains-v1.jpg",
    kicker: "序 · 根",
    title: "很久以前，\n祖先從半石半木的聖木裡誕生。",
    sub: "那聖木叫 Pusu Qhuni——我們的起點。",
    dim: "bg-slate-950/72",
  },
  {
    // 大洪水回聲
    bg: "/images/journey/scene/scene-rockfall-v1.png",
    kicker: "壹 · 斷路",
    title: "風雨像遠古那場大洪水，\n山河重整，路碎成好幾段。",
    sub: "落石封住峽口，吊橋垮了一半，霧壓在稜線上。",
    dim: "bg-slate-950/74",
  },
  {
    // 射日：世代接力遠征
    bg: "/images/home/home-mode-a-forest-path-v1.jpg",
    kicker: "貳 · 遠行",
    title: "祖先曾為了射下灼烤大地的太陽，\n世代接力，遠行不歸。",
    sub: "今天，換你帶著隊伍上路——把每一個人帶回家。",
    dim: "bg-slate-950/70",
  },
  {
    bg: "/images/journey/scene/scene-bridge-v1.png",
    kicker: "參 · 修復",
    title: "一塊石頭墊穩腳下，\n一根繩橫過斷崖，一段木搭起殘橋。",
    sub: "天色會變，體力會盡，壓力會累積——照顧好隊伍，才走得到最後。",
    dim: "bg-slate-950/72",
  },
  {
    bg: "/images/journey/scene/scene-forest-v1.png",
    kicker: "肆 · 山的話語",
    title: "路上，你會遇見這片山的語言。",
    sub: "答對了，腳步更穩。學得越好，走得越遠。",
    dim: "bg-slate-950/72",
  },
  {
    // 彩虹橋 Hakaw Utux（僅意象）
    bg: "/images/journey/scene/scene-village-v1.png",
    kicker: "終 · 彩虹橋",
    title: "抵達部落時，天邊一道彩虹橋，\n連著此世與祖先。",
    sub: "把每一個人，平安帶回部落。",
    dim: "bg-slate-950/55",
  },
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** 逐字打字：進入視窗才開始打；打完 onDone。\n 換行。 */
function Typewriter({
  text,
  speed = 55,
  className,
  onDone,
}: {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (prefersReducedMotion()) {
      // 減少動態：直接顯示全文（刻意的一次性初始化）
      /* eslint-disable react-hooks/set-state-in-effect */
      setShown(text);
      setDone(true);
      /* eslint-enable react-hooks/set-state-in-effect */
      doneRef.current?.();
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        let i = 0;
        const tick = () => {
          i += 1;
          setShown(text.slice(0, i));
          if (i >= text.length) {
            setDone(true);
            doneRef.current?.();
            return;
          }
          timer = setTimeout(tick, speed);
        };
        tick();
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [text, speed]);

  const lines = shown.split("\n");
  return (
    <div ref={ref} className={className} aria-label={text}>
      {lines.map((ln, i) => (
        <span key={i}>
          {ln}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
      {!done && (
        <span className="caret" aria-hidden>
          &nbsp;
        </span>
      )}
    </div>
  );
}

/** 進入視窗淡入上浮（kicker / sub / CTA / logo 用）。show=false 時先隱藏（等打字完） */
function Reveal({
  children,
  show = true,
  delay = 0,
}: {
  children: ReactNode;
  show?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className="reveal"
      style={{
        ["--reveal-delay" as string]: `${delay}s`,
        visibility: show ? undefined : "hidden",
      }}
    >
      {children}
    </div>
  );
}

function ChapterSection({ ch, index, last }: { ch: Chapter; index: number; last: boolean }) {
  const [titleDone, setTitleDone] = useState(false);
  return (
    <section className="relative flex h-screen snap-start items-center justify-center overflow-hidden px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ch.bg} alt="" aria-hidden className="ken-burns absolute inset-0 h-full w-full object-cover" />
      <div className={`absolute inset-0 ${ch.dim ?? "bg-slate-950/70"}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80" />

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        {index === 0 && (
          <Reveal>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/brand/logo-canyon-walker-v1.png"
              alt="峽谷行者 Canyon Walker"
              width={200}
              height={207}
              className="mx-auto mb-8 w-36 sm:w-44 h-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
            />
          </Reveal>
        )}

        {ch.kicker && (
          <Reveal>
            <div className="mb-5 inline-block rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90">
              {ch.kicker}
            </div>
          </Reveal>
        )}

        <Typewriter
          text={ch.title}
          className={`font-bold leading-snug ${
            index === 0 || last ? "text-3xl sm:text-5xl" : "text-2xl sm:text-4xl"
          }`}
          onDone={() => setTitleDone(true)}
        />

        {ch.sub && (
          <Reveal show={titleDone} delay={0.1}>
            <p className="mt-5 text-base sm:text-lg text-slate-300/90">{ch.sub}</p>
          </Reveal>
        )}

        {last && (
          <Reveal show={titleDone} delay={0.25}>
            <Link
              href="/journey"
              className="mt-10 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-8 py-3.5 text-base font-semibold text-emerald-50 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-2xl"
            >
              走上山徑
              <span>▸</span>
            </Link>
          </Reveal>
        )}

        {index === 0 && (
          <div className="scroll-hint pointer-events-none absolute inset-x-0 -bottom-24 mx-auto text-2xl text-slate-300">
            ↓
          </div>
        )}
      </div>
    </section>
  );
}

export default function ProloguePage() {
  return (
    <main className="relative bg-slate-950 text-slate-100">
      <AmbientAudio />

      <Link
        href="/journey"
        className="fixed right-4 top-4 z-50 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:bg-slate-800 hover:text-white"
      >
        略過序幕 ▸
      </Link>

      <div className="h-screen snap-y snap-mandatory overflow-y-scroll">
        {CHAPTERS.map((ch, i) => (
          <ChapterSection key={i} ch={ch} index={i} last={i === CHAPTERS.length - 1} />
        ))}

        <div className="bg-slate-950 px-6 py-6 text-center">
          <p className="mx-auto max-w-xl text-[11px] leading-relaxed text-slate-600">
            傳說依據：原住民族委員會、臺灣原住民族事典、維基百科等公開文獻，忠於記載改編。
            彩虹橋僅取「連結此世與祖先」之意象。族語專名與文化用法複核進行中，歡迎族人指正。
          </p>
        </div>
      </div>
    </main>
  );
}
