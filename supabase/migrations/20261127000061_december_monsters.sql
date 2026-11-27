-- December monsters: ten new species, live from 1 December 2026 (London time).
--  24–31 tower monsters, 32 a tower boss (Boss Lair from floor 35), 33 a group-boss legend (weekly raids from the week of 7 December).
-- Before the date nothing changes: the tower, lair, dex and raids hide them (dec_live()).
-- From the date the tower's wild floors cycle through 20 species and its boss floors through 7, so old floors can show new monsters
-- (replays included). New dex set "December monsters" (all 9 catchable ones): 300 💧 + 200 XP. The old sets keep counting only the old species.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.dec_live() returns boolean language sql stable as $$
  select now() >= timestamptz '2026-12-01 00:00 Europe/London'
$$;

-- monster moves (what they use against you) and the evolved forms' signature moves
insert into moves (id, en, zh, type, stat, power, effect, effect_val, uses, req_kind, req_val, desc_en, desc_zh, sort) values
  ('skip_squat',     'Skip Squat',      '走佬深蹲',   'endurance', 'spd', 55, 'crit',     0.2,  null, 'monster', 0, 'Gone before leg day starts.', '腳日未開始已經走咗。', 520),
  ('bench_camp',     'Bench Camp',      '霸機',       'normal',    'none', 0, 'buff_def', 2,    null, 'monster', 0, 'Not moving. Still texting.', '唔郁。仲覆緊訊息。', 521),
  ('bench_chomp',    'Bench Chomp',     '凳咬',       'normal',    'atk', 50, 'flinch',   0.2,  null, 'monster', 0, 'The bench bites back.', '張凳反咬你一啖。', 522),
  ('in_queue',       'In Queue',        '排緊隊',     'climbing',  'tec', 40, 'lock',     2,    null, 'monster', 0, 'One more match. Then another.', '打多鋪先。再打多鋪。', 523),
  ('missing_sock',   'Missing Sock',    '唔見咗隻襪', 'normal',    'atk', 45, 'flinch',   0.25, null, 'monster', 0, 'Can’t go, can’t find the other sock.', '搵唔到另一隻襪，去唔到。', 524),
  ('last_buffet',    'Last Buffet',     '最後放題',   'strength',  'atk', 95, 'recoil',   0.15, null, 'monster', 0, 'Diet starts next month.', '下個月先減肥。', 525),
  ('mala_temptation','Mala Temptation', '麻辣誘惑',   'strength',  'atk', 75, 'lock',     1,    null, 'monster', 0, 'Just one hotpot after the gym. Then no gym.', '做完 gym 打個邊爐啫。結果冇去 gym。', 526),
  ('flash_pose',     'Flash Pose',      '閃光自拍',   'climbing',  'tec', 50, 'flinch',   0.3,  null, 'monster', 0, 'Blinded by the selfie flash.', '畀自拍閃光燈閃親。', 527),
  ('beta_tingle',    'Beta Tingle',     '手痕腳痕',   'endurance', 'spd', 22, 'multi',    null, null, 'monster', 0, 'Too much pre-workout: scratch scratch scratch.', '飲多咗 pre-workout：痕痕痕。', 528),
  ('red_light',      'Red Light',       '紅燈',       'normal',    'none', 0, 'buff_def', 2,    null, 'monster', 0, 'Stuck in traffic. Again.', '又塞車。', 529),
  ('foam_roll_nap',  'Foam-Roll Nap',   '拉筋瞓著',   'normal',    'none', 0, 'heal',     0.3,  null, 'monster', 0, 'Just five minutes of stretching…', '拉五分鐘筋啫……', 530),
  ('bulgarian_split','Bulgarian Split', '保加利亞分腿蹲','endurance','spd', 80, 'crit',    0.2,  3,    'monster', 0, 'Leg day, finally.', '終於練腳。', 531),
  ('superset_slash', 'Superset Slash',  '超級組斬',   'normal',    'atk', 30, 'multi',    null, 3,    'monster', 0, 'Two exercises, no rest.', '兩個動作，唔休息。', 532),
  ('daily_quest',    'Daily Quest',     '每日任務',   'climbing',  'tec', 80, 'flinch',   0.2,  3,    'monster', 0, 'The real-life grind pays off.', '現實升級都有回報。', 533),
  ('fresh_kit',      'Fresh Kit',       '乾淨裝備',   'normal',    'none', 0, 'heal_buff',0.3,  2,    'monster', 0, 'Clean kit, ready to go: heal, attack and defence up.', '乾淨衫，即刻出發：回血，攻擊同防禦都升。', 534),
  ('clean_bulk',     'Clean Bulk',      '乾淨增肌',   'strength',  'atk', 105,'crit',     0.2,  2,    'monster', 0, 'All that food, put to work.', '食咁多，全部用嚟練。', 535),
  ('plate_fan',      'Plate Fan',       '槓片開屏',   'climbing',  'tec', 30, 'multi',    null, 3,    'monster', 0, 'A fan of iron plates.', '一排鐵片開屏。', 536),
  ('clean_pinch',    'Clean Pinch',     '黑咖啡鉗',   'endurance', 'spd', 85, 'crit',     0.25, 3,    'monster', 0, 'Black coffee, steady claws.', '黑咖啡，鉗得穩。', 537),
  ('turbo_cadence',  'Turbo Cadence',   '極速踩單車', 'endurance', 'spd', 80, 'crit',     0.2,  3,    'monster', 0, 'Fastest snail on the spin bike.', '飛輪上面最快嘅蝸牛。', 538),
  ('deep_squat',     'Deep Squat',      '深蹲',       'strength',  'atk', 85, 'recoil',   0.1,  3,    'monster', 0, 'Full range, all the way down.', '全幅度，蹲到底。', 539)
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power,
  effect = excluded.effect, effect_val = excluded.effect_val, uses = excluded.uses, desc_en = excluded.desc_en, desc_zh = excluded.desc_zh, sort = excluded.sort;

