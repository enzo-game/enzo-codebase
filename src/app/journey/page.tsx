import Link from "next/link";

export default function JourneyPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-950 via-slate-950 to-slate-950 text-slate-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-200">
            ◀ 回模式選擇
          </Link>
          <span className="text-[10px] rounded-full bg-amber-500/90 text-black px-2 py-0.5">
            開發中
          </span>
        </div>

        <div className="text-4xl mb-3">⛰️🧵</div>
        <h1 className="text-3xl font-bold mb-2">模式 A · 山徑劇情</h1>
        <p className="text-emerald-300/80 text-sm mb-6">教育 / 文化主線 · 非戰鬥對決結構</p>

        <div className="rounded-2xl border border-emerald-800/50 bg-emerald-950/30 p-5 mb-6">
          <p className="text-sm text-slate-300 leading-relaxed">
            扮演「織者」，沿山徑節點（森林路段 → 岩壁路段 → 吊壁路段 → 山頂）推進，
            完成部落任務（修復山徑、架設橋樑、完成祈禱），在故事與文化知識中學習太魯閣族語。
          </p>
          <p className="text-xs text-slate-500 mt-3">
            此模式為<strong className="text-slate-300">非戰鬥</strong>結構：系統挑戰＝環境（落石、險徑、山靈試煉），不塑造敵對族群。
          </p>
        </div>

        {/* 三大介面預告 */}
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">規劃中的介面</h2>
        <div className="grid sm:grid-cols-3 gap-3 mb-8">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">🥾</div>
            <div className="font-semibold text-sm">山徑推進盤</div>
            <div className="text-xs text-slate-400 mt-1">沿節點推進，行動點驅動的山林旅程。</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">🧵</div>
            <div className="font-semibold text-sm">織紋節點盤</div>
            <div className="text-xs text-slate-400 mt-1">菱形織紋格盤，完成連線觸發效果。</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">📜</div>
            <div className="font-semibold text-sm">部落任務圖誌</div>
            <div className="text-xs text-slate-400 mt-1">任務、故事與文化知識的教育導向。</div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-700/40 bg-amber-950/20 p-4 mb-8">
          <p className="text-sm text-amber-200/90">
            🚧 山徑劇情模式的機制細節（山徑推進 / 織紋連線 / 部落任務）正由遊戲設計部（ORDER-010）定案，
            介面視覺由美術部規劃中。目前先開放<Link href="/play" className="underline">模式 B 競技對戰</Link>。
          </p>
        </div>

        <p className="text-xs text-slate-600">
          視覺概念依原住民族委員會太魯閣族族群介紹；文化正確性由 enzo-culture 審查。
        </p>
      </div>
    </main>
  );
}
