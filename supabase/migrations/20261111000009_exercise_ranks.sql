-- One ranking per exercise: each groupmate's heaviest set (at least 1 rep), the reps at that weight,
-- how many sets they've done of it and when they last did it. Only exercises and people with a record show up.
-- Lifts are already visible to groupmates (group_lifts); nothing new leaves the database.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.group_exercise_ranks(p_group uuid)
returns table (user_id uuid, display_name text, exercise_id text, best_kg numeric, best_reps int, sets_total int, last_on date)
language sql stable security definer set search_path = public as $$
  with m as (
    select gm.user_id, p.display_name
    from group_members gm join profiles p on p.id = gm.user_id
    where gm.group_id = p_group and public.is_member(p_group)
  ), s as (
    select w.user_id, w.performed_on, x.exercise_id, x.weight_kg, x.reps
    from workouts w join workout_sets x on x.workout_id = w.id
    where w.user_id in (select m.user_id from m) and x.reps >= 1
  ), b as (
    select s.user_id, s.exercise_id, max(s.weight_kg) as best_kg, count(*)::int as sets_total, max(s.performed_on) as last_on
    from s group by 1, 2
  )
  select b.user_id, m.display_name, b.exercise_id, b.best_kg,
    (select max(s.reps) from s where s.user_id = b.user_id and s.exercise_id = b.exercise_id and s.weight_kg = b.best_kg)::int,
    b.sets_total, b.last_on
  from b join m on m.user_id = b.user_id;
$$;
revoke execute on function public.group_exercise_ranks(uuid) from public, anon;
grant execute on function public.group_exercise_ranks(uuid) to authenticated;
