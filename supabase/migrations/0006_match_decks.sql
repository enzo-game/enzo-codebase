-- 司令 B2 —— /vs 自組牌組。matches 存雙方牌組（card id 陣列，jsonb）：房主建房帶 deck_a、
-- 加入者加房帶 deck_b。match_state 由伺服器首次初始化時讀這兩欄，用 initMatch(..., deckA, deckB)
-- 各自發自己的牌組；沒帶（null）或不合法就回退整個卡池（跟 /play 一樣）。
--
-- 部署順序（SQL 先）：先在 SQL Editor 跑這支 —— 兩個 RPC 都新增 p_deck 且 default null，
-- 所以「舊前端」呼叫 create_match(p_difficulty) / join_match(p_code) 仍然成立（p_deck 走 null，
-- 照舊全卡池）—— 任何時間點都不會壞。跑完再合併新前端（會帶 p_deck）。
alter table public.matches
  add column if not exists deck_a jsonb,
  add column if not exists deck_b jsonb;

-- 換 create_match 簽章：加 p_deck。先 drop 舊的單參版避免多載歧義。
drop function if exists public.create_match(text);
create or replace function public.create_match(p_difficulty text default 'normal', p_deck jsonb default null)
returns public.matches language plpgsql security definer set search_path = public as $$
declare
  code text;
  m public.matches;
  tries int := 0;
  diff text := case when p_difficulty in ('easy', 'normal', 'hard') then p_difficulty else 'normal' end;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  loop
    code := upper(substr(md5(gen_random_uuid()::text), 1, 6));
    begin
      insert into public.matches (room_code, player_a, difficulty, deck_a)
        values (code, auth.uid(), diff, p_deck)
        returning * into m;
      return m;
    exception when unique_violation then
      tries := tries + 1;               -- 房號碰撞極少，重試幾次
      if tries > 5 then raise; end if;
    end;
  end loop;
end $$;

grant execute on function public.create_match(text, jsonb) to authenticated, anon;

-- 換 join_match 簽章：加 p_deck（加入者的牌組），寫進 deck_b。
drop function if exists public.join_match(text);
create or replace function public.join_match(p_code text, p_deck jsonb default null)
returns public.matches language plpgsql security definer set search_path = public as $$
declare
  m public.matches;
  expired_id uuid;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;

  select id into expired_id
    from public.matches
   where room_code = upper(p_code)
     and status = 'waiting'
     and player_b is null
     and created_at < now() - interval '60 seconds';

  if expired_id is not null then
    delete from public.matches where id = expired_id;
    raise exception 'room expired';
  end if;

  update public.matches
     set player_b = auth.uid(), status = 'active', deck_b = p_deck, updated_at = now()
   where room_code = upper(p_code)
     and status = 'waiting'
     and player_b is null
     and player_a <> auth.uid()
  returning * into m;

  if m.id is null then raise exception 'room not joinable'; end if;
  return m;
end $$;

grant execute on function public.join_match(text, jsonb) to authenticated, anon;
