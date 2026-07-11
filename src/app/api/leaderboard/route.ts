// ORDER-060 P4 —— 天梯：service role 讀全 profiles 取前 20（display_name/wins/losses）。
// 只回公開的名稱與勝負數，不需登入。RLS 只讓玩家讀自己，故跨玩家排行一律走此 service-role 端點。
import { NextResponse } from "next/server";
import { serviceClient, matchServerConfigured } from "@/lib/matchServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!matchServerConfigured) {
    return NextResponse.json({ error: "後端尚未設定" }, { status: 503 });
  }
  const svc = serviceClient();
  const { data, error } = await svc
    .from("profiles")
    .select("display_name,wins,losses")
    .or("wins.gt.0,losses.gt.0")
    .order("wins", { ascending: false })
    .order("losses", { ascending: true })
    .limit(20);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaderboard: data ?? [] });
}
