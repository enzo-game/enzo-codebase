"use client";
import { useEffect, useState } from "react";

// 對戰計時器：顯示這局打了多久（mm:ss）。running=true 時每秒跳動；結束後停在最後時間
// （靠 now state 只在 running 時更新，parent 之後重繪也不會再前進）。startMs 為 null 時不顯示。
export default function MatchClock({ startMs, running }: { startMs: number | null; running: boolean }) {
  const [now, setNow] = useState<number>(() => (startMs ?? 0));

  useEffect(() => {
    if (startMs == null || !running) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 進入計時即對齊現在時間，之後每秒更新
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs, running]);

  if (startMs == null) return null;
  const s = Math.max(0, Math.floor((now - startMs) / 1000));
  return (
    <>
      {Math.floor(s / 60)}:{String(s % 60).padStart(2, "0")}
    </>
  );
}
