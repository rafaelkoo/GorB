-- Exercises people add themselves (wall climbing, a machine only their gym has…). No 3D demo.
-- kind 'weight': logged as sets (kg × reps) like any lift, so it shows in progress and rankings.
-- kind 'minutes': logged in the cardio card (minutes per day), private like cardio.
-- Everyone in your groups can see and use the exercises you add; only you can rename or delete yours.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.custom_exercises (
  id text primary key check (id ~ '^c_[a-z0-9]{6,20}$'),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  kind text not null check (kind in ('weight', 'minutes')),
  cat text not null default 'other' check (cat in ('chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'other')),
  created_at timestamptz not null default now()
);
alter table public.custom_exercises enable row level security;

drop policy if exists "see own and groupmates exercises" on public.custom_exercises;
create policy "see own and groupmates exercises" on public.custom_exercises for select to authenticated
  using (public.shares_group(user_id));
drop policy if exists "add own exercise" on public.custom_exercises;
create policy "add own exercise" on public.custom_exercises for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "edit own exercise" on public.custom_exercises;
create policy "edit own exercise" on public.custom_exercises for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "delete own exercise" on public.custom_exercises;
create policy "delete own exercise" on public.custom_exercises for delete to authenticated using (user_id = auth.uid());

-- cardio can now hold your own minute-based exercises too (ids like c_ab12cd34)
alter table public.cardio_logs drop constraint if exists cardio_logs_kind_check;
alter table public.cardio_logs drop constraint if exists cardio_logs_kind_ok;
alter table public.cardio_logs add constraint cardio_logs_kind_ok check (kind ~ '^[a-z0-9_]{1,40}$');
