// 切面寶石（費用／攻擊／生命指示器）——/play 單機盤面與 /vs 線上盤面共用的單一來源。
// 依司令規格：費用＝藍寶石六角柱切、攻擊＝琥珀石六角切、生命＝紅寶石盾形切。
// 小型 SVG：深色鑲邊（bezel）→ 漸層主體 → 三角切面（亮／暗面）→ 白色高光點。
// 文化紅線：輪廓一律避開菱形（祖靈之眼紋樣），切面也只用三角形，不出現菱形塊面。
import type { JSX } from "react";

/** 寶石漸層共用定義：整頁 render 一次，供所有 StatGem 以 url(#…) 引用 */
export function GemDefs() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden focusable="false">
      <defs>
        <linearGradient id="gemSapphire" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.55" stopColor="#0284c7" />
          <stop offset="1" stopColor="#075985" />
        </linearGradient>
        <linearGradient id="gemAmber" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fcd34d" />
          <stop offset="0.55" stopColor="#f59e0b" />
          <stop offset="1" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="gemRuby" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fb7185" />
          <stop offset="0.55" stopColor="#e11d48" />
          <stop offset="1" stopColor="#9f1239" />
        </linearGradient>
      </defs>
    </svg>
  );
}

type GemKind = "cost" | "atk" | "hp";

const GEM_LABEL: Record<GemKind, string> = {
  cost: "費",
  atk: "攻",
  hp: "命",
};

const GEM_TITLE: Record<GemKind, string> = {
  cost: "費用：打出這張牌需要的法力",
  atk: "攻擊：造成的傷害",
  hp: "生命：承受傷害的血量",
};

/** 藍寶石：直立六角柱切（尖頂尖底、左右直邊，六邊形非菱形） */
function GemShapeCost() {
  return (
    <>
      <polygon points="12,0.8 21.5,6.6 21.5,17.4 12,23.2 2.5,17.4 2.5,6.6" fill="#0c2f45" stroke="#bae6fd" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <polygon points="12,2.8 19.7,7.6 19.7,16.4 12,21.2 4.3,16.4 4.3,7.6" fill="url(#gemSapphire)" />
      <polygon points="12,2.8 4.3,7.6 12,12.2" fill="#ffffff" opacity="0.34" />
      <polygon points="12,2.8 19.7,7.6 12,12.2" fill="#ffffff" opacity="0.18" />
      <polygon points="4.3,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.14" />
      <polygon points="19.7,16.4 12,21.2 12,12.2" fill="#000000" opacity="0.26" />
      <circle cx="8.2" cy="6.6" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

/** 琥珀石：平頂六角切 */
function GemShapeAtk() {
  return (
    <>
      <polygon points="6,1.2 18,1.2 23.3,12 18,22.8 6,22.8 0.7,12" fill="#5b3308" stroke="#fde68a" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <polygon points="7.1,3.1 16.9,3.1 21.2,12 16.9,20.9 7.1,20.9 2.8,12" fill="url(#gemAmber)" />
      <polygon points="7.1,3.1 16.9,3.1 12,12" fill="#ffffff" opacity="0.3" />
      <polygon points="7.1,3.1 2.8,12 12,12" fill="#ffffff" opacity="0.16" />
      <polygon points="2.8,12 7.1,20.9 12,12" fill="#000000" opacity="0.14" />
      <polygon points="7.1,20.9 16.9,20.9 12,12" fill="#000000" opacity="0.26" />
      <polygon points="21.2,12 16.9,20.9 12,12" fill="#000000" opacity="0.18" />
      <circle cx="8.6" cy="6" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

/** 紅寶石：盾形切 */
function GemShapeHp() {
  return (
    <>
      <path d="M12 0.8 L21.6 4.6 V11.4 C21.6 17.5 12 23.2 12 23.2 C12 23.2 2.4 17.5 2.4 11.4 V4.6 Z" fill="#4c0519" stroke="#fecdd3" strokeWidth="0.9" strokeOpacity="0.75" strokeLinejoin="round" />
      <path d="M12 2.8 L19.7 5.9 V11.2 C19.7 16.2 12 20.9 12 20.9 C12 20.9 4.3 16.2 4.3 11.2 V5.9 Z" fill="url(#gemRuby)" />
      <polygon points="12,2.8 4.3,5.9 12,11.6" fill="#ffffff" opacity="0.32" />
      <polygon points="12,2.8 19.7,5.9 12,11.6" fill="#ffffff" opacity="0.16" />
      <polygon points="4.3,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.14" />
      <polygon points="19.7,11.2 12,20.9 12,11.6" fill="#000000" opacity="0.26" />
      <circle cx="8.4" cy="6.4" r="1.2" fill="#ffffff" opacity="0.9" />
    </>
  );
}

const GEM_SHAPE: Record<GemKind, () => JSX.Element> = {
  cost: GemShapeCost,
  atk: GemShapeAtk,
  hp: GemShapeHp,
};

export function StatGem({
  kind,
  value,
  size = "md",
  tone = "text-white",
  className = "",
}: {
  kind: GemKind;
  value: number;
  size?: "md" | "sm";
  tone?: string;
  className?: string;
}) {
  const Shape = GEM_SHAPE[kind];
  return (
    <span
      className={`hs-gem hs-gem-${size} ${className}`}
      data-label={GEM_LABEL[kind]}
      title={`${GEM_TITLE[kind]} ${value}`}
      aria-label={`${GEM_TITLE[kind]} ${value}`}
    >
      <svg viewBox="0 0 24 24" className="block w-full h-full" aria-hidden focusable="false">
        <Shape />
      </svg>
      <span className={`hs-gem-num ${tone}`}>{value}</span>
      <span className="hs-gem-label" aria-hidden>{GEM_LABEL[kind]}</span>
    </span>
  );
}
