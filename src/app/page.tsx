import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center">
        <div className="text-5xl mb-4">🏹🌈</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Enzo</h1>
        <p className="text-lg text-slate-300 mb-2">原民 Truku 爐石式卡牌遊戲 · 族語教學</p>
        <p className="text-sm text-slate-500 mb-8">
          出牌時答對太魯閣族語題目，即可觸發卡牌的族語加成。學得越好，打得越強。
        </p>

        <Link
          href="/play"
          className="inline-block rounded-full bg-emerald-600 hover:bg-emerald-500 px-8 py-3 font-semibold transition-colors"
        >
          進入練習模式 ▶
        </Link>

        <div className="mt-12 grid sm:grid-cols-3 gap-4 text-left">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">🃏</div>
            <div className="font-semibold text-sm">爐石式對戰</div>
            <div className="text-xs text-slate-400">法力曲線、隨從與法術、戰場出牌。</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">📚</div>
            <div className="font-semibold text-sm">族語答題加成</div>
            <div className="text-xs text-slate-400">答對得加成，答錯揭示正解，正向學習。</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="text-2xl mb-1">⛰️</div>
            <div className="font-semibold text-sm">Truku 文化主題</div>
            <div className="text-xs text-slate-400">動物、植物、器物、人物與自然。</div>
          </div>
        </div>

        <p className="mt-10 text-xs text-slate-600">
          MVP 開發中。目前族語題庫為示範佔位資料，正式太魯閣族語內容由語言部審核 hunter.db 後填入。
        </p>
        <p className="mt-2 text-xs text-slate-700">
          <a href="/api/health" className="underline">/api/health</a> · enzo-game
        </p>
      </div>
    </main>
  );
}
