-- Battle moves (phase 2): you learn moves from your real training, Pokémon style.
--   Strength moves: by your best lift (one-rep max, last 60 days) for that body part
--   Volume moves:   by sets in the last 60 days
--   Endurance moves: by cardio minutes in the last 60 days
--   Climbing moves: by your hardest topped grade (last 60 days)
--   Grit (a trait, not a move): 12+ gym days in the last 60 → once per battle, survive a knockout on 1 HP
-- Stop training and the requirement drops below the line: you forget the move until you're back.
-- Applied by GitHub Actions. Safe to run more than once.

-- which body part each built-in exercise works (custom exercises carry their own)
create table if not exists public.exercise_cat (id text primary key, cat text not null);
insert into public.exercise_cat (id, cat) values
  ('bench_press', 'chest'),
  ('inc_db', 'chest'),
  ('inc_mach', 'chest'),
  ('pec_deck', 'chest'),
  ('cable_fly', 'chest'),
  ('pushup', 'chest'),
  ('chest_dip', 'chest'),
  ('low_cable_fly', 'chest'),
  ('decline_bench', 'chest'),
  ('close_grip_bench', 'chest'),
  ('svend_press', 'chest'),
  ('lat_pd', 'back'),
  ('vbar_pd', 'back'),
  ('sit_row', 'back'),
  ('db_row', 'back'),
  ('deadlift', 'back'),
  ('pullup', 'back'),
  ('tbar_row', 'back'),
  ('shrug', 'back'),
  ('good_morning', 'back'),
  ('cable_row_wide', 'back'),
  ('chest_supported_row', 'back'),
  ('cable_pullover', 'back'),
  ('meadows_row', 'back'),
  ('back_extension', 'back'),
  ('squat', 'legs'),
  ('leg_press', 'legs'),
  ('leg_curl', 'legs'),
  ('calf', 'legs'),
  ('adductor', 'legs'),
  ('rdl', 'legs'),
  ('hip_thrust', 'legs'),
  ('bulgarian', 'legs'),
  ('hack_squat', 'legs'),
  ('seated_calf', 'legs'),
  ('goblet_squat', 'legs'),
  ('step_up', 'legs'),
  ('sissy_squat', 'legs'),
  ('nordic_curl', 'legs'),
  ('donkey_calf', 'legs'),
  ('sumo_deadlift', 'legs'),
  ('lunge', 'legs'),
  ('db_press', 'shoulders'),
  ('ohp', 'shoulders'),
  ('lat_raise', 'shoulders'),
  ('rev_fly', 'shoulders'),
  ('facepull', 'shoulders'),
  ('arnold_press', 'shoulders'),
  ('upright_row', 'shoulders'),
  ('rear_delt_fly', 'shoulders'),
  ('cable_lateral', 'shoulders'),
  ('leaning_lateral', 'shoulders'),
  ('w_press', 'shoulders'),
  ('lu_raises', 'shoulders'),
  ('bb_curl', 'arms'),
  ('hammer', 'arms'),
  ('db_curl', 'arms'),
  ('cable_pd', 'arms'),
  ('skull', 'arms'),
  ('dip', 'arms'),
  ('preacher_curl', 'arms'),
  ('concentration_curl', 'arms'),
  ('cable_curl', 'arms'),
  ('overhead_tri', 'arms'),
  ('cable_tri', 'arms'),
  ('incline_curl', 'arms'),
  ('spider_curl', 'arms'),
  ('drag_curl', 'arms'),
  ('reverse_curl', 'arms'),
  ('wrist_curl', 'arms'),
  ('tricep_kickback', 'arms'),
  ('jm_press', 'arms'),
  ('plank', 'core'),
  ('crunch', 'core'),
  ('leg_raise', 'core'),
  ('cable_crunch', 'core'),
  ('russian_twist', 'core'),
  ('ab_wheel', 'core'),
  ('pallof_press', 'core'),
  ('dead_bug', 'core'),
  ('hollow_hold', 'core'),
  ('cable_woodchop', 'core'),
  ('landmine_rotation', 'core'),
  ('wall_climb', 'other')
on conflict (id) do update set cat = excluded.cat;
alter table public.exercise_cat enable row level security;
drop policy if exists "anyone reads exercise_cat" on public.exercise_cat;
create policy "anyone reads exercise_cat" on public.exercise_cat for select to authenticated using (true);
grant select on public.exercise_cat to authenticated;

