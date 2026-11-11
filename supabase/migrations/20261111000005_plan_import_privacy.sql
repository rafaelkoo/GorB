-- Weekly plan, FitTrack-style targets (reps + deadline), rest timer, share choices.
-- Applied by GitHub Actions. Safe to run more than once.
--
-- Privacy: plan and lift targets are now private unless the person turns sharing on
-- (profiles.share_plan / profiles.share_targets). Body details keep body_profiles.share_body.

alter table public.profiles add column if not exists share_plan boolean not null default false;
alter table public.profiles add column if not exists share_targets boolean not null default false;

-- FitTrack targets are "kg × reps by a date"; base_e1rm is the starting estimate used for pace
alter table public.lift_targets add column if not exists target_reps int not null default 1;
alter table public.lift_targets drop constraint if exists lift_targets_reps_check;
alter table public.lift_targets add constraint lift_targets_reps_check check (target_reps between 1 and 30);
alter table public.lift_targets add column if not exists by_date date;
alter table public.lift_targets add column if not exists set_on date not null default current_date;
alter table public.lift_targets add column if not exists base_e1rm numeric(6, 2);

alter table public.body_profiles add column if not exists goal_date date;
alter table public.body_profiles add column if not exists rest_sec int not null default 90;
alter table public.body_profiles drop constraint if exists body_profiles_rest_check;
alter table public.body_profiles add constraint body_profiles_rest_check check (rest_sec between 15 and 600);

-- One weekly plan per person: {"Mon":[{"id":"bench_press","sets":5,"reps":15}], ... "Sun":[]}
create table if not exists public.plans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.plans enable row level security;

create or replace function public.shares_flag(p_user uuid, p_flag text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select case p_flag when 'plan' then share_plan when 'targets' then share_targets end
                   from profiles where id = p_user), false);
$$;
revoke execute on function public.shares_flag(uuid, text) from public, anon;
grant execute on function public.shares_flag(uuid, text) to authenticated;

drop policy if exists "own plan" on public.plans;
create policy "own plan" on public.plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "shared plan" on public.plans;
create policy "shared plan" on public.plans for select to authenticated
  using (public.shares_flag(user_id, 'plan') and public.shares_group(user_id));

drop policy if exists "groupmates see lift targets" on public.lift_targets;
create policy "groupmates see lift targets" on public.lift_targets for select to authenticated
  using (public.shares_flag(user_id, 'targets') and public.shares_group(user_id));
