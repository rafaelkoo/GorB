-- See other people's team and pets: their level and type, their 4 moves, the pets in their team with
-- what each would fight with, how many pets they have, their dex and their best tower floor.
-- Only for you or someone who shares a group with you. IVs show as a grade, not the numbers.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.user_team(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb; g text;
begin
  if auth.uid() is null or (p_user <> auth.uid() and not public.shares_group(p_user)) then return null; end if;
  me := public.fighter_snapshot(p_user);
  return jsonb_build_object(
    'name', (select display_name from profiles where id = p_user),
    'avatar', (select avatar from profiles where id = p_user),
    'level', me->'level', 'type', me->'type', 'hp', me->'hp', 'atk', me->'atk', 'def', me->'def', 'spd', me->'spd', 'tec', me->'tec',
    'moves', (select jsonb_agg(jsonb_build_object('id', m->>'id', 'en', m->>'en', 'zh', m->>'zh', 'type', m->>'type', 'power', m->'power')) from jsonb_array_elements(me->'moves') m),
    'tower', (select tower_floor from profiles where id = p_user),
    'pets_total', (select count(*) from pets where user_id = p_user),
    'evolved_total', (select count(*) from pets where user_id = p_user and evolved),
    'dex', (select count(*) from pet_dex where user_id = p_user),
    'team', coalesce((select jsonb_agg(jsonb_build_object(
        'species', p.species, 'nickname', p.nickname, 'evolved', p.evolved, 'level', public.pet_level(p.xp), 'type', m.type, 'boss', m.boss,
        'iv_avg', round(((p.iv->>'hp')::numeric + (p.iv->>'atk')::numeric + (p.iv->>'def')::numeric + (p.iv->>'spd')::numeric + (p.iv->>'tec')::numeric) / 5, 3),
        'snap', (select s - 'pet' from public.pet_snapshot(p.id, me) s)) order by p.slot)
      from pets p join monsters m on m.idx = p.species where p.user_id = p_user and p.slot is not null), '[]'::jsonb));
end $$;
revoke all on function public.user_team(uuid) from public, anon;
grant execute on function public.user_team(uuid) to authenticated;
