-- Balls can be thrown at any monster on your turn, bosses included. The chance still rises as its HP
-- falls (rate × ball × (1 − HP left) × 1.6 + 2%), so a full-HP boss is about a 2% long shot.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.battle_item(p_id uuid, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; it shop_items; st jsonb; ev jsonb; sp monsters; frac numeric; chance numeric; amt int; pid uuid; iv jsonb; ok boolean;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' or bt.turn is distinct from auth.uid() or bt.kind not in ('tower', 'lair') then raise exception 'You can’t use items now'; end if;
  select * into it from shop_items where id = p_item;
  if it.id is null or not exists (select 1 from user_items where user_id = auth.uid() and item = p_item and qty > 0) then raise exception 'You don’t have that'; end if;
  st := bt.state;
  if it.kind = 'potion' then
    if coalesce((st->>'items')::int, 0) >= 2 then raise exception 'Only 2 drinks a fight'; end if;
    amt := least((st->'max'->>'a')::int - (st->'hp'->>'a')::int, round((st->'max'->>'a')::int * it.val));
    st := jsonb_set(jsonb_set(st, '{hp,a}', to_jsonb((st->'hp'->>'a')::int + amt)), '{items}', to_jsonb(coalesce((st->>'items')::int, 0) + 1));
    ev := jsonb_build_object('t', 'item', 'who', 'a', 'item', p_item, 'heal', amt);
    update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item;
    update battles set state = st, turn = null, log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
    return jsonb_build_array(ev) || public.monster_turns(p_id);
  end if;
  -- a ball
  select * into sp from monsters where idx = (bt.snap->'b'->>'monster')::int;
  frac := (st->'hp'->>'b')::numeric / greatest(1, (st->'max'->>'b')::numeric);
  chance := least(0.95, sp.catch_rate * it.val * (1 - frac) * 1.6 * (case when (bt.snap->'b'->>'elite')::boolean then 0.7 else 1 end)
    -- your first of a boss species is easier to catch
    * (case when sp.boss and not exists (select 1 from pets where user_id = auth.uid() and species = sp.idx) then 1.5 else 1 end) + 0.02);
  ok := random() < chance;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item;
  if ok then
    iv := jsonb_build_object('hp', round((random() * 0.4 - 0.2)::numeric, 3), 'atk', round((random() * 0.4 - 0.2)::numeric, 3), 'def', round((random() * 0.4 - 0.2)::numeric, 3),
      'spd', round((random() * 0.4 - 0.2)::numeric, 3), 'tec', round((random() * 0.4 - 0.2)::numeric, 3));
    insert into pets (user_id, species, iv, caught_in) values (auth.uid(), sp.idx, iv, bt.kind) returning id into pid;
    ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', true, 'pet', pid, 'iv', iv, 'species', sp.idx, 'chance', round(chance, 2));
    update battles set state = jsonb_set(st, '{caught}', to_jsonb(pid)), status = 'done', winner_side = 'a', winner = bt.a, turn = null,
      log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
    if bt.kind = 'tower' then perform public.tower_finish(p_id); end if;
    return jsonb_build_array(ev);
  end if;
  ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', false, 'chance', round(chance, 2));
  update battles set turn = null, log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
  return jsonb_build_array(ev) || public.monster_turns(p_id);
end $$;
