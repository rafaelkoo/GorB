-- Weekly group boss (co-op). Every Monday (London time) a new boss turns up for each group.
--   HP     = 100 × each member's days-per-week target (3 if they haven't set one), added up
--   Damage = (100 per gym day this week + 2 per set, up to 80 sets) × underdog bonus
--   Underdog bonus: +10% for every level below the group's average, up to +50%, so the people who
--   are behind matter just as much.
-- Beat it by Sunday night and everyone in the group can claim the loot once (60 coins + 80 XP),
-- this week or the week after. Applied by GitHub Actions. Safe to run more than once.

create or replace function public.group_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  nx date := wk + 7; out jsonb; hp int; dealt numeric; avg_lvl numeric;
begin
  if auth.uid() is not null and not public.is_member(p_group) then return null; end if;
  with m as (
    select gm.user_id, p.display_name, coalesce(p.days_per_week, 3) as target,
      ((public.character_card(gm.user_id))->>'level')::int as level
    from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group
  ), act as (
    select m.*,
      (select count(distinct (c.created_at at time zone 'Europe/London')::date) from checkins c
        where c.user_id = m.user_id and (c.created_at at time zone 'Europe/London')::date >= wk and (c.created_at at time zone 'Europe/London')::date < nx) as days,
      (select count(*) from workouts w join workout_sets s on s.workout_id = w.id
        where w.user_id = m.user_id and w.performed_on >= wk and w.performed_on < nx and s.reps >= 1) as sets
    from m
  ), lv as (select avg(level) as a from m)
  select sum(target) * 100, (select a from lv),
    jsonb_agg(jsonb_build_object('user_id', user_id, 'name', display_name, 'level', level, 'days', days, 'sets', sets,
      'mult', round(1 + least(0.5, greatest(0, (select a from lv) - level) * 0.1), 2),
      'dmg', round((days * 100 + least(sets, 80) * 2) * (1 + least(0.5, greatest(0, (select a from lv) - level) * 0.1))))
      order by days desc, display_name)
  into hp, avg_lvl, out from act;
  select coalesce(sum((x->>'dmg')::numeric), 0) into dealt from jsonb_array_elements(out) x;
  return jsonb_build_object(
    'week_start', wk, 'week_end', nx - 1,
    'boss', (extract(week from wk)::int + abs(hashtext(p_group::text))) % 6,
    'hp', hp, 'dmg', least(dealt, hp), 'defeated', dealt >= hp,
    'claimed', exists (select 1 from rewards r where r.user_id = auth.uid() and r.ref = 'boss:' || p_group || ':' || wk),
    'members', coalesce(out, '[]'::jsonb));
end $$;
revoke all on function public.group_boss(uuid, date) from public, anon;
grant execute on function public.group_boss(uuid, date) to authenticated;

-- claim the loot for a beaten boss (this week or last); returns the reward, or null
create or replace function public.claim_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  b jsonb;
begin
  if auth.uid() is null or not public.is_member(p_group) then return null; end if;
  if wk < date_trunc('week', now() at time zone 'Europe/London')::date - 7 then return null; end if;   -- only this week or last
  b := public.group_boss(p_group, wk);
  if not coalesce((b->>'defeated')::boolean, false) then return null; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (auth.uid(), 'boss', 'boss:' || p_group || ':' || wk, 80, 60, jsonb_build_object('group', p_group, 'week', wk, 'boss', b->'boss'))
  on conflict do nothing;
  if not found then return null; end if;
  return jsonb_build_object('xp', 80, 'coins', 60, 'boss', b->'boss', 'week', wk);
end $$;
revoke all on function public.claim_boss(uuid, date) from public, anon;
grant execute on function public.claim_boss(uuid, date) to authenticated;
