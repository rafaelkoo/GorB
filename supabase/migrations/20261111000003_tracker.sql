-- Gym tracker. Applied by GitHub Actions. Safe to run more than once.

-- One workout per person per UK day; saving again replaces that day's sets.
create unique index if not exists workouts_one_per_day on public.workouts (user_id, performed_on);

-- Every logged set of one person (yourself or a groupmate), oldest first.
create or replace function public.lift_history(p_user uuid)
returns table (performed_on date, exercise_id text, set_no int, weight_kg numeric, reps int)
language sql stable security definer set search_path = public as $$
  select w.performed_on, s.exercise_id, s.set_no, s.weight_kg, s.reps
  from workouts w join workout_sets s on s.workout_id = w.id
  where w.user_id = p_user and public.shares_group(p_user)
  order by w.performed_on, s.exercise_id, s.set_no;
$$;

-- Heaviest weight each member of a group has lifted for each exercise (at least 1 rep).
create or replace function public.group_lifts(p_group uuid, p_exercises text[])
returns table (user_id uuid, display_name text, exercise_id text, best_kg numeric, best_on date)
language sql stable security definer set search_path = public as $$
  select distinct on (m.user_id, s.exercise_id)
         m.user_id, p.display_name, s.exercise_id, s.weight_kg, w.performed_on
  from group_members m
  join profiles p on p.id = m.user_id
  join workouts w on w.user_id = m.user_id
  join workout_sets s on s.workout_id = w.id and s.reps >= 1 and s.exercise_id = any (p_exercises)
  where m.group_id = p_group and public.is_member(p_group)
  order by m.user_id, s.exercise_id, s.weight_kg desc, w.performed_on;
$$;

revoke execute on function public.lift_history(uuid), public.group_lifts(uuid, text[]) from public, anon;
grant execute on function public.lift_history(uuid), public.group_lifts(uuid, text[]) to authenticated;
