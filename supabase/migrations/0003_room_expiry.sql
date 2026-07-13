-- ORDER-060 —— 好友房 1 分鐘過期：避免建了房沒人加入、房號一直有效卻沒人用（浪費/混淆）。
-- 懶執行（跟 P3 回合逾時同一招）：不用背景 cron，join_match 當下檢查 created_at 是否已超過
-- 60 秒沒人加入，超過就直接刪掉那筆房間（尚未有人加入＝沒有 match_state，刪除無副作用）並
-- 回專屬錯誤訊息；房主端的倒數純靠 client 拿 created_at 自己算，不需要伺服器額外推送。

create or replace function public.join_match(p_code text)
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
     set player_b = auth.uid(), status = 'active', updated_at = now()
   where room_code = upper(p_code)
     and status = 'waiting'
     and player_b is null
     and player_a <> auth.uid()
  returning * into m;

  if m.id is null then raise exception 'room not joinable'; end if;
  return m;
end $$;
