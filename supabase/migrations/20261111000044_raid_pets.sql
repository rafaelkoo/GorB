-- Pets in the weekly group boss (raids).
--   Your team comes in like in the tower: switch any time, the next one comes in when one goes down.
--   The boss gets tougher with a bigger team (same as the tower).
--   Damage that counts: (70 + 60 × how well the team did) × (1 + 10% per pet, so up to +50%) × underdog.
--     "How well" is measured against your own HP, as before (a raid is 8 moves, whoever makes them),
--     and the pet bonus multiplies it: the more you train, the more your pets add.
--   No bag in raids (drinks can be bought with coins). Pets get XP from raids too.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.raid_fight(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  sa jsonb; sb jsonb; bid uuid; first text; bidx int; base numeric; party jsonb;
begin
  if auth.uid() is null or not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  if not exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'Check in at the gym today to attack the boss'; end if;
  if exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'You’ve already attacked today (it counts in all your groups). Come back after your next gym day.'; end if;
  party := public.party_snapshot(auth.uid()); sa := party->0;
  bidx := (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6;
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
  update battles set state = state || jsonb_build_object('dealt', dealt, 'perf', round(perf, 2), 'mult', m, 'pets', pets, 'team_bonus', bonus, 'counts', counts) where id = p_id;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'raid', 'raid:' || p_id, 10, 0, jsonb_build_object('group', bt.group_id, 'counts', counts))
  on conflict do nothing;
end $$;
revoke all on function public.raid_finish(uuid) from public, anon, authenticated;

create or replace function public.pet_fight_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt int;
begin
  if new.kind not in ('tower', 'lair', 'raid') or old.status <> 'active' or new.status <> 'done' or new.snap->'party' is null then return new; end if;
  if (new.log->-1->>'t') = 'flee' then return new; end if;
  amt := case when new.winner_side = 'a' then 20 else 5 end;
  update pets set xp = least(xp + amt, public.pet_level_xp(10))
  where user_id = new.a and id in (select (x->>'pet')::uuid from jsonb_array_elements(new.snap->'party') x where x ? 'pet');
  new.state := new.state || jsonb_build_object('pet_xp', amt);
  return new;
end $$;