insert into monsters (idx, en, zh, type, hp, atk, def, spd, tec, moves, catch_rate, boss, raid, evo_en, evo_zh, sig_move, ratios) values
  (24, 'Skip-Leg-Day Flamingo', '走佬腳雞',   'endurance', 56, 26, 14, 30, 18, '{skip_squat,alarm_blast,sugar_rush}',      0.4,  false, false, 'Squatting Flamingo', '深蹲巨鳥',     'bulgarian_split', '{"hp": 0.9, "atk": 1.0, "def": 0.7, "spd": 1.35, "tec": 0.9}'),
  (25, 'Bench-Hog Mimic',       '霸機寶箱怪', 'normal',    74, 24, 28, 12, 16, '{bench_chomp,bench_camp,doomscroll}',      0.4,  false, false, 'Free-Weight Knight', '自由重量騎士', 'superset_slash',  '{"hp": 1.2, "atk": 0.9, "def": 1.4, "spd": 0.6, "tec": 0.8}'),
  (26, 'One-More-Game Gremlin', '打多鋪先小鬼','climbing', 56, 20, 15, 24, 30, '{in_queue,notif_ping,doomscroll}',         0.4,  false, false, 'IRL Grinder',        '現實升級勇者', 'daily_quest',     '{"hp": 0.9, "atk": 0.8, "def": 0.8, "spd": 1.1, "tec": 1.35}'),
  (27, 'Laundry-Pile Golem',    '污糟衫山怪', 'normal',    80, 22, 24, 12, 16, '{missing_sock,couch_sink,snooze}',         0.45, false, false, 'Gear-Ready Golem',   '潔癖裝備師',   'fresh_kit',       '{"hp": 1.35, "atk": 0.8, "def": 1.2, "spd": 0.6, "tec": 0.8}'),
  (28, 'Mirror-Flex Peacock',   '鏡前自拍孔雀','climbing', 58, 22, 16, 22, 30, '{flash_pose,doomscroll,sugar_rush}',       0.35, false, false, 'PR-Day Peacock',     '破紀錄孔雀',   'plate_fan',       '{"hp": 0.9, "atk": 0.9, "def": 0.8, "spd": 1.0, "tec": 1.35}'),
  (29, 'Pre-Workout Crab',      '發抖蟹',     'endurance', 58, 24, 22, 30, 16, '{beta_tingle,alarm_blast,sugar_rush}',     0.4,  false, false, 'Espresso Crab',      '黑咖啡鐵蟹',   'clean_pinch',     '{"hp": 0.95, "atk": 0.9, "def": 1.1, "spd": 1.3, "tec": 0.8}'),
  (30, 'Traffic Snail',         '塞車蝸牛',   'endurance', 70, 20, 30, 16, 16, '{red_light,slime_splash,alarm_blast}',     0.45, false, false, 'Spin-Bike Snail',    '飛輪蝸牛',     'turbo_cadence',   '{"hp": 1.1, "atk": 0.8, "def": 1.4, "spd": 1.0, "tec": 0.7}'),
  (31, 'Nap-Stretch Snake',     '拉筋瞓著蛇', 'normal',    76, 22, 18, 18, 18, '{doms_ache,foam_roll_nap,blanket_wrap}',   0.45, false, false, 'Mobility Python',    '靈活性巨蟒',   'deep_squat',      '{"hp": 1.3, "atk": 0.9, "def": 1.0, "spd": 0.8, "tec": 0.9}'),
  (32, 'All-You-Can-Eat Whale', '放題巨鯨',   'strength',  98, 34, 26, 12, 16, '{last_buffet,snack_breath,sugar_rush}',    0.2,  true,  false, 'Bulking Whale',      '增肌巨鯨',     'clean_bulk',      '{"hp": 1.45, "atk": 1.35, "def": 1.1, "spd": 0.6, "tec": 0.7}'),
  (33, 'Hotpot Cauldron',       '宵夜邊爐鍋怪','strength', 98, 32, 26, 14, 20, '{mala_temptation,second_helping,snack_breath,couch_sink}', 0, false, true, null, null, null, '{"hp": 1.4, "atk": 1.2, "def": 1.1, "spd": 0.6, "tec": 0.8}')
