/*
 * 峽谷行者 UI 音效（程式即時合成）
 * ─────────────────────────────────────────────
 * 純 Web Audio 合成的短促 UI 回饋音：出牌、答對、答錯、抵達/勝利。
 * 無音訊檔、無版權疑慮。
 *
 * 文化守門（Themis）：此為**中性 UI 回饋音**（一般遊戲介面音效語彙），
 * 不使用、不模仿任何太魯閣族歌謠、口簧琴、木琴或祭儀聲響。
 * 真實族群樂音屬文化紅線，須真人族人授權，不得由程式或 AI 假造。
 *
 * 皆由使用者手勢（點擊出牌/作答）觸發，符合瀏覽器 autoplay 政策。
 */

type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as WindowWithWebkit).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 單一短音：正弦/三角波 + 快速 attack-decay 包絡 */
function tone(
  ac: AudioContext,
  freq: number,
  startAt: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
) {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(vol, startAt + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  o.connect(g);
  g.connect(ac.destination);
  o.start(startAt);
  o.stop(startAt + dur + 0.05);
}

/** 出牌：短促柔和「嗒」（低音三角波，似木片輕碰的中性感） */
export function sfxPlayCard() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 220, t, 0.09, 0.12, "triangle");
  tone(ac, 330, t + 0.02, 0.07, 0.05, "triangle");
}

/** 答對：兩聲上行輕鳴（標準 UI 確認音） */
export function sfxCorrect() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 523.25, t, 0.12, 0.1);
  tone(ac, 784, t + 0.1, 0.18, 0.1);
}

/** 答錯：低沉短降音（不刺耳，不懲罰感過重） */
export function sfxWrong() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 196, t, 0.16, 0.1, "triangle");
  tone(ac, 147, t + 0.09, 0.2, 0.08, "triangle");
}

/** 抵達/勝利：三聲柔和上行（中性 UI 完成音） */
export function sfxArrive() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 392, t, 0.15, 0.09);
  tone(ac, 523.25, t + 0.12, 0.15, 0.09);
  tone(ac, 659.25, t + 0.24, 0.28, 0.1);
}

/** 失敗/退場：兩聲柔和下行 */
export function sfxLose() {
  const ac = getCtx();
  if (!ac) return;
  const t = ac.currentTime;
  tone(ac, 330, t, 0.2, 0.08, "triangle");
  tone(ac, 220, t + 0.16, 0.3, 0.08, "triangle");
}
