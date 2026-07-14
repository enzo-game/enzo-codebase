import Link from "next/link";

// 打法攻略頁：教怎麼在峽谷行者贏。內容全部對齊實際引擎機制（答題加成、法力曲線、召喚病、
// 關鍵字效果、嘲諷單張化、手牌用盡補抽 3）。純靜態伺服器元件。全站禁 emoji：標記用 inline SVG。
export const metadata = {
  title: "打法攻略 · 峽谷行者",
  description: "怎麼在峽谷行者贏：答題加成、起手換牌、法力曲線、隨從交易、關鍵字用法與斬殺。",
};

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/50 p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-lg font-bold text-amber-100">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-400/60 bg-amber-500/10 text-sm text-amber-200">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-200/90">{children}</div>
    </section>
  );
}

const KEYWORDS: { name: string; effect: string; use: string }[] = [
  { name: "嘲諷", effect: "敵人必須先打掉它，才能攻擊你其他隨從或英雄。", use: "拿來保英雄、保後排的脆皮輸出。" },
  { name: "潛行", effect: "不能被指定為攻擊或法術目標，直到它自己出手一次。", use: "藏著大攻擊隨從，等好時機一擊。" },
  { name: "衝鋒", effect: "登場當回合就能攻擊，任何目標（含敵方英雄）。", use: "搶血、湊斬殺。" },
  { name: "突襲", effect: "登場當回合可攻擊敵方隨從，但不能打臉。", use: "即時清掉對面威脅或拆嘲諷。" },
  { name: "石鎧（聖盾）", effect: "抵擋第一次傷害後才消失。", use: "送去換對面大隨從，非常划算。" },
  { name: "汲取（吸血）", effect: "造成傷害時，同額回復你的英雄。", use: "互拚時活更久、把血量拉回來。" },
  { name: "疾風（風怒）", effect: "每回合可以攻擊兩次。", use: "一隻清兩個，或雙倍打臉。" },
  { name: "法術增幅", effect: "在場時，你的傷害法術 +N 點。", use: "留著它，讓清場法術一發解決。" },
];

export default function StrategyPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/home/home-bg-night-mountains-v1.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-950/90 via-slate-950/88 to-slate-950/95" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/battle" className="text-xs text-slate-400 hover:text-slate-200 underline">← 回競技對戰</Link>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-300 underline">返回首頁</Link>
        </div>

        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">打法攻略 · 怎麼贏</h1>
          <p className="mt-3 text-sm text-slate-300/90">
            峽谷行者是爐石式卡牌＋族語答題。雙方從同一副牌庫隨機抽牌，贏的關鍵不在「組什麼牌」，而在
            <span className="text-amber-200">答題、節奏、交易</span>這三件事。
          </p>
        </header>

        <div className="space-y-4">
          <Section n={1} title="答題＝你的加成引擎（最重要）">
            <p>每出一張牌都要先答一題太魯閣族語題。<span className="text-emerald-300">答對</span> → 觸發卡片的 ★加成（更強的版本，例如 +1/+1 或多一個效果）；<span className="text-rose-300">答錯</span> → 只用基礎效果打出。</p>
            <p>所以你的<span className="text-amber-200">答對率，直接等於你整套牌的強度</span>。別急著點，看清楚題目再選。</p>
            <p>難度：普通考單字、困難考句子。想穩就先打普通、把常見詞背熟；揭曉後會播族語發音，順便學起來。</p>
          </Section>

          <Section n={2} title="起手換牌：留便宜牌">
            <p>開局可以換一次起手牌（選到的洗回牌庫、重抽等量，<span className="text-slate-400">只有這一次機會</span>）。</p>
            <p>原則：<span className="text-amber-200">留 1–3 費的低費牌，換掉 6 費以上的貴牌</span>。前幾回合法力少，貴牌卡在手上等於空過。能馬上動的衝鋒小兵（像 1 費山羌）值得留。</p>
          </Section>

          <Section n={3} title="照法力曲線出牌，別浪費水晶">
            <p>法力從 1 點開始，每回合上限 +1（最多 10），而且<span className="text-amber-200">每回合回滿</span>。</p>
            <p>原則：每回合盡量把法力花光。第 3 回合有 3 點，就打 3 費、或 2+1，別留著。<span className="text-rose-300">空過的法力＝白送對手節奏</span>。</p>
          </Section>

          <Section n={4} title="隨從召喚病與交易">
            <p>剛打出的隨從<span className="text-amber-200">當回合不能攻擊</span>，要等下一回合（能攻擊時會發綠光、標「可攻擊」）。例外：<span className="text-emerald-300">衝鋒</span>登場即可打任何目標、<span className="text-emerald-300">突襲</span>登場可打敵方隨從但不能打臉。</p>
            <p>交易原則：用小換大、能白吃就白吃（石鎧、血厚的隨從去擋）。<span className="text-amber-200">血量通常比攻擊值更耐用</span>——活著的隨從才能持續輸出。</p>
          </Section>

          <Section n={5} title="關鍵字速查">
            <div className="grid gap-2 sm:grid-cols-2">
              {KEYWORDS.map((k) => (
                <div key={k.name} className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
                  <div className="text-sm font-semibold text-amber-100">{k.name}</div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-300">{k.effect}</p>
                  <p className="mt-1 text-xs leading-relaxed text-emerald-300/80">用法：{k.use}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section n={6} title="怎麼拆嘲諷">
            <p>敵方有嘲諷隨從時，你的攻擊<span className="text-amber-200">必須先指向嘲諷者</span>，才能碰到後面的隨從或英雄。</p>
            <p>拆法：傷害法術直接點掉、突襲隨從去換掉它、或把法術增幅疊上去讓一發清場法術解決。血厚的嘲諷就用小兵慢慢磨，或留一隻大隨從一次過。</p>
          </Section>

          <Section n={7} title="手牌空了不用怕">
            <p>手牌一清空，下次出牌會<span className="text-amber-200">自動補抽 3 張</span>，不會沒牌可打。</p>
            <p>所以節奏卡住時，把手牌打出去、觸發補抽也是一招——但別亂丟真正的好牌。</p>
          </Section>

          <Section n={8} title="收尾：算好斬殺">
            <p>快贏時先數傷害：場上<span className="text-amber-200">可攻擊隨從的總攻擊力 ＋ 這回合的衝鋒新兵 ≥ 對手英雄血量</span>，就全部衝臉。</p>
            <p>汲取幫你在互拚中活更久、疾風提供爆發傷害。對手有嘲諷，記得先拆再斬。</p>
          </Section>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link href="/battle" className="rounded-lg border border-sky-500/50 bg-sky-950/40 px-5 py-2 text-sm text-sky-100 hover:bg-sky-900/50">
            開始對戰 ▸
          </Link>
          <Link href="/collection" className="text-sm text-amber-300/80 hover:text-amber-200 underline">
            翻卡牌圖鑑 →
          </Link>
        </div>
      </div>
    </main>
  );
}
