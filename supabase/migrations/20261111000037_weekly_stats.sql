-- Steadier battle stats.
--   1. Fade, no cliff: training from the last 30 days counts fully, then fades to nothing by 90 days
--      (instead of everything vanishing on day 61).
--   2. Weekly: your stats are worked out once a week, from your training up to last Sunday, and stay
--      the same all week (tower, raids, matches). character_next shows what next Monday will bring.
--   3. Limited weekly change: a stat drops at most 10% a week (a bad week or a holiday costs little);
--      it rises by at most half the gap to where your training says it should be (or 10%, if more),
--      so one big session doesn't make you shoot up, but a newcomer still catches up in a few weeks.
-- Level, XP, coins and which moves you know are unchanged.
-- Applied by GitHub Actions. Safe to run more than once.

-- how much a day counts, by how many days ago it was
create or replace function public.stat_weight(p_age int) returns numeric language sql immutable as $$
  select case when p_age < 0 then 0 when p_age <= 30 then 1 when p_age >= 90 then 0 else (90 - p_age) / 60.0 end
$$;

-- stats from training up to a given day (that day included)
create or replace function public.character_raw(p_user uuid, p_as_of date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  since date := p_as_of - 89;
  days_w numeric; sets_w numeric; cardio_w numeric; boulder_w numeric; climbs_w numeric; grade_w numeric; kinds int; atk numeric;
  w numeric; c numeric; k numeric; tot numeric; type text;
begin
  select coalesce(sum(public.stat_weight(p_as_of - d)), 0) into days_w from (
    select distinct (created_at at time zone 'Europe/London')::date as d from checkins
    where user_id = p_user and (created_at at time zone 'Europe/London')::date between since and p_as_of) x;
  select coalesce(sum(public.stat_weight(p_as_of - wo.performed_on)) filter (where s.exercise_id <> 'wall_climb'), 0),
         coalesce(sum(public.stat_weight(p_as_of - wo.performed_on)) filter (where s.exercise_id = 'wall_climb'), 0),
         coalesce(max((s.weight_kg + 1) * public.stat_weight(p_as_of - wo.performed_on)) filter (where s.exercise_id = 'wall_climb'), 0),
         count(distinct s.exercise_id) filter (where wo.performed_on >= p_as_of - 59)
    into sets_w, climbs_w, grade_w, kinds
    from workouts wo join workout_sets s on s.workout_id = wo.id
    where wo.user_id = p_user and wo.performed_on between since and p_as_of and s.reps >= 1;
  select coalesce(sum(minutes * public.stat_weight(p_as_of - performed_on)) filter (where kind <> 'boulder'), 0),
         coalesce(sum(minutes * public.stat_weight(p_as_of - performed_on)) filter (where kind = 'boulder'), 0)
    into cardio_w, boulder_w from cardio_logs where user_id = p_user and performed_on between since and p_as_of;
  -- attack: your 3 best lifts as a one-rep max, older ones counting less as they fade
  select coalesce(avg(best), 0) into atk from (
    select max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end) * public.stat_weight(p_as_of - wo.performed_on)) as best
    from workouts wo join workout_sets s on s.workout_id = wo.id
    left join custom_exercises ce on ce.id = s.exercise_id
    where wo.user_id = p_user and wo.performed_on between since and p_as_of and s.reps between 1 and 30
      and s.weight_kg > 0 and s.weight_kg <= 500 and s.exercise_id <> 'wall_climb' and coalesce(ce.kind, '') <> 'timed'
    group by s.exercise_id order by best desc limit 3) b;
  w := sets_w; c := cardio_w / 5.0; k := climbs_w + boulder_w / 4.0; tot := w + c + k;
  type := case when tot < 10 then 'rookie'
               when greatest(w, c, k) < tot * 0.5 then 'balanced'
               when w >= c and w >= k then 'strength'
               when k >= c then 'climbing' else 'endurance' end;
  return jsonb_build_object('type', type, 'stats', jsonb_build_object(
    'hp', round(50 + 4 * days_w),
    'atk', round(atk),
    'def', round(20 + sets_w / 3),
    'spd', round(20 + cardio_w / 6),
    'tec', round(20 + 3 * greatest(0, kinds - (case when climbs_w > 0 then 1 else 0 end)) + 8 * grade_w + boulder_w / 8)));
