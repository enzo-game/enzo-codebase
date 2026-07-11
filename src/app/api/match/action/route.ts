// ORDER-060 P2 —— 送出對戰意圖（出牌/答題/攻擊/結束回合/認輸）。
// 權威計算在此（service role），不信前端。回傳呼叫者座位的脱敏視角。
import { NextResponse } from "next/server";
import { postAction, matchServerConfigured } from "@/lib/matchServer";
import type { MatchAction } from "@/engine/match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!matchServerConfigured) {
    return NextResponse.json({ error: "後端尚未設定" }, { status: 503 });
  }
  let body: { matchId?: string; action?: MatchAction };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }
  if (!body.matchId || !body.action) {
    return NextResponse.json({ error: "缺 matchId 或 action" }, { status: 400 });
  }
  const r = await postAction(req.headers.get("authorization"), body.matchId, body.action);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ view: r.view });
}
