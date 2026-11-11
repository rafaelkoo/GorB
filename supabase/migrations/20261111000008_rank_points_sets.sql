-- Rankings: add sets this month and points (this month + all time), same rules as the app's points:
-- set 5 · workout day 15 · PR 25 (heavier than every earlier day on that exercise) · habit 5 · check-in day 10.
-- Only totals leave the database; which habits someone ticked stays private.
-- Applied by GitHub Actions. Safe to run more than once.

drop function if exists public.group_rankings(uuid);
create function public.group_rankings(p_group uuid)
returns table (
  user_id uuid, display_name text, days_month int, workouts_month int, volume_month numeric,
  bench numeric, deadlift numeric, squat numeric, ohp numeric, days_target int, weight_change_kg numeric,
  sets_month int, points_month int, points_total int
)
language sql stable security definer set search_path = public as $$
  with m as (
    select gm.user_id, p.display_name, p.days_per_week
    from group_members gm join profiles p on p.id = gm.user_id
    where gm.group_id = p_group and public.is_member(p_group)
  ), d as (select date_trunc('month', now() at time zone 'Europe/London')::date as start),
  sets as (
    select w.user_id, w.performed_on as day, s.exercise_id, s.weight_kg, s.reps
    from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id in (select m.user_id from m)
  ),
  tops as (
    select x.user_id, x.exercise_id, x.day, max(x.weight_kg) as top from sets x where x.reps >= 1 group by 1, 2, 3
  ),
  prs as (
    select t.user_id, t.day,
      t.top > max(t.top) over (partition by t.user_id, t.exercise_id order by t.day rows between unbounded preceding and 1 preceding) as is_pr
    from tops t
  ),
  pts as (
    select x.user_id, x.day, 5 * count(*) filter (where x.reps >= 1) + 15 as p from sets x group by 1, 2
    union all select r.user_id, r.day, 25 from prs r where r.is_pr
    union all select h.user_id, h.day, 5 from habit_ticks h where h.user_id in (select m.user_id from m)
    union all select c.user_id, c.day, 10 from (
      select distinct ch.user_id, (ch.created_at at time zone 'Europe/London')::date as day
      from checkins ch where ch.user_id in (select m.user_id from m)) c
  )
  select m.user_id, m.display_name,
    (select count(distinct (c.created_at at time zone 'Europe/London')::date) from checkins c, d
      where c.user_id = m.user_id and (c.created_at at time zone 'Europe/London')::date >= d.start)::int,
    (select count(*) from workouts w, d where w.user_id = m.user_id and w.performed_on >= d.start)::int,
    (select coalesce(sum(x.weight_kg * x.reps), 0) from sets x, d where x.user_id = m.user_id and x.day >= d.start),
    (select max(x.weight_kg) from sets x where x.user_id = m.user_id and x.exercise_id = 'bench_press' and x.reps >= 1),
    (select max(x.weight_kg) from sets x where x.user_id = m.user_id and x.exercise_id = 'deadlift' and x.reps >= 1),
    (select max(x.weight_kg) from sets x where x.user_id = m.user_id and x.exercise_id = 'squat' and x.reps >= 1),
    (select max(x.weight_kg) from sets x where x.user_id = m.user_id and x.exercise_id = 'ohp' and x.reps >= 1),
    m.days_per_week,
    case when public.shares_body(m.user_id) then
      (select weight_kg from body_weights where body_weights.user_id = m.user_id order by logged_on desc limit 1)
      - (select weight_kg from body_weights where body_weights.user_id = m.user_id order by logged_on asc limit 1)
    end,
    (select count(*) from sets x, d where x.user_id = m.user_id and x.reps >= 1 and x.day >= d.start)::int,
    (select coalesce(sum(p.p), 0) from pts p, d where p.user_id = m.user_id and p.day >= d.start)::int,
    (select coalesce(sum(p.p), 0) from pts p where p.user_id = m.user_id)::int
  from m;
$$;
revoke execute on function public.group_rankings(uuid) from public, anon;
grant execute on function public.group_rankings(uuid) to authenticated;
