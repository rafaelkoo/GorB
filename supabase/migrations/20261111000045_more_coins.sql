-- More ways to earn coins, all tied to training:
--   1. Group boss attacks: 5 coins + 1 per 20 damage that counts (about 10–15 an attack).
--   2. PRs: +10 coins for every day you set a weight PR or an estimated one-rep-max PR on a lift (from 24 Nov 2026).
--   3. Streak: each week in a row you hit your days target adds 10% to the weekly quests' coins (up to +50%).
--   4. Releasing a pet gives coins back: 5 + 2 a level above 1 + up to 15 for good IVs (5–38).
--   5. Catching is cheaper: Creatine Ball 150 → 120, and your first catch of a boss species is ×1.5 easier.
--   6. Replay any tower floor you've cleared (1 ticket): 30% of its first-clear XP and coins each win, so when the
--      next floor is too hard you can still earn while you train. Catching works there too.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.rewards drop constraint if exists rewards_kind_check;
alter table public.rewards add constraint rewards_kind_check
  check (kind in ('chest', 'comeback', 'summon', 'boss', 'quest', 'season', 'battle', 'spend', 'tower', 'raid', 'lair', 'pet'));

update public.shop_items set price = 120 where id = 'ultra_ball';

-- 2. PR coins
create or replace function public.pr_coins(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select 10 * count(distinct (exercise_id, day))::int from (
    select t.exercise_id, t.day,
           t.top > max(t.top) over w as heavier, t.e1 > max(t.e1) over w as better, count(*) over w as before_n
    from (select s.exercise_id, wo.performed_on as day, max(s.weight_kg) as top,
                 max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as e1
          from workouts wo join workout_sets s on s.workout_id = wo.id
          where wo.user_id = p_user and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500 and s.exercise_id <> 'wall_climb'
          group by 1, 2) t
    window w as (partition by t.exercise_id order by t.day rows between unbounded preceding and 1 preceding)) q
  where q.day >= date '2026-11-24' and q.before_n > 0 and (q.heavier or q.better)
$$;
revoke all on function public.pr_coins(uuid) from public, anon, authenticated;

create or replace function public.character_card(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  base jsonb; lx int; lc int; xp bigint; lvl int := 1; need int := 100; left_xp bigint; wk jsonb;
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  base := public.character_card_base(p_user);
  wk := public.weekly_stats(p_user, date_trunc('week', now() at time zone 'Europe/London')::date);
  select coalesce(sum(r.xp), 0), coalesce(sum(r.coins), 0) into lx, lc from rewards r where r.user_id = p_user;
  xp := (base->>'xp')::bigint + lx; left_xp := xp;
  while left_xp >= need loop left_xp := left_xp - need; lvl := lvl + 1; need := 100 + 40 * (lvl - 1); end loop;
  return base || jsonb_build_object('xp', xp, 'level', lvl, 'xp_in_level', left_xp, 'xp_for_next', need,
    'coins', (base->>'coins')::int + lc + public.pr_coins(p_user), 'pr_coins', public.pr_coins(p_user), 'bonus_xp', lx, 'bonus_coins', lc,
    'stats', wk->'stats', 'type', wk->>'type');
end $$;

-- 3. streak
create or replace function public.week_streak(p_user uuid, p_target int) returns int
language plpgsql stable security definer set search_path = public as $$
declare wk date := date_trunc('week', now() at time zone 'Europe/London')::date; n int := 0; days int;
begin
  loop
    exit when n >= 5;
    wk := wk - 7;
    select count(distinct (created_at at time zone 'Europe/London')::date) into days from checkins
      where user_id = p_user and (created_at at time zone 'Europe/London')::date >= wk and (created_at at time zone 'Europe/London')::date < wk + 7;
    exit when days < greatest(1, p_target);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.week_streak(uuid, int) from public, anon, authenticated;

create or replace function public.my_quests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  d date := (now() at time zone 'Europe/London')::date;
  wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  usual_sets int; usual_cardio int; target int;
  sets_today int; in_today int; days_wk int; cardio_wk int; new_ex int; streak int; boost numeric;
begin
  if u is null then return '[]'::jsonb; end if;
  select coalesce(days_per_week, 3) into target from profiles where id = u;
  -- your usual: average sets on a gym day, and average weekly cardio, over the last 4 weeks
  select coalesce(round(avg(n)), 0) into usual_sets from (
    select count(*) n from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = u and w.performed_on >= d - 28 and w.performed_on < d and s.reps >= 1 group by w.performed_on) a;
  select coalesce(sum(minutes), 0) / 4 into usual_cardio from cardio_logs where user_id = u and performed_on >= wk - 28 and performed_on < wk;
  usual_sets := greatest(6, least(25, usual_sets));
  usual_cardio := greatest(30, (usual_cardio * 1.1)::int / 5 * 5);
  -- progress
  select count(*) into in_today from checkins where user_id = u and (created_at at time zone 'Europe/London')::date = d;
  select count(*) into sets_today from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = u and w.performed_on = d and s.reps >= 1;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days_wk from checkins where user_id = u and (created_at at time zone 'Europe/London')::date >= wk;
  select coalesce(sum(minutes), 0) into cardio_wk from cardio_logs where user_id = u and performed_on >= wk;
  select count(distinct s.exercise_id) into new_ex from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = u and w.performed_on >= wk and s.reps >= 1
      and not exists (select 1 from workouts w2 join workout_sets s2 on s2.workout_id = w2.id where w2.user_id = u and w2.performed_on < wk and s2.exercise_id = s.exercise_id);
  -- streak: weeks in a row (before this one) you hit your days target; each adds 10% to weekly quest coins, up to +50%
  streak := public.week_streak(u, target);
  boost := 1 + 0.1 * least(streak, 5);
  return (select jsonb_agg(q || jsonb_build_object('claimed', exists (select 1 from rewards r where r.user_id = u and r.ref = 'quest:' || (q->>'id') || ':' || (q->>'since'))))
    from (values
      (jsonb_build_object('id', 'checkin', 'period', 'day', 'since', d, 'target', 1, 'progress', least(in_today, 1), 'coins', 10, 'xp', 0)),
      (jsonb_build_object('id', 'sets', 'period', 'day', 'since', d, 'target', usual_sets, 'progress', least(sets_today, usual_sets), 'coins', 10, 'xp', 15)),
      (jsonb_build_object('id', 'days', 'period', 'week', 'since', wk, 'target', target, 'progress', least(days_wk, target), 'coins', round(40 * boost)::int, 'xp', 60, 'streak', streak)),
      (jsonb_build_object('id', 'new', 'period', 'week', 'since', wk, 'target', 1, 'progress', least(new_ex, 1), 'coins', round(20 * boost)::int, 'xp', 20, 'streak', streak)),
      (jsonb_build_object('id', 'cardio', 'period', 'week', 'since', wk, 'target', usual_cardio, 'progress', least(cardio_wk, usual_cardio), 'coins', round(25 * boost)::int, 'xp', 20, 'streak', streak))
    ) v(q));
end $$;
revoke all on function public.my_quests() from public, anon;
grant execute on function public.my_quests() to authenticated;

-- 1. raid coins
create or replace function public.raid_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles; dealt int; m numeric; perf numeric; counts int; team_hp int; pets int; bonus numeric;
begin
  select * into bt from battles where id = p_id;
  dealt := greatest(0, (bt.state->'max'->>'b')::int - (bt.state->'hp'->>'b')::int);
  -- measured against YOUR HP (a raid is 8 moves whoever makes them), so stronger trainers score more
  team_hp := coalesce((bt.snap->'party'->0->>'hp')::int, (bt.state->'max'->>'a')::int);
  pets := greatest(0, coalesce(jsonb_array_length(bt.snap->'party'), 1) - 1);
  bonus := 1 + 0.1 * pets;
  perf := least(1, dealt / greatest(1, 2.0 * team_hp));
  m := public.underdog_mult(bt.group_id, bt.a);
  counts := round((70 + 60 * perf) * bonus * m);
  update battles set state = state || jsonb_build_object('dealt', dealt, 'perf', round(perf, 2), 'mult', m, 'pets', pets, 'team_bonus', bonus, 'counts', counts, 'coins', 5 + counts / 20) where id = p_id;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'raid', 'raid:' || p_id, 10, 5 + counts / 20, jsonb_build_object('group', bt.group_id, 'counts', counts))
  on conflict do nothing;
end $$;
revoke all on function public.raid_finish(uuid) from public, anon, authenticated;

-- 4. release a pet for coins
create or replace function public.release_value(p_pet uuid) returns int
language sql stable security definer set search_path = public as $$
  select (5 + 2 * (public.pet_level(p.xp) - 1)
    + greatest(0, round(((p.iv->>'hp')::numeric + (p.iv->>'atk')::numeric + (p.iv->>'def')::numeric + (p.iv->>'spd')::numeric + (p.iv->>'tec')::numeric) / 5 * 75)))::int
  from pets p where p.id = p_pet
$$;
revoke all on function public.release_value(uuid) from public, anon, authenticated;

drop function if exists public.pet_update(uuid, text, boolean);
create or replace function public.pet_update(p_pet uuid, p_nickname text, p_release boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if not exists (select 1 from pets where id = p_pet and user_id = auth.uid()) then raise exception 'Not your pet'; end if;
  if p_release then
    v := public.release_value(p_pet);
    delete from pets where id = p_pet;
    insert into rewards (user_id, kind, ref, xp, coins, meta) values (auth.uid(), 'pet', 'release:' || p_pet, 0, v, jsonb_build_object('pet', p_pet));
    return jsonb_build_object('coins', v);
  end if;
  update pets set nickname = nullif(left(btrim(coalesce(p_nickname, '')), 20), '') where id = p_pet;
  return null;
end $$;
revoke all on function public.pet_update(uuid, text, boolean) from public, anon;
grant execute on function public.pet_update(uuid, text, boolean) to authenticated;

-- 5. first catch of a boss species is ×1.5 easier
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
  if sp.boss and frac > 0.3 then raise exception 'Bosses can only be caught at 30%% HP or less'; end if;
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

create or replace function public.my_pets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  me := public.fighter_snapshot(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'nickname', p.nickname, 'slot', p.slot, 'iv', p.iv,
      'caught_at', p.caught_at, 'boss', m.boss, 'type', m.type, 'xp', p.xp, 'level', public.pet_level(p.xp),
      'xp_from', public.pet_level_xp(public.pet_level(p.xp)), 'xp_to', case when public.pet_level(p.xp) < 10 then public.pet_level_xp(public.pet_level(p.xp) + 1) end,
      'extra_move', p.extra_move, 'release', public.release_value(p.id), 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

-- 6. replaying cleared tower floors
drop function if exists public.tower_fight();
create or replace function public.tower_fight(p_floor int default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; f int; party jsonb; sb jsonb; bid uuid; first text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'tower' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  perform public.daily_tickets(auth.uid());
  select * into p from profiles where id = auth.uid() for update;
  if p.tickets < 1 then raise exception 'No tickets left. You get 3 free tomorrow, or 3 more when you check in at the gym.'; end if;
  f := p.tower_floor + 1;
  if p_floor is not null and p_floor <> f then
    if p_floor < 1 or p_floor > p.tower_floor then raise exception 'You can replay floors you’ve cleared'; end if;
    f := p_floor;
  end if;
  party := public.party_snapshot(auth.uid());
  sb := public.scale_for_party(public.tower_snapshot(f), jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  update profiles set tickets = tickets - 1 where id = auth.uid();
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('tower', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb) || jsonb_build_object('replay', f <= p.tower_floor), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;
revoke all on function public.tower_fight(int) from public, anon;
grant execute on function public.tower_fight(int) to authenticated;

create or replace function public.tower_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles; fx int; fc int;
begin
  select * into bt from battles where id = p_id;
  if bt.winner_side is distinct from 'a' then return; end if;
  fx := 20 + 4 * bt.floor + (case when bt.floor % 5 = 0 then 30 else 0 end);
  fc := 5 + bt.floor + (case when bt.floor % 5 = 0 then 15 else 0 end);
  if coalesce((bt.state->>'replay')::boolean, false) then
    insert into rewards (user_id, kind, ref, xp, coins, meta)
    values (bt.a, 'tower', 'tower-replay:' || p_id, round(fx * 0.3), greatest(1, round(fc * 0.3)), jsonb_build_object('floor', bt.floor, 'replay', true))
    on conflict do nothing;
    return;
  end if;
  update profiles set tower_floor = greatest(tower_floor, bt.floor) where id = bt.a;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'tower', 'tower:' || bt.floor, fx, fc, jsonb_build_object('floor', bt.floor))
  on conflict do nothing;
end $$;
revoke all on function public.tower_finish(uuid) from public, anon, authenticated;
