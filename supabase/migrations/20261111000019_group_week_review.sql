-- Weekly group review: last week's (Mon–Sun, London time) gym days per member against their
-- days-per-week target, plus any new personal bests. Shown as a card on the group page and pushed
-- to everyone every Monday morning by the weekly-review Edge Function.
-- Applied by GitHub Actions. Safe to run more than once.

-- p_week: the Monday the week starts on; leave it out for last week
create or replace function public.group_week_review(p_group uuid, p_week date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, (date_trunc('week', now() at time zone 'Europe/London') - interval '7 days')::date);
  nx date := wk + 7;
  out jsonb;
begin
  -- members of the group only (the Edge Function runs as the service role, which has no user)
  if auth.uid() is not null and not public.is_member(p_group) then return null; end if;
  select jsonb_build_object(
    'group_id', g.id, 'group_name', g.name, 'week_start', wk, 'week_end', nx - 1,
    'members', coalesce((
      select jsonb_agg(m order by (m->>'days')::int desc, m->>'name') from (
        select jsonb_build_object(
          'user_id', p.id, 'name', p.display_name, 'target', p.days_per_week,
          'days', (select count(distinct (c.created_at at time zone 'Europe/London')::date) from checkins c
                    where c.user_id = p.id and (c.created_at at time zone 'Europe/London')::date >= wk
                      and (c.created_at at time zone 'Europe/London')::date < nx),
          'workouts', (select count(*) from workouts w where w.user_id = p.id and w.performed_on >= wk and w.performed_on < nx),
          -- a new best: heavier (or a harder climbing grade) than anything before this week
          'prs', coalesce((
            select jsonb_agg(jsonb_build_object('exercise_id', x.exercise_id, 'kg', x.now_kg, 'was', x.before_kg) order by x.now_kg - x.before_kg desc)
            from (
              select s.exercise_id, max(s.weight_kg) as now_kg,
                (select max(s2.weight_kg) from workouts w2 join workout_sets s2 on s2.workout_id = w2.id
                  where w2.user_id = p.id and s2.exercise_id = s.exercise_id and s2.reps >= 1 and w2.performed_on < wk) as before_kg
              from workouts w join workout_sets s on s.workout_id = w.id
              where w.user_id = p.id and w.performed_on >= wk and w.performed_on < nx and s.reps >= 1
              group by s.exercise_id
            ) x where x.before_kg is not null and x.now_kg > x.before_kg), '[]'::jsonb)
        ) as m
        from group_members gm join profiles p on p.id = gm.user_id
        where gm.group_id = p_group
      ) members), '[]'::jsonb)
  ) into out
  from groups g where g.id = p_group;
  return out;
end $$;
revoke all on function public.group_week_review(uuid, date) from public, anon;
grant execute on function public.group_week_review(uuid, date) to authenticated;

-- one push per group per week, however many times the function is called
create table if not exists public.week_review_sent (
  group_id uuid not null references public.groups (id) on delete cascade,
  week_start date not null,
  sent_at timestamptz not null default now(),
  primary key (group_id, week_start)
);
alter table public.week_review_sent enable row level security;   -- no policies: only the service role touches it

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.group_week_review(uuid, date) to service_role';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute 'create extension if not exists pg_net with schema extensions';
    perform cron.unschedule(jobid) from cron.job where jobname = 'gob-week-review';
    -- Mondays 08:07 UTC (08:07 in winter, 09:07 in summer, London)
    perform cron.schedule('gob-week-review', '7 8 * * 1', $job$
      select net.http_post(
        url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/weekly-review',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$);
  end if;
end $$;
