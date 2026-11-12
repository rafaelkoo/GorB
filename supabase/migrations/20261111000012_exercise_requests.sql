-- "Request an exercise": ask for one to be added to the library with a 3D demo.
-- People see only their own requests. Rafael reviews them in the Supabase dashboard
-- (Table Editor → exercise_requests) and sets status to 'added' or 'declined'.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.exercise_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  note text check (note is null or char_length(note) <= 300),
  status text not null default 'open' check (status in ('open', 'added', 'declined')),
  created_at timestamptz not null default now()
);
alter table public.exercise_requests enable row level security;

drop policy if exists "see own requests" on public.exercise_requests;
create policy "see own requests" on public.exercise_requests for select to authenticated using (user_id = auth.uid());
drop policy if exists "make a request" on public.exercise_requests;
create policy "make a request" on public.exercise_requests for insert to authenticated with check (user_id = auth.uid() and status = 'open');
drop policy if exists "withdraw own open request" on public.exercise_requests;
create policy "withdraw own open request" on public.exercise_requests for delete to authenticated using (user_id = auth.uid() and status = 'open');
