-- The weekly group boss gets its own six monsters, not the tower's: the big things that stop a whole
-- group going (the holiday feast, deadlines, dark winter nights, hangovers, the gym being shut, friends
-- who cancel). Species 18–23, raid only: not in the tower, the lair or the dex, and not catchable.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.monsters add column if not exists raid boolean not null default false;

insert into public.moves (id, en, zh, type, stat, power, effect, effect_val, req_kind, req_val, desc_en, desc_zh, sort) values
  ('second_helping', 'Second Helping',   '再嚟一碟',  'strength',  'atk', 80, 'heal_buff', 0.15, 'monster', 0, 'Just one more plate.', '多一碟啫。', 500),
  ('deadline_crush', 'Deadline Crush',   '死線壓頂',  'endurance', 'spd', 45, 'ramp', 25,      'monster', 0, 'Closer every turn.', '一步一步逼近。', 501),
  ('long_night',     'Long Night',       '漫長黑夜',  'climbing',  'tec', 70, 'lock', 2,       'monster', 0, 'Dark at 4pm. Stay in.', '四點就天黑，留喺屋企啦。', 502),
  ('pounding_head',  'Pounding Head',    '頭痛欲裂',  'normal',    'atk', 75, 'flinch', 0.3,   'monster', 0, 'Too loud. Everything’s too loud.', '好嘈，乜都好嘈。', 503),
  ('shutters_down',  'Shutters Down',    '落閘',      'normal',    'none', 0, 'buff_def', 2,   'monster', 0, 'Closed for the holidays.', '假期休館。', 504),
  ('last_minute',    'Last-Minute Cancel', '臨時放飛機', 'endurance', 'spd', 65, 'crit', 0.3, 'monster', 0, '“Sorry, can’t make it tonight.”', '「唔好意思，今晚嚟唔到。」', 505)
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power,
  effect = excluded.effect, effect_val = excluded.effect_val, desc_en = excluded.desc_en, desc_zh = excluded.desc_zh, sort = excluded.sort;

insert into public.monsters (idx, en, zh, type, hp, atk, def, spd, tec, moves, ratios, catch_rate, boss, raid) values
  (18, 'Holiday Feast Titan', '節日大餐巨人', 'strength',  100, 32, 26, 14, 18, '{second_helping,snack_breath,sugar_rush,couch_sink}',   '{"hp":1.4,"atk":1.2,"def":1.1,"spd":0.6,"tec":0.7}', 0, false, true),
  (19, 'Deadline Storm',      '死線風暴',     'endurance',  86, 26, 20, 34, 22, '{deadline_crush,overtime_crunch,notif_ping,alarm_blast}', '{"hp":1.0,"atk":0.9,"def":0.9,"spd":1.4,"tec":1.0}', 0, false, true),
  (20, 'Winter Night Wraith', '冬夜幽靈',     'climbing',   84, 24, 20, 24, 34, '{long_night,blanket_wrap,doomscroll,downpour}',          '{"hp":1.0,"atk":0.9,"def":0.9,"spd":1.0,"tec":1.4}', 0, false, true),
  (21, 'Hangover Ogre',       '宿醉食人魔',   'normal',     96, 30, 24, 16, 20, '{pounding_head,beer_belly,snooze,couch_sink}',            '{"hp":1.3,"atk":1.1,"def":1.0,"spd":0.7,"tec":0.9}', 0, false, true),
  (22, 'Gym-Closed Gargoyle', '休館石像鬼',   'normal',    104, 26, 32, 12, 18, '{shutters_down,cushion_slam,excuse_wall,doms_ache}',      '{"hp":1.5,"atk":1.0,"def":1.4,"spd":0.6,"tec":0.8}', 0, false, true),
  (23, 'Flake Fox',           '放飛機狐',     'endurance',  80, 28, 18, 36, 24, '{last_minute,notif_ping,alarm_blast,sugar_rush}',         '{"hp":0.9,"atk":1.0,"def":0.8,"spd":1.5,"tec":1.0}', 0, false, true)
on conflict (idx) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, hp = excluded.hp, atk = excluded.atk, def = excluded.def,
  spd = excluded.spd, tec = excluded.tec, moves = excluded.moves, ratios = excluded.ratios, catch_rate = excluded.catch_rate, boss = excluded.boss, raid = excluded.raid;

-- this week's boss for a group: one of the six raid monsters, a different one for each group
create or replace function public.raid_boss_idx(p_group uuid, p_week date) returns int language sql immutable as $$
  select 18 + (extract(week from p_week)::int + abs(hashtext(p_group::text))) % 6
$$;

create or replace function public.raid_fight(p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'Europe/London')::date; wk date := date_trunc('week', now() at time zone 'Europe/London')::date;
  sa jsonb; sb jsonb; bid uuid; first text; bidx int; base numeric; party jsonb;
