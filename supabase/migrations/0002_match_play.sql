-- ORDER-060 P2 —— 伺服器權威對戰的資料層。
-- 權威計算改由 Vercel Route Handler（service role）執行、直接複用 TS 引擎，
-- 不走 Supabase Edge Function（避開需 Docker / supabase login 的部署卡點）。
--
-- 隱藏資訊保護：完整權威狀態（含雙方手牌、牌庫順序、答案）放在 match_state，
-- RLS 拒絕所有 client 讀取（只有 service role 能存取）；matches 只留可公開欄位 + version。
-- Realtime 僅推 matches 的 version 變動當「有事發生」訊號，客戶端收到後再向
-- Route Handler 拉「自己座位的脱敏視角」。

-- ─────────────── 權威狀態（client 不可讀）───────────────
create table if not exists public.match_state (
  match_id   uuid primary key references public.matches(id) on delete cascade,
  state      jsonb not null,          -- 序列化的 MatchState（含機密：對手手牌/牌庫/答案）
  version    int   not null default 0,
  updated_at timestamptz not null default now()
);

-- 啟用 RLS 但「不建任何 policy」＝ 一律拒絕匿名/authenticated 讀寫；
-- service_role 會 bypass RLS，故只有伺服器端能碰。
alter table public.match_state enable row level security;

-- ─────────────── matches：加 version 當 Realtime poke ───────────────
alter table public.matches add column if not exists version int not null default 0;

-- matches 已在 0001 加入 supabase_realtime publication；version 的 UPDATE 會自動被推送。
