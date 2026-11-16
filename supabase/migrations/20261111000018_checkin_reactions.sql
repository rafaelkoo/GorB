-- Emoji reactions under check-in photos (Instagram style). One reaction per person per photo:
-- tapping another emoji changes it, tapping yours again removes it. Only people who can see the
-- check-in (its owner and their groupmates) can see or add reactions.
-- A new reaction pokes the notify-reaction Edge Function, which pushes it to the photo's owner.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.checkin_reactions (
  id uuid not null default gen_random_uuid() unique,
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (checkin_id, user_id)
);
create index if not exists checkin_reactions_checkin on public.checkin_reactions (checkin_id);

alter table public.checkin_reactions enable row level security;

drop policy if exists "see reactions on visible checkins" on public.checkin_reactions;
create policy "see reactions on visible checkins" on public.checkin_reactions for select to authenticated
  using (exists (select 1 from public.checkins c where c.id = checkin_id and (c.user_id = auth.uid() or public.shares_group(c.user_id))));

drop policy if exists "react to visible checkins" on public.checkin_reactions;
create policy "react to visible checkins" on public.checkin_reactions for insert to authenticated
  with check (user_id = auth.uid() and notified_at is null
    and exists (select 1 from public.checkins c where c.id = checkin_id and (c.user_id = auth.uid() or public.shares_group(c.user_id))));

drop policy if exists "change own reaction" on public.checkin_reactions;
create policy "change own reaction" on public.checkin_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "remove own reaction" on public.checkin_reactions;
create policy "remove own reaction" on public.checkin_reactions for delete to authenticated using (user_id = auth.uid());

-- people can only change the emoji itself, nothing else on the row
revoke update on public.checkin_reactions from authenticated, anon;
grant select, insert, delete on public.checkin_reactions to authenticated;
grant update (emoji) on public.checkin_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
    execute $f$
      create or replace function public.reaction_notify() returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        perform net.http_post(
          url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/notify-reaction',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('id', new.id),
          timeout_milliseconds := 10000);
        return new;
      end $b$;
    $f$;
    execute 'drop trigger if exists reaction_notify on public.checkin_reactions';
    execute 'create trigger reaction_notify after insert on public.checkin_reactions for each row execute function public.reaction_notify()';
  end if;
end $$;

-- for the push: a group two people are both in (the oldest one), so tapping the notification opens it.
-- Only the Edge Function (service role) may call it.
create or replace function public.shared_group_of(a uuid, b uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select x.group_id from group_members x join group_members y on y.group_id = x.group_id and y.user_id = b
  join groups g on g.id = x.group_id where x.user_id = a order by g.created_at limit 1
$$;
revoke all on function public.shared_group_of(uuid, uuid) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.shared_group_of(uuid, uuid) to service_role';
  end if;
end $$;
