-- Personal quests: daily and weekly, scaled to each person's own habits so newcomers get easier
-- targets for the same reward. Progress is worked out here from real records; claim once each.
--   Daily  · check in today                          → 10 coins
--   Daily  · do N sets today (N ≈ your usual, 6–25)   → 10 coins + 15 XP
--   Weekly · hit your days target (or 3)              → 40 coins + 60 XP
--   Weekly · try an exercise you've never logged      → 20 coins + 20 XP
--   Weekly · M minutes of cardio (≈ your usual, 30+)  → 25 coins + 20 XP
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.my_quests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  d date := (now() at time zone 'Europe/London')::date;
  wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  usual_sets int; usual_cardio int; target int;
  sets_today int; in_today int; days_wk int; cardio_wk int; new_ex int;
begin
  if u is null then return '[]'::jsonb; end if;
  select coalesce(days_per_week, 3) into target from profiles where id = u;
  -- your usual: average sets on a gym day, and average weekly cardio, over the last 4 weeks
  select coalesce(round(avg(n)), 0) into usual_sets from (
    select count(*) n from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = u and w.performed_on >= d - 28 and w.performed_on < d and s.reps >= 1 group by w.performed_on) a;
  select coalesce(sum(minutes), 0) / 4 into usual_cardio from cardio_logs where user_id = u and performed_on >= wk - 28 and performed_on < wk;
  usual_sets := greatest(6, least(25, usual_sets));
  usual_cardio := greatest(30, (usual_cardio * 1.1)::int / 5 * 5);
  -- progress
  select count(*) into in_today from checkins where user_id = u and (created_at at time zone 'Europe/London')::date = d;
  select count(*) into sets_today from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = u and w.performed_on = d and s.reps >= 1;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days_wk from checkins where user_id = u and (created_at at time zone 'Europe/London')::date >= wk;
  select coalesce(sum(minutes), 0) into cardio_wk from cardio_logs where user_id = u and performed_on >= wk;
  select count(distinct s.exercise_id) into new_ex from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = u and w.performed_on >= wk and s.reps >= 1
      and not exists (select 1 from workouts w2 join workout_sets s2 on s2.workout_id = w2.id where w2.user_id = u and w2.performed_on < wk and s2.exercise_id = s.exercise_id);
  return (select jsonb_agg(q || jsonb_build_object('claimed', exists (select 1 from rewards r where r.user_id = u and r.ref = 'quest:' || (q->>'id') || ':' || (q->>'since'))))
    from (values
      (jsonb_build_object('id', 'checkin', 'period', 'day', 'since', d, 'target', 1, 'progress', least(in_today, 1), 'coins', 10, 'xp', 0)),
      (jsonb_build_object('id', 'sets', 'period', 'day', 'since', d, 'target', usual_sets, 'progress', least(sets_today, usual_sets), 'coins', 10, 'xp', 15)),
      (jsonb_build_object('id', 'days', 'period', 'week', 'since', wk, 'target', target, 'progress', least(days_wk, target), 'coins', 40, 'xp', 60)),
      (jsonb_build_object('id', 'new', 'period', 'week', 'since', wk, 'target', 1, 'progress', least(new_ex, 1), 'coins', 20, 'xp', 20)),
      (jsonb_build_object('id', 'cardio', 'period', 'week', 'since', wk, 'target', usual_cardio, 'progress', least(cardio_wk, usual_cardio), 'coins', 25, 'xp', 20))
    ) v(q));
end $$;
revoke all on function public.my_quests() from public, anon;
grant execute on function public.my_quests() to authenticated;

create or replace function public.claim_quest(p_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q jsonb;
begin
  select x into q from jsonb_array_elements(public.my_quests()) x where x->>'id' = p_id;
  if q is null or (q->>'progress')::int < (q->>'target')::int or (q->>'claimed')::boolean then return null; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (auth.uid(), 'quest', 'quest:' || p_id || ':' || (q->>'since'), (q->>'xp')::int, (q->>'coins')::int, jsonb_build_object('quest', p_id))
  on conflict do nothing;
  if not found then return null; end if;
  return jsonb_build_object('coins', (q->>'coins')::int, 'xp', (q->>'xp')::int);
end $$;
revoke all on function public.claim_quest(text) from public, anon;
grant execute on function public.claim_quest(text) to authenticated;