on conflict (idx) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, tec = excluded.tec, moves = excluded.moves, catch_rate = excluded.catch_rate, boss = excluded.boss, raid = excluded.raid,
  evo_en = excluded.evo_en, evo_zh = excluded.evo_zh, sig_move = excluded.sig_move, ratios = excluded.ratios;

-- the tower: from December, 20 wild species (a new one every 2–3 floors) and 7 bosses
create or replace function public.tower_monster_idx(p_floor integer) returns integer language sql stable as $$
  select case
    when not public.dec_live() then
      case when p_floor % 5 = 0 then 12 + ((p_floor / 5 - 1) % 6)
           else (array[0, 2, 9, 1, 6, 4, 7, 3, 10, 8, 5, 11])[(p_floor - p_floor / 5 - 1) % 12 + 1] end
    when p_floor % 5 = 0 then (array[12, 13, 14, 15, 16, 17, 32])[(p_floor / 5 - 1) % 7 + 1]
    else (array[0, 24, 2, 9, 25, 1, 6, 26, 4, 7, 27, 3, 10, 28, 8, 5, 29, 11, 30, 31])[(p_floor - p_floor / 5 - 1) % 20 + 1] end
$$;

-- the first boss floor of each boss species (the Boss Lair unlocks once you've beaten it there)
create or replace function public.boss_floor(p_species integer) returns integer language sql immutable as $$
  select case when p_species = 32 then 35 else 5 * (p_species - 11) end
$$;

create or replace function public.lair_unlocked(p_user uuid, p_species integer) returns boolean language sql stable security definer set search_path to 'public' as $$
  select (p_species < 24 or public.dec_live()) and coalesce((select tower_floor from profiles where id = p_user), 0) >= public.boss_floor(p_species)
$$;

-- the first few tower floors where a species turns up (for the dex)
create or replace function public.species_floors(p_species integer) returns int[] language sql stable as $$
  select coalesce(array_agg(f order by f), '{}') from (select f from generate_series(1, 70) f where public.tower_monster_idx(f) = p_species order by f limit 3) x
$$;

-- group bosses: the Hotpot Cauldron joins the weekly rotation from the week of 7 December (a week's boss never changes mid-week)
create or replace function public.raid_boss_idx(p_group uuid, p_week date) returns integer language sql immutable as $$
  select case when p_week >= date '2026-12-07'
    then (array[18, 19, 20, 21, 22, 23, 33])[(extract(week from p_week)::int + abs(hashtext(p_group::text))) % 7 + 1]
    else 18 + (extract(week from p_week)::int + abs(hashtext(p_group::text))) % 6 end
$$;

CREATE OR REPLACE FUNCTION public.lair_fight(p_species integer, p_pay text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'Europe/London')::date; sp monsters; party jsonb; o jsonb; sb jsonb; bid uuid; first text; best numeric;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  perform public.daily_tickets(auth.uid());
  select id into bid from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  select * into sp from monsters where idx = p_species and boss;
  if sp.idx is null then raise exception 'No such boss'; end if;
  if not public.lair_unlocked(auth.uid(), sp.idx) then raise exception 'Beat it on tower floor % first', public.boss_floor(sp.idx); end if;
  if p_pay = 'free' then
    if exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d) then
      raise exception 'Today’s free try is used. Use a ticket or 40 coins.'; end if;
  elsif p_pay = 'ticket' then
    update profiles set tickets = tickets - 1 where id = auth.uid() and tickets > 0;
    if not found then raise exception 'No tickets left'; end if;
  elsif p_pay = 'coins' then
    if not public.spend_coins(auth.uid(), 40, 'lair') then raise exception 'Not enough coins'; end if;
  else raise exception 'Pay with free, ticket or coins'; end if;
  party := public.party_snapshot(auth.uid()); o := public.party_me(party);   -- the boss is matched to YOU, whoever goes first
  -- the boss is matched to you: your own stats × its species, a bit stronger, with lots of HP
  -- (its attacking stats are scaled so its strongest one is 65% of yours; Phoenix is fast, Dragon strong, but none outclasses you)
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.65
        / greatest((sp.ratios->>'atk')::numeric, (sp.ratios->>'spd')::numeric, (sp.ratios->>'tec')::numeric);
  sb := public.monster_snapshot(sp.idx, (o->>'level')::int + 2, 1, false) || jsonb_build_object('boss_pet', true,
    'hp',  round((o->>'hp')::numeric  * (sp.ratios->>'hp')::numeric * 1.1),
    'def', round((o->>'def')::numeric * (sp.ratios->>'def')::numeric * 0.85),
    'atk', round(best * (sp.ratios->>'atk')::numeric), 'spd', round(best * (sp.ratios->>'spd')::numeric), 'tec', round(best * (sp.ratios->>'tec')::numeric));
  sb := public.scale_for_party(sb, jsonb_array_length(party));
  first := case when (party->0->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, a, species, pay, status, turn, snap, state, log, last_move_at)
  values ('lair', auth.uid(), sp.idx, p_pay, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', party->0, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $function$;

CREATE OR REPLACE FUNCTION public.lair_status()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d date := (now() at time zone 'Europe/London')::date;
begin
  if auth.uid() is null then return null; end if;
  perform public.daily_tickets(auth.uid());
  return jsonb_build_object(
    'free', not exists (select 1 from battles where a = auth.uid() and kind = 'lair' and pay = 'free' and (created_at at time zone 'Europe/London')::date = d),
    'tickets', (select tickets from profiles where id = auth.uid()), 'coins', public.coins_of(auth.uid()), 'price', 40,
    'floor', (select tower_floor from profiles where id = auth.uid()),
    'open', (select id from battles where a = auth.uid() and kind = 'lair' and status = 'active' limit 1),
    'bosses', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type, 'unlocked', public.lair_unlocked(auth.uid(), m.idx),
                 'floor', public.boss_floor(m.idx), 'caught', (select count(*) from pets where user_id = auth.uid() and species = m.idx)) order by m.idx) from monsters m where m.boss and (m.idx < 24 or public.dec_live())));