end $$;
revoke all on function public.character_raw(uuid, date) from public, anon, authenticated;

create table if not exists public.character_stats_weekly (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  stats jsonb not null,
  type text not null,
  primary key (user_id, week)
);
alter table public.character_stats_weekly enable row level security;   -- read through character_card only

-- each stat moves towards the target: down by at most 10% (at least 1), up by at most half the gap
-- or 10%, whichever is more (at least 1)
create or replace function public.clamp_stats(p_prev jsonb, p_target jsonb) returns jsonb language sql immutable as $$
  select jsonb_object_agg(k, case
    when not (p_prev ? k) then t
    when t < p then greatest(t, p - greatest(1, round(p * 0.1)))
    else least(t, p + greatest(1, round(p * 0.1), ceil((t - p) * 0.5))) end)
  from (select k, (p_target->>k)::numeric as t, (p_prev->>k)::numeric as p from jsonb_object_keys(p_target) k) x
$$;

-- a week's stats: training up to the Sunday before, limited by the last stored week
create or replace function public.weekly_stats(p_user uuid, p_week date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare raw jsonb; prev jsonb; got character_stats_weekly;
begin
  select * into got from character_stats_weekly where user_id = p_user and week = p_week;
  if got.user_id is not null then return jsonb_build_object('stats', got.stats, 'type', got.type); end if;
  raw := public.character_raw(p_user, p_week - 1);
  select stats into prev from character_stats_weekly where user_id = p_user and week < p_week order by week desc limit 1;
  return jsonb_build_object('stats', case when prev is null then raw->'stats' else public.clamp_stats(prev, raw->'stats') end, 'type', raw->>'type');
end $$;
revoke all on function public.weekly_stats(uuid, date) from public, anon, authenticated;

-- Mondays: save everyone's week (the next week is limited by this one)
create or replace function public.store_weekly_stats() returns int
language plpgsql security definer set search_path = public as $$
declare wk date := date_trunc('week', now() at time zone 'Europe/London')::date; n int := 0; u uuid; s jsonb;
begin
  for u in select id from profiles loop
    if not exists (select 1 from character_stats_weekly where user_id = u and week = wk) then
      s := public.weekly_stats(u, wk);
      insert into character_stats_weekly (user_id, week, stats, type) values (u, wk, s->'stats', s->>'type') on conflict do nothing;
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.store_weekly_stats() from public, anon, authenticated;

-- the card: level, XP and coins as before; stats and type are this week's
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
    'coins', (base->>'coins')::int + lc, 'bonus_xp', lx, 'bonus_coins', lc,
    'stats', wk->'stats', 'type', wk->>'type');
end $$;

-- what next Monday will bring if you stop now: today's training, limited by this week's stats
create or replace function public.character_next(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare cur jsonb; raw jsonb;
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  cur := public.weekly_stats(p_user, date_trunc('week', now() at time zone 'Europe/London')::date);
  raw := public.character_raw(p_user, (now() at time zone 'Europe/London')::date);
  return jsonb_build_object('stats', public.clamp_stats(cur->'stats', raw->'stats'), 'type', raw->>'type',
    'next_week', date_trunc('week', now() at time zone 'Europe/London')::date + 7);
end $$;
revoke all on function public.character_next(uuid) from public, anon;
grant execute on function public.character_next(uuid) to authenticated;

-- start the chain now, and every Monday 01:30 UTC
select public.store_weekly_stats();
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    perform cron.unschedule(jobid) from cron.job where jobname = 'gob-weekly-stats';
    perform cron.schedule('gob-weekly-stats', '30 1 * * 1', 'select public.store_weekly_stats()');
  end if;
end $$;
