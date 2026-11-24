-- Pets, Pokémon style.
--   Species: the 12 tower monsters (6 old + 6 new) and 6 boss species. Each has its own leaning
--     (stat ratios, e.g. Kettlebell Pup is all attack, Treadmill Turtle all HP and defence), a type,
--     moves and how easy it is to catch.
--   A pet's stats come from YOUR stats (so training still decides everything) × its species ratios
--     × its IVs: a random -20%..+20% per stat when caught. Catch the same species again for better IVs.
--   Catching: in the tower or a boss fight, throw a ball (bought with coins). The lower its HP, the
--     better the chance; boss species can only be caught at 30% HP or less.
--   Team: you plus up to 5 pets, in the tower and boss fights (not raids or friendly matches). Switch
--     any time (uses your turn); when one goes down the next comes in. Monsters get tougher with a
--     bigger team, so a full team helps but doesn't walk through everything.
--   Shop (coins): balls and potions. Coins are spent as negative rows in the rewards ledger.
--   Boss lair: fight a boss species to catch it. One free try a day, then 1 ticket or 40 coins.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.rewards drop constraint if exists rewards_kind_check;
alter table public.rewards add constraint rewards_kind_check
  check (kind in ('chest', 'comeback', 'summon', 'boss', 'quest', 'season', 'battle', 'spend', 'tower', 'raid', 'lair'));
alter table public.battles drop constraint if exists battles_kind_check;
alter table public.battles add constraint battles_kind_check check (kind in ('pvp', 'tower', 'raid', 'lair', 'test'));
alter table public.battles add column if not exists species int;
alter table public.battles add column if not exists pay text;

-- ---------- species ----------
alter table public.monsters add column if not exists en text;
alter table public.monsters add column if not exists zh text;
alter table public.monsters add column if not exists ratios jsonb;          -- {hp, atk, def, spd, tec} × your stats
alter table public.monsters add column if not exists catch_rate numeric not null default 0.4;
alter table public.monsters add column if not exists boss boolean not null default false;

insert into public.monsters (idx, en, zh, type, hp, atk, def, spd, tec, moves, ratios, catch_rate, boss) values
  (0,  'The Couch Monster',     '梳化怪',     'normal',    70, 26, 22, 14, 18, '{cushion_slam,couch_sink,snooze}',       '{"hp":1.3,"atk":0.7,"def":1.3,"spd":0.6,"tec":0.8}',  0.45, false),
  (1,  'Midnight Snack Dragon', '宵夜龍',     'strength',  62, 30, 16, 18, 18, '{snack_breath,sugar_rush,cushion_slam}', '{"hp":1.0,"atk":1.25,"def":0.9,"spd":0.8,"tec":0.8}', 0.35, false),
  (2,  'Lazy Slime',            '懶惰史萊姆', 'normal',    66, 27, 18, 20, 18, '{slime_splash,snooze,sugar_rush}',       '{"hp":1.15,"atk":0.9,"def":1.0,"spd":0.9,"tec":0.9}', 0.5,  false),
  (3,  'The Snooze Clock',      '貪睡鬧鐘',   'endurance', 58, 22, 16, 30, 18, '{alarm_blast,notif_ping,snooze}',        '{"hp":0.9,"atk":0.8,"def":0.8,"spd":1.35,"tec":0.9}', 0.4,  false),
  (4,  'Bubble Tea Beast',      '珍奶怪',     'strength',  64, 29, 18, 22, 18, '{boba_barrage,snack_breath,sugar_rush}', '{"hp":1.0,"atk":1.15,"def":0.9,"spd":1.0,"tec":0.8}', 0.4,  false),
  (5,  'Doomscroll Demon',      '碌手機魔',   'climbing',  60, 24, 16, 24, 30, '{doomscroll,notif_ping,alarm_blast}',    '{"hp":0.9,"atk":0.8,"def":0.8,"spd":1.0,"tec":1.35}', 0.35, false),
  (6,  'Kettlebell Pup',        '鐵鈴狗',     'strength',  60, 32, 16, 20, 14, '{bicep_hammer,squat_slam,shove}',        '{"hp":0.95,"atk":1.3,"def":0.9,"spd":1.0,"tec":0.7}', 0.4,  false),
  (7,  'Treadmill Turtle',      '跑步機龜',   'endurance', 76, 18, 24, 20, 16, '{sprint,second_wind,iron_wall}',         '{"hp":1.25,"atk":0.7,"def":1.3,"spd":1.0,"tec":0.8}', 0.45, false),
  (8,  'Chalk Bat',             '粉筆蝠',     'climbing',  54, 20, 15, 26, 28, '{grip,side_pull,heel_hook}',             '{"hp":0.85,"atk":0.8,"def":0.8,"spd":1.2,"tec":1.3}', 0.4,  false),
  (9,  'Foam Roller Worm',      '滾筒蟲',     'normal',    78, 18, 20, 16, 18, '{shove,snooze,couch_sink}',              '{"hp":1.3,"atk":0.7,"def":1.1,"spd":0.8,"tec":0.9}',  0.5,  false),
  (10, 'Jump Rope Snake',       '跳繩蛇',     'endurance', 56, 24, 15, 30, 20, '{sprint,interval_rush,notif_ping}',      '{"hp":0.9,"atk":0.9,"def":0.8,"spd":1.35,"tec":1.0}', 0.4,  false),
  (11, 'Shaker Golem',          '搖搖杯魔像', 'strength',  80, 28, 24, 12, 14, '{bench_blast,warmup,iron_wall}',         '{"hp":1.3,"atk":1.1,"def":1.2,"spd":0.6,"tec":0.7}',  0.35, false),
  (12, 'Deadlift Dragon',       '硬拉龍',     'strength',  90, 36, 22, 18, 18, '{deadlift_uproot,max_out,warmup}',       '{"hp":1.1,"atk":1.45,"def":1.0,"spd":0.8,"tec":0.8}', 0.2,  true),
  (13, 'Marathon Phoenix',      '馬拉松鳳凰', 'endurance', 80, 26, 20, 36, 22, '{marathon_grind,interval_rush,second_wind}', '{"hp":1.0,"atk":0.9,"def":0.9,"spd":1.5,"tec":1.0}', 0.2, true),
  (14, 'Summit Yeti',           '攀頂雪人',   'climbing',  86, 28, 22, 20, 36, '{roof_crush,crimp_lock,dyno}',           '{"hp":1.15,"atk":1.0,"def":1.0,"spd":0.9,"tec":1.45}', 0.2, true),
  (15, 'Iron Golem',            '鐵人魔像',   'normal',   100, 26, 32, 12, 18, '{cushion_slam,iron_wall,the_pump}',      '{"hp":1.5,"atk":1.0,"def":1.45,"spd":0.6,"tec":0.8}', 0.2, true),
  (16, 'Couch King',            '梳化王',     'normal',    96, 30, 28, 14, 20, '{cushion_slam,snooze,sugar_rush}',       '{"hp":1.4,"atk":1.1,"def":1.3,"spd":0.7,"tec":0.9}',  0.2, true),
  (17, 'Midnight Hydra',        '宵夜九頭蛇', 'strength',  88, 34, 22, 24, 22, '{snack_breath,boba_barrage,sugar_rush}', '{"hp":1.2,"atk":1.3,"def":1.0,"spd":1.0,"tec":1.0}',  0.2, true)
