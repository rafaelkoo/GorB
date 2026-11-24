-- Shop moves and the lazy monsters.
--   Shop moves: a separate set of moves bought with coins (moves.req_kind = 'shop', moves.price).
--     They never count towards fusions and only ONE can be in your 4 at a time, so the moves your
--     training teaches stay the core of how you fight. Owned for good once bought.
--   Monsters: species 6–15 become the excuses that keep you from the gym (takeaway, the warm duvet,
--     rain, sore muscles, overtime, beer, "I'll start Monday", "tomorrow", binge-watching, excuses).
--     Same slots, types and stat shapes as before, new names and moves. Couch King and Midnight
--     Hydra stay.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.moves add column if not exists price int;
alter table public.moves drop constraint if exists moves_req_kind_check;

insert into public.moves (id, en, zh, type, stat, power, effect, effect_val, req_kind, req_val, price, desc_en, desc_zh, sort) values
  -- shop moves
  ('caffeine_kick', 'Caffeine Kick', '咖啡因衝擊', 'endurance', 'spd', 55, 'crit', 0.2, 'shop', 0, 120, 'A double espresso straight into the fight.', '一杯雙份特濃直接入場。', 200),
  ('wrist_wraps',   'Wrist-Wrap Jab', '護腕重拳', 'strength',  'atk', 60, 'flinch', 0.2, 'shop', 0, 120, 'Wrapped up and swinging.', '紮好護腕，一拳過去。', 201),
  ('chalk_cloud',   'Chalk Cloud',   '粉袋突襲',  'climbing',  'tec', 60, 'crit', 0.2, 'shop', 0, 120, 'A puff of chalk, then a strike.', '撥一嘢粉，再出手。', 202),
  ('battle_ropes',  'Battle Ropes',  '戰繩連擊',  'normal',    'atk', 20, 'multi', null, 'shop', 0, 150, 'Wave after wave.', '一浪接一浪。', 203),
  ('foam_roll',     'Foam Roll',     '筋膜放鬆',  'normal',    'none', 0, 'heal', 0.3, 'shop', 0, 100, 'Roll out the aches mid-fight.', '打到一半碌一碌，舒服返。', 204),
  ('lifting_belt',  'Lifting Belt',  '舉重腰帶',  'normal',    'none', 0, 'buff_def', 1, 'shop', 0, 80, 'Brace up: defence rises.', '收緊腰帶：防禦提升。', 205),
  ('pre_workout',   'Pre-Workout',   '運動前飲品', 'normal',   'none', 0, 'buff_both', 1, 'shop', 0, 180, 'Tingly hands, attack and defence up.', '手痺痺，攻擊同防禦都升。', 206),
  -- the lazy monsters' moves
  ('delivery_dash',    'Delivery Dash',     '外賣衝刺',   'strength',  'atk', 55, 'crit', 0.15, 'monster', 0, null, 'Your order has arrived.', '你嘅外賣到咗。', 300),
  ('blanket_wrap',     'Duvet Wrap',        '被竇纏身',   'endurance', 'spd', 40, 'lock', 1, 'monster', 0, null, 'Just five more minutes…', '再瞓五分鐘…', 301),
  ('downpour',         'Downpour',          '傾盆大雨',   'climbing',  'tec', 20, 'multi', null, 'monster', 0, null, 'Too wet to go out.', '咁大雨點出街。', 302),
  ('doms_ache',        'DOMS Ache',         '肌肉痠痛',   'normal',    'atk', 40, 'flinch', 0.25, 'monster', 0, null, 'Still sore from Tuesday.', '星期二練完仲痛緊。', 303),
  ('overtime_crunch',  'Overtime Crunch',   '加班地獄',   'endurance', 'spd', 35, 'ramp', 20, 'monster', 0, null, 'One more email. And another.', '再覆多封 email，又一封。', 304),
  ('beer_belly',       'Beer Belly Bump',   '啤酒肚撞',   'strength',  'atk', 50, 'recoil', 0.1, 'monster', 0, null, 'One pint turned into five.', '話飲一杯，飲咗五杯。', 305),
  ('start_monday',     'Start Next Monday', '下星期一先', 'strength',  'atk', 100, 'recoil', 0.2, 'monster', 0, null, 'The diet, the gym, everything: next Monday.', '減肥、gym、乜都好：下星期一先。', 306),
  ('tomorrow_promise', 'Tomorrow, Promise', '聽日先',     'endurance', 'none', 0, 'heal', 0.3, 'monster', 0, null, 'It rises again every day.', '每日都重新復活。', 307),
  ('binge_grab',       'Next Episode',      '下一集',     'climbing',  'tec', 70, 'lock', 1, 'monster', 0, null, 'Autoplay in 5… 4… 3…', '自動播放 5… 4… 3…', 308),
  ('excuse_wall',      'Wall of Excuses',   '藉口牆',     'normal',    'none', 0, 'buff_def', 2, 'monster', 0, null, 'Brick after brick of reasons.', '一磚一磚嘅理由。', 309)
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power, effect = excluded.effect,
  effect_val = excluded.effect_val, req_kind = excluded.req_kind, req_val = excluded.req_val, price = excluded.price, desc_en = excluded.desc_en,
  desc_zh = excluded.desc_zh, sort = excluded.sort;

