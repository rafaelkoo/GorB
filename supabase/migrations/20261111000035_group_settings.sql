-- Group settings and joining with a preview.
--   show_history: when you join, you choose whether the group can see your check-ins from before you
--     joined (photos are kept 7 days) or only the ones after. Enforced here for both the check-ins and
--     the photo files, not just hidden in the app. You can change it later in the group's settings.
--   mute_checkins / mute_chat: no push for that group's check-ins / chat.
--   in_everyone: include this group in YOUR "Everyone" ranking (a personal view, nobody else's).
--   pinned: open the app on this group, and list it first.
-- Also: group_preview (what you see before joining), join_group with the history choice, and
-- my_group_cards (the summary on the groups page).
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.group_members add column if not exists show_history boolean not null default true;
alter table public.group_members add column if not exists mute_checkins boolean not null default false;
alter table public.group_members add column if not exists mute_chat boolean not null default false;
alter table public.group_members add column if not exists in_everyone boolean not null default true;
alter table public.group_members add column if not exists pinned boolean not null default false;

-- can the signed-in person see this person's check-in from this time? (a shared group where the
-- owner's history is visible, or the check-in is from after they joined that group)
create or replace function public.can_see_checkin(p_owner uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = public as $$
  select p_owner = auth.uid() or exists (
    select 1 from group_members me join group_members o on o.group_id = me.group_id
    where me.user_id = auth.uid() and o.user_id = p_owner and (o.show_history or p_at >= o.joined_at))
$$;

drop policy if exists "see groupmates checkins" on public.checkins;
create policy "see groupmates checkins" on public.checkins for select to authenticated
  using (public.can_see_checkin(user_id, created_at));

-- photo files follow the same rule (full photo or its _t thumbnail)
create or replace function public.can_see_photo(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select split_part(p_name, '/', 1) = auth.uid()::text or exists (
    select 1 from checkins c
    where c.photo_path in (p_name, regexp_replace(p_name, '_t\.jpg$', '.jpg'))
      and public.can_see_checkin(c.user_id, c.created_at))
$$;
drop policy if exists "groupmates view photos" on storage.objects;
create policy "groupmates view photos" on storage.objects for select to authenticated
  using (bucket_id = 'checkins' and public.can_see_photo(name));

-- your own settings for a group
create or replace function public.set_group_prefs(p_group uuid, p_prefs jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  if (p_prefs->>'pinned')::boolean then update group_members set pinned = false where user_id = auth.uid(); end if;
  update group_members set
    show_history  = coalesce((p_prefs->>'show_history')::boolean, show_history),
    mute_checkins = coalesce((p_prefs->>'mute_checkins')::boolean, mute_checkins),
    mute_chat     = coalesce((p_prefs->>'mute_chat')::boolean, mute_chat),
    in_everyone   = coalesce((p_prefs->>'in_everyone')::boolean, in_everyone),
    pinned        = coalesce((p_prefs->>'pinned')::boolean, pinned)
  where group_id = p_group and user_id = auth.uid();
end $$;

-- what you see before joining from an invite link or code
create or replace function public.group_preview(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare g groups;
begin
  if auth.uid() is null then return null; end if;
  select * into g from groups where invite_code = upper(btrim(p_code));
  if g.id is null then return null; end if;
  return jsonb_build_object('id', g.id, 'name', g.name,
    'already', exists (select 1 from group_members where group_id = g.id and user_id = auth.uid()),
    'members', (select coalesce(jsonb_agg(jsonb_build_object('name', p.display_name, 'avatar', p.avatar, 'id', p.id) order by m.joined_at), '[]'::jsonb)
                from group_members m join profiles p on p.id = m.user_id where m.group_id = g.id),
    'top', (select jsonb_build_object('name', l.display_name, 'days', l.days) from (
              select p.display_name, count(distinct (c.created_at at time zone 'Europe/London')::date) as days
              from group_members m join profiles p on p.id = m.user_id
              join checkins c on c.user_id = m.user_id and (c.created_at at time zone 'Europe/London') >= date_trunc('month', now() at time zone 'Europe/London')
              where m.group_id = g.id group by p.display_name order by 2 desc limit 1) l));
end $$;

-- join, choosing whether they see your check-ins from before
create or replace function public.join_group(p_code text, p_show_history boolean) returns public.groups
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'invite code not found'; end if;
  insert into group_members (group_id, user_id, show_history) values (g.id, auth.uid(), coalesce(p_show_history, true)) on conflict do nothing;
  return g;
end $$;

-- the groups page: one card per group
create or replace function public.my_group_cards() returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select g.id, g.name, me.pinned, me.mute_checkins, me.mute_chat, me.in_everyone, me.show_history, g.created_at
    from group_members me join groups g on g.id = me.group_id where me.user_id = auth.uid()
  ), today as (
    select gm.group_id, p.id as user_id, p.display_name
    from group_members gm join profiles p on p.id = gm.user_id
    where gm.group_id in (select id from mine)
      and exists (select 1 from checkins c where c.user_id = gm.user_id
                  and (c.created_at at time zone 'Europe/London')::date = (now() at time zone 'Europe/London')::date)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'name', m.name, 'pinned', m.pinned, 'mute_checkins', m.mute_checkins, 'mute_chat', m.mute_chat,
      'in_everyone', m.in_everyone, 'show_history', m.show_history,
      'members', (select count(*) from group_members x where x.group_id = m.id),
      'names', (select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name) order by x.joined_at) from group_members x join profiles p on p.id = x.user_id where x.group_id = m.id),
      'today', (select coalesce(jsonb_agg(t.user_id), '[]'::jsonb) from today t where t.group_id = m.id),
      'rank', (select r.pos from (select l.user_id, rank() over (order by l.days desc) as pos from public.group_leaderboard(m.id) l) r where r.user_id = auth.uid()),
      'boss', (select jsonb_build_object('hp', b->'hp', 'dmg', b->'dmg', 'defeated', b->'defeated') from (select public.group_boss(m.id) as b) z))
    order by m.pinned desc, m.created_at), '[]'::jsonb)
  from mine m
$$;

revoke all on function public.set_group_prefs(uuid, jsonb), public.group_preview(text), public.join_group(text, boolean), public.my_group_cards() from public, anon;
grant execute on function public.set_group_prefs(uuid, jsonb), public.group_preview(text), public.join_group(text, boolean), public.my_group_cards() to authenticated;
