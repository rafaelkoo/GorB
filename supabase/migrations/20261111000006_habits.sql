-- Daily habits (FitTrack's: water, protein, sleep, steps). Private to each person.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.habit_ticks (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  habit text not null check (habit in ('water', 'protein', 'sleep', 'steps')),
  primary key (user_id, day, habit)
);
alter table public.habit_ticks enable row level security;

drop policy if exists "own habits" on public.habit_ticks;
create policy "own habits" on public.habit_ticks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