-- the excuses (6–15)
update public.monsters m set en = v.en, zh = v.zh, moves = v.mv from (values
  (6,  'Takeaway Goblin',   '外賣哥布林',   '{delivery_dash,snack_breath,sugar_rush}'::text[]),
  (7,  'Duvet Burrito',     '被竇卷',       '{blanket_wrap,snooze,couch_sink}'),
  (8,  'Rain Cloud',        '落雨雲',       '{downpour,doomscroll,notif_ping}'),
  (9,  'DOMS Jelly',        '肌肉痛啫喱',   '{doms_ache,snooze,couch_sink}'),
  (10, 'Overtime Ghost',    '加班鬼',       '{overtime_crunch,notif_ping,alarm_blast}'),
  (11, 'Beer Belly Barrel', '啤酒肚桶',     '{beer_belly,snack_breath,couch_sink}'),
  (12, 'Next-Monday Dragon','下星期一龍',   '{start_monday,snack_breath,sugar_rush}'),
  (13, 'Tomorrow Phoenix',  '聽日先鳳凰',   '{overtime_crunch,alarm_blast,tomorrow_promise}'),
  (14, 'Binge Kraken',      '追劇八爪魚',   '{binge_grab,doomscroll,downpour}'),
  (15, 'Excuse Golem',      '藉口魔像',     '{cushion_slam,excuse_wall,doms_ache}')
) v(idx, en, zh, mv) where m.idx = v.idx;

-- ---------- owning shop moves ----------
create table if not exists public.user_moves (
  user_id uuid not null references public.profiles (id) on delete cascade,
  move text not null references public.moves (id),
  bought_at timestamptz not null default now(),
  primary key (user_id, move)
);
alter table public.user_moves enable row level security;
drop policy if exists "own and groupmates moves" on public.user_moves;
create policy "own and groupmates moves" on public.user_moves for select to authenticated using (user_id = auth.uid() or public.shares_group(user_id));
grant select on public.user_moves to authenticated;

