"use client";

import Link from "next/link";
import { Noto_Serif_TC, Noto_Sans_TC, Cinzel } from "next/font/google";
import { useEffect, useRef, type ReactNode } from "react";
import AmbientAudio from "@/components/AmbientAudio";

/*
 * 峽谷行者 · 序幕（/prologue）
 * ─────────────────────────────────────────────
 * 電影式滾動敘事，文字以淡入（fade in）進場，帶玩家進入「模式 A 山徑」的動機與世界。
 *
 * 敘事：融入 5 則**有出處**的太魯閣族傳說（Pusu Qhuni 石生起源／大洪水／射日／
 * 彩虹橋 Hakaw Utux 意象／巨人）。來源見 enzo-culture/references/truku-legends-sourced.md，
 * 司令 2026-07-09 核准。忠於文獻改編、標注出處；彩虹橋僅取「連結此世與祖先」之意象，
 * 不演出審判／獵首／紋面等神聖細節。族語專名待 Mnemosyne 對拼寫。
 *
 * 字體系統（僅本頁）：中文標題／內文／羅馬拼音分層，避免單一 font-family 造成跨平台
 * fallback 不一致。使用 next/font/google 於建置期自動 self-host（無執行期外部請求、無
 * CLS），非手動管理 woff2。
 */

const notoSerifTC = Noto_Serif_TC({
  weight: ["500", "700"],
  subsets: ["latin"],
  display: "swap",
});

const notoSansTC = Noto_Sans_TC({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
});

const cinzel = Cinzel({
  weight: ["400", "600"],
  subsets: ["latin"],
  display: "swap",
});

type Chapter = {
  bg: string;
  kicker?: string;
  title: string; // 淡入顯示（\n 換行）
  sub?: ReactNode; // 標題淡入後接著淡入；含羅馬拼音（如 Pusu Qhuni）時用 <Latin>
  dim?: string;
};

/** 羅馬拼音／族語專名獨立字體（Cinzel），避免與中文字混排時字重/字距不協調 */
function Latin({ children }: { children: ReactNode }) {
  return <span className={`${cinzel.className} tracking-wide`}>{children}</span>;
}

