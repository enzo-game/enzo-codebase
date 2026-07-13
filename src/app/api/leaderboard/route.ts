// ORDER-060 —— 天梯：只顯示已申請序號的玩家（未申請的匿名 profiles 不上榜，避免排行被
// 測試/一次性匿名帳號弄亂）。同一序號底下所有匿名 session 的戰績用 get_leaderboard() 聚合。
// 只回公開的名稱與勝負數，不需登入。
import { NextResponse } from "next/server";
import { serviceClient, matchServerConfigured } from "@/lib/matchServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!matchServerConfigured) {
    return NextResponse.json({ error: "後端尚未設定" }, { status: 503 });
  }
  const svc = serviceClient();
  const { data, error } = await svc.rpc("get_leaderboard");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ leaderboard: data ?? [] });
}