create or replace function public.buy_move(p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m moves;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into m from moves where id = p_move and req_kind = 'shop';
  if m.id is null then raise exception 'That move isn’t for sale'; end if;
  if exists (select 1 from user_moves where user_id = auth.uid() and move = p_move) then raise exception 'You already have it'; end if;
  if not public.spend_coins(auth.uid(), m.price, 'move ' || p_move) then raise exception 'Not enough coins'; end if;
  insert into user_moves (user_id, move) values (auth.uid(), p_move);
  return jsonb_build_object('coins', public.coins_of(auth.uid()));
end $$;
revoke all on function public.buy_move(text) from public, anon;
grant execute on function public.buy_move(text) to authenticated;

create or replace function public.character_moves(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Europe/London')::date - 59;
  boulder_climbs int; lifts jsonb; mx numeric; sets60 int; cardio60 int; grade int; climbs60 int; days60 int; learned text[]; eq text[]; bought text[];
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  select coalesce(jsonb_object_agg(cat, round(best)), '{}'::jsonb), coalesce(max(best), 0) into lifts, mx from (
    select coalesce(ec.cat, ce.cat, 'other') as cat, max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as best
    from workouts w join workout_sets s on s.workout_id = w.id
    left join exercise_cat ec on ec.id = s.exercise_id
    left join custom_exercises ce on ce.id = s.exercise_id
    where w.user_id = p_user and w.performed_on >= since and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500
      and s.exercise_id <> 'wall_climb' and coalesce(ce.kind, '') <> 'timed'
    group by 1) b;
  select count(*) into sets60 from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = p_user and w.performed_on >= since and s.reps >= 1;
  select coalesce(sum(minutes) filter (where kind <> 'boulder'), 0), coalesce(sum(minutes) filter (where kind = 'boulder'), 0) / 4
    into cardio60, boulder_climbs from cardio_logs where user_id = p_user and performed_on >= since;
  select coalesce(max(s.weight_kg), -1), count(*) into grade, climbs60 from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = p_user and w.performed_on >= since and s.exercise_id = 'wall_climb' and s.reps >= 1;
  climbs60 := climbs60 + boulder_climbs;   -- bouldering minutes: 4 min ≈ 1 climb
  select count(distinct (created_at at time zone 'Europe/London')::date) into days60 from checkins where user_id = p_user and (created_at at time zone 'Europe/London')::date >= since;

  select coalesce(array_agg(id order by sort), '{}') into learned from moves m where
    case m.req_kind
      when 'always' then true
      when 'lift' then coalesce((lifts->>m.req_cat)::numeric, 0) >= m.req_val
      when 'maxlift' then mx >= m.req_val
      when 'sets' then sets60 >= m.req_val
      when 'cardio' then cardio60 >= m.req_val
      when 'climb' then grade >= m.req_val
      when 'climbs' then climbs60 >= m.req_val
      else false
    end;
  -- fusions: all their parts learned
  learned := learned || coalesce((select array_agg(id order by sort) from moves where req_kind = 'fusion' and req_moves <@ learned), '{}');
  -- moves bought in the shop: kept apart from what training teaches, and only one of them in your 4
  select coalesce(array_agg(u.move order by m.sort), '{}') into bought from user_moves u join moves m on m.id = u.move where u.user_id = p_user;
  select array(select x from unnest(coalesce(p.battle_moves, '{}')) x where x = any(learned) or x = any(bought) limit 4) into eq from profiles p where p.id = p_user;
  if (select count(*) from unnest(eq) x where x = any(bought)) > 1 then
    eq := array(select x from unnest(eq) with ordinality u(x, i)
      where not x = any(bought) or i = (select min(i2) from unnest(eq) with ordinality v(y, i2) where y = any(bought)) order by i);
  end if;
  if coalesce(array_length(eq, 1), 0) < 4 then
    eq := eq || array(select id from moves where id = any(learned) and not id = any(eq)
      order by (case when effect like 'buff%' or effect like 'heal%' then 1 else 0 end), power desc limit 4 - coalesce(array_length(eq, 1), 0));
  end if;
  return jsonb_build_object(
    'basis', jsonb_build_object('lifts', lifts, 'max', round(mx), 'sets', sets60, 'cardio', cardio60, 'grade', grade, 'climbs', climbs60, 'days', days60),
    'learned', to_jsonb(learned), 'bought', to_jsonb(bought), 'equipped', to_jsonb(eq), 'grit', days60 >= 12);
end $$;

-- equip: anything you've learned, plus at most one bought move
create or replace function public.set_moves(p_moves text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cm jsonb; shop_seen boolean := false; keep text[] := '{}'; x text;
begin
  if auth.uid() is null then return null; end if;
  cm := public.character_moves(auth.uid());
  foreach x in array coalesce(p_moves, '{}') loop
    exit when coalesce(array_length(keep, 1), 0) >= 4;
    if x = any(keep) then continue; end if;
    if cm->'learned' ? x then keep := keep || x;
    elsif cm->'bought' ? x and not shop_seen then keep := keep || x; shop_seen := true;
    end if;
  end loop;
  update profiles set battle_moves = keep where id = auth.uid();
  return public.character_moves(auth.uid());
end $$;
revoke all on function public.set_moves(text[]) from public, anon;
grant execute on function public.set_moves(text[]) to authenticated;

alter table public.moves add constraint moves_req_kind_check
  check (req_kind in ('always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'climbs', 'fusion', 'monster', 'shop'));

-- ---------- boss floors: every 5th tower floor is a boss species, and beating it opens it in the Boss Lair ----------
-- boss floors: 5 → species 12, 10 → 13, … 30 → 17, then round again; the other floors take the 12 in turn
create or replace function public.tower_monster_idx(p_floor int) returns int language sql immutable as $$
  select case when p_floor % 5 = 0 then 12 + ((p_floor / 5 - 1) % 6)
              else (array[0, 2, 9, 1, 6, 4, 7, 3, 10, 8, 5, 11])[(p_floor - p_floor / 5 - 1) % 12 + 1] end
$$;
-- the boss on floor 5k is lair species 12 + (k−1)
create or replace function public.lair_unlocked(p_user uuid, p_species int) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select tower_floor from profiles where id = p_user), 0) >= 5 * (p_species - 11)
$$;
revoke all on function public.lair_unlocked(uuid, int) from public, anon, authenticated;

-- the monster on a floor. Boss floors use the boss's own shape at tower strength, as an elite.
create or replace function public.tower_snapshot(p_floor int) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare i int := public.tower_monster_idx(p_floor); m monsters; s numeric := public.tower_scale(p_floor); r jsonb;
begin
  if p_floor % 5 <> 0 then return public.monster_snapshot(i, public.tower_level(p_floor), s, false); end if;
  select * into m from monsters where idx = i; r := m.ratios;
  return public.monster_snapshot(i, public.tower_level(p_floor) + 1, s, true) || jsonb_build_object('boss_floor', true,
    -- about as tough as the old elites: its shape, but evened out so no boss is a wall
    'hp',  round(62 * s * 1.3 * (r->>'hp')::numeric / 1.25),
    'def', round(18 * s * (r->>'def')::numeric / 1.15),
    'spd', round(22 * s * (r->>'spd')::numeric / 1.2),
    'atk', round(27 * s * 1.15 * (r->>'atk')::numeric / greatest((r->>'atk')::numeric, (r->>'spd')::numeric, (r->>'tec')::numeric)),
    'tec', round(27 * s * 1.15 * (r->>'tec')::numeric / greatest((r->>'atk')::numeric, (r->>'spd')::numeric, (r->>'tec')::numeric)));
end $$;
revoke all on function public.tower_snapshot(int) from public, anon, authenticated;

create or replace function public.my_tower() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p profiles; nxt int;
begin
  if auth.uid() is null then return null; end if;
  select * into p from profiles where id = auth.uid();
  nxt := p.tower_floor + 1;
  return jsonb_build_object('tickets', p.tickets, 'cleared', p.tower_floor, 'next', nxt,
    'monster', public.tower_monster_idx(nxt), 'elite', nxt % 5 = 0, 'boss', nxt % 5 = 0,
    'reward', jsonb_build_object('xp', 20 + 4 * nxt + (case when nxt % 5 = 0 then 30 else 0 end), 'coins', 5 + nxt + (case when nxt % 5 = 0 then 15 else 0 end)),
    'open', (select id from battles where a = auth.uid() and kind = 'tower' and status = 'active' order by created_at desc limit 1),
    'best', (select coalesce(jsonb_agg(jsonb_build_object('name', pr.display_name, 'floor', pr.tower_floor) order by pr.tower_floor desc), '[]'::jsonb)
             from profiles pr where pr.tower_floor > 0 and (pr.id = auth.uid() or public.shares_group(pr.id))));
end $$;

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
  sb := public.scale_for_party(public.tower_snapshot(f), jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  update profiles set tickets = tickets - 1 where id = auth.uid();
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('tower', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

create or replace function public.pet_test(p_pet uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare f int; pa jsonb; sb jsonb; bid uuid; first text;
begin
  if not exists (select 1 from pets where id = p_pet and user_id = auth.uid()) then raise exception 'Not your pet'; end if;
  update battles set status = 'done', turn = null where a = auth.uid() and kind = 'test' and status = 'active';
  select tower_floor + 1 into f from profiles where id = auth.uid();
  if f % 5 = 0 then f := f + 1; end if;   -- practise on a normal floor
  pa := public.pet_snapshot(p_pet);
  sb := public.tower_snapshot(f);
  first := case when (pa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, floor, status, turn, snap, state, log, last_move_at)
  values ('test', auth.uid(), f, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', pa, 'b', sb),
          public.battle_state0(pa, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

-- the lair: only bosses you've beaten on their tower floor
create or replace function public.lair_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null then return null; end if;
  return jsonb_build_object(
    'free', not exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d),
    'tickets', (select tickets from profiles where id = auth.uid()), 'coins', public.coins_of(auth.uid()), 'price', 40,
    'floor', (select tower_floor from profiles where id = auth.uid()),
    'open', (select id from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1),
    'bosses', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type, 'unlocked', public.lair_unlocked(auth.uid(), m.idx),
                 'floor', 5 * (m.idx - 11), 'caught', (select count(*) from pets where user_id = auth.uid() and species = m.idx)) order by m.idx) from monsters m where m.boss));
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
  if not public.lair_unlocked(auth.uid(), sp.idx) then raise exception 'Beat it on tower floor % first', 5 * (sp.idx - 11); end if;
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