on conflict (idx) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, tec = excluded.tec, moves = excluded.moves, ratios = excluded.ratios, catch_rate = excluded.catch_rate, boss = excluded.boss;

-- the tower now has all 12 (easiest first), every 5th floor an elite
create or replace function public.tower_monster_idx(p_floor int) returns int language sql immutable as $$
  select (array[0, 2, 9, 1, 6, 4, 7, 3, 10, 8, 5, 11])[(p_floor - 1) % 12 + 1]
$$;

-- ---------- pets, items, shop ----------
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  species int not null references public.monsters (idx),
  iv jsonb not null,                 -- {hp, atk, def, spd, tec}: -0.2 .. 0.2 each
  nickname text check (char_length(nickname) <= 20),
  slot int check (slot between 1 and 5),   -- in your team, in this order
  caught_at timestamptz not null default now(),
  caught_in text
);
create index if not exists pets_user on public.pets (user_id);
alter table public.pets enable row level security;
drop policy if exists "see own and groupmates pets" on public.pets;
create policy "see own and groupmates pets" on public.pets for select to authenticated using (user_id = auth.uid() or public.shares_group(user_id));
grant select on public.pets to authenticated;

create table if not exists public.shop_items (
  id text primary key, en text not null, zh text not null, kind text not null, price int not null, val numeric, sort int not null default 0,
  desc_en text, desc_zh text
);
insert into public.shop_items (id, en, zh, kind, price, val, sort, desc_en, desc_zh) values
  ('ball',          'Protein Ball',      '蛋白球',     'ball',   30,  1.0, 1, 'Catch a monster. Works best at low HP.', '捉怪用。佢血越少越易捉。'),
  ('great_ball',    'Mass Gainer Ball',  '增肌球',     'ball',   70,  1.6, 2, 'Better catch chance (×1.6).', '更易捉（×1.6）。'),
  ('ultra_ball',    'Creatine Ball',     '肌酸球',     'ball',   150, 2.3, 3, 'Best catch chance (×2.3).', '最易捉（×2.3）。'),
  ('potion',        'Electrolyte Drink', '電解質飲品', 'potion', 25,  0.3, 4, 'Heal 30% in the tower or a boss fight. 2 items a fight.', '塔或者 Boss 戰回血 30%。每場最多用 2 件。'),
  ('super_potion',  'Recovery Shake',    '恢復奶昔',   'potion', 60,  0.6, 5, 'Heal 60%.', '回血 60%。')
