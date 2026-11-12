-- Group chat, WhatsApp style. One chat per group, kept forever, visible to members only.
-- kind 'text' = a message someone typed; 'rename' = a grey line when anyone renames the group
-- (body holds the new name). Renames go through rename_group() so anyone in the group can do it
-- and every rename is logged in the chat.
-- Each new message calls the notify-chat Edge Function, which pushes it to the other members.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'rename')),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now(),
  notified_at timestamptz
);
create index if not exists chat_messages_group_time on public.chat_messages (group_id, created_at desc);
alter table public.chat_messages enable row level security;

drop policy if exists "members read the chat" on public.chat_messages;
create policy "members read the chat" on public.chat_messages for select to authenticated using (public.is_member(group_id));
drop policy if exists "members send messages" on public.chat_messages;
create policy "members send messages" on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid() and kind = 'text' and notified_at is null and public.is_member(group_id));
-- the time is the server's, whatever the phone says
create or replace function public.chat_stamp() returns trigger language plpgsql as $$
begin new.created_at := now(); new.notified_at := null; return new; end $$;
drop trigger if exists chat_stamp on public.chat_messages;
create trigger chat_stamp before insert on public.chat_messages for each row execute function public.chat_stamp();

-- where each person has read up to, for unread counts
create table if not exists public.chat_reads (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, group_id)
);
alter table public.chat_reads enable row level security;
drop policy if exists "own read marks" on public.chat_reads;
create policy "own read marks" on public.chat_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_member(group_id));

-- unread messages per group for the signed-in person (others' messages after their read mark)
create or replace function public.chat_unread()
returns table (group_id uuid, unread int)
language sql stable security definer set search_path = public as $$
  select gm.group_id, count(c.id)::int
  from group_members gm
  left join chat_reads r on r.user_id = gm.user_id and r.group_id = gm.group_id
  left join chat_messages c on c.group_id = gm.group_id and c.kind = 'text'
    and c.user_id is distinct from gm.user_id and c.created_at > coalesce(r.read_at, gm.joined_at)
  where gm.user_id = auth.uid()
  group by gm.group_id;
$$;
revoke execute on function public.chat_unread() from public, anon;
grant execute on function public.chat_unread() to authenticated;

-- anyone in the group can rename it; the rename is logged as a line in the chat
create or replace function public.rename_group(p_group uuid, p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare n text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'); old text;
begin
  if not public.is_member(p_group) then raise exception 'not in this group'; end if;
  if char_length(n) < 1 or char_length(n) > 60 then raise exception 'name must be 1 to 60 characters'; end if;
  select name into old from groups where id = p_group;
  if old is not distinct from n then return n; end if;
  update groups set name = n where id = p_group;
  insert into chat_messages (group_id, user_id, kind, body) values (p_group, auth.uid(), 'rename', n);
  return n;
end $$;
revoke execute on function public.rename_group(uuid, text) from public, anon;
grant execute on function public.rename_group(uuid, text) to authenticated;

do $$
begin
  -- live updates in the app (Supabase Realtime); plain Postgres in local tests has no such publication
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages') then
    execute 'alter publication supabase_realtime add table public.chat_messages';
  end if;

  -- push: every typed message pokes notify-chat with its id; the function reads the message itself
  -- and marks it notified, so calling it again (or with a made-up id) sends nothing
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
    execute $f$
      create or replace function public.chat_notify() returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        perform net.http_post(
          url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/notify-chat',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('id', new.id),
          timeout_milliseconds := 10000);
        return new;
      end $b$;
    $f$;
    execute 'drop trigger if exists chat_notify on public.chat_messages';
    execute 'create trigger chat_notify after insert on public.chat_messages for each row when (new.kind = ''text'') execute function public.chat_notify()';
  end if;
end $$;
