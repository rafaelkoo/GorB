-- Catch the group boss. A legend: one ball per attack, and the odds are tiny: 0.5% × the ball at full HP,
-- rising to 3% × the ball as the whole group wears it down that week (a Creatine Ball: 1.2% to 6.9%).
-- No drinks in the group boss fight, only balls. Catching it ends your attack (your damage still counts).
-- Legendary pets (species 18–23) don't evolve; like any pet kept in its form they learn their type's ultimate
-- at level 20. They have their own row in the dex.
-- Applied by GitHub Actions. Safe to run more than once.

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

create or replace function public.my_pets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  me := public.fighter_snapshot(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'nickname', p.nickname, 'slot', p.slot, 'iv', p.iv,
      'caught_at', p.caught_at, 'boss', m.boss, 'type', m.type, 'xp', p.xp, 'level', public.pet_level(p.xp),
      'xp_from', public.pet_level_xp(public.pet_level(p.xp)), 'xp_to', case when public.pet_level(p.xp) < 20 then public.pet_level_xp(public.pet_level(p.xp) + 1) end,
      'extra_move', p.extra_move, 'release', public.release_value(p.id), 'evolved', p.evolved, 'gym_days', p.gym_days, 'keep_form', p.keep_form, 'sig_move', m.sig_move, 'legend', m.raid, 'ultimate', public.ultimate_move(m.type),
      'evo_ready', m.evo_en is not null and not p.evolved and public.pet_level(p.xp) >= 10 and p.gym_days >= 20,
      'evo_prompt', m.evo_en is not null and not p.evolved and not p.keep_form and public.pet_level(p.xp) >= 10 and p.gym_days >= 20 and public.pet_level(p.xp) > p.evo_skip_level, 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.pet_fight_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt int; ready jsonb;
begin
  if new.kind not in ('tower', 'lair', 'raid') or old.status <> 'active' or new.status <> 'done' or new.snap->'party' is null then return new; end if;
  if (new.log->-1->>'t') = 'flee' then return new; end if;
  amt := case when new.winner_side = 'a' then 20 else 5 end;
  with up as (
    update pets p set xp = least(p.xp + amt, public.pet_level_xp(20))
    where p.user_id = new.a and p.id in (select (x->>'pet')::uuid from jsonb_array_elements(new.snap->'party') x where x ? 'pet')
    returning p.id, p.species, p.nickname, p.xp, p.gym_days, p.evolved, p.keep_form, p.evo_skip_level)
  -- pets that just levelled up into being able to evolve (or levelled again while you said "not now")
  select coalesce(jsonb_agg(jsonb_build_object('pet', id, 'species', species, 'name', nickname, 'level', public.pet_level(xp))), '[]'::jsonb) into ready
  from up where species in (select idx from monsters where evo_en is not null) and not evolved and not keep_form and gym_days >= 20 and public.pet_level(xp) >= 10
    and public.pet_level(xp) > public.pet_level(xp - amt) and public.pet_level(xp) > evo_skip_level;
  new.state := new.state || jsonb_build_object('pet_xp', amt, 'evo_ready', ready);
  return new;
end $$;

create or replace function public.evolve_pet(p_pet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pt pets;
begin
  select * into pt from pets where id = p_pet and user_id = auth.uid() for update;
  if pt.id is null then raise exception 'Not your pet'; end if;
  if pt.evolved then raise exception 'Already evolved'; end if;
  if (select evo_en from monsters where idx = pt.species) is null then raise exception 'Legendary pets don’t evolve: at level 20 they learn their ultimate'; end if;
  if public.pet_level(pt.xp) < 10 then raise exception 'It needs to be level 10'; end if;
  if pt.gym_days < 20 then raise exception 'It needs 20 gym days in your team (it has %)', pt.gym_days; end if;
  update pets set evolved = true where id = p_pet;
  insert into pet_dex (user_id, species, evolved) values (auth.uid(), pt.species, true)
  on conflict (user_id, species) do update set evolved = true;
  return jsonb_build_object('evolved', true, 'species', pt.species);
end $$;

create or replace function public.my_dex() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); normal int; boss int; evo int;
begin
  if u is null then return null; end if;
  select count(*) filter (where m.boss is false), count(*) filter (where m.boss), count(*) filter (where d.evolved)
    into normal, boss, evo from pet_dex d join monsters m on m.idx = d.species where d.user_id = u;
  return jsonb_build_object(
    'species', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'evo_en', m.evo_en, 'evo_zh', m.evo_zh, 'type', m.type, 'boss', m.boss,
        'caught', d.species is not null, 'evolved', coalesce(d.evolved, false), 'first', d.first_caught,
        'have', (select count(*) from pets p where p.user_id = u and p.species = m.idx),
        'best_iv', (select max(((p.iv->>'hp')::numeric + (p.iv->>'atk')::numeric + (p.iv->>'def')::numeric + (p.iv->>'spd')::numeric + (p.iv->>'tec')::numeric) / 5)
                    from pets p where p.user_id = u and p.species = m.idx)) order by m.idx)
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u where not m.raid),
    'legend', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type, 'caught', d.species is not null, 'first', d.first_caught,
        'have', (select count(*) from pets p where p.user_id = u and p.species = m.idx)) order by m.idx)
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u where m.raid),
    'sets', jsonb_build_array(
      jsonb_build_object('id', 'normal', 'have', normal, 'need', 12, 'coins', 150, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:normal')),
      jsonb_build_object('id', 'boss', 'have', boss, 'need', 6, 'coins', 250, 'xp', 150, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:boss')),
      jsonb_build_object('id', 'evo', 'have', evo, 'need', 6, 'coins', 200, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:evo'))));
end $$;
