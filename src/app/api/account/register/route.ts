// ORDER-060 —— 申請序號：顯示名稱 + PIN（4–6 位數字），名稱不能重複。
// 成功後把呼叫者現在的匿名身分掛上這個序號，之後在別的裝置用同樣名稱+PIN 登入可以接回戰績。
import { NextResponse } from "next/server";
import { registerAccount } from "@/lib/accountServer";

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
  const r = await registerAccount(req.headers.get("authorization"), body.displayName, body.pin);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ displayName: r.displayName });
}
