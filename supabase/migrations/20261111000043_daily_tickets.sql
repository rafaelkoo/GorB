-- Free tower tickets: 3 every day (London time), on top of the 3 your first check-in of the day gives.
-- Still capped at 9. Given the first time you open the tower or the Boss Lair that day.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.profiles add column if not exists tickets_free_day date;

create or replace function public.daily_tickets(p_user uuid) returns void
language sql security definer set search_path = public as $$
  update profiles set tickets = least(9, tickets + 3), tickets_free_day = (now() at time zone 'Europe/London')::date
  where id = p_user and tickets_free_day is distinct from (now() at time zone 'Europe/London')::date
$$;
revoke all on function public.daily_tickets(uuid) from public, anon, authenticated;

create or replace function public.my_tower() returns jsonb
language plpgsql security definer set search_path = public as $$
declare p profiles; nxt int;
begin
  if auth.uid() is null then return null; end if;
  perform public.daily_tickets(auth.uid());
  select * into p from profiles where id = auth.uid();
  nxt := p.tower_floor + 1;
  return jsonb_build_object('tickets', p.tickets, 'cleared', p.tower_floor, 'next', nxt,
    'monster', public.tower_monster_idx(nxt), 'elite', nxt % 5 = 0, 'boss', nxt % 5 = 0,
    'reward', jsonb_build_object('xp', 20 + 4 * nxt + (case when nxt % 5 = 0 then 30 else 0 end), 'coins', 5 + nxt + (case when nxt % 5 = 0 then 15 else 0 end)),
    'open', (select id from battles where a = auth.uid() and kind = 'tower' and status = 'active' order by created_at desc limit 1),
    'best', (select coalesce(jsonb_agg(jsonb_build_object('name', pr.display_name, 'floor', pr.tower_floor) order by pr.tower_floor desc), '[]'::jsonb)
             from profiles pr where pr.tower_floor > 0 and (pr.id = auth.uid() or public.shares_group(pr.id))));
end $$;

create or replace function public.lair_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null then return null; end if;
  perform public.daily_tickets(auth.uid());
  return jsonb_build_object(
    'free', not exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d),
    'tickets', (select tickets from profiles where id = auth.uid()), 'coins', public.coins_of(auth.uid()), 'price', 40,
    'floor', (select tower_floor from profiles where id = auth.uid()),
    'open', (select id from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1),
    'bosses', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type, 'unlocked', public.lair_unlocked(auth.uid(), m.idx),
                 'floor', 5 * (m.idx - 11), 'caught', (select count(*) from pets where user_id = auth.uid() and species = m.idx)) order by m.idx) from monsters m where m.boss));
end $$;

create or replace function public.tower_fight() returns uuid
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
  party := public.party_snapshot(auth.uid());
  sb := public.scale_for_party(public.tower_snapshot(f), jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  update profiles set tickets = tickets - 1 where id = auth.uid();
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('tower', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

create or replace function public.lair_fight(p_species int, p_pay text) returns uuid
language plpgsql security definer set search_path = public as $$
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
  party := public.party_snapshot(auth.uid()); o := party->0;
  -- the boss is matched to you: your own stats × its species, a bit stronger, with lots of HP
  -- (its attacking stats are scaled so its strongest one is 65% of yours; Phoenix is fast, Dragon strong, but none outclasses you)
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.65
        / greatest((sp.ratios->>'atk')::numeric, (sp.ratios->>'spd')::numeric, (sp.ratios->>'tec')::numeric);
  sb := public.monster_snapshot(sp.idx, (o->>'level')::int + 2, 1, false) || jsonb_build_object('boss_pet', true,
    'hp',  round((o->>'hp')::numeric  * (sp.ratios->>'hp')::numeric * 1.1),
    'def', round((o->>'def')::numeric * (sp.ratios->>'def')::numeric * 0.85),
    'atk', round(best * (sp.ratios->>'atk')::numeric), 'spd', round(best * (sp.ratios->>'spd')::numeric), 'tec', round(best * (sp.ratios->>'tec')::numeric));
  sb := public.scale_for_party(sb, jsonb_array_length(party));
  first := case when (o->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, species, pay, status, turn, snap, state, log, last_move_at)
  values ('lair', auth.uid(), sp.idx, p_pay, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', o, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;
