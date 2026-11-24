-- Catching the group boss ends it for the week: it's gone, so it counts as beaten for the whole group
-- (everyone gets the week's loot as usual), the card says who caught it, and nobody can attack it again
-- until Monday's new boss.
-- Applied by GitHub Actions. Safe to run more than once.

-- who caught a group's boss in a week, if anyone
create or replace function public.raid_caught(p_group uuid, p_week date) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('user_id', b.a, 'name', p.display_name, 'at', b.updated_at)
  from battles b join profiles p on p.id = b.a
  where b.kind = 'raid' and b.group_id = p_group and b.week = p_week and b.state ? 'caught'
  order by b.updated_at limit 1
$$;
revoke all on function public.raid_caught(uuid, date) from public, anon, authenticated;

create or replace function public.group_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  d date := (now() at time zone 'Europe/London')::date;
  out jsonb; hp int; dealt numeric; caught jsonb;
begin
  if auth.uid() is not null and not public.is_member(p_group) then return null; end if;
  select sum(coalesce(p.days_per_week, 3)) * 100 into hp from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select jsonb_agg(jsonb_build_object('user_id', gm.user_id, 'name', p.display_name,
      'level', ((public.character_card(gm.user_id))->>'level')::int,
      'mult', public.underdog_mult(p_group, gm.user_id),
      'hits', (select count(*) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'),
      'dmg', (select coalesce(sum(public.raid_counts(b.state, p_group, gm.user_id)), 0) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'))
      order by p.display_name)
  into out from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select coalesce(sum((x->>'dmg')::numeric), 0) into dealt from jsonb_array_elements(out) x;
  select jsonb_agg(x order by (x->>'dmg')::int desc) into out from jsonb_array_elements(out) x;
  caught := public.raid_caught(p_group, wk);
  return jsonb_build_object(
    'week_start', wk, 'week_end', wk + 6,
    'boss', public.raid_boss_idx(p_group, wk),
    'hp', hp, 'dmg', case when caught is not null then hp else least(dealt, hp) end, 'defeated', dealt >= hp or caught is not null, 'caught_by', caught,
    'claimed', exists (select 1 from rewards r where r.user_id = auth.uid() and r.ref = 'boss:' || p_group || ':' || wk),
    'loot_elsewhere', exists (select 1 from rewards r where r.user_id = auth.uid() and r.kind = 'boss' and r.meta->>'week' = wk::text and r.ref <> 'boss:' || p_group || ':' || wk),
    'can_attack', p_week is null and caught is null
      and exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d)
      and not exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d),
    'open', (select id from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1),
    'members', coalesce(out, '[]'::jsonb));
end $$;

create or replace function public.raid_fight(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  sa jsonb; sb jsonb; bid uuid; first text; bidx int; base numeric; party jsonb;
begin
  if auth.uid() is null or not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  if public.raid_caught(p_group, date_trunc('week', now() at time zone 'Europe/London')::date) is not null then
    raise exception 'This week’s boss has been caught. A new one comes on Monday.'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  if not exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'Check in at the gym today to attack the boss'; end if;
  if exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'You’ve already attacked today (it counts in all your groups). Come back after your next gym day.'; end if;
  party := public.party_snapshot(auth.uid()); sa := party->0;
  bidx := public.raid_boss_idx(p_group, wk);
  base := greatest((sa->>'atk')::int, (sa->>'spd')::int, (sa->>'tec')::int);
  sb := public.monster_snapshot(bidx, (sa->>'level')::int, 1, false);
  sb := sb || jsonb_build_object('raid', true, 'hp', round((sa->>'hp')::int * 8),
    'def', greatest(10, round(base) - 50),
    'atk', round(((sa->>'def')::int + 50) * 0.6), 'spd', round(((sa->>'def')::int + 50) * 0.6), 'tec', round(((sa->>'def')::int + 50) * 0.6));
  sb := public.scale_for_party(sb, jsonb_array_length(party));   -- a tougher boss for a bigger team
  first := case when (sa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, group_id, a, week, status, turn, snap, state, log, last_move_at)
  values ('raid', p_group, auth.uid(), wk, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', sa, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

create or replace function public.battle_item(p_id uuid, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; it shop_items; st jsonb; ev jsonb; sp monsters; frac numeric; chance numeric; amt int; pid uuid; iv jsonb; ok boolean; gb jsonb; gfrac numeric;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' or bt.turn is distinct from auth.uid() or bt.kind not in ('tower', 'lair', 'raid') then raise exception 'You can’t use items now'; end if;
  select * into it from shop_items where id = p_item;
  if it.id is null or not exists (select 1 from user_items where user_id = auth.uid() and item = p_item and qty > 0) then raise exception 'You don’t have that'; end if;
  st := bt.state;
  if bt.kind = 'raid' and it.kind <> 'ball' then raise exception 'Only balls in the group boss fight'; end if;
  if bt.kind = 'raid' and coalesce((st->>'threw')::boolean, false) then raise exception 'One ball per attack'; end if;
  if bt.kind = 'raid' and public.raid_caught(bt.group_id, bt.week) is not null then raise exception 'Someone in your group has just caught it'; end if;
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
  if bt.kind = 'raid' then
    -- the group boss: one ball per attack, and the odds are tiny. They rise as the whole group wears it down
    -- this week: 0.5% × ball at full HP, up to 3% × ball when it's nearly beaten (Creatine Ball: 1.2%–6.9%).
    gb := public.group_boss(bt.group_id);
    gfrac := greatest(0, (gb->>'hp')::numeric - (gb->>'dmg')::numeric) / greatest(1, (gb->>'hp')::numeric);
    chance := 0.005 * it.val * (1 + 5 * (1 - gfrac));
    st := st || jsonb_build_object('threw', true);
  else
  chance := least(0.95, sp.catch_rate * it.val * (1 - frac) * 1.6 * (case when (bt.snap->'b'->>'elite')::boolean then 0.7 else 1 end)
    -- your first of a boss species is easier to catch
    * (case when sp.boss and not exists (select 1 from pets where user_id = auth.uid() and species = sp.idx) then 1.5 else 1 end) + 0.02);
  end if;
  ok := random() < chance;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item;
  if ok then
    iv := jsonb_build_object('hp', round((random() * 0.4 - 0.2)::numeric, 3), 'atk', round((random() * 0.4 - 0.2)::numeric, 3), 'def', round((random() * 0.4 - 0.2)::numeric, 3),
      'spd', round((random() * 0.4 - 0.2)::numeric, 3), 'tec', round((random() * 0.4 - 0.2)::numeric, 3));
    insert into pets (user_id, species, iv, caught_in) values (auth.uid(), sp.idx, iv, bt.kind) returning id into pid;
    ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', true, 'pet', pid, 'iv', iv, 'species', sp.idx, 'chance', round(chance, 3));
    update battles set state = jsonb_set(st, '{caught}', to_jsonb(pid)), status = 'done', winner_side = 'a', winner = bt.a, turn = null,
      log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
    if bt.kind = 'tower' then perform public.tower_finish(p_id); end if;
    if bt.kind = 'raid' then perform public.raid_finish(p_id); end if;   -- your damage so far still counts
    return jsonb_build_array(ev);
  end if;
  ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', false, 'chance', round(chance, 3));
  update battles set state = st, turn = null, log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
  return jsonb_build_array(ev) || public.monster_turns(p_id);
end $$;
