import Link from "next/link";

// 首頁／模式選擇（landing）——依設計目標稿「圖2」改版骨架。
// 註：本檔為「無敏感裝飾」的中性骨架。ORDER-016 生圖到位後，於各 {/* ORDER-016 */}
// 標記處換入插畫（/images/home/*）；織紋/菱形四角外框、織布徽、「祖靈/圖紋」呈現
// 屬文化避免清單，待 enzo-culture 複核核定替代設計後另補，這裡一律用中性 CSS。

type Accent = "emerald" | "sky";

const ACCENT: Record<
  Accent,
  { ring: string; hover: string; text: string; chip: string; bg: string; cta: string }
> = {
  emerald: {
    ring: "border-emerald-800/50",
    hover: "hover:border-emerald-500/80",
    text: "text-emerald-300",
    chip: "bg-lime-400/90 text-black",
    bg: "from-emerald-950/60 to-slate-950/40",
    cta: "bg-emerald-800/70 hover:bg-emerald-700 text-emerald-50",
  },
  sky: {
    ring: "border-sky-800/50",
    hover: "hover:border-sky-500/80",
    text: "text-sky-300",
    chip: "bg-sky-400/90 text-black",
    bg: "from-sky-950/60 to-slate-950/40",
    cta: "bg-sky-800/70 hover:bg-sky-700 text-sky-50",
  },
};

function ModeCard({
  href,
  emblem,
  chip,
  title,
  kicker,
  desc,
  cta,
  accent,
}: {
  href: string;
  emblem: string;
  chip: string;
  title: string;
  kicker: string;
  desc: string;
  cta: string;
  accent: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <Link
      href={href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border ${a.ring} ${a.hover} bg-gradient-to-b ${a.bg} p-6 transition-colors`}
    >
      {/* ORDER-016: 換入 home-mode-{a|b}-*-v1.png 作卡底（此處為中性漸層佔位） */}
      <span
        className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.chip}`}
      >
        {chip}
      </span>

      {/* ORDER-016: 換入 emblem-mode-{a|b}-*-v1.png（此處中性圓徽佔位） */}
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/5 text-3xl">
        {emblem}
      </div>

      <div className="text-2xl font-bold tracking-tight">{title}</div>
      <div className={`mt-1 text-xs ${a.text}`}>{kicker}</div>
      <p className="mt-3 text-sm leading-relaxed text-slate-300/90">{desc}</p>

      <span
        className={`mt-6 inline-flex w-fit items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${a.cta}`}
      >
        {cta}
        <span className="transition-transform group-hover:translate-x-0.5">▸</span>
      </span>
    </Link>
  );
}

function FeatureCard({
  emblem,
  title,
  desc,
}: {
  emblem: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-4">
      {/* ORDER-016: 換入 feature-*-v1.png（中性徽章佔位） */}
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xl">
        {emblem}
      </div>
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 背景層（中性）：深色漸層 + 底部暖光（營火感）。ORDER-016 生圖後換 home-bg-night-mountains-v1.png */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_bottom,_rgba(217,119,6,0.18),_transparent_70%)]" />

      {/* 中性外框（非織紋/菱形；ORDER-016 §4 織紋四角外框待文化複核） */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-14">
        {/* 品牌 */}
        <header className="text-center">
          <div className="text-5xl">🏹🌈</div>
          <h1 className="mt-2 font-serif text-6xl font-bold tracking-tight">Enzo</h1>
          {/* 中性分隔飾（非菱形）：線 · 圓點 · 線 */}
          <div className="mx-auto mt-4 flex items-center justify-center gap-3 text-slate-600">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
          <p className="mt-4 text-lg text-amber-100/90">
            原民 Truku 爐石式卡牌遊戲 · 族語教學
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm text-slate-400">
            出牌時答對太魯閣族語題目，即可觸發卡牌的族語加成。學得越好，打得越強。
          </p>
        </header>

        {/* 雙模式大卡 */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <ModeCard
            href="/journey"
            accent="emerald"
            emblem="⛰️"
            chip="友善可玩"
            title="模式 A · 山徑劇情"
            kicker="教育 · 文化任務 · 劇情取向"
            desc="沿山徑推進、清障搭橋、管理補給與壓力，答對族語題讓行動全額生效，帶隊伍安全返家。"
            cta="走上山徑"
          />
          <ModeCard
            href="/play"
            accent="sky"
            emblem="⚔️"
            chip="可連玩"
            title="模式 B · 競技對戰"
            kicker="vs 山林試煉（系統） · 闖五式"
            desc="雙方英雄血量、AI 回合、隨從攻擊與勝敗判定。出牌答對族語題觸發加成，適合熟練者。"
            cta="進入對戰"
          />
        </div>

        {/* 三特色 */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            emblem="🃏"
            title="爐石式對戰"
            desc="法力曲線、隨從與法術、戰場出牌。"
          />
          <FeatureCard
            emblem="📚"
            title="族語答題加成"
            desc="答對得加成，答錯揭示正解，正向學習。"
          />
          {/* 註：原稿此格為「Truku 文化主題／祖靈、圖紋」，屬文化避免清單；改中性自然主題，待 enzo-culture 核定正式呈現。 */}
          <FeatureCard
            emblem="⛰️"
            title="山林主題"
            desc="山徑、溪流、部落與自然素材，貼近在地情境。"
          />
        </div>

        <footer className="mt-auto pt-12 text-center">
          <p className="text-xs text-slate-600">
            MVP 開發中。族語詞彙與發音來源：原住民族語E樂園（原民會）；正式對外發布前須取得授權，文化用法複核進行中。
          </p>
          <p className="mt-2 text-xs text-slate-700">
            <a href="/api/health" className="underline">
              /api/health
            </a>{" "}
            · enzo-game
          </p>
        </footer>
      </div>
    </main>
  );
}
