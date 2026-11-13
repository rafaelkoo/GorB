-- Reply to a check-in photo from the group feed: the reply goes into that group's chat and shows
-- which photo it's about. checkin_id points at the photo; it must belong to someone in the same group.
-- If the check-in is deleted the reply stays, without the photo.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.chat_messages add column if not exists checkin_id uuid references public.checkins (id) on delete set null;

drop policy if exists "members send messages" on public.chat_messages;
create policy "members send messages" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid() and kind = 'text' and notified_at is null and public.is_member(group_id)
    and (checkin_id is null or exists (
      select 1 from public.checkins c join public.group_members gm on gm.user_id = c.user_id
      where c.id = checkin_id and gm.group_id = chat_messages.group_id))
  );