const CHAPTERS: Chapter[] = [
  {
    // Pusu Qhuni 石生起源
    bg: "/images/home/home-bg-night-mountains-v1.jpg",
    kicker: "序 · 根",
    title: "很久以前，\n祖先從半石半木的聖木裡誕生。",
    sub: (
      <>
        那聖木叫 <Latin>Pusu Qhuni</Latin>——我們的起點。
      </>
    ),
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

/** 進入視窗淡入上浮（logo / kicker / 標題 / 內文 / CTA 共用），delay 用來做錯開節奏 */
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

function ChapterSection({ ch, index, last }: { ch: Chapter; index: number; last: boolean }) {
  const titleLines = ch.title.split("\n");
  return (
    <section className="relative flex h-screen snap-start items-center justify-center overflow-hidden px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={ch.bg} alt="" aria-hidden className="ken-burns absolute inset-0 h-full w-full object-cover" />
      <div className={`absolute inset-0 ${ch.dim ?? "bg-slate-950/70"}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/60 via-transparent to-slate-950/80" />
      {/* 文字可讀性遮罩：置中文字欄後方極淡的霧狀暗化，不做成明顯黑框 */}
      <div
        className="pointer-events-none absolute inset-x-[4%] inset-y-[16%] blur-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(3,8,15,0.55) 0%, rgba(3,8,15,0.32) 38%, rgba(3,8,15,0.1) 68%, transparent 82%)",
        }}
        aria-hidden
      />

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
            <div
              className={`${notoSansTC.className} mb-5 inline-block rounded-full border border-amber-500/30 bg-amber-950/30 px-3 py-1 text-xs tracking-[0.3em] text-amber-300/90`}
            >
              {ch.kicker}
            </div>
          </Reveal>
        )}

        <Reveal delay={0.15}>
          <div
            className={`${notoSerifTC.className} font-bold leading-[1.35] tracking-wide [text-shadow:0_3px_10px_rgba(0,0,0,0.78),0_0_26px_rgba(217,181,108,0.16)] ${
              index === 0 || last ? "text-3xl sm:text-5xl" : "text-2xl sm:text-4xl"
            }`}
          >
            {titleLines.map((ln, i) => (
              <span key={i}>
                {ln}
                {i < titleLines.length - 1 && <br />}
              </span>
            ))}
          </div>
        </Reveal>

        {ch.sub && (
          <Reveal delay={0.3}>
            <p className={`${notoSansTC.className} mt-5 text-base leading-loose tracking-wide text-slate-300/90 sm:text-lg`}>
              {ch.sub}
            </p>
          </Reveal>
        )}

        {index === 0 && (
          <Reveal delay={0.42}>
            <p
              className={`${notoSansTC.className} mx-auto mt-3 max-w-md text-sm leading-loose tracking-wide text-slate-400/90 sm:text-base`}
            >
              你將成為新的峽谷行者，穿越山林與迷霧，找回失落的名字與記憶。
            </p>
          </Reveal>
        )}

        {index === 0 && (
          <Reveal delay={0.56}>
            <div className="mt-10 flex flex-col items-center gap-3">
              {/* 雙線邊框按鈕（中性直角/圓角雙框，非菱形——沿用 ORDER-018 中性外框原則） */}
              <button
                type="button"
                onClick={() => {
                  document.querySelectorAll("section")[1]?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`${notoSerifTC.className} group relative inline-flex items-center justify-center rounded border-2 border-amber-500/60 bg-gradient-to-b from-[#32251766] to-[#0f1218f0] px-10 py-4 text-lg font-bold tracking-[0.18em] text-amber-100 shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_26px_rgba(217,181,108,0.18)] transition hover:-translate-y-0.5 hover:border-amber-300/90 hover:shadow-[0_16px_42px_rgba(0,0,0,0.55),0_0_34px_rgba(217,181,108,0.28)]`}
              >
                <span className="pointer-events-none absolute inset-1 rounded border border-amber-500/25" aria-hidden />
                開始旅程
              </button>
              <button
                type="button"
                onClick={() => {
                  document.querySelectorAll("section")[1]?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`${notoSansTC.className} tracking-[0.12em] text-sm text-amber-200/80 transition hover:text-amber-100`}
              >
                繼續閱讀序章
              </button>
            </div>
          </Reveal>
        )}

        {last && (
          <Reveal delay={0.45}>
            {/* 與「開始旅程」同款雙線金框史詩感按鈕，維持序幕全程一致的視覺語彙 */}
            <Link
              href="/journey"
              className={`${notoSerifTC.className} group relative mt-10 inline-flex items-center justify-center gap-2 rounded border-2 border-emerald-400/60 bg-gradient-to-b from-[#123a2966] to-[#0f1218f0] px-10 py-4 text-lg font-bold tracking-[0.18em] text-emerald-100 shadow-[0_12px_32px_rgba(0,0,0,0.45),0_0_26px_rgba(52,211,153,0.18)] transition hover:-translate-y-0.5 hover:border-emerald-300/90 hover:shadow-[0_16px_42px_rgba(0,0,0,0.55),0_0_34px_rgba(52,211,153,0.28)]`}
            >
              <span className="pointer-events-none absolute inset-1 rounded border border-emerald-400/25" aria-hidden />
              走上山徑
              <span>▸</span>
            </Link>
          </Reveal>
        )}

        {index === 0 && <div className="scroll-hint mt-6 text-2xl text-slate-300">↓</div>}
      </div>
    </section>
  );
}

export default function ProloguePage() {
  return (
    <main className="relative bg-slate-950 text-slate-100">
      <AmbientAudio />

      {/* 氛圍特效層（scene-vfx）：微光粒子／山霧流動／祖靈光點。固定疊層，跨章節持續、效果極淡。 */}
      <div className="scene-vfx" aria-hidden>
        <div className="mist mist-1" />
        <div className="mist mist-2" />
        <div className="mist mist-3" />
        <div className="spirit-light spirit-1" />
        <div className="spirit-light spirit-2" />
        <div className="spirit-light spirit-3" />
      </div>

      <Link
        href="/journey"
        className={`${notoSansTC.className} fixed right-4 top-4 z-50 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1.5 text-xs text-slate-300 backdrop-blur transition hover:bg-slate-800 hover:text-white`}
      >
        略過序幕 ▸
      </Link>

      <div className="h-screen snap-y snap-mandatory overflow-y-scroll">
        {CHAPTERS.map((ch, i) => (
          <ChapterSection key={i} ch={ch} index={i} last={i === CHAPTERS.length - 1} />
        ))}

        <div className="bg-slate-950 px-6 py-6 text-center">
          <p className={`${notoSansTC.className} mx-auto max-w-xl text-[11px] leading-relaxed text-slate-600`}>
            傳說依據：原住民族委員會、臺灣原住民族事典、維基百科等公開文獻，忠於記載改編。
            彩虹橋僅取「連結此世與祖先」之意象。族語專名與文化用法複核進行中，歡迎族人指正。
          </p>
        </div>
      </div>
    </main>
  );
}
