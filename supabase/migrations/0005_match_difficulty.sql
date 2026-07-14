-- ORDER-060 —— 好友房共用難度（房主建房時選，整局兩人同題型：normal=單字題、hard=句子題）。
-- /vs 沒有 AI，難度只影響出題題型（不影響對手強度）。match_state 由伺服器在對局開始時建立，
-- initMatch 會讀這個欄位決定出題用 makeQuiz(單字) 還是 makeSentenceQuiz(句子)。
alter table public.matches add column if not exists difficulty text not null default 'normal';

-- 換 create_match 簽章：加 p_difficulty 參數。先 drop 舊的無參數版避免多載重疊/歧義；
-- 部署順序：先在 SQL Editor 跑這支 → 舊前端 rpc("create_match") 無參呼叫仍走 default('normal')
-- 照常運作 → 再合併新前端（會帶 p_difficulty）。這樣任何時間點都不會壞。
drop function if exists public.create_match();

create or replace function public.create_match(p_difficulty text default 'normal')
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
      insert into public.matches (room_code, player_a, difficulty)
        values (code, auth.uid(), diff)
        returning * into m;
      return m;
    exception when unique_violation then
      tries := tries + 1;               -- 房號碰撞極少，重試幾次
      if tries > 5 then raise; end if;
    end;
  end loop;
end $$;

grant execute on function public.create_match(text) to authenticated, anon;
