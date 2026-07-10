-- ORDER-060 P1 —— 線上對戰（好友房）資料模型 + RLS + 原子配對 RPC
-- 設計見 VS_ONLINE_BATTLE_PROPOSAL.md。權威狀態 matches.state 由 P2 的 Edge Function 寫入。

-- ─────────────── 玩家（匿名 session 也建一筆）───────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '織者',
  wins        int  not null default 0,
  losses      int  not null default 0,
  created_at  timestamptz not null default now()
);

-- 新 auth 使用者（含匿名）自動建 profile
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────── 對局 ───────────────
do $$ begin
  create type public.match_status as enum ('waiting','active','finished');
exception when duplicate_object then null; end $$;

create table if not exists public.matches (
  id            uuid primary key default gen_random_uuid(),
  status        public.match_status not null default 'waiting',
  room_code     text unique not null,
  player_a      uuid not null references auth.users(id),
  player_b      uuid references auth.users(id),
  state         jsonb,               -- 權威 Game 狀態（P2 由 Edge Function 寫入；P1 為 null）
  turn_owner    uuid,                -- 現在輪到誰
  turn_deadline timestamptz,         -- 回合逾時
  winner        uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 動作稽核 / 重播（P2 由 Edge Function 以 service_role 寫入）
create table if not exists public.match_events (
  id         bigint generated always as identity primary key,
  match_id   uuid not null references public.matches(id) on delete cascade,
  actor      uuid not null,
  action     jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists match_events_match_id_idx on public.match_events(match_id);

-- ─────────────── RLS ───────────────
alter table public.profiles     enable row level security;
alter table public.matches      enable row level security;
alter table public.match_events enable row level security;

-- profiles：只能讀/改自己
drop policy if exists profiles_self_select on public.profiles;
create policy profiles_self_select on public.profiles
  for select using (auth.uid() = id);
drop policy if exists profiles_self_update on public.profiles;
create policy profiles_self_update on public.profiles
  for update using (auth.uid() = id);

-- matches：只有對局雙方能讀（房號查詢與加入一律走 SECURITY DEFINER RPC，不開放任意讀）
drop policy if exists matches_participant_select on public.matches;
create policy matches_participant_select on public.matches
  for select using (auth.uid() = player_a or auth.uid() = player_b);

-- match_events：雙方可讀；寫入僅 service_role（Edge Function），故不建 insert policy
drop policy if exists match_events_participant_select on public.match_events;
create policy match_events_participant_select on public.match_events
  for select using (
    exists (
      select 1 from public.matches m
      where m.id = match_events.match_id
        and (auth.uid() = m.player_a or auth.uid() = m.player_b)
    )
  );

-- ─────────────── 原子配對 RPC ───────────────
-- 建房：產生 6 碼房號，建立者為 player_a
create or replace function public.create_match()
returns public.matches language plpgsql security definer set search_path = public as $$
declare
  code text;
  m public.matches;
  tries int := 0;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into public.matches (room_code, player_a) values (code, auth.uid()) returning * into m;
      return m;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then raise; end if;   -- 房號碰撞極少，重試幾次
    end;
  end loop;
end $$;

-- 加入房：把自己填為 player_b 並轉 active（單一 UPDATE 保證原子、防雙人搶同房）
create or replace function public.join_match(p_code text)
returns public.matches language plpgsql security definer set search_path = public as $$
declare m public.matches;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  update public.matches
     set player_b = auth.uid(), status = 'active', updated_at = now()
   where room_code = upper(p_code)
     and status = 'waiting'
     and player_b is null
     and player_a <> auth.uid()
  returning * into m;
  if m.id is null then raise exception 'room not joinable'; end if;
  return m;
end $$;

grant execute on function public.create_match() to authenticated, anon;
grant execute on function public.join_match(text) to authenticated, anon;

-- ─────────────── Realtime ───────────────
alter publication supabase_realtime add table public.matches;
