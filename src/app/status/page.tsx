import Link from "next/link";
import {
  artBatches,
  reviewItems,
  otherLines,
  autoOrders,
  PIPELINE_STAGES,
  LAST_UPDATED,
  PROD_URL,
  type Stage,
  type Owner,
} from "@/data/fleetStatus";

export const metadata = {
  title: "Enzo 艦隊狀態看板",
  robots: { index: false, follow: false }, // 內部用，不索引
};

const STAGE_UI: Record<Stage, { dot: string; label: string; text: string }> = {
  done: { dot: "bg-emerald-500", label: "✓", text: "text-emerald-300" },
  wip: { dot: "bg-amber-400", label: "…", text: "text-amber-300" },
  blocked: { dot: "bg-rose-500", label: "✕", text: "text-rose-300" },
  na: { dot: "bg-slate-700", label: "–", text: "text-slate-500" },
};

// 「下一步等誰」的分色：等你 / 等 Claude / 等真人審查
const OWNER_UI: Record<Owner, string> = {
  司令: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  Codex: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  Claude: "bg-sky-500/20 text-sky-200 border-sky-500/40",
  Themis: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  Mnemosyne: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  族人: "bg-rose-500/20 text-rose-200 border-rose-500/40",
  "—": "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

function StageDot({ s }: { s: Stage }) {
  const ui = STAGE_UI[s];
  return (
    <span className="inline-flex flex-col items-center gap-0.5">
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-black/80 ${ui.dot}`}>
        {ui.label}
      </span>
    </span>
  );
}

function OwnerChip({ o }: { o: Owner }) {
  if (o === "—") return <span className="text-xs text-slate-600">—</span>;
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${OWNER_UI[o]}`}>
      等 {o}
    </span>
  );
}

export default function StatusPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-4 sm:px-8 py-8">
      <div className="mx-auto max-w-5xl">
        {/* 頂部 */}
        <header className="mb-6">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Link href="/" className="hover:text-slate-200">◀ 回首頁</Link>
            <span>·</span>
            <span>內部看板（不對外索引）</span>
          </div>
          <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">Enzo 艦隊狀態看板</h1>
          <p className="mt-1 text-sm text-slate-400">
            一頁看完每個東西卡在哪、下一步等誰。最後更新：{LAST_UPDATED}．
            <a href={PROD_URL} className="underline hover:text-slate-200"> 正式站</a>
          </p>
        </header>

        {/* 圖例 */}
        <section className="mb-6 rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-xs">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> 過關</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" /> 進行中／排隊</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-rose-500" /> 卡住</span>
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-slate-700" /> 不適用</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-slate-800 pt-3">
            <span className="flex items-center gap-2"><span className="rounded-full border border-amber-500/40 bg-amber-500/20 px-2 py-0.5 text-amber-200">等 司令/Codex</span> 你動一下就過</span>
            <span className="flex items-center gap-2"><span className="rounded-full border border-sky-500/40 bg-sky-500/20 px-2 py-0.5 text-sky-200">等 Claude</span> 我做，通常快</span>
            <span className="flex items-center gap-2"><span className="rounded-full border border-rose-500/40 bg-rose-500/20 px-2 py-0.5 text-rose-200">等 真人審查</span> AI 不能代拍板</span>
          </div>
        </section>

        {/* 一、美術素材批次 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">一、美術素材批次</h2>
        <div className="mb-8 overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
                <th className="p-3 text-left font-medium">項目</th>
                {PIPELINE_STAGES.map((s) => (
                  <th key={s} className="p-2 font-medium">{s}</th>
                ))}
                <th className="p-3 text-left font-medium">卡在哪 / 下一步</th>
              </tr>
            </thead>
            <tbody>
              {artBatches.map((r) => (
                <tr key={r.name} className="border-b border-slate-800/60 last:border-0">
                  <td className="p-3 font-medium">{r.name}</td>
                  <td className="p-2 text-center"><StageDot s={r.gen} /></td>
                  <td className="p-2 text-center"><StageDot s={r.qa} /></td>
                  <td className="p-2 text-center"><StageDot s={r.culture} /></td>
                  <td className="p-2 text-center"><StageDot s={r.lang} /></td>
                  <td className="p-2 text-center"><StageDot s={r.integrate} /></td>
                  <td className="p-2 text-center"><StageDot s={r.live} /></td>
                  <td className="p-3">
                    <div className="mb-1"><OwnerChip o={r.next} /></div>
                    <div className="text-xs text-slate-400">{r.blocker}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 二、審查中單項 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">二、文化／語言審查中的單項</h2>
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {reviewItems.map((r) => (
            <div key={r.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{r.name}</span>
                <span className={`mt-0.5 h-3 w-3 flex-none rounded-full ${STAGE_UI[r.status].dot}`} />
              </div>
              <OwnerChip o={r.next} />
              <p className="mt-2 text-xs text-slate-400">{r.blocker}</p>
            </div>
          ))}
        </div>

        {/* 三、其他工作線 */}
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">三、其他工作線</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {otherLines.map((r) => (
            <div key={r.name} className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{r.name}</span>
                <span className={`mt-0.5 h-3 w-3 flex-none rounded-full ${STAGE_UI[r.status].dot}`} />
              </div>
              <OwnerChip o={r.next} />
              <p className="mt-2 text-xs text-slate-400">{r.blocker}</p>
            </div>
          ))}
        </div>

        {/* 四、全部 ORDER 自動追蹤（git log 為準，每小時自動更新） */}
        <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wider text-slate-400">
          四、全部 ORDER 自動追蹤
          <span className="ml-2 normal-case font-normal text-slate-500">（git log 為準，每小時自動生成）</span>
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/60 text-xs text-slate-400">
                <th className="p-3 text-left font-medium">單號</th>
                <th className="p-3 text-left font-medium">標題</th>
                <th className="p-2 text-center font-medium">狀態</th>
                <th className="p-3 text-left font-medium">說明 / 下一步</th>
              </tr>
            </thead>
            <tbody>
              {autoOrders.map((r) => (
                <tr key={r.order} className="border-b border-slate-800/60 last:border-0">
                  <td className="p-3 font-mono text-xs text-slate-300 whitespace-nowrap">{r.order}</td>
                  <td className="p-3 leading-snug">{r.name}</td>
                  <td className="p-2 text-center"><StageDot s={r.status} /></td>
                  <td className="p-3">
                    <div className="text-xs text-slate-400">{r.blocker}</div>
                    {r.next !== "—" && <div className="mt-0.5 text-[11px] text-slate-500">下一步：{r.next}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="mt-10 border-t border-slate-800 pt-4 text-xs text-slate-600">
          憑證：文化報告 `enzo-culture/harbor/reports/`．生圖 `enzo-art/outputs/`．決策 `registry.json`．
          此頁資料源：`src/data/fleetStatus.ts`（有進度就更新）。
        </footer>
      </div>
    </main>
  );
}
