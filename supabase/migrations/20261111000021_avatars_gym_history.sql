-- Pixel gym: each person's avatar, today's scene for a group, and past months of the board.
-- Applied by GitHub Actions. Safe to run more than once.

-- Avatar: a small JSON of parts, e.g. {"v":1,"skin":2,"hair":"spiky","hairColor":1,"top":4,"shorts":0,"build":"normal"}.
-- Kept as JSON so clothes and gear can be added later without a database change. Groupmates
-- already see each other's profiles, so they see each other's avatars.
alter table public.profiles add column if not exists avatar jsonb
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 2000));

-- Today in the gym (London time): for each member, did they check in today, and what did they do
-- most (the exercise with the most sets, or else their longest cardio). Shows where their avatar stands;
-- anyone who hasn't checked in sits on the bench.
create or replace function public.group_gym_today(p_group uuid)
returns table (user_id uuid, display_name text, avatar jsonb, checked_in boolean, exercise_id text, cardio text, sets int)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Europe/London')::date as today)
  select m.user_id, p.display_name, p.avatar,
    exists (select 1 from checkins c, d where c.user_id = m.user_id and (c.created_at at time zone 'Europe/London')::date = d.today),
    (select s.exercise_id from workouts w join workout_sets s on s.workout_id = w.id, d
      where w.user_id = m.user_id and w.performed_on = d.today
      group by s.exercise_id order by count(*) desc, max(s.set_no) desc limit 1),
    (select cl.kind from cardio_logs cl, d where cl.user_id = m.user_id and cl.performed_on = d.today order by cl.minutes desc limit 1),
    coalesce((select count(*)::int from workouts w join workout_sets s on s.workout_id = w.id, d where w.user_id = m.user_id and w.performed_on = d.today), 0)
  from group_members m join profiles p on p.id = m.user_id
  where m.group_id = p_group and public.is_member(p_group)
  order by p.display_name;
$$;

-- Past months of the gym/bitch board, newest first, from the month the group started up to last month.
-- Someone only counts in a month if they'd joined by the end of it (so new members aren't the bitch
-- of months before they arrived).
create or replace function public.group_history(p_group uuid)
returns table (month date, user_id uuid, display_name text, days int)
language sql stable security definer set search_path = public as $$
  with months as (
    select generate_series(
      date_trunc('month', (select g.created_at at time zone 'Europe/London' from groups g where g.id = p_group)),
      date_trunc('month', now() at time zone 'Europe/London') - interval '1 month',
      interval '1 month')::date as month
  )
  select mo.month, m.user_id, p.display_name,
    (select count(distinct (c.created_at at time zone 'Europe/London')::date)::int from checkins c
      where c.user_id = m.user_id
        and (c.created_at at time zone 'Europe/London') >= mo.month
        and (c.created_at at time zone 'Europe/London') < mo.month + interval '1 month') as days
  from months mo
  join group_members m on m.group_id = p_group and (m.joined_at at time zone 'Europe/London') < mo.month + interval '1 month'
  join profiles p on p.id = m.user_id
  where public.is_member(p_group)
  order by mo.month desc, days desc, p.display_name;
$$;

revoke all on function public.group_gym_today(uuid), public.group_history(uuid) from public, anon;
grant execute on function public.group_gym_today(uuid), public.group_history(uuid) to authenticated;