end $function$;

CREATE OR REPLACE FUNCTION public.my_dex()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare u uuid := auth.uid(); normal int; boss int; evo int; dec int;
begin
  if u is null then return null; end if;
  select count(*) filter (where m.boss is false and m.idx < 24), count(*) filter (where m.boss and m.idx < 24), count(*) filter (where d.evolved),
         count(*) filter (where m.idx between 24 and 32)
    into normal, boss, evo, dec from pet_dex d join monsters m on m.idx = d.species where d.user_id = u;
  return jsonb_build_object(
    'species', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'evo_en', m.evo_en, 'evo_zh', m.evo_zh, 'type', m.type, 'boss', m.boss,
        'caught', d.species is not null, 'evolved', coalesce(d.evolved, false), 'first', d.first_caught,
        'have', (select count(*) from pets p where p.user_id = u and p.species = m.idx), 'floors', public.species_floors(m.idx),
        'best_iv', (select max(((p.iv->>'hp')::numeric + (p.iv->>'atk')::numeric + (p.iv->>'def')::numeric + (p.iv->>'spd')::numeric + (p.iv->>'tec')::numeric) / 5)
                    from pets p where p.user_id = u and p.species = m.idx)) order by m.idx)
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u where not m.raid and (m.idx < 24 or public.dec_live())),
    'legend', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'type', m.type, 'caught', d.species is not null, 'first', d.first_caught,
        'have', (select count(*) from pets p where p.user_id = u and p.species = m.idx)) order by m.idx)
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u where m.raid and (m.idx < 24 or public.dec_live())),
    'sets', jsonb_build_array(
      jsonb_build_object('id', 'normal', 'have', normal, 'need', 12, 'coins', 150, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:normal')),
      jsonb_build_object('id', 'boss', 'have', boss, 'need', 6, 'coins', 250, 'xp', 150, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:boss')),
      jsonb_build_object('id', 'evo', 'have', evo, 'need', 6, 'coins', 200, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:evo')))
      || case when public.dec_live() then jsonb_build_array(jsonb_build_object('id', 'dec', 'have', dec, 'need', 9, 'coins', 300, 'xp', 200, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:dec'))) else '[]'::jsonb end);
end $function$;
