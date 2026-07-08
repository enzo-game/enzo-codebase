import Link from "next/link";
import {
  artBatches,
  reviewItems,
  otherLines,
  PIPELINE_STAGES,
  LAST_UPDATED,
  PROD_URL,
  type Stage,
  type Owner,
  type PipelineRow,
  type ItemRow,
} from "@/data/fleetStatus";

export const metadata = {
  title: "Enzo 艦隊狀態看板",
  robots: { index: false, follow: false }, // 內部用，不索引
};

const STAGE_COLOR: Record<Stage, string> = {
  done: "bg-emerald-500 border-emerald-400 text-emerald-950",
  wip: "bg-amber-400 border-amber-300 text-amber-950",
  blocked: "bg-rose-500 border-rose-400 text-rose-950",
  pending: "bg-slate-800 border-slate-600 text-slate-500",
  na: "bg-slate-900 border-slate-800 text-slate-700",
};
const STAGE_ICON: Record<Stage, string> = { done: "✓", wip: "…", blocked: "✕", pending: "·", na: "–" };

const OWNER_TONE: Record<Owner, string> = {
  司令: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  Codex: "bg-amber-400/15 text-amber-200 border-amber-400/40",
  Claude: "bg-sky-400/15 text-sky-200 border-sky-400/40",
  Themis: "bg-rose-400/15 text-rose-200 border-rose-400/40",
  Mnemosyne: "bg-rose-400/15 text-rose-200 border-rose-400/40",
  族人: "bg-rose-400/15 text-rose-200 border-rose-400/40",
  "—": "bg-slate-700/30 text-slate-500 border-slate-600/30",
};

// 由六關卡推出整體狀態（給總覽計數與卡片邊框）
function overall(r: PipelineRow): Stage {
  const stages = [r.gen, r.qa, r.culture, r.lang, r.integrate, r.live];
  if (r.live === "done") return "done";
  if (stages.includes("blocked")) return "blocked";
  if (stages.includes("wip")) return "wip";
  return "pending";
}

function OwnerChip({ o }: { o: Owner }) {
  if (o === "—") return null;
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${OWNER_TONE[o]}`}>
      等 {o}
    </span>
  );
}

// 六關卡進度軌道：連起來的燈號
function Rail({ r }: { r: PipelineRow }) {
  const stages: Stage[] = [r.gen, r.qa, r.culture, r.lang, r.integrate, r.live];
  return (
    <div className="flex items-center">
      {stages.map((s, i) => (
        <div key={i} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold ${STAGE_COLOR[s]} ${s === "blocked" ? "ring-4 ring-rose-500/25" : ""}`}
            >
              {STAGE_ICON[s]}
            </div>
            <span className="text-[10px] text-slate-500">{PIPELINE_STAGES[i]}</span>
          </div>
          {i < stages.length - 1 && (
            <div className={`mx-1 h-1 flex-1 rounded-full ${s === "done" ? "bg-emerald-500/60" : "bg-slate-800"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function StatCard({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={`flex-1 rounded-2xl border p-4 text-center ${tone}`}>
      <div className="text-3xl font-black">{n}</div>
      <div className="mt-1 text-xs opacity-80">{label}</div>
    </div>
  );
}

function MiniCard({ r }: { r: ItemRow }) {
  return (
    <div className={`rounded-xl border bg-slate-900/40 p-3 ${r.status === "blocked" ? "border-rose-500/30" : r.status === "done" ? "border-emerald-500/25" : "border-amber-400/25"}`}>
      <div className="flex items-start gap-2">
        <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${STAGE_COLOR[r.status].split(" ")[0]}`} />
        <div className="min-w-0">
          <div className="text-sm font-medium leading-snug">{r.name}</div>
          <div className="mt-1.5"><OwnerChip o={r.next} /></div>
          <p className="mt-1.5 text-xs leading-snug text-slate-400">{r.blocker}</p>
        </div>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const all = artBatches;
  const done = all.filter((r) => overall(r) === "done").length;
  const wip = all.filter((r) => overall(r) === "wip").length;
  const blocked = all.filter((r) => overall(r) === "blocked").length;

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 px-4 sm:px-8 py-8">
      <div className="mx-auto max-w-6xl">
        {/* 頂部 */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Link href="/" className="hover:text-slate-300">◀ 回首頁</Link>
              <span>·</span><span>內部看板</span>
            </div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight">Enzo 艦隊狀態</h1>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>最後更新 {LAST_UPDATED}</div>
            <a href={PROD_URL} className="underline hover:text-slate-300">正式站 ↗</a>
          </div>
        </header>

        {/* 總覽數字 */}
        <div className="mb-6 flex gap-3">
          <StatCard n={done} label="完成" tone="border-emerald-500/30 bg-emerald-500/10 text-emerald-200" />
          <StatCard n={wip} label="進行中" tone="border-amber-400/30 bg-amber-400/10 text-amber-200" />
          <StatCard n={blocked} label="卡住" tone="border-rose-500/30 bg-rose-500/10 text-rose-200" />
        </div>

        {/* 圖例 */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-slate-800 bg-slate-900/30 px-4 py-2.5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500" />過關</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-400" />進行中</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-rose-500 ring-2 ring-rose-500/30" />卡住</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-slate-700" />不適用</span>
          <span className="ml-auto flex items-center gap-2">
            <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-amber-200">等你</span>
            <span className="rounded-full border border-sky-400/40 bg-sky-400/15 px-2 py-0.5 text-sky-200">等 Claude</span>
            <span className="rounded-full border border-rose-400/40 bg-rose-400/15 px-2 py-0.5 text-rose-200">等真人審查</span>
          </span>
        </div>

        {/* 一、美術素材批次 — 管線軌道 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">美術素材批次</h2>
        <div className="mb-8 space-y-3">
          {all.map((r) => (
            <div
              key={r.name}
              className={`rounded-2xl border bg-slate-900/40 p-4 ${overall(r) === "done" ? "border-emerald-500/25" : overall(r) === "blocked" ? "border-rose-500/30" : "border-amber-400/25"}`}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold">{r.name}</span>
                <div className="flex items-center gap-2">
                  <OwnerChip o={r.next} />
                  <span className="text-xs text-slate-400">{r.blocker}</span>
                </div>
              </div>
              <Rail r={r} />
            </div>
          ))}
        </div>

        {/* 二、審查中單項 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">文化／語言審查單項</h2>
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {reviewItems.map((r) => <MiniCard key={r.name} r={r} />)}
        </div>

        {/* 三、其他工作線 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">其他工作線</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {otherLines.map((r) => <MiniCard key={r.name} r={r} />)}
        </div>

        <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-600">
          資料源 `src/data/fleetStatus.ts`（有進度就更新）· 憑證：`enzo-culture/harbor/reports/`、`enzo-art/outputs/`。
        </footer>
      </div>
    </main>
  );
}
