import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-3xl w-full text-center">
        <div className="text-5xl mb-4">🏹🌈</div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3">Enzo</h1>
        <p className="text-lg text-slate-300 mb-2">原民 Truku 爐石式卡牌遊戲 · 族語教學</p>
        <p className="text-sm text-slate-500 mb-10">
          出牌時答對太魯閣族語題目，即可觸發卡牌的族語加成。學得越好，打得越強。
        </p>

        {/* 模式選擇入口 */}
        <h2 className="text-xs uppercase tracking-widest text-slate-500 mb-3">選擇模式</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-left">
          {/* 模式 A：山徑劇情 / 教育 */}
          <Link
            href="/journey"
            className="group relative rounded-2xl border border-emerald-800/60 bg-emerald-950/30 p-5 transition-colors hover:border-emerald-600 hover:bg-emerald-900/30"
          >
            <span className="absolute top-3 right-3 text-[10px] rounded-full bg-amber-500/90 text-black px-2 py-0.5">
              開發中
            </span>
            <div className="text-3xl mb-2">⛰️</div>
            <div className="font-semibold">模式 A · 山徑劇情</div>
            <div className="text-xs text-emerald-300/80 mb-2">教育 / 文化主線 · 非戰鬥</div>
            <p className="text-xs text-slate-400">
              沿山徑推進，完成部落任務與故事，學習太魯閣族文化與族語。適合課堂與初學者。
            </p>
          </Link>

          {/* 模式 B：競技對戰 */}
          <Link
            href="/play"
            className="group relative rounded-2xl border border-sky-800/60 bg-sky-950/30 p-5 transition-colors hover:border-sky-500 hover:bg-sky-900/30"
          >
            <span className="absolute top-3 right-3 text-[10px] rounded-full bg-emerald-500/90 text-black px-2 py-0.5">
              可遊玩
            </span>
            <div className="text-3xl mb-2">🃏</div>
            <div className="font-semibold">模式 B · 競技對戰</div>
            <div className="text-xs text-sky-300/80 mb-2">vs 山林試煉（系統）· 爐石式</div>
            <p className="text-xs text-slate-400">
              雙方英雄血量、AI 回合、隨從攻擊與勝敗判定。出牌答對族語題觸發加成。適合熟練者。
            </p>
            <span className="mt-3 inline-block text-sm font-semibold text-sky-300 group-hover:text-sky-200">
              進入對戰 ▶
            </span>
          </Link>
        </div>

        <div className="mt-10 grid sm:grid-cols-3 gap-4 text-left">
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
            <div className="text-xs text-slate-400">山林、祖靈、團結、狩獵、織布。</div>
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
