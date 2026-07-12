import Link from "next/link";

// 首頁／模式選擇（landing）——依設計目標稿「圖2」改版骨架。
// 註：本檔為「無敏感裝飾」的中性骨架。ORDER-016 生圖到位後，於各 {/* ORDER-016 */}
// 標記處換入插畫（/images/home/*）；織紋/菱形四角外框、織布徽、「祖靈/圖紋」呈現
// 屬文化避免清單，待 enzo-culture 複核核定替代設計後另補，這裡一律用中性 CSS。

type Accent = "emerald" | "sky";

const ACCENT: Record<
  Accent,
  { ring: string; hover: string; text: string; chip: string; bg: string; cta: string; glow: string }
> = {
  emerald: {
    ring: "border-emerald-800/50",
    hover: "hover:border-emerald-400/90",
    text: "text-emerald-300",
    chip: "bg-lime-400/90 text-black",
    bg: "from-emerald-950/90 via-slate-950/75 to-slate-950/55",
    cta: "bg-emerald-800/80 hover:bg-emerald-700 text-emerald-50",
    glow: "bg-emerald-500/30",
  },
  sky: {
    ring: "border-sky-800/50",
    hover: "hover:border-sky-400/90",
    text: "text-sky-300",
    chip: "bg-sky-400/90 text-black",
    bg: "from-sky-950/90 via-slate-950/75 to-slate-950/55",
    cta: "bg-sky-800/80 hover:bg-sky-700 text-sky-50",
    glow: "bg-sky-500/30",
  },
};

