-- Cardio log (FitTrack's cardio: treadmill, bike, rower…), minutes per kind per day. Private to each person.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.cardio_logs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  performed_on date not null,
  kind text not null check (kind in ('cardio30', 'treadmill', 'bike', 'rowing', 'jump_rope', 'hiit', 'stair_climber', 'battle_ropes', 'sled_push', 'box_jump')),
  minutes int not null check (minutes between 1 and 600),
  primary key (user_id, performed_on, kind)
);
alter table public.cardio_logs enable row level security;

drop policy if exists "own cardio" on public.cardio_logs;
create policy "own cardio" on public.cardio_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
