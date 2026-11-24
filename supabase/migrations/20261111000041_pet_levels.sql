-- Pet levels, feeding and move scrolls.
--   Levels 1–10: each level adds 2% to all its stats (level 10: +18%). Your own training still
--     matters far more, since a pet's stats start from yours.
--   XP: every pet in your team gets 20 XP when you win a tower or Boss Lair fight (catching counts),
--     5 when you lose. Walking away gives nothing.
--   Food (shop): Protein Bar +40 XP, Steak +150 XP.
--   Move scrolls: teach a pet one extra move (a 4th). Same type as the pet or Normal; Normal pets
--     can learn any. Fusion and monster-only moves can't be taught. Price 60 + 1.5 × power.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.pets add column if not exists xp int not null default 0;
alter table public.pets add column if not exists extra_move text references public.moves (id);

-- XP needed to reach a level: 25·n·(n−1) → L2 50, L3 150, L5 500, L10 2250
create or replace function public.pet_level(p_xp int) returns int language sql immutable as $$
  select least(10, greatest(1, floor((1 + sqrt(1 + 4 * greatest(p_xp, 0) / 25.0)) / 2)::int))
$$;
create or replace function public.pet_level_xp(p_level int) returns int language sql immutable as $$ select 25 * p_level * (p_level - 1) $$;

insert into public.shop_items (id, en, zh, kind, price, val, sort, desc_en, desc_zh) values
  ('protein_bar', 'Protein Bar', '蛋白棒', 'food', 20, 40, 6, 'Feed a pet: +40 XP.', '餵寵物：+40 經驗。'),
  ('steak',       'Steak',       '牛扒',   'food', 60, 150, 7, 'Feed a pet: +150 XP.', '餵寵物：+150 經驗。')
on conflict (id) do update set en = excluded.en, zh = excluded.zh, kind = excluded.kind, price = excluded.price, val = excluded.val, sort = excluded.sort,
  desc_en = excluded.desc_en, desc_zh = excluded.desc_zh;

-- a pet's fighter card: your stats × its species × its IVs × its level
create or replace function public.pet_snapshot(p_pet uuid, p_owner jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pt pets; sp monsters; o jsonb; r jsonb; best numeric; lv numeric;
begin
  select * into pt from pets where id = p_pet; if pt.id is null then return null; end if;
  select * into sp from monsters where idx = pt.species;
  o := coalesce(p_owner, public.fighter_snapshot(pt.user_id)); r := sp.ratios;
  -- attack, speed and technique come from your best one, so a climbing pet still hits hard for a lifter
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.85;
  lv := 1 + 0.02 * (public.pet_level(pt.xp) - 1);
  return jsonb_build_object('pet', pt.id, 'species', sp.idx, 'name', pt.nickname, 'level', o->'level', 'pet_level', public.pet_level(pt.xp), 'type', sp.type, 'grit', false,
    'hp',  greatest(20, round((o->>'hp')::numeric * (r->>'hp')::numeric * (1 + (pt.iv->>'hp')::numeric) * lv)),
    'atk', greatest(10, round(best * (r->>'atk')::numeric * (1 + (pt.iv->>'atk')::numeric) * lv)),
    'def', greatest(5,  round((o->>'def')::numeric * (r->>'def')::numeric * (1 + (pt.iv->>'def')::numeric) * lv)),
    'spd', greatest(5,  round(best * (r->>'spd')::numeric * (1 + (pt.iv->>'spd')::numeric) * lv)),
    'tec', greatest(5,  round(best * (r->>'tec')::numeric * (1 + (pt.iv->>'tec')::numeric) * lv)),
    'moves', (select jsonb_agg(public.move_json(x) order by coalesce(array_position(sp.moves, x.id), 99)) from moves x where x.id = any(sp.moves) or x.id = pt.extra_move));
end $$;
revoke all on function public.pet_snapshot(uuid, jsonb) from public, anon, authenticated;

-- XP for the team when a tower or lair fight ends
create or replace function public.pet_fight_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt int;
begin
  if new.kind not in ('tower', 'lair') or old.status <> 'active' or new.status <> 'done' or new.snap->'party' is null then return new; end if;
  if (new.log->-1->>'t') = 'flee' then return new; end if;
  amt := case when new.winner_side = 'a' then 20 else 5 end;
  update pets set xp = least(xp + amt, public.pet_level_xp(10))
  where user_id = new.a and id in (select (x->>'pet')::uuid from jsonb_array_elements(new.snap->'party') x where x ? 'pet');
  new.state := new.state || jsonb_build_object('pet_xp', amt);
  return new;
end $$;
drop trigger if exists pet_fight_xp on public.battles;
create trigger pet_fight_xp before update on public.battles for each row execute function public.pet_fight_xp();

-- feed a pet one item of food
create or replace function public.pet_feed(p_pet uuid, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it shop_items; pt pets;
begin
  select * into pt from pets where id = p_pet and user_id = auth.uid() for update;
  if pt.id is null then raise exception 'Not your pet'; end if;
  select * into it from shop_items where id = p_item and kind = 'food';
  if it.id is null then raise exception 'That’s not food'; end if;
  if public.pet_level(pt.xp) >= 10 then raise exception 'Already level 10'; end if;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item and qty > 0;
  if not found then raise exception 'You don’t have that'; end if;
  update pets set xp = least(xp + it.val::int, public.pet_level_xp(10)) where id = p_pet returning * into pt;
  return jsonb_build_object('xp', pt.xp, 'level', public.pet_level(pt.xp));
end $$;

-- what a move scroll costs, or null if this pet can't learn it
create or replace function public.scroll_price(p_species int, p_move text) returns int
language sql stable security definer set search_path = public as $$
  select 60 + round(1.5 * m.power)::int from moves m, monsters s
  where m.id = p_move and s.idx = p_species
    and m.req_kind in ('always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'climbs')
    and (s.type = 'normal' or m.type in (s.type, 'normal'))
    and not (m.id = any(s.moves))
$$;

-- teach a pet one extra move with coins (replaces any extra move it had)
create or replace function public.pet_teach(p_pet uuid, p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pt pets; price int;
begin
  select * into pt from pets where id = p_pet and user_id = auth.uid() for update;
  if pt.id is null then raise exception 'Not your pet'; end if;
  if pt.extra_move = p_move then raise exception 'It already knows that'; end if;
  price := public.scroll_price(pt.species, p_move);
  if price is null then raise exception 'This pet can’t learn that move'; end if;
  if not public.spend_coins(auth.uid(), price, 'scroll ' || p_move) then raise exception 'Not enough coins'; end if;
  update pets set extra_move = p_move where id = p_pet;
  return jsonb_build_object('coins', public.coins_of(auth.uid()), 'move', p_move);
end $$;

-- your pets, with level and what they'd fight with now
create or replace function public.my_pets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  me := public.fighter_snapshot(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'nickname', p.nickname, 'slot', p.slot, 'iv', p.iv,
      'caught_at', p.caught_at, 'boss', m.boss, 'type', m.type, 'xp', p.xp, 'level', public.pet_level(p.xp),
      'xp_from', public.pet_level_xp(public.pet_level(p.xp)), 'xp_to', case when public.pet_level(p.xp) < 10 then public.pet_level_xp(public.pet_level(p.xp) + 1) end,
      'extra_move', p.extra_move, 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

revoke all on function public.pet_feed(uuid, text), public.pet_teach(uuid, text) from public, anon;
grant execute on function public.pet_feed(uuid, text), public.pet_teach(uuid, text) to authenticated;
