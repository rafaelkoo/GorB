-- Weekly tidy-up of people's own exercises (done by Rafael in the Supabase dashboard).
-- 1. custom_exercise_report: a view for the weekly tidy-up in the Supabase dashboard (Table Editor).
--    Not reachable from the app.
-- 2. merge_custom_exercise(from, into): moves every record of one added exercise onto another and
--    deletes the first. Dashboard / migrations only.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace view public.custom_exercise_report as
  select ce.id, ce.name, ce.kind, ce.cat, p.display_name as added_by, ce.created_at::date as added_on,
    (select count(distinct w.user_id) from workout_sets s join workouts w on w.id = s.workout_id where s.exercise_id = ce.id)
      + (select count(distinct c.user_id) from cardio_logs c where c.kind = ce.id) as people_using,
    (select count(*) from workout_sets s where s.exercise_id = ce.id) as sets_logged,
    (select coalesce(sum(c.minutes), 0) from cardio_logs c where c.kind = ce.id) as cardio_minutes,
    greatest((select max(w.performed_on) from workout_sets s join workouts w on w.id = s.workout_id where s.exercise_id = ce.id),
             (select max(c.performed_on) from cardio_logs c where c.kind = ce.id)) as last_used,
    count(*) over (partition by lower(regexp_replace(btrim(ce.name), '\s+', ' ', 'g'))) as same_name_count
  from custom_exercises ce left join profiles p on p.id = ce.user_id
  order by lower(ce.name), ce.created_at;
revoke all on public.custom_exercise_report from public, anon, authenticated;

create or replace function public.merge_custom_exercise(p_from text, p_into text)
returns text language plpgsql security definer set search_path = public as $$
declare a custom_exercises; b custom_exercises; n_sets int; n_cardio int;
begin
  select * into a from custom_exercises where id = p_from;
  select * into b from custom_exercises where id = p_into;
  if a.id is null or b.id is null then raise exception 'both exercises must exist (% → %)', p_from, p_into; end if;
  if (a.kind = 'minutes') <> (b.kind = 'minutes') then raise exception 'cannot merge a minutes exercise with a sets exercise'; end if;
  -- sets: move them, numbered after any sets already logged under the target in the same workout
  update workout_sets s set exercise_id = p_into,
    set_no = s.set_no + coalesce((select max(x.set_no) from workout_sets x where x.workout_id = s.workout_id and x.exercise_id = p_into), 0)
  where s.exercise_id = p_from;
  get diagnostics n_sets = row_count;
  -- cardio: same person and day under both → add the minutes together
  insert into cardio_logs (user_id, performed_on, kind, minutes)
    select user_id, performed_on, p_into, minutes from cardio_logs where kind = p_from
  on conflict (user_id, performed_on, kind) do update set minutes = least(600, cardio_logs.minutes + excluded.minutes);
  delete from cardio_logs where kind = p_from;
  get diagnostics n_cardio = row_count;
  -- plans and targets that mention it
  update plans set plan = replace(plan::text, '"' || p_from || '"', '"' || p_into || '"')::jsonb where plan::text like '%"' || p_from || '"%';
  update lift_targets t set exercise_id = p_into where t.exercise_id = p_from
    and not exists (select 1 from lift_targets x where x.user_id = t.user_id and x.exercise_id = p_into);
  delete from lift_targets where exercise_id = p_from;
  delete from custom_exercises where id = p_from;
  return format('merged %s (%s) into %s (%s): %s sets, %s cardio days moved', a.name, p_from, b.name, p_into, n_sets, n_cardio);
end $$;
revoke execute on function public.merge_custom_exercise(text, text) from public, anon, authenticated;
