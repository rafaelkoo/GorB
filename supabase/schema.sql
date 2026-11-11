-- Gym or Bitch database schema (run once in Supabase → SQL Editor)
-- Privacy rule: you only see people, check-ins and photos of people you share a group with.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

-- One row per gym visit. Photo is required (anti-fake rule).
create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  photo_path text not null check (photo_path <> ''),
  note text check (char_length(note) <= 140),
  created_at timestamptz not null default now()
);
create index on public.checkins (user_id, created_at desc);

-- Workout logging (phase 3). exercise_id uses FitTrack's ids (bench_press, deadlift, ...).
create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  checkin_id uuid references public.checkins (id) on delete set null,
  performed_on date not null default current_date,
  created_at timestamptz not null default now()
);
create table public.workout_sets (
  id bigint generated always as identity primary key,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null,
  set_no int not null check (set_no > 0),
  weight_kg numeric(6, 2) not null default 0 check (weight_kg >= 0),
  reps int not null default 0 check (reps >= 0)
);

-- Web Push (phase 2): one row per device.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- server-side truth ----------
-- The phone never decides who posted or when: user and time are stamped here.
create function public.stamp_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.user_id := auth.uid();
  new.created_at := now();
  -- photo must sit in the poster's own folder
  if split_part(new.photo_path, '/', 1) <> auth.uid()::text then
    raise exception 'photo must be in your own folder';
  end if;
  return new;
end $$;
create trigger checkins_stamp before insert on public.checkins
  for each row execute function public.stamp_checkin();

-- Make a profile row when someone signs up.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- helpers (security definer avoids RLS recursion) ----------
create function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = g and user_id = auth.uid());
$$;

create function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other);
$$;

-- ---------- RPCs ----------
create function public.create_group(p_name text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into groups (name, owner_id) values (trim(p_name), auth.uid()) returning * into g;
  insert into group_members (group_id, user_id, role) values (g.id, auth.uid(), 'owner');
  return g;
end $$;

create function public.join_group(p_code text) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'invite code not found'; end if;
  insert into group_members (group_id, user_id) values (g.id, auth.uid()) on conflict do nothing;
  return g;
end $$;

-- Monthly table: counts distinct UK days with a check-in (two posts on one day = 1).
create function public.group_leaderboard(p_group uuid, p_month date default current_date)
returns table (user_id uuid, display_name text, days int)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.display_name,
         count(distinct (c.created_at at time zone 'Europe/London')::date)::int as days
  from group_members m
  join profiles p on p.id = m.user_id
  left join checkins c on c.user_id = m.user_id
       and (c.created_at at time zone 'Europe/London') >= date_trunc('month', p_month)
       and (c.created_at at time zone 'Europe/London') <  date_trunc('month', p_month) + interval '1 month'
  where m.group_id = p_group and public.is_member(p_group)
  group by m.user_id, p.display_name
  order by days desc, p.display_name;
$$;

revoke execute on function public.stamp_checkin(), public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_group(text), public.join_group(text),
  public.group_leaderboard(uuid, date), public.is_member(uuid), public.shares_group(uuid) from public, anon;
grant execute on function public.create_group(text), public.join_group(text),
  public.group_leaderboard(uuid, date), public.is_member(uuid), public.shares_group(uuid) to authenticated;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.checkins enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "see self and groupmates" on public.profiles for select to authenticated using (public.shares_group(id));
create policy "edit own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "members see group" on public.groups for select to authenticated using (public.is_member(id));
create policy "owner renames group" on public.groups for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "owner deletes group" on public.groups for delete to authenticated using (owner_id = auth.uid());
-- groups are created only through create_group()

create policy "members see members" on public.group_members for select to authenticated using (public.is_member(group_id));
create policy "leave group" on public.group_members for delete to authenticated using (user_id = auth.uid());
-- joining happens only through join_group()

create policy "see groupmates checkins" on public.checkins for select to authenticated using (public.shares_group(user_id));
create policy "post own checkin" on public.checkins for insert to authenticated with check (user_id = auth.uid()); -- trigger stamps user_id first
create policy "delete own checkin" on public.checkins for delete to authenticated using (user_id = auth.uid());

create policy "see groupmates workouts" on public.workouts for select to authenticated using (public.shares_group(user_id));
create policy "own workouts" on public.workouts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "see groupmates sets" on public.workout_sets for select to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and public.shares_group(w.user_id)));
create policy "own sets" on public.workout_sets for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "own push subs" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- photo storage (private bucket) ----------
-- Path format: <user id>/<random>.jpg
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('checkins', 'checkins', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;

create policy "upload own photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "groupmates view photos" on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and public.shares_group(((storage.foldername(name))[1])::uuid));
create policy "delete own photos" on storage.objects for delete to authenticated
  using (bucket_id = 'checkins' and (storage.foldername(name))[1] = auth.uid()::text);

-- Later changes live in supabase/migrations/ (run them in order after this file).