begin
  if auth.uid() is null or not public.is_member(p_group) then raise exception 'Not in this group'; end if;
  select id into bid from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1;
  if bid is not null then return bid; end if;
  if not exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'Check in at the gym today to attack the boss'; end if;
  if exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d) then
    raise exception 'You’ve already attacked today (it counts in all your groups). Come back after your next gym day.'; end if;
  party := public.party_snapshot(auth.uid()); sa := party->0;
  bidx := public.raid_boss_idx(p_group, wk);
  base := greatest((sa->>'atk')::int, (sa->>'spd')::int, (sa->>'tec')::int);
  sb := public.monster_snapshot(bidx, (sa->>'level')::int, 1, false);
  sb := sb || jsonb_build_object('raid', true, 'hp', round((sa->>'hp')::int * 8),
    'def', greatest(10, round(base) - 50),
    'atk', round(((sa->>'def')::int + 50) * 0.6), 'spd', round(((sa->>'def')::int + 50) * 0.6), 'tec', round(((sa->>'def')::int + 50) * 0.6));
  sb := public.scale_for_party(sb, jsonb_array_length(party));   -- a tougher boss for a bigger team
  first := case when (sa->>'spd')::int >= (sb->>'spd')::int then 'a' else 'b' end;
  insert into battles (kind, group_id, a, week, status, turn, snap, state, log, last_move_at)
  values ('raid', p_group, auth.uid(), wk, 'active', case when first = 'a' then auth.uid() end, jsonb_build_object('a', sa, 'b', sb, 'party', party),
          public.party_state0(party, sb), jsonb_build_array(jsonb_build_object('t', 'start', 'first', first)), now())
  returning id into bid;
  perform public.monster_turns(bid);
  return bid;
end $$;

create or replace function public.group_boss(p_group uuid, p_week date default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  wk date := coalesce(p_week, date_trunc('week', now() at time zone 'Europe/London')::date);
  d date := (now() at time zone 'Europe/London')::date;
  out jsonb; hp int; dealt numeric;
begin
  if auth.uid() is not null and not public.is_member(p_group) then return null; end if;
  select sum(coalesce(p.days_per_week, 3)) * 100 into hp from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select jsonb_agg(jsonb_build_object('user_id', gm.user_id, 'name', p.display_name,
      'level', ((public.character_card(gm.user_id))->>'level')::int,
      'mult', public.underdog_mult(p_group, gm.user_id),
      'hits', (select count(*) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'),
      'dmg', (select coalesce(sum(public.raid_counts(b.state, p_group, gm.user_id)), 0) from battles b where b.a = gm.user_id and b.kind = 'raid' and b.week = wk and b.status = 'done'))
      order by p.display_name)
  into out from group_members gm join profiles p on p.id = gm.user_id where gm.group_id = p_group;
  select coalesce(sum((x->>'dmg')::numeric), 0) into dealt from jsonb_array_elements(out) x;
  select jsonb_agg(x order by (x->>'dmg')::int desc) into out from jsonb_array_elements(out) x;
  return jsonb_build_object(
    'week_start', wk, 'week_end', wk + 6,
    'boss', public.raid_boss_idx(p_group, wk),
    'hp', hp, 'dmg', least(dealt, hp), 'defeated', dealt >= hp,
    'claimed', exists (select 1 from rewards r where r.user_id = auth.uid() and r.ref = 'boss:' || p_group || ':' || wk),
    'loot_elsewhere', exists (select 1 from rewards r where r.user_id = auth.uid() and r.kind = 'boss' and r.meta->>'week' = wk::text and r.ref <> 'boss:' || p_group || ':' || wk),
    'can_attack', p_week is null
      and exists (select 1 from checkins where user_id = auth.uid() and (created_at at time zone 'Europe/London')::date = d)
      and not exists (select 1 from battles where a = auth.uid() and kind = 'raid' and (created_at at time zone 'Europe/London')::date = d),
    'open', (select id from battles where a = auth.uid() and kind = 'raid' and status = 'active' limit 1),
    'members', coalesce(out, '[]'::jsonb));
end $$;

create or replace function public.my_dex() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare u uuid := auth.uid(); normal int; boss int; evo int;
begin
  if u is null then return null; end if;
  select count(*) filter (where m.boss is false), count(*) filter (where m.boss), count(*) filter (where d.evolved)
    into normal, boss, evo from pet_dex d join monsters m on m.idx = d.species where d.user_id = u;
  return jsonb_build_object(
    'species', (select jsonb_agg(jsonb_build_object('idx', m.idx, 'en', m.en, 'zh', m.zh, 'evo_en', m.evo_en, 'evo_zh', m.evo_zh, 'type', m.type, 'boss', m.boss,
        'caught', d.species is not null, 'evolved', coalesce(d.evolved, false), 'first', d.first_caught,
        'have', (select count(*) from pets p where p.user_id = u and p.species = m.idx),
        'best_iv', (select max(((p.iv->>'hp')::numeric + (p.iv->>'atk')::numeric + (p.iv->>'def')::numeric + (p.iv->>'spd')::numeric + (p.iv->>'tec')::numeric) / 5)
                    from pets p where p.user_id = u and p.species = m.idx)) order by m.idx)
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u where not m.raid),
    'sets', jsonb_build_array(
      jsonb_build_object('id', 'normal', 'have', normal, 'need', 12, 'coins', 150, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:normal')),
      jsonb_build_object('id', 'boss', 'have', boss, 'need', 6, 'coins', 250, 'xp', 150, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:boss')),
      jsonb_build_object('id', 'evo', 'have', evo, 'need', 6, 'coins', 200, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:evo'))));
end $$;
