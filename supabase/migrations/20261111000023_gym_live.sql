-- The pixel gym follows what you're training today, live: the Log sends your ticked sets per exercise
-- as you tick them (before you press Save), and the gym puts your character at the station for the
-- body part you've done most today. Saved workouts count too.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.gym_live (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  day date not null,
  sets jsonb not null default '{}'::jsonb check (jsonb_typeof(sets) = 'object' and pg_column_size(sets) < 4000),   -- {exercise_id: ticked sets}
  last_ex text check (last_ex is null or char_length(last_ex) <= 60),                                                -- the exercise ticked most recently
  updated_at timestamptz not null default now()
);
alter table public.gym_live enable row level security;
drop policy if exists "own live status" on public.gym_live;
create policy "own live status" on public.gym_live for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.gym_live to authenticated;

-- today in the gym, now with the sets per exercise (saved and live, whichever is more) and the last exercise
drop function if exists public.group_gym_today(uuid);
create function public.group_gym_today(p_group uuid)
returns table (user_id uuid, display_name text, avatar jsonb, checked_in boolean, cardio text, sets_by_ex jsonb, last_ex text, exercise_id text, sets int)
language sql stable security definer set search_path = public as $$
  with d as (select (now() at time zone 'Europe/London')::date as today),
  m as (select gm.user_id from group_members gm where gm.group_id = p_group and public.is_member(p_group)),
  saved as (
    select w.user_id, s.exercise_id, count(*)::int as n
    from workouts w join workout_sets s on s.workout_id = w.id, d
    where w.user_id in (select user_id from m) and w.performed_on = d.today
    group by 1, 2
  ),
  live as (
    select gl.user_id, kv.key as exercise_id, least(greatest((kv.value)::text::int, 0), 99) as n
    from gym_live gl, d, jsonb_each(gl.sets) kv
    where gl.user_id in (select user_id from m) and gl.day = d.today and jsonb_typeof(kv.value) = 'number'
  ),
  merged as (
    select coalesce(a.user_id, b.user_id) as user_id, coalesce(a.exercise_id, b.exercise_id) as exercise_id, greatest(coalesce(a.n, 0), coalesce(b.n, 0)) as n
    from saved a full join live b on a.user_id = b.user_id and a.exercise_id = b.exercise_id
  )
  select p.id, p.display_name, p.avatar,
    exists (select 1 from checkins c, d where c.user_id = p.id and (c.created_at at time zone 'Europe/London')::date = d.today),
    (select cl.kind from cardio_logs cl, d where cl.user_id = p.id and cl.performed_on = d.today order by cl.minutes desc limit 1),
    coalesce((select jsonb_object_agg(x.exercise_id, x.n) from merged x where x.user_id = p.id and x.n > 0), '{}'::jsonb),
    (select gl.last_ex from gym_live gl, d where gl.user_id = p.id and gl.day = d.today),
    (select x.exercise_id from merged x where x.user_id = p.id and x.n > 0 order by x.n desc limit 1),
    coalesce((select sum(x.n)::int from merged x where x.user_id = p.id), 0)
  from m join profiles p on p.id = m.user_id
  order by p.display_name;
$$;
revoke all on function public.group_gym_today(uuid) from public, anon;
grant execute on function public.group_gym_today(uuid) to authenticated;