on conflict (id) do update set en = excluded.en, zh = excluded.zh, kind = excluded.kind, price = excluded.price, val = excluded.val, sort = excluded.sort,
  desc_en = excluded.desc_en, desc_zh = excluded.desc_zh;
alter table public.shop_items enable row level security;
drop policy if exists "anyone reads shop" on public.shop_items;
create policy "anyone reads shop" on public.shop_items for select to authenticated using (true);
grant select on public.shop_items to authenticated;

create table if not exists public.user_items (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item text not null references public.shop_items (id),
  qty int not null default 0 check (qty >= 0),
  primary key (user_id, item)
);
alter table public.user_items enable row level security;
drop policy if exists "own items" on public.user_items;
create policy "own items" on public.user_items for select to authenticated using (user_id = auth.uid());
grant select on public.user_items to authenticated;

create or replace function public.coins_of(p_user uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce((public.character_card(p_user)->>'coins')::int, 0)
$$;
revoke all on function public.coins_of(uuid) from public, anon, authenticated;

-- pay with coins (a negative row in the ledger); false if you can't afford it
create or replace function public.spend_coins(p_user uuid, p_amount int, p_what text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('coins:' || p_user));
  if public.coins_of(p_user) < p_amount then return false; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta) values (p_user, 'spend', 'spend:' || gen_random_uuid(), 0, -p_amount, jsonb_build_object('for', p_what));
  return true;
end $$;
revoke all on function public.spend_coins(uuid, int, text) from public, anon, authenticated;

create or replace function public.shop_buy(p_item text, p_qty int default 1) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it shop_items;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into it from shop_items where id = p_item;
  if it.id is null or p_qty < 1 or p_qty > 20 then raise exception 'Can’t buy that'; end if;
  if not public.spend_coins(auth.uid(), it.price * p_qty, p_item || ' ×' || p_qty) then raise exception 'Not enough coins'; end if;
  insert into user_items (user_id, item, qty) values (auth.uid(), p_item, p_qty)
  on conflict (user_id, item) do update set qty = user_items.qty + p_qty;
  return jsonb_build_object('coins', public.coins_of(auth.uid()), 'qty', (select qty from user_items where user_id = auth.uid() and item = p_item));
end $$;

