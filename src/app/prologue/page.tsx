"use client";

import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import AmbientAudio from "@/components/AmbientAudio";

/*
 * 峽谷行者 · 序幕（/prologue）
 * ─────────────────────────────────────────────
 * 電影式滾動敘事，帶玩家進入「模式 A 山徑」的動機與世界。
 *
 * 文化守門（Themis）：本序幕為**中性情境敘事**（風雨斷路 → 帶隊修復山徑 → 平安返家），
 * 對應遊戲既有機制（糧/木/石/繩、體力、壓力、落石/斷橋/補給/部落節點）。
 * **不虛構太魯閣族神話／祖靈／傳說／祭儀**，不自造族語。
 * 若日後要放具文化根據的正統敘事，須真人族人／族語老師提供並複核。
 */

type Chapter = {
  bg: string;
  kicker?: string;
  lines: ReactNode[];
  dim?: string; // overlay 濃度
};

const CHAPTERS: Chapter[] = [
  {
    bg: "/images/home/home-bg-night-mountains-v1.jpg",
    lines: [
      <span key="1" className="block text-3xl sm:text-5xl font-bold leading-tight">
        風雨過後，山徑斷了。
      </span>,
      <span key="2" className="mt-4 block text-base sm:text-xl text-slate-300/90">
        一條回家的路，要靠你一段一段接回來。
      </span>,
    ],
    dim: "bg-slate-950/70",
  },
  {
    bg: "/images/journey/scene/scene-rockfall-v1.png",
    kicker: "壹 · 斷路",
    lines: [
      <span key="1" className="block text-2xl sm:text-4xl font-semibold leading-snug">
        溪水暴漲的那一夜，
        <br />
        通往部落的路，碎成了好幾段。
      </span>,
      <span key="2" className="mt-4 block text-base sm:text-lg text-slate-300/90">
        落石封住峽口，吊橋垮了一半，霧壓在稜線上。
      </span>,
    ],
    dim: "bg-slate-950/72",
  },
  {
    bg: "/images/home/home-mode-a-forest-path-v1.jpg",
    kicker: "貳 · 啟程",
    lines: [
      <span key="1" className="block text-2xl sm:text-4xl font-semibold leading-snug">
        你不能等。
        <br />
        隊伍在山的這頭，家在另一頭。
      </span>,
      <span key="2" className="mt-4 block text-base sm:text-lg text-slate-300/90">
        揹上能帶的——糧食、木、石、繩，一步一步往前。
      </span>,
    ],
    dim: "bg-slate-950/68",
  },
  {
    bg: "/images/journey/scene/scene-bridge-v1.png",
    kicker: "參 · 修復",
    lines: [
      <span key="1" className="block text-2xl sm:text-4xl font-semibold leading-snug">
        一塊石頭墊穩腳下，
        <br />
        一根繩橫過斷崖，一段木搭起殘橋。
      </span>,
      <span key="2" className="mt-4 block text-base sm:text-lg text-slate-300/90">
        天色會變，體力會盡，壓力會累積——照顧好隊伍，才走得到最後。
      </span>,
    ],
    dim: "bg-slate-950/70",
  },
  {
    bg: "/images/journey/scene/scene-forest-v1.png",
    kicker: "肆 · 山的話語",
    lines: [
      <span key="1" className="block text-2xl sm:text-4xl font-semibold leading-snug">
        路上，你會遇見這片山的語言。
      </span>,
      <span key="2" className="mt-4 block text-base sm:text-lg text-slate-300/90">
        答對了，腳步更穩。學得越好，走得越遠。
      </span>,
    ],
    dim: "bg-slate-950/70",
  },
  {
    bg: "/images/journey/scene/scene-village-v1.png",
    kicker: "終",
    lines: [
      <span key="1" className="block text-3xl sm:text-5xl font-bold leading-tight">
        把每一個人，
        <br />
        平安帶回部落。
      </span>,
    ],
    dim: "bg-slate-950/55",
  },
];

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
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
    <div ref={ref} className="reveal" style={{ ["--reveal-delay" as string]: `${delay}s` }}>
      {children}
    </div>
  );
}

export default function ProloguePage() {
  return (
    <main className="relative bg-slate-950 text-slate-100">
      <AmbientAudio />

      {/* 略過序幕 */}
      <Link
        href="/journey"
        className="fixed right-4 top-4 z-50 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:bg-slate-800 hover:text-white"
      >
        略過序幕 ▸
      </Link>

      <div className="h-screen snap-y snap-mandatory overflow-y-scroll">
        {CHAPTERS.map((ch, i) => (
          <section
            key={i}
            className="relative flex h-screen snap-start items-center justify-center overflow-hidden px-6"
          >
            {/* 底圖（緩慢推近）＋深色 overlay 保可讀 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ch.bg}
              alt=""
              aria-hidden
              className="ken-burns absolute inset-0 h-full w-full object-cover"
            />
            <div className={`absolute inset-0 ${ch.dim ?? "bg-slate-950/70"}`} />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80" />

            {/* 首屏加 logo */}
            <div className="relative z-10 mx-auto max-w-2xl text-center">
              {i === 0 && (
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
                  <div className="mb-4 inline-block rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90">
                    {ch.kicker}
                  </div>
                </Reveal>
              )}

              {ch.lines.map((ln, j) => (
                <Reveal key={j} delay={0.15 * (j + 1)}>
                  {ln}
                </Reveal>
              ))}

              {/* 終章 CTA */}
              {i === CHAPTERS.length - 1 && (
                <Reveal delay={0.4}>
                  <Link
                    href="/journey"
                    className="mt-10 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-8 py-3.5 text-base font-semibold text-emerald-50 shadow-lg transition hover:-translate-y-0.5 hover:bg-emerald-600 hover:shadow-2xl"
                  >
                    走上山徑
                    <span>▸</span>
                  </Link>
                </Reveal>
              )}

              {/* 首屏捲動提示 */}
              {i === 0 && (
                <div className="scroll-hint pointer-events-none absolute inset-x-0 -bottom-24 mx-auto text-2xl text-slate-300">
                  ↓
                </div>
              )}
            </div>
          </section>
        ))}

        {/* 文化誠實標註 */}
        <div className="bg-slate-950 px-6 py-6 text-center">
          <p className="mx-auto max-w-xl text-[11px] leading-relaxed text-slate-600">
            本序幕為遊戲情境敘事，不代表任何族群之神話、傳說或祭儀；族語與文化內容之正式版本，複核進行中。
          </p>
        </div>
      </div>
    </main>
  );
}
