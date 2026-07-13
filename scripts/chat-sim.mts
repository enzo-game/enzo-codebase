// 一次性：模擬對手在對局聊天頻道 broadcast 一則訊息，驗證另一端能即時收到。
// 用法：npx tsx scripts/chat-sim.mts <matchId> "訊息"
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
for (const l of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "").trim();
}
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
const matchId = process.argv[2];
const text = process.argv[3] ?? "嗨，這是對手";
const ch = sb.channel(`chat:${matchId}`, { config: { broadcast: { self: false } } });
await new Promise<void>((res) => ch.subscribe((s) => { if (s === "SUBSCRIBED") res(); }));
await ch.send({ type: "broadcast", event: "msg", payload: { text, ts: Date.now() } });
console.log(`已向 chat:${matchId} 廣播：「${text}」`);
await new Promise((r) => setTimeout(r, 500));
process.exit(0);
