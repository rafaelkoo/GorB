-- Summon: tap a groupmate who's resting on the bench in the pixel gym to call them in. They get a push.
-- If they check in within 24 hours, you both get 15 coins. One summon per person per friend per day,
-- and only for someone who hasn't checked in today.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.summons (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles (id) on delete cascade,
  to_user uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  day date not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  notified_at timestamptz,
  unique (from_user, to_user, day)
);
create index if not exists summons_to on public.summons (to_user, created_at desc);
alter table public.summons enable row level security;
drop policy if exists "see summons you sent or got" on public.summons;
create policy "see summons you sent or got" on public.summons for select to authenticated using (from_user = auth.uid() or to_user = auth.uid());
grant select on public.summons to authenticated;

create or replace function public.summon(p_to uuid, p_group uuid) returns text
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null or p_to = auth.uid() then return 'no'; end if;
  if not (public.is_member(p_group) and exists (select 1 from group_members where group_id = p_group and user_id = p_to)) then return 'no'; end if;
  if exists (select 1 from checkins c where c.user_id = p_to and (c.created_at at time zone 'Europe/London')::date = d) then return 'already_in'; end if;
  insert into summons (from_user, to_user, group_id, day) values (auth.uid(), p_to, p_group, d) on conflict do nothing;
  return case when found then 'sent' else 'already_sent' end;
end $$;
revoke all on function public.summon(uuid, uuid) from public, anon;
grant execute on function public.summon(uuid, uuid) to authenticated;

-- answered: when the summoned person checks in within 24 hours, both get 15 coins (once per summon)
create or replace function public.summon_answered() returns trigger
language plpgsql security definer set search_path = public as $$
declare s record;
begin
  for s in select * from summons where to_user = new.user_id and answered_at is null and created_at > now() - interval '24 hours' loop
    update summons set answered_at = now() where id = s.id;
    insert into rewards (user_id, kind, ref, coins, meta) values
      (s.to_user, 'summon', 'summon-in:' || s.id, 15, jsonb_build_object('from', s.from_user)),
      (s.from_user, 'summon', 'summon-out:' || s.id, 15, jsonb_build_object('to', s.to_user))
    on conflict do nothing;
  end loop;
  return new;
end $$;
drop trigger if exists summon_answered on public.checkins;
create trigger summon_answered after insert on public.checkins for each row execute function public.summon_answered();

-- push to the person being summoned (notify-reaction sends it, called with { id, summon: true })
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
    execute $f$
      create or replace function public.summon_notify() returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        perform net.http_post(
          url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/notify-reaction',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('id', new.id, 'summon', true),
          timeout_milliseconds := 10000);
        return new;
      end $b$;
    $f$;
    execute 'drop trigger if exists summon_notify on public.summons';
    execute 'create trigger summon_notify after insert on public.summons for each row execute function public.summon_notify()';
  end if;
end $$;