create table if not exists public.moves (
  id text primary key,
  en text not null, zh text not null,
  type text not null check (type in ('strength', 'endurance', 'climbing', 'normal')),
  stat text not null check (stat in ('atk', 'spd', 'tec', 'none')),   -- which of your stats powers it
  power int not null default 0,
  effect text,              -- null | multi | heal | buff_atk | buff_def | buff_both | recoil | ramp | flinch | crit | lock
  effect_val numeric,
  req_kind text not null check (req_kind in ('always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'monster')),
  req_cat text, req_val numeric not null default 0,
  desc_en text not null, desc_zh text not null,
  sort int not null default 0
);
alter table public.moves enable row level security;
drop policy if exists "anyone reads moves" on public.moves;
create policy "anyone reads moves" on public.moves for select to authenticated using (true);
grant select on public.moves to authenticated;

insert into public.moves (id, en, zh, type, stat, power, effect, effect_val, req_kind, req_cat, req_val, desc_en, desc_zh, sort) values
  ('shove',          'Shove',            '推撞',       'normal',    'atk',  35, null,       null, 'always',  null,        0,   'A basic push.', '基本一推。', 1),
  ('warmup',         'Warm-up',          '熱身',       'normal',    'none',  0, 'buff_atk', 1,    'always',  null,        0,   'Raises your attack.', '提升攻擊。', 2),
  ('squat_slam',     'Squat Slam',       '深蹲重擊',   'strength',  'atk',  55, null,       null, 'lift',    'legs',      40,  'Drive up from the hole.', '由最低點爆發。', 10),
  ('deadlift_uproot','Deadlift Uproot',  '拔地而起',   'strength',  'atk',  85, 'recoil',   0.15, 'lift',    'back',      100, 'Huge hit; you take 15% of it back.', '超重一擊，自己承受 15% 反傷。', 11),
  ('bench_blast',    'Bench Blast',      '臥推衝擊',   'strength',  'atk',  55, null,       null, 'lift',    'chest',     30,  'A straight push off the chest.', '由胸口直推出去。', 12),
  ('chest_cannon',   'Chest Cannon',     '胸推炮',     'strength',  'atk',  80, null,       null, 'lift',    'chest',     80,  'Heavy pressing power.', '重推之力。', 13),
  ('row_combo',      'Row Combo',        '划船連擊',   'strength',  'atk',  22, 'multi',    3,    'lift',    'back',      30,  'Hits 2–3 times.', '連打 2 至 3 下。', 14),
  ('press_uppercut', 'Press Uppercut',   '推舉上勾拳', 'strength',  'atk',  60, 'crit',     0.25, 'lift',    'shoulders', 20,  'Often a critical hit.', '好易爆擊。', 15),
  ('bicep_hammer',   'Bicep Hammer',     '二頭鎚',     'strength',  'atk',  45, 'flinch',   0.2,  'lift',    'arms',      12,  '20% chance they lose their next turn.', '20% 令對手停一回合。', 16),
  ('max_out',        'Max Out',          '極限一擊',   'strength',  'atk', 120, 'recoil',   0.25, 'maxlift', null,        140, 'Everything you’ve got; 25% recoil.', '全力一擊，自己承受 25% 反傷。', 17),
  ('the_pump',       'The Pump',         '泵感',       'normal',    'none',  0, 'buff_both', 1,   'sets',    null,        40,  'Raises your attack and defence.', '提升攻擊同防禦。', 20),
  ('iron_wall',      'Iron Wall',        '鐵壁',       'normal',    'none',  0, 'buff_def', 2,    'sets',    null,        100, 'Sharply raises your defence.', '大幅提升防禦。', 21),
  ('sprint',         'Sprint',           '衝刺',       'endurance', 'spd',  45, 'crit',     0.15, 'cardio',  null,        30,  'Fast hit powered by speed.', '用速度出擊。', 30),
  ('second_wind',    'Second Wind',      '第二口氣',   'endurance', 'none',  0, 'heal',     0.35, 'cardio',  null,        120, 'Heals 35% of your HP.', '回復 35% 體力。', 31),
  ('interval_rush',  'Interval Rush',    '間歇連打',   'endurance', 'spd',  25, 'multi',    3,    'cardio',  null,        200, 'Speed hits 2–3 times.', '用速度連打 2 至 3 下。', 32),
  ('marathon_grind', 'Marathon Grind',   '長跑拖垮',   'endurance', 'spd',  35, 'ramp',     20,   'cardio',  null,        300, 'Gets 20 stronger every time you use it.', '每用一次威力加 20。', 33),
  ('grip',           'Grip',             '抓點',       'climbing',  'tec',  40, null,       null, 'climb',   null,        0,   'A technical strike.', '技巧一擊。', 40),
  ('dyno',           'Dyno',             'Dyno 飛撲',  'climbing',  'tec',  70, 'crit',     0.3,  'climb',   null,        3,   'Big leap, often critical.', '大飛撲，好易爆擊。', 41),
  ('crimp_lock',     'Crimp Lock',       '指力鎖',     'climbing',  'tec',  30, 'lock',     2,    'climb',   null,        5,   'Lowers their attack and blocks their boosts for 2 turns.', '降低對手攻擊，2 回合內佢唔可以加強自己。', 42),
  -- monsters only (never learned by players)
  ('cushion_slam',   'Cushion Slam',     '咕𠱸壓頂',   'normal',    'atk',  45, null,       null, 'monster', null,        0,   '', '', 100),
  ('couch_sink',     'Sink In',          '陷入梳化',   'normal',    'none',  0, 'buff_def', 1,    'monster', null,        0,   '', '', 101),
  ('snooze',         'Snooze',           '再瞓多陣',   'normal',    'none',  0, 'heal',     0.3,  'monster', null,        0,   '', '', 102),
  ('sugar_rush',     'Sugar Rush',       '糖份爆發',   'normal',    'none',  0, 'buff_atk', 1,    'monster', null,        0,   '', '', 103),
  ('snack_breath',   'Snack Breath',     '宵夜吐息',   'strength',  'atk',  60, null,       null, 'monster', null,        0,   '', '', 104),
  ('slime_splash',   'Slime Splash',     '史萊姆濺射', 'normal',    'atk',  40, 'flinch',   0.2,  'monster', null,        0,   '', '', 105),
  ('alarm_blast',    'Alarm Blast',      '鬧鐘轟炸',   'endurance', 'spd',  50, 'crit',     0.2,  'monster', null,        0,   '', '', 106),
  ('boba_barrage',   'Boba Barrage',     '珍珠連射',   'strength',  'atk',  20, 'multi',    null, 'monster', null,        0,   '', '', 107),
  ('doomscroll',     'Doomscroll',       '無限碌',     'climbing',  'tec',  35, 'lock',     2,    'monster', null,        0,   '', '', 108),
  ('notif_ping',     'Notification',     '通知轟炸',   'endurance', 'spd',  20, 'multi',    null, 'monster', null,        0,   '', '', 109)
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power,
  effect = excluded.effect, effect_val = excluded.effect_val, req_kind = excluded.req_kind, req_cat = excluded.req_cat, req_val = excluded.req_val,
  desc_en = excluded.desc_en, desc_zh = excluded.desc_zh, sort = excluded.sort;

alter table public.profiles add column if not exists battle_moves text[];

-- what you've got: the numbers moves depend on, every move with learned yes/no, and your 4 equipped
create or replace function public.character_moves(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Europe/London')::date - 59;
  lifts jsonb; mx numeric; sets60 int; cardio60 int; grade int; days60 int; learned text[]; eq text[];
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  -- best one-rep max per body part (not climbing, not timed holds)
  select coalesce(jsonb_object_agg(cat, round(best)), '{}'::jsonb), coalesce(max(best), 0) into lifts, mx from (
    select coalesce(ec.cat, ce.cat, 'other') as cat, max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as best
    from workouts w join workout_sets s on s.workout_id = w.id
    left join exercise_cat ec on ec.id = s.exercise_id
    left join custom_exercises ce on ce.id = s.exercise_id
    where w.user_id = p_user and w.performed_on >= since and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500
      and s.exercise_id <> 'wall_climb' and coalesce(ce.kind, '') <> 'timed'
    group by 1) b;
  select count(*) into sets60 from workouts w join workout_sets s on s.workout_id = w.id where w.user_id = p_user and w.performed_on >= since and s.reps >= 1;
  select coalesce(sum(minutes), 0) into cardio60 from cardio_logs where user_id = p_user and performed_on >= since;
  select coalesce(max(s.weight_kg), -1) into grade from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = p_user and w.performed_on >= since and s.exercise_id = 'wall_climb' and s.reps >= 1;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days60 from checkins where user_id = p_user and (created_at at time zone 'Europe/London')::date >= since;

  select array_agg(id order by sort) into learned from moves m where
    case m.req_kind
      when 'always' then true
      when 'lift' then coalesce((lifts->>m.req_cat)::numeric, 0) >= m.req_val
      when 'maxlift' then mx >= m.req_val
      when 'sets' then sets60 >= m.req_val
      when 'cardio' then cardio60 >= m.req_val
      when 'climb' then grade >= m.req_val
    end;
  -- equipped: your choice (only moves you still know), topped up with your strongest
  select array(select x from unnest(coalesce(p.battle_moves, '{}')) x where x = any(learned) limit 4) into eq from profiles p where p.id = p_user;
  if coalesce(array_length(eq, 1), 0) < 4 then
    eq := eq || array(select id from moves where id = any(learned) and not id = any(eq) order by (case when effect like 'buff%' or effect = 'heal' then 1 else 0 end), power desc limit 4 - coalesce(array_length(eq, 1), 0));
  end if;
  return jsonb_build_object(
    'basis', jsonb_build_object('lifts', lifts, 'max', round(mx), 'sets', sets60, 'cardio', cardio60, 'grade', grade, 'days', days60),
    'learned', to_jsonb(learned), 'equipped', to_jsonb(eq), 'grit', days60 >= 12);
end $$;
revoke all on function public.character_moves(uuid) from public, anon;
grant execute on function public.character_moves(uuid) to authenticated;

create or replace function public.set_moves(p_moves text[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare known jsonb;
begin
  if auth.uid() is null then return null; end if;
  known := public.character_moves(auth.uid())->'learned';
  update profiles set battle_moves = array(select x from unnest(p_moves) x where known ? x limit 4) where id = auth.uid();
  return public.character_moves(auth.uid());
end $$;
revoke all on function public.set_moves(text[]) from public, anon;
grant execute on function public.set_moves(text[]) to authenticated;
