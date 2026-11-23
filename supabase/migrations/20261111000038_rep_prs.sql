-- Rep PRs give XP too, so a plateau still feels like progress: from 24 Nov 2026, a session where
-- your best estimated one-rep max for an exercise beats every earlier session, without a heavier
-- weight than before (that's already a +25 PB), gives +15 XP. Nothing before that date changes.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.character_card_base(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/London')::date;
  since date := today - 59;
  days60 int; sets60 int; cardio60 int; boulder60 int; climbs60 int; kinds60 int; grade60 int; atk numeric;
  days_all int; xp bigint; lvl int := 1; need int; left_xp bigint; type text; w numeric; c numeric; k numeric; tot numeric;
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;

  -- last 60 days
  select count(distinct (ch.created_at at time zone 'Europe/London')::date) into days60
    from checkins ch where ch.user_id = p_user and (ch.created_at at time zone 'Europe/London')::date >= since;
  select count(*) filter (where s.exercise_id <> 'wall_climb'),
         count(*) filter (where s.exercise_id = 'wall_climb'),
         count(distinct s.exercise_id),
         coalesce(max(s.weight_kg) filter (where s.exercise_id = 'wall_climb'), -1)
    into sets60, climbs60, kinds60, grade60
    from workouts wo join workout_sets s on s.workout_id = wo.id
    where wo.user_id = p_user and wo.performed_on >= since and s.reps >= 1;
  -- bouldering logged as minutes (cardio card) counts as climbing, not cardio
  select coalesce(sum(minutes) filter (where kind <> 'boulder'), 0), coalesce(sum(minutes) filter (where kind = 'boulder'), 0)
    into cardio60, boulder60 from cardio_logs where user_id = p_user and performed_on >= since;
  -- attack: average of the 3 best lifts as a one-rep max (not climbing, not timed holds, sensible reps and weights)
  select coalesce(avg(best), 0) into atk from (
    select max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as best
    from workouts wo join workout_sets s on s.workout_id = wo.id
    left join custom_exercises ce on ce.id = s.exercise_id
    where wo.user_id = p_user and wo.performed_on >= since and s.reps between 1 and 30
      and s.weight_kg > 0 and s.weight_kg <= 500 and s.exercise_id <> 'wall_climb' and coalesce(ce.kind, '') <> 'timed'
    group by s.exercise_id order by best desc limit 3) b;

  -- type: weights sets vs cardio (5 min ≈ 1 set) vs climbs
  w := sets60; c := cardio60 / 5.0; k := climbs60 + boulder60 / 4.0; tot := w + c + k;   -- 4 bouldering minutes ≈ 1 climb
  type := case when tot < 10 then 'rookie'
               when greatest(w, c, k) < tot * 0.5 then 'balanced'
               when w >= c and w >= k then 'strength'
               when k >= c then 'climbing' else 'endurance' end;

  -- all-time XP
  select count(distinct (ch.created_at at time zone 'Europe/London')::date) into days_all from checkins ch where ch.user_id = p_user;
  select days_all * 20
    + coalesce((select sum(least(n, 30)) * 2 from (select count(*) n from workouts wo join workout_sets s on s.workout_id = wo.id
        where wo.user_id = p_user and s.reps >= 1 and s.exercise_id <> 'wall_climb' group by wo.performed_on) a), 0)
    + coalesce((select sum(least(m, 120)) / 2 from (select sum(minutes) m from cardio_logs where user_id = p_user group by performed_on) b), 0)
    + coalesce((select sum(least(n, 30)) * 3 from (select count(*) n from workouts wo join workout_sets s on s.workout_id = wo.id
        where wo.user_id = p_user and s.reps >= 1 and s.exercise_id = 'wall_climb' group by wo.performed_on) d), 0)
    + coalesce((select count(*) * 25 from (
        select t.top > max(t.top) over (partition by t.exercise_id order by t.day rows between unbounded preceding and 1 preceding) as pr
        from (select s.exercise_id, wo.performed_on as day, max(s.weight_kg) as top from workouts wo join workout_sets s on s.workout_id = wo.id
              where wo.user_id = p_user and s.reps >= 1 and s.weight_kg <= 500 group by 1, 2) t) p where p.pr), 0)
    -- rep PRs (from 24 Nov 2026): a better estimated one-rep max without a heavier weight, +15
    + coalesce((select count(*) * 15 from (
        select t.day, t.e1 > max(t.e1) over w as better, t.top > coalesce(max(t.top) over w, 0) as heavier, count(*) over w as before_n
        from (select s.exercise_id, wo.performed_on as day, max(s.weight_kg) as top,
                     max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as e1
              from workouts wo join workout_sets s on s.workout_id = wo.id
              where wo.user_id = p_user and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500 and s.exercise_id <> 'wall_climb'
              group by 1, 2) t
        window w as (partition by t.exercise_id order by t.day rows between unbounded preceding and 1 preceding)) q
      where q.day >= date '2026-11-24' and q.better and not q.heavier and q.before_n > 0), 0)
    into xp;
  left_xp := xp; need := 100;
  while left_xp >= need loop left_xp := left_xp - need; lvl := lvl + 1; need := 100 + 40 * (lvl - 1); end loop;

  return jsonb_build_object(
    'user_id', p_user, 'level', lvl, 'xp', xp, 'xp_in_level', left_xp, 'xp_for_next', need, 'type', type,
    'coins', days_all * 10,
    'stats', jsonb_build_object(
      'hp', 50 + 4 * days60,
      'atk', round(atk),
      'def', 20 + sets60 / 3,
      'spd', 20 + cardio60 / 6,
      -- 3 per different exercise (climbing not counted twice) + 8 per V grade (V0 = 8) of the hardest topped climb
      'tec', 20 + 3 * (kinds60 - (case when climbs60 > 0 then 1 else 0 end)) + (case when grade60 >= 0 then 8 * (grade60 + 1) else 0 end) + boulder60 / 8),
    'basis', jsonb_build_object('days60', days60, 'sets60', sets60, 'cardio60', cardio60, 'boulder60', boulder60, 'climbs60', climbs60, 'kinds60', kinds60, 'best_grade', grade60, 'days_all', days_all));
end $$;
revoke all on function public.character_card_base(uuid) from public, anon, authenticated;
