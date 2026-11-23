-- PvE: the Gym Tower and the weekly boss raid. Fights use the engine in migration 031.
--
-- Battle tickets: your first check-in of the day gives 3 (you can hold up to 9). A tower fight costs 1.
--
-- Gym Tower: floors that get harder as you go up. Each floor has one of the six "bad habit" monsters;
--   every 5th floor is a stronger elite. You can only fight the next floor up. Clearing a floor for the
--   first time gives XP and coins. Your stats drop if you stop training, so high floors stay hard.
--
-- Weekly boss raid (replaces the boss from migration 026, same loot): one raid attack per gym day.
--   You fight the boss for up to 8 moves; the damage you do (× the underdog bonus) comes off its HP.
--   The raid boss is matched to you, so a newcomer can do about as much as a strong lifter.
--   Boss HP = 100 × everyone's weekly day targets, added up (as before).
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.rewards drop constraint if exists rewards_kind_check;
alter table public.rewards add constraint rewards_kind_check
  check (kind in ('chest', 'comeback', 'summon', 'boss', 'quest', 'season', 'battle', 'spend', 'tower', 'raid'));

alter table public.profiles add column if not exists tickets int not null default 3;
alter table public.profiles add column if not exists tickets_day date;
alter table public.profiles add column if not exists tower_floor int not null default 0;   -- highest floor cleared

-- the six monsters (sprites are BOSSES in js/pixel.js, same order)
create table if not exists public.monsters (
  idx int primary key,
  type text not null,
  hp int not null, atk int not null, def int not null, spd int not null, tec int not null,   -- floor 1
  moves text[] not null
);
insert into public.monsters (idx, type, hp, atk, def, spd, tec, moves) values
  (0, 'normal',    70, 26, 22, 14, 18, '{cushion_slam,couch_sink,snooze}'),          -- The Couch Monster
  (1, 'strength',  62, 30, 16, 18, 18, '{snack_breath,sugar_rush,cushion_slam}'),    -- Midnight Snack Dragon
  (2, 'normal',    66, 27, 18, 20, 18, '{slime_splash,snooze,sugar_rush}'),          -- Lazy Slime
  (3, 'endurance', 58, 22, 16, 30, 18, '{alarm_blast,notif_ping,snooze}'),           -- The Snooze Clock
  (4, 'strength',  64, 29, 18, 22, 18, '{boba_barrage,snack_breath,sugar_rush}'),    -- Bubble Tea Beast
  (5, 'climbing',  60, 24, 16, 24, 30, '{doomscroll,notif_ping,alarm_blast}')        -- Doomscroll Demon
on conflict (idx) do update set type = excluded.type, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, tec = excluded.tec, moves = excluded.moves;
alter table public.monsters enable row level security;
drop policy if exists "anyone reads monsters" on public.monsters;
create policy "anyone reads monsters" on public.monsters for select to authenticated using (true);
grant select on public.monsters to authenticated;

-- which monster is on a floor: they take turns (easiest first), every 5th floor is an elite
create or replace function public.tower_monster_idx(p_floor int) returns int language sql immutable as $$
  select (array[0, 2, 1, 4, 3, 5])[(p_floor - 1) % 6 + 1]
$$;

-- how tough a floor is: gentle for the first few floors, then steeper; level goes up every third floor
create or replace function public.tower_scale(p_floor int) returns numeric language sql immutable as $$ select 1 + 0.02 * (p_floor - 1) + 0.008 * (p_floor - 1) ^ 2 $$;
create or replace function public.tower_level(p_floor int) returns int language sql immutable as $$ select 1 + (p_floor + 2) / 3 $$;

-- a monster's fighter card. p_scale is how much tougher than floor 1 it is.
create or replace function public.monster_snapshot(p_idx int, p_level int, p_scale numeric, p_elite boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'monster', m.idx, 'elite', p_elite, 'level', p_level, 'type', m.type, 'grit', false,
    'hp',  round(m.hp  * p_scale * (case when p_elite then 1.3 else 1 end)),
    'atk', round(m.atk * p_scale * (case when p_elite then 1.15 else 1 end)),
    'def', round(m.def * p_scale), 'spd', round(m.spd * p_scale), 'tec', round(m.tec * p_scale * (case when p_elite then 1.15 else 1 end)),
    'moves', (select jsonb_agg(jsonb_build_object('id', x.id, 'en', x.en, 'zh', x.zh, 'type', x.type, 'stat', x.stat, 'power', x.power, 'effect', x.effect, 'val', x.effect_val)
              order by array_position(m.moves, x.id)) from moves x where x.id = any(m.moves)))
  from monsters m where m.idx = p_idx
