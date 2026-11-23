-- Bouldering as minutes. The cardio card gets "Bouldering": minutes logged there count as climbing,
-- not cardio: they don't raise Speed or make you Endurance type; they add to Technique (1 per 8 min),
-- count towards the Climbing type (4 min ≈ 1 climb) and towards the climb-count moves (Boulder Chain,
-- Climbing Stamina). Grade moves (V1, V3…) still need climbs logged with their V grade.
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

create or replace function public.character_moves(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Europe/London')::date - 59;
  boulder_climbs int; lifts jsonb; mx numeric; sets60 int; cardio60 int; grade int; climbs60 int; days60 int; learned text[]; eq text[];
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  select coalesce(jsonb_object_agg(cat, round(best)), '{}'::jsonb), coalesce(max(best), 0) into lifts, mx from (
    select coalesce(ec.cat, ce.cat, 'other') as cat, max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as best
    from workouts w join workout_sets s on s.workout_id = w.id
    left join exercise_cat ec on ec.id = s.exercise_id
    left join custom_exercises ce on ce.id = s.exercise_id
    where w.user_id = p_user and w.performed_on >= since and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500
      and s.exercise_id <> 'wall_climb' and coalesce(ce.kind, '') <> 'timed'
    group by 1) b;
  select count(*) into sets60 from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = p_user and w.performed_on >= since and s.reps >= 1;
  select coalesce(sum(minutes) filter (where kind <> 'boulder'), 0), coalesce(sum(minutes) filter (where kind = 'boulder'), 0) / 4
    into cardio60, boulder_climbs from cardio_logs where user_id = p_user and performed_on >= since;
  select coalesce(max(s.weight_kg), -1), count(*) into grade, climbs60 from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = p_user and w.performed_on >= since and s.exercise_id = 'wall_climb' and s.reps >= 1;
  climbs60 := climbs60 + boulder_climbs;   -- bouldering minutes: 4 min ≈ 1 climb
  select count(distinct (created_at at time zone 'Europe/London')::date) into days60 from checkins where user_id = p_user and (created_at at time zone 'Europe/London')::date >= since;

  select coalesce(array_agg(id order by sort), '{}') into learned from moves m where
    case m.req_kind
      when 'always' then true
      when 'lift' then coalesce((lifts->>m.req_cat)::numeric, 0) >= m.req_val
      when 'maxlift' then mx >= m.req_val
      when 'sets' then sets60 >= m.req_val
      when 'cardio' then cardio60 >= m.req_val
      when 'climb' then grade >= m.req_val
      when 'climbs' then climbs60 >= m.req_val
      else false
    end;
  -- fusions: all their parts learned
  learned := learned || coalesce((select array_agg(id order by sort) from moves where req_kind = 'fusion' and req_moves <@ learned), '{}');
  select array(select x from unnest(coalesce(p.battle_moves, '{}')) x where x = any(learned) limit 4) into eq from profiles p where p.id = p_user;
  if coalesce(array_length(eq, 1), 0) < 4 then
    eq := eq || array(select id from moves where id = any(learned) and not id = any(eq)
      order by (case when effect like 'buff%' or effect like 'heal%' then 1 else 0 end), power desc limit 4 - coalesce(array_length(eq, 1), 0));
  end if;
  return jsonb_build_object(
    'basis', jsonb_build_object('lifts', lifts, 'max', round(mx), 'sets', sets60, 'cardio', cardio60, 'grade', grade, 'climbs', climbs60, 'days', days60),
    'learned', to_jsonb(learned), 'equipped', to_jsonb(eq), 'grit', days60 >= 12);
end $$;

