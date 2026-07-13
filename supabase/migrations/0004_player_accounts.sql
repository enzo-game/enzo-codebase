-- ORDER-060 —— 序號帳號：玩家自己取顯示名稱 + PIN，之後在別的裝置/新的匿名 session
-- 輸入同樣的名稱+PIN 就能把戰績接回來。顯示名稱唯一（拿來當登入用的識別碼）。
-- PIN 只存 hash（Node crypto.scrypt，在 service-role Route Handler 端算，見 matchServer.ts），
-- 不留明碼；沒有給 client 直接讀寫的 RLS policy，一律走 service-role 端點（跟 match_state
-- 同一個保護原則）。
--
-- 匿名 auth.users 本身沒有持久身分（換裝置/清 session 就換一個 uid），所以序號帳號跟
-- profiles 是「多對一」：一個 player_accounts 可以對到好幾個 profiles 列（同一人不同時期
-- 的不同匿名 uid），戰績用 account_id 聚合，不強行改寫 profiles.id（那是 auth.users 的 FK，
-- 改不了）。

create table if not exists public.player_accounts (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null unique,
  pin_hash     text not null,
  created_at   timestamptz not null default now()
);

alter table public.profiles add column if not exists account_id uuid references public.player_accounts(id) on delete set null;
create index if not exists profiles_account_id_idx on public.profiles(account_id);

alter table public.player_accounts enable row level security;
-- 刻意不建任何 policy：一律靠 service role 的 Route Handler 讀寫（跟 match_state 同招）。

-- 天梯改成只聚合「已申請序號」的玩家（account_id 有設），未申請的匿名 profiles 不上榜，
-- 避免排行被測試/一次性帳號弄亂。同一序號底下所有 profiles 的 wins/losses 加總。
create or replace function public.get_leaderboard()
returns table(display_name text, wins bigint, losses bigint)
language sql security definer set search_path = public as $$
  select pa.display_name,
         coalesce(sum(p.wins), 0)::bigint as wins,
         coalesce(sum(p.losses), 0)::bigint as losses
    from public.player_accounts pa
    join public.profiles p on p.account_id = pa.id
   group by pa.id, pa.display_name
  having coalesce(sum(p.wins), 0) > 0 or coalesce(sum(p.losses), 0) > 0
   order by wins desc, losses asc
   limit 20
$$;

grant execute on function public.get_leaderboard() to authenticated, anon;