$$;
revoke all on function public.monster_snapshot(int, int, numeric, boolean) from public, anon, authenticated;

-- tickets: the first check-in of the day adds 3, up to 9
create or replace function public.checkin_tickets() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date := (new.created_at at time zone 'Europe/London')::date;
begin
  update profiles set tickets = least(9, tickets + 3), tickets_day = d
   where id = new.user_id and tickets_day is distinct from d;
  return new;
end $$;
drop trigger if exists checkin_tickets on public.checkins;
create trigger checkin_tickets after insert on public.checkins for each row execute function public.checkin_tickets();

-- your tower: tickets, floors cleared, the next monster, and any fight you left open
create or replace function public.my_tower() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p profiles; nxt int;
begin
  if auth.uid() is null then return null; end if;
  select * into p from profiles where id = auth.uid();
  nxt := p.tower_floor + 1;
  return jsonb_build_object('tickets', p.tickets, 'cleared', p.tower_floor, 'next', nxt,
    'monster', public.tower_monster_idx(nxt), 'elite', nxt % 5 = 0,
    'reward', jsonb_build_object('xp', 20 + 4 * nxt + (case when nxt % 5 = 0 then 30 else 0 end), 'coins', 5 + nxt + (case when nxt % 5 = 0 then 15 else 0 end)),
    'open', (select id from battles where a = auth.uid() and kind = 'tower' and status = 'active' order by created_at desc limit 1),
    'best', (select coalesce(jsonb_agg(jsonb_build_object('name', pr.display_name, 'floor', pr.tower_floor) order by pr.tower_floor desc), '[]'::jsonb)
             from profiles pr where pr.tower_floor > 0 and (pr.id = auth.uid() or public.shares_group(pr.id))));
end $$;

