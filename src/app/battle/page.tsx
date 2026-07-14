import Link from "next/link";

// 競技對戰入口（模式 B）——先讓玩家選「跟 AI 打」還是「跟真人連線」，再進到對應頁面。
// 司令要求把「線上對戰(/vs)」跟「模式 B 對戰(/play)」整合成同一個入口，進來再自己選。
// AI 對戰 → /play（單機打山林試煉，可調難度）；真人對戰 → /vs（好友房房號連線 / 天梯）。

function RobotIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <rect x="4" y="8" width="16" height="12" rx="2" />
      <path d="M12 8V4M9 4h6" strokeLinecap="round" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M2 13v3M22 13v3" strokeLinecap="round" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" strokeLinecap="round" />
      <path d="M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" />
    </svg>
  );
}

function DeckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <rect x="8.5" y="3" width="11" height="15" rx="2" />
      <path d="M5 7v11a3 3 0 0 0 3 3h8" strokeLinecap="round" />
    </svg>
  );
}

function StrategyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

type Accent = "sky" | "fuchsia" | "emerald" | "amber";
const ACCENT: Record<Accent, { ring: string; glow: string; text: string; chip: string; cta: string }> = {
  sky: { ring: "border-sky-800/50 hover:border-sky-400/90", glow: "bg-sky-500/25", text: "text-sky-300", chip: "bg-sky-400/90 text-black", cta: "bg-sky-800/80 hover:bg-sky-700 text-sky-50" },
  fuchsia: { ring: "border-fuchsia-800/50 hover:border-fuchsia-400/90", glow: "bg-fuchsia-500/25", text: "text-fuchsia-300", chip: "bg-fuchsia-400/90 text-black", cta: "bg-fuchsia-800/80 hover:bg-fuchsia-700 text-fuchsia-50" },
  emerald: { ring: "border-emerald-800/50 hover:border-emerald-400/90", glow: "bg-emerald-500/25", text: "text-emerald-300", chip: "bg-emerald-400/90 text-black", cta: "bg-emerald-800/80 hover:bg-emerald-700 text-emerald-50" },
  amber: { ring: "border-amber-800/50 hover:border-amber-400/90", glow: "bg-amber-500/25", text: "text-amber-300", chip: "bg-amber-400/90 text-black", cta: "bg-amber-800/80 hover:bg-amber-700 text-amber-50" },
};

function ChoiceCard({
  href,
  icon,
  accent,
  chip,
  title,
  desc,
  cta,
  order,
}: {
  href: string;
  icon: React.ReactNode;
  accent: Accent;
  chip: string;
  title: string;
  desc: string;
  cta: string;
  order: number;
}) {
  const a = ACCENT[accent];
  return (
    <div className={`anim-card anim-card-${((order - 1) % 2) + 1} relative`}>
      <div className={`glow-breathe pointer-events-none absolute -inset-2 rounded-3xl blur-2xl ${a.glow}`} aria-hidden />
      <Link
        href={href}
        className={`group relative flex min-h-[280px] flex-col rounded-2xl border ${a.ring} bg-slate-900/50 backdrop-blur-sm p-7 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl`}
      >
        <span className={`absolute right-4 top-4 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.chip}`}>{chip}</span>
        <span className={`mb-4 inline-flex h-14 w-14 items-center justify-center rounded-xl border ${a.ring} ${a.text}`}>{icon}</span>
        <div className="text-2xl font-bold tracking-tight">{title}</div>
        <p className="mt-3 text-sm leading-relaxed text-slate-200/90">{desc}</p>
        <span className={`mt-auto inline-flex w-fit items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${a.cta}`}>
          {cta}
          <span className="transition-transform group-hover:translate-x-1">▸</span>
        </span>
      </Link>
    </div>
  );
}

export default function BattleChooser() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/home/home-bg-night-mountains-v1.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/80 to-slate-950/90" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-14">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">競技對戰</h1>
          <p className="mt-3 text-sm text-slate-300/90">跟 AI 練功或真人連線一較高下；也能組自己的牌組、看打法攻略。</p>
          <div className="mx-auto mt-4 flex items-center justify-center gap-3 text-slate-600">
            <span className="h-px w-16 bg-gradient-to-r from-transparent to-slate-600" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70" />
            <span className="h-px w-16 bg-gradient-to-l from-transparent to-slate-600" />
          </div>
        </header>

        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          <ChoiceCard
            href="/play"
            order={1}
            accent="sky"
            icon={<RobotIcon className="h-7 w-7" />}
            chip="單機 · 免連線"
            title="AI 對戰"
            desc="跟系統「山林試煉」對打，AI 自動出牌。可選難度，隨時開局，適合練功與熟悉卡組。"
            cta="開始 AI 對戰"
          />
          <ChoiceCard
            href="/vs"
            order={2}
            accent="fuchsia"
            icon={<GlobeIcon className="h-7 w-7" />}
            chip="連線 · 真人"
            title="真人對戰"
            desc="用房號邀好友連線對戰，回合計時、斷線重連、天梯排行。也可進練習房先看介面。"
            cta="進入連線大廳"
          />
          <ChoiceCard
            href="/deck"
            order={3}
            accent="emerald"
            icon={<DeckIcon className="h-7 w-7" />}
            chip="自組 · 30 張"
            title="牌組編輯器"
            desc="從卡池挑 30 張組一副牌（同名最多 2 張、傳說 1 張），存起來就會帶進 AI 與真人對戰。"
            cta="編輯牌組"
          />
          <ChoiceCard
            href="/strategy"
            order={4}
            accent="amber"
            icon={<StrategyIcon className="h-7 w-7" />}
            chip="教學 · 攻略"
            title="打法攻略"
            desc="答題加成、法力曲線、隨從交易、關鍵字用法與斬殺——教你怎麼在峽谷行者贏。"
            cta="看打法攻略"
          />
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-slate-500 underline hover:text-slate-300">
            ← 回首頁
          </Link>
        </div>
      </div>
    </main>
  );
}
