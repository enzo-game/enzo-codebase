// ORDER-060 —— 用名稱+PIN 登入既有序號：驗證通過就把呼叫者現在的（可能是全新的）匿名身分
// 掛回這個序號，接回戰績與顯示名稱。
import { NextResponse } from "next/server";
import { loginAccount } from "@/lib/accountServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { displayName?: string; pin?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }
  if (!body.displayName || !body.pin) {
    return NextResponse.json({ error: "缺顯示名稱或 PIN" }, { status: 400 });
  }
  const r = await loginAccount(req.headers.get("authorization"), body.displayName, body.pin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ displayName: r.displayName });
}
