-- Photos in the group chat.
--   The app shrinks each photo before sending (longest side 960 px, plus a 360 px preview), so a photo is
--   roughly 60–150 KB, and re-encoding drops EXIF (GPS, phone model).
--   Stored in a private bucket 'chat' at <group id>/<user id>/<random>.jpg: only members of that group can
--   see it. cleanup-photos deletes chat photos after 5 days; the message stays, marked photo_expired.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.chat_messages add column if not exists photo_path text;
alter table public.chat_messages add column if not exists photo_expired boolean not null default false;

-- a photo can go without a caption
alter table public.chat_messages drop constraint if exists chat_messages_body_check;
alter table public.chat_messages add constraint chat_messages_body_check
  check (char_length(body) <= 1000 and (char_length(btrim(body)) >= 1 or photo_path is not null));

drop policy if exists "members send messages" on public.chat_messages;
create policy "members send messages" on public.chat_messages for insert to authenticated
  with check (
    user_id = auth.uid() and kind = 'text' and notified_at is null and public.is_member(group_id) and not photo_expired
    and (checkin_id is null or exists (
      select 1 from public.checkins c join public.group_members gm on gm.user_id = c.user_id
      where c.id = checkin_id and gm.group_id = chat_messages.group_id))
    and (reply_to is null or exists (
      select 1 from public.chat_messages r where r.id = chat_messages.reply_to and r.group_id = chat_messages.group_id))
    and (photo_path is null or (split_part(photo_path, '/', 1) = group_id::text and split_part(photo_path, '/', 2) = auth.uid()::text))
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat', 'chat', false, 524288, array['image/jpeg'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "members upload chat photos" on storage.objects;
create policy "members upload chat photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "members view chat photos" on storage.objects;
create policy "members view chat photos" on storage.objects for select to authenticated
  using (bucket_id = 'chat' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "delete own chat photos" on storage.objects;
create policy "delete own chat photos" on storage.objects for delete to authenticated
  using (bucket_id = 'chat' and (storage.foldername(name))[2] = auth.uid()::text);
