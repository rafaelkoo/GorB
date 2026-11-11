-- Personal details, weight log, targets, language, group rankings.
-- Applied by GitHub Actions. Safe to run more than once.
--
-- Who sees what:
--   profiles.lang, profiles.days_per_week, lift_targets → groupmates (targets are part of the game)
--   body_profiles, body_weights → only you, unless you switch on share_body

alter table public.profiles add column if not exists lang text not null default 'en';
alter table public.profiles drop constraint if exists profiles_lang_check;
alter table public.profiles add constraint profiles_lang_check check (lang in ('en', 'zh'));
alter table public.profiles add column if not exists days_per_week int;
alter table public.profiles drop constraint if exists profiles_days_check;
alter table public.profiles add constraint profiles_days_check check (days_per_week between 1 and 7);

create table if not exists public.body_profiles (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  age int check (age between 12 and 100),
  sex text check (sex in ('male', 'female')),
  goal_id text check (goal_id in ('lose_weight', 'build_muscle', 'recomp', 'strength', 'endurance', 'wellness')),
  goal_weight_kg numeric(5, 1) check (goal_weight_kg between 30 and 300),
  share_body boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.body_weights (
  user_id uuid not null references public.profiles (id) on delete cascade,
  logged_on date not null,
  weight_kg numeric(5, 1) not null check (weight_kg between 30 and 300),
  primary key (user_id, logged_on)
);

create table if not exists public.lift_targets (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id text not null,
  target_kg numeric(6, 2) not null check (target_kg > 0 and target_kg < 1000),
  primary key (user_id, exercise_id)
);

alter table public.body_profiles enable row level security;
alter table public.body_weights enable row level security;
alter table public.lift_targets enable row level security;

-- true when this person chose to show body details to their groups
create or replace function public.shares_body(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from body_profiles where user_id = p_user and share_body);
$$;
revoke execute on function public.shares_body(uuid) from public, anon;
grant execute on function public.shares_body(uuid) to authenticated;

drop policy if exists "own body profile" on public.body_profiles;
create policy "own body profile" on public.body_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "shared body profile" on public.body_profiles;
create policy "shared body profile" on public.body_profiles for select to authenticated
  using (share_body and public.shares_group(user_id));

drop policy if exists "own weights" on public.body_weights;
create policy "own weights" on public.body_weights for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "shared weights" on public.body_weights;
create policy "shared weights" on public.body_weights for select to authenticated
  using (public.shares_body(user_id) and public.shares_group(user_id));

drop policy if exists "own lift targets" on public.lift_targets;
create policy "own lift targets" on public.lift_targets for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "groupmates see lift targets" on public.lift_targets;
create policy "groupmates see lift targets" on public.lift_targets for select to authenticated
  using (public.shares_group(user_id));

-- One row per member with everything the rankings page sorts by.
-- weight_change_kg is only filled for people who share body details.
create or replace function public.group_rankings(p_group uuid)
returns table (
  user_id uuid, display_name text, days_month int, workouts_month int, volume_month numeric,
  bench numeric, deadlift numeric, squat numeric, ohp numeric, days_target int, weight_change_kg numeric
)
language sql stable security definer set search_path = public as $$
  with m as (
    select gm.user_id, p.display_name, p.days_per_week
    from group_members gm join profiles p on p.id = gm.user_id
    where gm.group_id = p_group and public.is_member(p_group)
  ), d as (select date_trunc('month', now() at time zone 'Europe/London')::date as start)
  select m.user_id, m.display_name,
    (select count(distinct (c.created_at at time zone 'Europe/London')::date) from checkins c, d
      where c.user_id = m.user_id and (c.created_at at time zone 'Europe/London')::date >= d.start)::int,
    (select count(*) from workouts w, d where w.user_id = m.user_id and w.performed_on >= d.start)::int,
    (select coalesce(sum(s.weight_kg * s.reps), 0) from workouts w join workout_sets s on s.workout_id = w.id, d
      where w.user_id = m.user_id and w.performed_on >= d.start),
    (select max(s.weight_kg) from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = m.user_id and s.exercise_id = 'bench_press' and s.reps >= 1),
    (select max(s.weight_kg) from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = m.user_id and s.exercise_id = 'deadlift' and s.reps >= 1),
    (select max(s.weight_kg) from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = m.user_id and s.exercise_id = 'squat' and s.reps >= 1),
    (select max(s.weight_kg) from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = m.user_id and s.exercise_id = 'ohp' and s.reps >= 1),
    m.days_per_week,
    case when public.shares_body(m.user_id) then
      (select weight_kg from body_weights where user_id = m.user_id order by logged_on desc limit 1)
      - (select weight_kg from body_weights where user_id = m.user_id order by logged_on asc limit 1)
    end
  from m;
$$;
revoke execute on function public.group_rankings(uuid) from public, anon;
grant execute on function public.group_rankings(uuid) to authenticated;