-- start the next floor (costs a ticket). If you already have a fight open, you go back into it.
create or replace function public.tower_fight() returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; f int; sa jsonb; sb jsonb; bid uuid; first text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'tower' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  select * into p from profiles where id = auth.uid() for update;
  if p.tickets < 1 then raise exception 'No tickets left. Check in at the gym to get 3 more.'; end if;
  f := p.tower_floor + 1;
  sa := public.fighter_snapshot(auth.uid());
  sb := public.monster_snapshot(public.tower_monster_idx(f), public.tower_level(f), public.tower_scale(f), f % 5 = 0);
  first := case when (sa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  update profiles set tickets = tickets - 1 where id = auth.uid();
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('tower', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', sa, 'b', sb),
          public.battle_state0(sa, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);   -- a faster monster hits first
  return bid;
end $$;

-- called by the engine when a tower fight ends: first clear of a floor pays out
create or replace function public.tower_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles;
begin
  select * into bt from battles where id = p_id;
  if bt.winner_side is distinct from 'a' then return; end if;
  update profiles set tower_floor = greatest(tower_floor, bt.floor) where id = bt.a;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'tower', 'tower:' || bt.floor, 20 + 4 * bt.floor + (case when bt.floor % 5 = 0 then 30 else 0 end),
          5 + bt.floor + (case when bt.floor % 5 = 0 then 15 else 0 end), jsonb_build_object('floor', bt.floor))
  on conflict do nothing;
end $$;
revoke all on function public.tower_finish(uuid) from public, anon, authenticated;

-- ---------- the weekly boss raid ----------

-- the underdog bonus: +10% per level below the group average, up to +50%
create or replace function public.underdog_mult(p_group uuid, p_user uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select round(1 + least(0.5, greatest(0, avg(((public.character_card(gm.user_id))->>'level')::int)
         - ((public.character_card(p_user))->>'level')::int) * 0.1), 2)
  from group_members gm where gm.group_id = p_group
$$;
revoke all on function public.underdog_mult(uuid, uuid) from public, anon, authenticated;

-- one raid attack per gym day: you need to have checked in today
create or replace function public.raid_fight(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  sa jsonb; sb jsonb; bid uuid; first text; bidx int; lv int; base numeric;
begin
  if auth.uid() is null or not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'raid' and group_id = p_group and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  if not exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'Check in at the gym today to attack the boss'; end if;
  if exists (select 1 from battles where a = auth.uid() and kind = 'raid' and group_id = p_group and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'You’ve already attacked today. Come back after your next gym day.'; end if;
  sa := public.fighter_snapshot(auth.uid());
  bidx := (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6;
  -- the raid boss is matched to you: about your own strength, with lots of HP so it lasts the 8 moves
  lv := (sa->>'level')::int;
  base := greatest((sa->>'atk')::int, (sa->>'spd')::int, (sa->>'tec')::int);
  sb := public.monster_snapshot(bidx, lv, 1, false);
  -- its defence is set against your best stat and its attack against your defence, so it's a fair fight
  -- whoever you are
  sb := sb || jsonb_build_object('raid', true, 'hp', round((sa->>'hp')::int * 8),
    'def', greatest(10, round(base) - 50),
    'atk', round(((sa->>'def')::int + 50) * 0.6), 'spd', round(((sa->>'def')::int + 50) * 0.6), 'tec', round(((sa->>'def')::int + 50) * 0.6));
  first := case when (sa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, group_id, a, week, status, turn, snap, state, log, last_move_at)
  values ('raid', p_group, auth.uid(), wk, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', sa, 'b', sb),
          public.battle_state0(sa, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

-- when a raid attack ends: what it counts for. Turning up is worth 70, fighting well up to 60 more
-- (damage measured against your own HP, so a newcomer isn't compared with a big lifter), then × the
-- underdog bonus. So one attack is about 100-130, the same as a gym day was before. Plus 10 XP.
create or replace function public.raid_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles; dealt int; m numeric; perf numeric; counts int;
begin
  select * into bt from battles where id = p_id;
  dealt := greatest(0, (bt.state->'max'->>'b')::int - (bt.state->'hp'->>'b')::int);
  perf := least(1, dealt / greatest(1, 2.0 * (bt.state->'max'->>'a')::int));
  m := public.underdog_mult(bt.group_id, bt.a);
  counts := round((70 + 60 * perf) * m);
  update battles set state = state || jsonb_build_object('dealt', dealt, 'perf', round(perf, 2), 'mult', m, 'counts', counts) where id = p_id;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'raid', 'raid:' || p_id, 10, 0, jsonb_build_object('group', bt.group_id, 'counts', counts))
  on conflict do nothing;
end $$;
revoke all on function public.raid_finish(uuid) from public, anon, authenticated;

-- the boss card: same shape as before, now with raid damage. Each member: attacks this week, damage.
create or replace function public.group_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  d date := (now() at time zone 'Europe/London')::date;
  out jsonb; hp int; dealt numeric;
begin
  if auth.uid() is not null and not public.is_member(p_group) then return null; end if;
  select sum(coalesce(p.days_per_week, 3)) * 100 into hp from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select jsonb_agg(jsonb_build_object('user_id', gm.user_id, 'name', p.display_name,
      'level', ((public.character_card(gm.user_id))->>'level')::int,
      'mult', public.underdog_mult(p_group, gm.user_id),
      'hits', (select count(*) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.group_id = p_group and b.week = wk and b.status = 'done'),
      'dmg', (select coalesce(sum((b.state->>'counts')::int), 0) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.group_id = p_group and b.week = wk and b.status = 'done'))
      order by p.display_name)
  into out from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select coalesce(sum((x->>'dmg')::numeric), 0) into dealt from jsonb_array_elements(out) x;
  select jsonb_agg(x order by (x->>'dmg')::int desc) into out from jsonb_array_elements(out) x;
  return jsonb_build_object(
    'week_start', wk, 'week_end', wk + 6,
    'boss', (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6,
    'hp', hp, 'dmg', least(dealt, hp), 'defeated', dealt >= hp,
    'claimed', exists (select 1 from rewards r where r.user_id = auth.uid() and r.ref = 'boss:' || p_group || ':' || wk),
    'can_attack', p_week is null
      and exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d)
      and not exists (select 1 from battles where a = auth.uid() and kind = 'raid' and group_id = p_group and (created_at at time zone 'Europe/London')::date = d and status = 'done'),
    'open', (select id from battles where a = auth.uid() and kind = 'raid' and group_id = p_group and status = 'active' limit 1),
    'members', coalesce(out, '[]'::jsonb));
end $$;

revoke all on function public.my_tower(), public.tower_fight(), public.raid_fight(uuid) from public, anon;
grant execute on function public.my_tower(), public.tower_fight(), public.raid_fight(uuid) to authenticated;
