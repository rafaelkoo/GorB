-- Run once in Supabase → SQL Editor (after schema.sql).
-- New Google users get their first name filled in, so they skip the "pick a name" screen.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, left(coalesce(split_part(new.raw_user_meta_data ->> 'full_name', ' ', 1),
                                new.raw_user_meta_data ->> 'name', ''), 40))
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