-- ---------- pets in battle ----------
-- a pet's fighter card: your stats × its species × its IVs
create or replace function public.pet_snapshot(p_pet uuid, p_owner jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pt pets; sp monsters; o jsonb; r jsonb; best numeric;
begin
  select * into pt from pets where id = p_pet; if pt.id is null then return null; end if;
  select * into sp from monsters where idx = pt.species;
  o := coalesce(p_owner, public.fighter_snapshot(pt.user_id)); r := sp.ratios;
  -- attack, speed and technique come from your best one, so a climbing pet still hits hard for a lifter
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.85;
  return jsonb_build_object('pet', pt.id, 'species', sp.idx, 'name', pt.nickname, 'level', o->'level', 'type', sp.type, 'grit', false,
    'hp',  greatest(20, round((o->>'hp')::numeric  * (r->>'hp')::numeric  * (1 + (pt.iv->>'hp')::numeric))),
    'atk', greatest(10, round(best * (r->>'atk')::numeric * (1 + (pt.iv->>'atk')::numeric))),
    'def', greatest(5,  round((o->>'def')::numeric * (r->>'def')::numeric * (1 + (pt.iv->>'def')::numeric))),
    'spd', greatest(5,  round(best * (r->>'spd')::numeric * (1 + (pt.iv->>'spd')::numeric))),
    'tec', greatest(5,  round(best * (r->>'tec')::numeric * (1 + (pt.iv->>'tec')::numeric))),
    'moves', (select jsonb_agg(public.move_json(x) order by array_position(sp.moves, x.id)) from moves x where x.id = any(sp.moves)));
end $$;
revoke all on function public.pet_snapshot(uuid, jsonb) from public, anon, authenticated;

-- you, then your team in slot order
create or replace function public.party_snapshot(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  me := public.fighter_snapshot(p_user);
  return jsonb_build_array(me) || coalesce((select jsonb_agg(public.pet_snapshot(id, me) order by slot) from pets where user_id = p_user and slot is not null), '[]'::jsonb);
end $$;
revoke all on function public.party_snapshot(uuid) from public, anon, authenticated;

-- monsters get tougher with a bigger team: +50% HP and +6% attack per extra member
create or replace function public.scale_for_party(p_mon jsonb, p_n int) returns jsonb language sql immutable as $$
  select p_mon || jsonb_build_object('hp', round((p_mon->>'hp')::numeric * (1 + 0.5 * (p_n - 1))),
    'atk', round((p_mon->>'atk')::numeric * (1 + 0.06 * (p_n - 1))), 'tec', round((p_mon->>'tec')::numeric * (1 + 0.06 * (p_n - 1))),
    'spd', round((p_mon->>'spd')::numeric * (1 + 0.06 * (p_n - 1))))
$$;

-- the state a team fight starts from
create or replace function public.party_state0(p_party jsonb, sb jsonb) returns jsonb language sql immutable as $$
  select public.battle_state0(p_party->0, sb) || jsonb_build_object('active', 0, 'items', 0,
    'party', (select jsonb_agg(jsonb_build_object('hp', x->'hp', 'max', x->'hp')) from jsonb_array_elements(p_party) x))
$$;

-- bring in team member nxt (keeps the one going out's HP)
create or replace function public.party_switch_state(st jsonb, snap jsonb, nxt int) returns jsonb language plpgsql immutable as $$
declare cur text := st->>'active';
begin
  if (st->'party'->cur->>'hp')::int > 0 then st := jsonb_set(st, array['party', cur, 'hp'], st->'hp'->'a'); end if;
  st := jsonb_set(st, array['hp', 'a'], st->'party'->nxt->'hp');
  st := jsonb_set(st, array['max', 'a'], st->'party'->nxt->'max');
  st := jsonb_set(jsonb_set(jsonb_set(st, '{atk,a}', '0'), '{def,a}', '0'), '{lock,a}', '0');
  st := jsonb_set(st, '{ramp,a}', '{}'::jsonb);
  return jsonb_set(st, '{active}', to_jsonb(nxt));
end $$;

-- switch to another team member: uses your turn
create or replace function public.battle_switch(p_id uuid, p_to int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; st jsonb;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' or bt.turn is distinct from auth.uid() or bt.snap->'party' is null then raise exception 'You can’t switch now'; end if;
  if p_to = (bt.state->>'active')::int or p_to < 0 or p_to >= jsonb_array_length(bt.snap->'party') then raise exception 'Pick someone else'; end if;
  if (bt.state->'party'->p_to->>'hp')::int <= 0 then raise exception 'They’re out of this fight'; end if;
  st := public.party_switch_state(bt.state, bt.snap, p_to);
  update battles set snap = jsonb_set(bt.snap, '{a}', bt.snap->'party'->p_to), state = st, turn = null,
    log = log || jsonb_build_object('t', 'switch', 'who', 'a', 'to', p_to), updated_at = now(), last_move_at = now() where id = p_id;
  return jsonb_build_array(jsonb_build_object('t', 'switch', 'who', 'a', 'to', p_to)) || public.monster_turns(p_id);
end $$;

-- use an item: a potion heals whoever is fighting (2 items a fight); a ball tries to catch the monster
create or replace function public.battle_item(p_id uuid, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; it shop_items; st jsonb; ev jsonb; sp monsters; frac numeric; chance numeric; amt int; pid uuid; iv jsonb; ok boolean;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' or bt.turn is distinct from auth.uid() or bt.kind not in ('tower', 'lair') then raise exception 'You can’t use items now'; end if;
  select * into it from shop_items where id = p_item;
  if it.id is null or not exists (select 1 from user_items where user_id = auth.uid() and item = p_item and qty > 0) then raise exception 'You don’t have that'; end if;
  st := bt.state;
  if it.kind = 'potion' then
    if coalesce((st->>'items')::int, 0) >= 2 then raise exception 'Only 2 drinks a fight'; end if;
    amt := least((st->'max'->>'a')::int - (st->'hp'->>'a')::int, round((st->'max'->>'a')::int * it.val));
    st := jsonb_set(jsonb_set(st, '{hp,a}', to_jsonb((st->'hp'->>'a')::int + amt)), '{items}', to_jsonb(coalesce((st->>'items')::int, 0) + 1));
    ev := jsonb_build_object('t', 'item', 'who', 'a', 'item', p_item, 'heal', amt);
    update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item;
    update battles set state = st, turn = null, log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
    return jsonb_build_array(ev) || public.monster_turns(p_id);
  end if;
  -- a ball
  select * into sp from monsters where idx = (bt.snap->'b'->>'monster')::int;
  frac := (st->'hp'->>'b')::numeric / greatest(1, (st->'max'->>'b')::numeric);
  if sp.boss and frac > 0.3 then raise exception 'Bosses can only be caught at 30%% HP or less'; end if;
  chance := least(0.95, sp.catch_rate * it.val * (1 - frac) * 1.6 * (case when (bt.snap->'b'->>'elite')::boolean then 0.7 else 1 end) + 0.02);
  ok := random() < chance;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item;
  if ok then
    iv := jsonb_build_object('hp', round((random() * 0.4 - 0.2)::numeric, 3), 'atk', round((random() * 0.4 - 0.2)::numeric, 3), 'def', round((random() * 0.4 - 0.2)::numeric, 3),
      'spd', round((random() * 0.4 - 0.2)::numeric, 3), 'tec', round((random() * 0.4 - 0.2)::numeric, 3));
    insert into pets (user_id, species, iv, caught_in) values (auth.uid(), sp.idx, iv, bt.kind) returning id into pid;
    ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', true, 'pet', pid, 'iv', iv, 'species', sp.idx, 'chance', round(chance, 2));
    update battles set state = jsonb_set(st, '{caught}', to_jsonb(pid)), status = 'done', winner_side = 'a', winner = bt.a, turn = null,
      log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
    if bt.kind = 'tower' then perform public.tower_finish(p_id); end if;
    return jsonb_build_array(ev);
  end if;
  ev := jsonb_build_object('t', 'catch', 'who', 'a', 'item', p_item, 'ok', false, 'chance', round(chance, 2));
  update battles set turn = null, log = log || ev, updated_at = now(), last_move_at = now() where id = p_id;
  return jsonb_build_array(ev) || public.monster_turns(p_id);
end $$;

-- your pets, with what they'd fight with now
create or replace function public.my_pets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  me := public.fighter_snapshot(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'nickname', p.nickname, 'slot', p.slot, 'iv', p.iv,
      'caught_at', p.caught_at, 'boss', m.boss, 'type', m.type, 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

-- your team: up to 5 pets, in this order
create or replace function public.set_team(p_pets uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(array_length(p_pets, 1), 0) > 5 then raise exception 'Up to 5 pets in your team'; end if;
  if exists (select 1 from unnest(p_pets) x where not exists (select 1 from pets where id = x and user_id = auth.uid())) then raise exception 'Not your pet'; end if;
  update pets set slot = null where user_id = auth.uid();
  update pets p set slot = x.i from unnest(p_pets) with ordinality x(id, i) where p.id = x.id and p.user_id = auth.uid();
end $$;

create or replace function public.pet_update(p_pet uuid, p_nickname text, p_release boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pets where id = p_pet and user_id = auth.uid()) then raise exception 'Not your pet'; end if;
  if p_release then delete from pets where id = p_pet; return; end if;
  update pets set nickname = nullif(left(btrim(coalesce(p_nickname, '')), 20), '') where id = p_pet;
end $$;

create or replace function public.my_items() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('coins', public.coins_of(auth.uid()),
    'items', coalesce((select jsonb_object_agg(item, qty) from user_items where user_id = auth.uid() and qty > 0), '{}'::jsonb))
$$;

-- ---------- the tower with your team ----------
create or replace function public.tower_fight() returns uuid
language plpgsql security definer set search_path = public as $$
declare p profiles; f int; party jsonb; sb jsonb; bid uuid; first text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'tower' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  select * into p from profiles where id = auth.uid() for update;
  if p.tickets < 1 then raise exception 'No tickets left. Check in at the gym to get 3 more.'; end if;
  f := p.tower_floor + 1;
  party := public.party_snapshot(auth.uid());
  sb := public.scale_for_party(public.monster_snapshot(public.tower_monster_idx(f), public.tower_level(f), public.tower_scale(f), f % 5 = 0), jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  update profiles set tickets = tickets - 1 where id = auth.uid();
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('tower', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

-- ---------- the boss lair: fight a boss species to catch it ----------
create or replace function public.lair_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null then return null; end if;
  return jsonb_build_object(
    'free', not exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d),
    'tickets', (select tickets from profiles where id = auth.uid()), 'coins', public.coins_of(auth.uid()), 'price', 40,
    'open', (select id from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1),
    'bosses', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type,
                 'caught', (select count(*) from pets where user_id = auth.uid() and species = m.idx)) order by m.idx) from monsters m where m.boss));
end $$;

create or replace function public.lair_fight(p_species int, p_pay text) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; sp monsters; party jsonb; o jsonb; sb jsonb; bid uuid; first text; best numeric;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  select * into sp from monsters where idx = p_species and boss;
  if sp.idx is null then raise exception 'No such boss'; end if;
  if p_pay = 'free' then
    if exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d) then
      raise exception 'Today’s free try is used. Use a ticket or 40 coins.'; end if;
  elsif p_pay = 'ticket' then
    update profiles set tickets = tickets - 1 where id = auth.uid() and tickets > 0;
    if not found then raise exception 'No tickets left'; end if;
  elsif p_pay = 'coins' then
    if not public.spend_coins(auth.uid(), 40, 'lair') then raise exception 'Not enough coins'; end if;
  else raise exception 'Pay with free, ticket or coins'; end if;
  party := public.party_snapshot(auth.uid()); o := party->0;
  -- the boss is matched to you: your own stats × its species, a bit stronger, with lots of HP
  -- (its attacking stats are scaled so its strongest one is 65% of yours; Phoenix is fast, Dragon strong, but none outclasses you)
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.65
        / greatest((sp.ratios->>'atk')::numeric, (sp.ratios->>'spd')::numeric, (sp.ratios->>'tec')::numeric);
  sb := public.monster_snapshot(sp.idx, (o->>'level')::int + 2, 1, false) || jsonb_build_object('boss_pet', true,
    'hp',  round((o->>'hp')::numeric  * (sp.ratios->>'hp')::numeric * 1.1),
    'def', round((o->>'def')::numeric * (sp.ratios->>'def')::numeric * 0.85),
    'atk', round(best * (sp.ratios->>'atk')::numeric), 'spd', round(best * (sp.ratios->>'spd')::numeric), 'tec', round(best * (sp.ratios->>'tec')::numeric));
  sb := public.scale_for_party(sb, jsonb_array_length(party));
  first := case when (o->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, species, pay, status, turn, snap, state, log, last_move_at)
  values ('lair', auth.uid(), sp.idx, p_pay, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', o, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

-- beating a boss without catching it: 15 coins and 20 XP
create or replace function public.lair_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles;
begin
  select * into bt from battles where id = p_id;
  if bt.winner_side is distinct from 'a' or bt.state ? 'caught' then return; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta) values (bt.a, 'lair', 'lair:' || p_id, 20, 15, jsonb_build_object('species', bt.species))
  on conflict do nothing;
end $$;
revoke all on function public.lair_finish(uuid) from public, anon, authenticated;

-- fleeing works for the lair too
create or replace function public.battle_flee(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' or bt.a <> auth.uid() or bt.kind = 'pvp' then return; end if;
  update battles set status = 'done', winner_side = case when bt.kind = 'raid' then null else 'b' end, turn = null,
    log = log || jsonb_build_object('t', 'flee'), updated_at = now() where id = p_id;
  if bt.kind = 'raid' then perform public.raid_finish(p_id); end if;
end $$;

-- try a pet out: free, no rewards, against the monster on your next tower floor
create or replace function public.pet_test(p_pet uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare f int; pa jsonb; sb jsonb; bid uuid; first text;
begin
  if not exists (select 1 from pets where id = p_pet and user_id = auth.uid()) then raise exception 'Not your pet'; end if;
  update battles set status = 'done', turn = null where a = auth.uid() and kind = 'test' and status = 'active';
  select tower_floor + 1 into f from profiles where id = auth.uid();
  pa := public.pet_snapshot(p_pet);
  sb := public.monster_snapshot(public.tower_monster_idx(f), public.tower_level(f), public.tower_scale(f), false);
  first := case when (pa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('test', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', pa, 'b', sb),
          public.battle_state0(pa, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;
revoke all on function public.pet_test(uuid) from public, anon;
grant execute on function public.pet_test(uuid) to authenticated;

revoke all on function public.shop_buy(text, int), public.battle_switch(uuid, int), public.battle_item(uuid, text), public.my_pets(), public.set_team(uuid[]),
  public.pet_update(uuid, text, boolean), public.my_items(), public.lair_status(), public.lair_fight(int, text) from public, anon;
grant execute on function public.shop_buy(text, int), public.battle_switch(uuid, int), public.battle_item(uuid, text), public.my_pets(), public.set_team(uuid[]),
  public.pet_update(uuid, text, boolean), public.my_items(), public.lair_status(), public.lair_fight(int, text) to authenticated;

-- ---------- the engine, now with teams ----------
create or replace function public.battle_step(p_id uuid, p_side text, p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  SCALE constant numeric := 3.0;
  bt battles; me text; th text; mv jsonb; st jsonb; ev jsonb; s_me jsonb; s_th jsonb;
  hits int := 1; i int; dmg int; total int := 0; crit boolean; eff numeric; stab numeric; a numeric; d numeric; pw numeric; lv int;
  crits int := 0; dmgs jsonb := '[]'::jsonb; ko boolean := false; flinched boolean := false; hp_th int; hp_me int; amt int; nxt int;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'active' then raise exception 'This battle isn’t on'; end if;
  me := p_side; th := case when me = 'a' then 'b' else 'a' end;
  s_me := bt.snap->me; s_th := bt.snap->th; st := bt.state;
  select x into mv from jsonb_array_elements(s_me->'moves') x where x->>'id' = p_move;
  if mv is null then raise exception 'You don’t have that move'; end if;
  -- limited uses (like PP): healing twice a battle, boosts three times
  -- limited uses (like PP): the move's own limit, else healing twice a battle and boosts three times
  if mv->'uses' is not null and jsonb_typeof(mv->'uses') = 'number' or mv->>'effect' in ('heal', 'heal_buff', 'buff_atk', 'buff_def', 'buff_both') then
    if coalesce((st->'used'->me->>p_move)::int, 0) >= coalesce((mv->>'uses')::int, case when mv->>'effect' in ('heal', 'heal_buff') then 2 else 3 end) then raise exception 'No uses left for that move'; end if;
    st := jsonb_set(st, array['used'], coalesce(st->'used', '{"a":{},"b":{}}'::jsonb));
    st := jsonb_set(st, array['used', me, p_move], to_jsonb(coalesce((st->'used'->me->>p_move)::int, 0) + 1));
  end if;
  ev := jsonb_build_object('t', 'move', 'who', me, 'move', p_move);
  hp_th := (st->'hp'->>th)::int; hp_me := (st->'hp'->>me)::int; lv := (s_me->>'level')::int;

  if (mv->>'power')::int > 0 then
    if mv->>'effect' = 'multi' then hits := 2 + (case when random() < 0.5 then 1 else 0 end); end if;
    pw := (mv->>'power')::int;
    if mv->>'effect' = 'ramp' then
      pw := pw + coalesce((st->'ramp'->me->>p_move)::int, 0) * (mv->>'val')::numeric;
      st := jsonb_set(st, array['ramp', me, p_move], to_jsonb(coalesce((st->'ramp'->me->>p_move)::int, 0) + 1));
    end if;
    -- fusion moves use the higher of their stats
    a := (select max((s_me->>x)::numeric) from jsonb_array_elements_text(coalesce(mv->'stats', jsonb_build_array(mv->>'stat'))) x)
         * public.stage_mult((st->'atk'->>me)::int);
    d := (s_th->>'def')::numeric * public.stage_mult((st->'def'->>th)::int) + 50;   -- +50 softens big defence gaps
    -- fusion moves have two or three types: your type matching any of them counts, and the best match-up is used
    stab := case when s_me->>'type' in (select jsonb_array_elements_text(coalesce(mv->'types', jsonb_build_array(mv->>'type')))) then 1.5 else 1 end;
    eff := (select max(public.type_eff(x, s_th->>'type')) from jsonb_array_elements_text(coalesce(mv->'types', jsonb_build_array(mv->>'type'))) x);
    if mv->>'effect' = 'nocounter' then eff := greatest(1, eff); end if;
    for i in 1..hits loop
      crit := random() < (1.0 / 16 + coalesce(case when mv->>'effect' = 'crit' then (mv->>'val')::numeric end, 0));
      dmg := greatest(1, round((((2 * lv / 5.0 + 2) * pw * a / d) / 50 + 2) * stab * eff * (0.85 + random() * 0.15) * (case when crit then 1.5 else 1 end) * SCALE));
      total := total + dmg; dmgs := dmgs || to_jsonb(dmg); if crit then crits := crits + 1; end if;
    end loop;
    hp_th := hp_th - total;
    ev := ev || jsonb_build_object('dmg', dmgs, 'crit', crits, 'eff', eff);
    if mv->>'effect' = 'recoil' then
      amt := greatest(1, round(total * (mv->>'val')::numeric)); hp_me := hp_me - amt; ev := ev || jsonb_build_object('recoil', amt);
    end if;
    if mv->>'effect' = 'flinch' and random() < (mv->>'val')::numeric then flinched := true; ev := ev || jsonb_build_object('flinch', true); end if;
    if mv->>'effect' = 'lock' then
      st := jsonb_set(st, array['atk', th], to_jsonb(greatest(-4, (st->'atk'->>th)::int - 1)));
      st := jsonb_set(st, array['lock', th], to_jsonb((mv->>'val')::int));
      ev := ev || jsonb_build_object('lock', true);
    end if;
  elsif mv->>'effect' in ('buff_atk', 'buff_def', 'buff_both') then
    -- boosts stack up to +3 (×2.5)
    if (st->'lock'->>me)::int > 0 then ev := ev || jsonb_build_object('fail', 'locked');
    else
      if mv->>'effect' in ('buff_atk', 'buff_both') then st := jsonb_set(st, array['atk', me], to_jsonb(least(3, (st->'atk'->>me)::int + (mv->>'val')::int))); end if;
      if mv->>'effect' in ('buff_def', 'buff_both') then st := jsonb_set(st, array['def', me], to_jsonb(least(3, (st->'def'->>me)::int + (mv->>'val')::int))); end if;
      ev := ev || jsonb_build_object('buff', case mv->>'effect' when 'buff_atk' then 'atk' when 'buff_def' then 'def' else 'both' end, 'by', (mv->>'val')::int);
    end if;
  elsif mv->>'effect' = 'heal_buff' then
    -- heal and +1 attack and defence
    amt := least((st->'max'->>me)::int - hp_me, round((st->'max'->>me)::int * (mv->>'val')::numeric));
    hp_me := hp_me + amt;
    st := jsonb_set(st, array['atk', me], to_jsonb(least(3, (st->'atk'->>me)::int + 1)));
    st := jsonb_set(st, array['def', me], to_jsonb(least(3, (st->'def'->>me)::int + 1)));
    ev := ev || jsonb_build_object('heal', amt, 'buff', 'both', 'by', 1);
  elsif mv->>'effect' = 'heal' then
    amt := least((st->'max'->>me)::int - hp_me, round((st->'max'->>me)::int * (mv->>'val')::numeric));
    hp_me := hp_me + amt; ev := ev || jsonb_build_object('heal', amt);
  end if;

  -- knockouts (Grit saves you once on 1 HP)
  if hp_th <= 0 then
    if (s_th->>'grit')::boolean and not (st->'grit'->>th)::boolean then hp_th := 1; st := jsonb_set(st, array['grit', th], 'true'); ev := ev || jsonb_build_object('grit', th);
    else hp_th := 0; ko := true; ev := ev || jsonb_build_object('ko', th); end if;
  end if;
  if not ko and hp_me <= 0 then
    if (s_me->>'grit')::boolean and not (st->'grit'->>me)::boolean then hp_me := 1; st := jsonb_set(st, array['grit', me], 'true'); ev := ev || jsonb_build_object('grit', me);
    else hp_me := 0; ev := ev || jsonb_build_object('ko', me); end if;
  end if;
  st := jsonb_set(jsonb_set(st, array['hp', th], to_jsonb(hp_th)), array['hp', me], to_jsonb(hp_me));
  if (st->'lock'->>me)::int > 0 then st := jsonb_set(st, array['lock', me], to_jsonb((st->'lock'->>me)::int - 1)); end if;

  if me = 'a' then st := jsonb_set(st, array['moves'], to_jsonb(coalesce((st->>'moves')::int, 0) + 1)); end if;

  -- your team: when the one fighting goes down and someone's left, the next one comes in (your go)
  if (st->'hp'->>'a')::int <= 0 and not (me = 'a' and ko) and jsonb_array_length(coalesce(bt.snap->'party', '[]'::jsonb)) > 1 then
    st := jsonb_set(st, array['party', (st->>'active'), 'hp'], '0');
    select (x.i - 1)::int into nxt from jsonb_array_elements(st->'party') with ordinality x(p, i) where (x.p->>'hp')::int > 0 order by x.i limit 1;
    if nxt is not null then
      st := public.party_switch_state(st, bt.snap, nxt);
      ev := ev || jsonb_build_object('next', nxt);
      update battles set snap = jsonb_set(bt.snap, array['a'], bt.snap->'party'->nxt), state = st, log = log || ev,
        turn = bt.a, winner_side = null, updated_at = now(), last_move_at = now() where id = p_id;
      return ev;
    end if;
  end if;

  if ko or hp_me <= 0 or (bt.kind = 'raid' and coalesce((st->>'moves')::int, 0) >= 8) then
    -- the end: in a raid you're timed out after 8 moves; the side still standing wins
    update battles set state = st, log = log || ev, status = 'done', turn = null,
      winner_side = case when ko then me when hp_me <= 0 then th else null end,
      winner = case when ko then (case when me = 'a' then bt.a else bt.b end) when hp_me <= 0 then (case when th = 'a' then bt.a else bt.b end) end,
      updated_at = now(), last_move_at = now() where id = p_id;
    if bt.kind = 'tower' then perform public.tower_finish(p_id);
    elsif bt.kind = 'raid' then perform public.raid_finish(p_id);
    elsif bt.kind = 'lair' then perform public.lair_finish(p_id); end if;
  else
    update battles set state = st, log = log || ev,
      turn = case when (case when flinched then me else th end) = 'a' then bt.a else bt.b end,   -- null = the monster's go
      winner_side = null,
      updated_at = now(), last_move_at = now() where id = p_id;
  end if;
  return ev;
end $$;
revoke all on function public.battle_step(uuid, text, text) from public, anon, authenticated;
