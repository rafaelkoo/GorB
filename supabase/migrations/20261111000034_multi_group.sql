-- People in more than one group.
--
-- 1. Per-group captions. A check-in is still one photo that every one of your groups sees (it's the
--    proof you went, and it counts in every group), but you can give a group its own caption, so a
--    message aimed at someone in one group doesn't confuse the others. Captions can be changed later.
--    A group only ever sees its own caption (or your default one); other groups' captions stay hidden.
-- 2. Weekly boss: one raid attack per gym day in total (not per group); it counts towards the boss in
--    every group you're in (with that group's underdog bonus). Loot: once per person per week, from
--    whichever of your groups beats its boss first.
-- 3. Friendly matches: one open match per pair of people, even if you share several groups.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.checkin_captions (
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  note text not null default '' check (char_length(note) <= 140),
  primary key (checkin_id, group_id)
);
alter table public.checkin_captions enable row level security;
drop policy if exists "group sees its captions" on public.checkin_captions;
create policy "group sees its captions" on public.checkin_captions for select to authenticated using (public.is_member(group_id));
grant select on public.checkin_captions to authenticated;

-- post a check-in with any per-group captions in one go (so the push already knows them)
create or replace function public.post_checkin(p_path text, p_note text, p_captions jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; k text; v text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  insert into checkins (user_id, photo_path, note) values (auth.uid(), p_path, nullif(btrim(coalesce(p_note, '')), '')) returning id into cid;
  for k, v in select key, value from jsonb_each_text(coalesce(p_captions, '{}'::jsonb)) loop
    if public.is_member(k::uuid) and btrim(v) is distinct from btrim(coalesce(p_note, '')) then
      insert into checkin_captions (checkin_id, group_id, note) values (cid, k::uuid, left(btrim(v), 140))
      on conflict (checkin_id, group_id) do update set note = excluded.note;
    end if;
  end loop;
  return cid;
end $$;

-- change a caption afterwards, for one group (it gets its own caption from then on)
create or replace function public.set_caption(p_checkin uuid, p_group uuid, p_note text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from checkins where id = p_checkin and user_id = auth.uid()) then raise exception 'Not your check-in'; end if;
  if not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  insert into checkin_captions (checkin_id, group_id, note) values (p_checkin, p_group, left(btrim(coalesce(p_note, '')), 140))
  on conflict (checkin_id, group_id) do update set note = excluded.note;
end $$;
revoke all on function public.post_checkin(text, text, jsonb), public.set_caption(uuid, uuid, text) from public, anon;
grant execute on function public.post_checkin(text, text, jsonb), public.set_caption(uuid, uuid, text) to authenticated;

-- the default caption isn't shown to a group that has its own; read captions through this instead of
-- checkins.note when you need to respect that (the feed does it in the app)

-- ---------- boss: one attack a day in total, counted in every group ----------
create or replace function public.raid_fight(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  sa jsonb; sb jsonb; bid uuid; first text; bidx int; base numeric;
begin
  if auth.uid() is null or not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  if not exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'Check in at the gym today to attack the boss'; end if;
  if exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'You’ve already attacked today (it counts in all your groups). Come back after your next gym day.'; end if;
  sa := public.fighter_snapshot(auth.uid());
  bidx := (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6;
  base := greatest((sa->>'atk')::int, (sa->>'spd')::int, (sa->>'tec')::int);
  sb := public.monster_snapshot(bidx, (sa->>'level')::int, 1, false);
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

-- what one finished raid attack counts for in a given group (that group's underdog bonus)
create or replace function public.raid_counts(p_state jsonb, p_group uuid, p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select round((70 + 60 * coalesce((p_state->>'perf')::numeric, 0)) * public.underdog_mult(p_group, p_user))::int
$$;
revoke all on function public.raid_counts(jsonb, uuid, uuid) from public, anon, authenticated;

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
      'hits', (select count(*) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'),
      'dmg', (select coalesce(sum(public.raid_counts(b.state, p_group, gm.user_id)), 0) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'))
      order by p.display_name)
  into out from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select coalesce(sum((x->>'dmg')::numeric), 0) into dealt from jsonb_array_elements(out) x;
  select jsonb_agg(x order by (x->>'dmg')::int desc) into out from jsonb_array_elements(out) x;
  return jsonb_build_object(
    'week_start', wk, 'week_end', wk + 6,
    'boss', (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6,
    'hp', hp, 'dmg', least(dealt, hp), 'defeated', dealt >= hp,
    'claimed', exists (select 1 from rewards r where r.user_id = auth.uid() and r.ref = 'boss:' || p_group || ':' || wk),
    'loot_elsewhere', exists (select 1 from rewards r where r.user_id = auth.uid() and r.kind = 'boss' and r.meta->>'week' = wk::text and r.ref <> 'boss:' || p_group || ':' || wk),
    'can_attack', p_week is null
      and exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d)
      and not exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d),
    'open', (select id from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1),
    'members', coalesce(out, '[]'::jsonb));
end $$;

-- loot: once per person per week, whichever of your groups beats its boss first
create or replace function public.claim_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  b jsonb;
begin
  if auth.uid() is null or not public.is_member(p_group) then return null; end if;
  if wk < date_trunc('week', now() at time zone 'Europe/London')::date - 7 then return null; end if;
  perform pg_advisory_xact_lock(hashtext('boss-loot:' || auth.uid() || ':' || wk));
  if exists (select 1 from rewards r where r.user_id = auth.uid() and r.kind = 'boss' and r.meta->>'week' = wk::text) then return null; end if;
  b := public.group_boss(p_group, wk);
  if not coalesce((b->>'defeated')::boolean, false) then return null; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (auth.uid(), 'boss', 'boss:' || p_group || ':' || wk, 80, 60, jsonb_build_object('group', p_group, 'week', wk, 'boss', b->'boss'))
  on conflict do nothing;
  if not found then return null; end if;
  return jsonb_build_object('xp', 80, 'coins', 60, 'boss', b->'boss', 'week', wk);
end $$;

-- ---------- friendly matches: one open match per pair ----------
create or replace function public.challenge(p_opp uuid, p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null or p_opp = auth.uid() then raise exception 'You can’t battle yourself'; end if;
  if not (public.is_member(p_group) and exists (select 1 from group_members where group_id = p_group and user_id = p_opp)) then raise exception 'Not in this group'; end if;
  if exists (select 1 from battles where kind = 'pvp' and status in ('pending', 'active')
             and ((a = auth.uid() and b = p_opp) or (a = p_opp and b = auth.uid()))) then raise exception 'You already have a match going with them'; end if;
  insert into battles (group_id, a, b) values (p_group, auth.uid(), p_opp) returning id into bid;
  return bid;
end $$;
