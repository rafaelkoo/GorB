-- Your team, in the order you choose, and you're always in it. You can be first, last or anywhere
-- between your pets (profiles.team_me_pos, 0–5); whoever is first starts the fight.
-- Bosses in the lair and the group boss are still matched to YOU, wherever you stand in the line.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.profiles add column if not exists team_me_pos int not null default 0 check (team_me_pos between 0 and 5);

-- you within a team (the one that isn't a pet)
create or replace function public.party_me(p_party jsonb) returns jsonb language sql immutable as $$
  select x from jsonb_array_elements(p_party) x where not x ? 'pet' limit 1
$$;

create or replace function public.party_snapshot(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb; pets_ jsonb; pos int;
begin
  me := public.fighter_snapshot(p_user);
  pets_ := coalesce((select jsonb_agg(public.pet_snapshot(id, me) order by slot) from pets where user_id = p_user and slot is not null), '[]'::jsonb);
  pos := least(coalesce((select team_me_pos from profiles where id = p_user), 0), jsonb_array_length(pets_));
  return coalesce((select jsonb_agg(x order by i) from jsonb_array_elements(pets_) with ordinality p(x, i) where i <= pos), '[]'::jsonb)
    || jsonb_build_array(me)
    || coalesce((select jsonb_agg(x order by i) from jsonb_array_elements(pets_) with ordinality p(x, i) where i > pos), '[]'::jsonb);
end $$;
revoke all on function public.party_snapshot(uuid) from public, anon, authenticated;

-- the team in order: your pets (up to 5) and where you stand among them
drop function if exists public.set_team(uuid[]);
create or replace function public.set_team(p_pets uuid[], p_me_pos int default 0) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(p_pets, 1), 0) > 5 then raise exception 'Up to 5 pets in your team'; end if;
  if exists (select 1 from unnest(p_pets) x where not exists (select 1 from pets where id = x and user_id = auth.uid())) then raise exception 'Not your pet'; end if;
  update pets set slot = null where user_id = auth.uid();
  update pets p set slot = x.i from unnest(p_pets) with ordinality x(id, i) where p.id = x.id and p.user_id = auth.uid();
  update profiles set team_me_pos = greatest(0, least(coalesce(p_me_pos, 0), coalesce(array_length(p_pets, 1), 0))) where id = auth.uid();
end $$;
revoke all on function public.set_team(uuid[], int) from public, anon;
grant execute on function public.set_team(uuid[], int) to authenticated;

CREATE OR REPLACE FUNCTION public.lair_fight(p_species integer, p_pay text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare d date := (now() at time zone 'Europe/London')::date; sp monsters; party jsonb; o jsonb; sb jsonb; bid uuid; first text; best numeric;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform public.daily_tickets(auth.uid());
  select id into bid from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  select * into sp from monsters where idx = p_species and boss;
  if sp.idx is null then raise exception 'No such boss'; end if;
  if not public.lair_unlocked(auth.uid(), sp.idx) then raise exception 'Beat it on tower floor % first', 5 * (sp.idx - 11); end if;
  if p_pay = 'free' then
    if exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d) then
      raise exception 'Today’s free try is used. Use a ticket or 40 coins.'; end if;
  elsif p_pay = 'ticket' then
    update profiles set tickets = tickets - 1 where id = auth.uid() and tickets > 0;
    if not found then raise exception 'No tickets left'; end if;
  elsif p_pay = 'coins' then
    if not public.spend_coins(auth.uid(), 40, 'lair') then raise exception 'Not enough coins'; end if;
  else raise exception 'Pay with free, ticket or coins'; end if;
  party := public.party_snapshot(auth.uid()); o := public.party_me(party);   -- the boss is matched to YOU, whoever goes first
  -- the boss is matched to you: your own stats × its species, a bit stronger, with lots of HP
  -- (its attacking stats are scaled so its strongest one is 65% of yours; Phoenix is fast, Dragon strong, but none outclasses you)
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.65
        / greatest((sp.ratios->>'atk')::numeric, (sp.ratios->>'spd')::numeric, (sp.ratios->>'tec')::numeric);
  sb := public.monster_snapshot(sp.idx, (o->>'level')::int + 2, 1, false) || jsonb_build_object('boss_pet', true,
    'hp',  round((o->>'hp')::numeric  * (sp.ratios->>'hp')::numeric * 1.1),
    'def', round((o->>'def')::numeric * (sp.ratios->>'def')::numeric * 0.85),
    'atk', round(best * (sp.ratios->>'atk')::numeric), 'spd', round(best * (sp.ratios->>'spd')::numeric), 'tec', round(best * (sp.ratios->>'tec')::numeric));
  sb := public.scale_for_party(sb, jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, species, pay, status, turn, snap, state, log, last_move_at)
  values ('lair', auth.uid(), sp.idx, p_pay, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

CREATE OR REPLACE FUNCTION public.raid_fight(p_group uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
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
  party := public.party_snapshot(auth.uid()); sa := public.party_me(party);
  bidx := public.raid_boss_idx(p_group, wk);
  base := greatest((sa->>'atk')::int, (sa->>'spd')::int, (sa->>'tec')::int);
  sb := public.monster_snapshot(bidx, (sa->>'level')::int, 1, false);
  sb := sb || jsonb_build_object('raid', true, 'hp', round((sa->>'hp')::int * 8),
    'def', greatest(10, round(base) - 50),
    'atk', round(((sa->>'def')::int + 50) * 0.6), 'spd', round(((sa->>'def')::int + 50) * 0.6), 'tec', round(((sa->>'def')::int + 50) * 0.6));
  sb := public.scale_for_party(sb, jsonb_array_length(party));   -- a tougher boss for a bigger team
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, group_id, a, week, status, turn, snap, state, log, last_move_at)
  values ('raid', p_group, auth.uid(), wk, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

CREATE OR REPLACE FUNCTION public.raid_finish(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare bt battles; dealt int; m numeric; perf numeric; counts int; team_hp int; pets int; bonus numeric;
begin
  select * into bt from battles where id = p_id;
  dealt := greatest(0, (bt.state->'max'->>'b')::int - (bt.state->'hp'->>'b')::int);
  -- measured against YOUR HP (a raid is 8 moves whoever makes them), so stronger trainers score more
  team_hp := coalesce((public.party_me(bt.snap->'party')->>'hp')::int, (bt.state->'max'->>'a')::int);
  pets := greatest(0, coalesce(jsonb_array_length(bt.snap->'party'), 1) - 1);
  -- +10% a pet, +15% for an evolved one
  bonus := 1 + 0.1 * pets + 0.05 * (select count(*) from jsonb_array_elements(bt.snap->'party') x where (x->>'evolved')::boolean);
  perf := least(1, dealt / greatest(1, 2.0 * team_hp));
  m := public.underdog_mult(bt.group_id, bt.a);
  counts := round((70 + 60 * perf) * bonus * m);
  update battles set state = state || jsonb_build_object('dealt', dealt, 'perf', round(perf, 2), 'mult', m, 'pets', pets, 'team_bonus', bonus, 'evolved_pets', (select count(*) from jsonb_array_elements(bt.snap->'party') x where (x->>'evolved')::boolean), 'counts', counts, 'coins', 5 + counts / 20) where id = p_id;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'raid', 'raid:' || p_id, 10, 5 + counts / 20, jsonb_build_object('group', bt.group_id, 'counts', counts))
  on conflict do nothing;
end $$;
revoke all on function public.raid_finish(uuid) from public, anon, authenticated;

-- where you stand in your team, for others to see too
create or replace function public.user_team_order(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when p_user = auth.uid() or public.shares_group(p_user) then team_me_pos end from profiles where id = p_user
$$;
revoke all on function public.user_team_order(uuid) from public, anon;
grant execute on function public.user_team_order(uuid) to authenticated;
