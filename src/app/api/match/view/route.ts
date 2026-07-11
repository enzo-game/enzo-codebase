// ORDER-060 P2 —— 拉取呼叫者座位的脱敏對戰視角。
// 客戶端收到 Realtime poke（matches.version 變動）後打這支同步狀態。
import { NextResponse } from "next/server";
import { getView, matchServerConfigured } from "@/lib/matchServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!matchServerConfigured) {
    return NextResponse.json({ error: "後端尚未設定" }, { status: 503 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺 id" }, { status: 400 });
  const r = await getView(req.headers.get("authorization"), id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ view: r.view });
}