function ModeCard({
  href,
  emblemSrc,
  bgSrc,
  chip,
  title,
  kicker,
  desc,
  cta,
  accent,
  order,
}: {
  href: string;
  emblemSrc: string;
  bgSrc: string;
  chip: string;
  title: string;
  kicker: string;
  desc: string;
  cta: string;
  accent: Accent;
  order: 1 | 2;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`anim-card ${order === 1 ? "anim-card-1" : "anim-card-2"} relative`}>
      {/* 卡背後呼吸光暈（hover 加亮） */}
      <div
        className={`glow-breathe pointer-events-none absolute -inset-2 rounded-3xl blur-2xl transition-opacity duration-500 group-hover:opacity-100 ${a.glow}`}
        aria-hidden
      />
      <Link
        href={href}
        className={`group shine relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border ${a.ring} ${a.hover} transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl`}
      >
        {/* 卡底插畫（ORDER-016）＋深色漸層 overlay 確保可讀 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={bgSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className={`absolute inset-0 bg-gradient-to-t ${a.bg}`} />

        <div className="relative flex flex-1 flex-col p-6">
        <span
          className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.chip}`}
        >
          {chip}
        </span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={emblemSrc}
          alt=""
          aria-hidden
          width={64}
          height={64}
          className="mb-4 h-16 w-16 drop-shadow"
        />

        <div className="text-2xl font-bold tracking-tight">{title}</div>
        <div className={`mt-1 text-xs ${a.text}`}>{kicker}</div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200/90">{desc}</p>

        <span
          className={`mt-auto inline-flex w-fit items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${a.cta}`}
        >
          {cta}
          <span className="transition-transform group-hover:translate-x-1">▸</span>
        </span>
        </div>
      </Link>
    </div>
  );
}

function FeatureCard({
  emblemSrc,
  title,
  desc,
  order,
}: {
  emblemSrc: string;
  title: string;
  desc: string;
  order: 1 | 2 | 3;
}) {
  return (
    <div
      className={`anim-feature anim-feature-${order} rounded-xl border border-slate-800/80 bg-slate-900/40 p-4 transition-colors duration-300 hover:border-slate-600 hover:bg-slate-900/70`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={emblemSrc}
        alt=""
        aria-hidden
        width={40}
        height={40}
        className="mb-2 h-10 w-10"
      />
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</p>
    </div>
  );
}

// 入口列小圖示（ORDER-039：全站禁 emoji，改用 inline SVG 線稿）
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" strokeLinecap="round" />
      <path d="M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" />
    </svg>
  );
}

// 山巔登頂旗（呼應 /vs/leaderboard 的天梯主題）
function SummitIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M4 20 L10 7 L13 12 L16.5 5 L21 20 Z" />
      <path d="M16.5 5 V1.5 M16.5 2 L19 3 L16.5 4" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* 背景層：夜山插畫（ORDER-016）＋深色漸層可讀性 overlay＋底部暖光（營火感） */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/home/home-bg-night-mountains-v1.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/75 to-slate-950/90" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[radial-gradient(ellipse_at_bottom,_rgba(217,119,6,0.22),_transparent_70%)]" />

      {/* 中性外框（非織紋/菱形；ORDER-016 §4 織紋四角外框待文化複核） */}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-6 py-14">
        {/* 品牌 */}
        <header className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/brand/logo-canyon-walker-v1.png"
            alt="峽谷行者 Canyon Walker"
            width={320}
            height={330}
            className="anim-logo mx-auto w-56 sm:w-72 h-auto drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)]"
          />
          <h1 className="sr-only">峽谷行者 Canyon Walker</h1>
          {/* 中性分隔飾（非菱形）：線 · 圓點 · 線 */}
          <div className="mx-auto mt-4 flex items-center justify-center gap-3 text-slate-600">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
          <Link
            href="/prologue"
            className="anim-logo mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-950/20 px-5 py-2 text-sm text-amber-100/90 transition hover:border-amber-400/70 hover:bg-amber-900/30"
          >
            ▶ 從序幕開始
          </Link>
        </header>

        {/* 雙模式大卡 */}
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <ModeCard
            href="/journey"
            order={1}
            accent="emerald"
            emblemSrc="/images/home/emblem-mode-a-mountain-v1.png"
            bgSrc="/images/home/home-mode-a-forest-path-v1.jpg"
            chip="友善可玩"
            title="模式 A · 山徑劇情"
            kicker="教育 · 文化任務 · 劇情取向"
            desc="沿山徑推進、清障搭橋、管理補給與壓力，答對族語題讓行動全額生效，帶隊伍安全返家。"
            cta="走上山徑"
          />
          <ModeCard
            href="/play"
            order={2}
            accent="sky"
            emblemSrc="/images/home/emblem-mode-b-cards-v1.png"
            bgSrc="/images/home/home-mode-b-arena-v1.jpg"
            chip="可連玩"
            title="模式 B · 競技對戰"
            kicker="vs 山林試煉（系統） · 闖五式"
            desc="雙方英雄血量、AI 回合、隨從攻擊與勝敗判定。出牌答對族語題觸發加成，適合熟練者。"
            cta="進入對戰"
          />
        </div>

        {/* 線上對戰入口（真人 PvP，ORDER-060 P2→P4 已上線） */}
        <Link
          href="/vs"
          className="anim-logo mt-5 flex items-center justify-between gap-4 rounded-2xl border border-fuchsia-500/40 bg-gradient-to-r from-fuchsia-950/30 via-slate-900/40 to-sky-950/30 px-6 py-4 transition hover:border-fuchsia-400/70 hover:from-fuchsia-900/40"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-fuchsia-100/90">
              <GlobeIcon className="h-[1.15em] w-[1.15em] shrink-0" />
              <span>線上對戰 · 跟真人連線</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">
              好友房房號連線 · 回合計時 · 斷線重連 ·{" "}
              <SummitIcon className="inline-block h-[1.15em] w-[1.15em] align-[-0.2em] text-amber-300/90" /> 天梯排行
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-fuchsia-400/50 px-4 py-1.5 text-sm text-fuchsia-100/90">
            連線對戰 →
          </span>
        </Link>

        {/* 卡牌圖鑑入口 */}
        <Link
          href="/collection"
          className="anim-logo mt-3 flex items-center justify-between gap-4 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-slate-900/40 to-emerald-950/30 px-6 py-4 transition hover:border-amber-400/70 hover:from-amber-900/40"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-amber-100/90">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className="h-[1.15em] w-[1.15em] shrink-0" aria-hidden>
                <rect x="8.5" y="3" width="11" height="15" rx="2" />
                <path d="M5 7v11a3 3 0 0 0 3 3h8" strokeLinecap="round" />
              </svg>
              <span>卡牌圖鑑 · 瀏覽全部卡牌</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">依費用曲線排列 · 費用／類型／稀有度／主題／關鍵字篩選 · 每張綁定族語詞與學習小註</div>
          </div>
          <span className="shrink-0 rounded-full border border-amber-400/50 px-4 py-1.5 text-sm text-amber-100/90">
            翻閱卡冊 →
          </span>
        </Link>

        {/* 句子練習入口 */}
        <Link
          href="/sentences"
          className="anim-logo mt-3 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/30 via-slate-900/40 to-sky-950/30 px-6 py-4 transition hover:border-emerald-400/70 hover:from-emerald-900/40"
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-emerald-100/90">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className="h-[1.15em] w-[1.15em] shrink-0" aria-hidden>
                <path d="M4 5h16M4 11h11M4 17h14" strokeLinecap="round" />
              </svg>
              <span>句子練習 · 中文組回太魯閣語</span>
            </div>
            <div className="mt-0.5 text-xs text-slate-400">4 個難度 · 2000+ 句真實例句 · 打散詞卡重組，答完看逐字對照</div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-400/50 px-4 py-1.5 text-sm text-emerald-100/90">
            開始練習 →
          </span>
        </Link>

        {/* 三特色 */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            order={1}
            emblemSrc="/images/home/feature-cards-v1.png"
            title="爐石式對戰"
            desc="法力曲線、隨從與法術、戰場出牌。"
          />
          <FeatureCard
            order={2}
            emblemSrc="/images/home/feature-language-v1.png"
            title="族語答題加成"
            desc="答對得加成，答錯揭示正解，正向學習。"
          />
          {/* 註：原稿此格為「Truku 文化主題／祖靈、圖紋」，屬文化避免清單；改中性自然主題，待 enzo-culture 核定正式呈現。 */}
          <FeatureCard
            order={3}
            emblemSrc="/images/home/feature-nature-v1.png"
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
