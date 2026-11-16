-- WhatsApp-style chat: reply to a message (it shows the message you're answering) and react to a
-- message with an emoji (one per person per message; another emoji changes it, the same one removes it).
-- A new reaction pokes notify-reaction, which tells the message's author.
-- Note: nothing in the app embeds profiles from chat_messages, so the extra link through
-- chat_reactions can't make such a query ambiguous (see the 0.30.1 fix for check-ins).
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.chat_messages add column if not exists reply_to uuid references public.chat_messages (id) on delete set null;

drop policy if exists "members send messages" on public.chat_messages;
create policy "members send messages" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid() and kind = 'text' and notified_at is null and public.is_member(group_id)
    and (checkin_id is null or exists (
      select 1 from public.checkins c join public.group_members gm on gm.user_id = c.user_id
      where c.id = checkin_id and gm.group_id = chat_messages.group_id))
    and (reply_to is null or exists (
      select 1 from public.chat_messages r where r.id = chat_messages.reply_to and r.group_id = chat_messages.group_id))
  );

create table if not exists public.chat_reactions (
  id uuid not null default gen_random_uuid() unique,
  message_id uuid not null references public.chat_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,   -- copied from the message, for live updates
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  primary key (message_id, user_id)
);
create index if not exists chat_reactions_group on public.chat_reactions (group_id);
alter table public.chat_reactions enable row level security;

-- group_id always comes from the message, whatever the app sends
create or replace function public.chat_reaction_stamp() returns trigger language plpgsql security definer set search_path = public as $$
begin
  select m.group_id into new.group_id from chat_messages m where m.id = new.message_id;
  if tg_op = 'INSERT' then new.created_at := now(); new.notified_at := null; end if;
  return new;
end $$;
drop trigger if exists chat_reaction_stamp on public.chat_reactions;
create trigger chat_reaction_stamp before insert or update on public.chat_reactions for each row execute function public.chat_reaction_stamp();

drop policy if exists "members see reactions" on public.chat_reactions;
create policy "members see reactions" on public.chat_reactions for select to authenticated using (public.is_member(group_id));
drop policy if exists "members react" on public.chat_reactions;
create policy "members react" on public.chat_reactions for insert to authenticated
  with check (user_id = auth.uid() and public.is_member(group_id)
    and exists (select 1 from public.chat_messages m where m.id = message_id and m.kind = 'text'));
drop policy if exists "change own chat reaction" on public.chat_reactions;
create policy "change own chat reaction" on public.chat_reactions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "remove own chat reaction" on public.chat_reactions;
create policy "remove own chat reaction" on public.chat_reactions for delete to authenticated using (user_id = auth.uid());
revoke update on public.chat_reactions from authenticated, anon;
grant select, insert, delete on public.chat_reactions to authenticated;
grant update (emoji) on public.chat_reactions to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chat_reactions') then
    execute 'alter publication supabase_realtime add table public.chat_reactions';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
    execute $f$
      create or replace function public.chat_reaction_notify() returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        perform net.http_post(
          url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/notify-reaction',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('id', new.id, 'chat', true),
          timeout_milliseconds := 10000);
        return new;
      end $b$;
    $f$;
    execute 'drop trigger if exists chat_reaction_notify on public.chat_reactions';
    execute 'create trigger chat_reaction_notify after insert on public.chat_reactions for each row execute function public.chat_reaction_notify()';
  end if;
end $$;
