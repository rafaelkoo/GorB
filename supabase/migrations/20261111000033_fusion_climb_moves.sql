-- Fusion moves and more climbing moves.
-- Fusion: learn two (or three) moves from different kinds of training and you also get the fusion.
--   It carries all their types (your type matching any counts for the ×1.5, the best match-up is used),
--   hits with the higher of their stats, is about 1.5× the strongest of its parts, and has limited uses.
--   Forget one of the parts (stop training) and the fusion goes too.
-- Climbing: moves for each grade V1–V7, plus two for how many climbs you've topped in 60 days.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.moves add column if not exists types text[];      -- fusion: all its types
alter table public.moves add column if not exists stats text[];      -- fusion: the stats it can use (the higher one is used)
alter table public.moves add column if not exists uses int;          -- uses per fight (null = no limit, or the usual for heals/boosts)
alter table public.moves add column if not exists req_moves text[];  -- fusion: the moves it's made from
alter table public.moves drop constraint if exists moves_req_kind_check;
alter table public.moves add constraint moves_req_kind_check
  check (req_kind in ('always', 'lift', 'maxlift', 'sets', 'cardio', 'climb', 'climbs', 'fusion', 'monster'));

insert into public.moves (id, en, zh, type, stat, power, effect, effect_val, req_kind, req_cat, req_val, desc_en, desc_zh, sort, types, stats, uses, req_moves) values
  -- climbing
  ('footwork',       'Footwork',        '腳法',       'climbing',  'none',  0, 'buff_def', 1,    'climb',  null, 1,   'Raises your defence.', '提升防禦。', 43, null, null, null, null),
  ('side_pull',      'Side Pull',       '側拉',       'climbing',  'tec',  50, 'flinch',   0.2,  'climb',  null, 2,   '20% chance they flinch and lose their turn.', '20% 機會令對手嚇親，出唔到招。', 44, null, null, null, null),
  ('heel_hook',      'Heel Hook',       '倒勾腳',     'climbing',  'tec',  65, 'lock',     1,    'climb',  null, 4,   'Lowers their attack and blocks their boosts for 1 turn.', '降低對手攻擊，1 回合內佢唔可以加強自己。', 45, null, null, null, null),
  ('roof_crush',     'Roof Crush',      '天花板',     'climbing',  'tec',  95, 'crit',     0.25, 'climb',  null, 6,   'Big hit, often critical.', '重擊，好易會心。', 46, null, null, null, null),
  ('send_it',        'Send It',         '完攀',       'climbing',  'tec', 130, null,       null, 'climb',  null, 7,   'The climber’s finisher. Once per fight.', '攀石終極招，每場用一次。', 47, null, null, 1, null),
  ('boulder_chain',  'Boulder Chain',   '連續抱石',   'climbing',  'tec',  20, 'multi',    null, 'climbs', null, 40,  'Hits 2–3 times.', '連打 2 至 3 下。', 48, null, null, null, null),
  ('climb_stamina',  'Climbing Stamina','攀石耐力',   'climbing',  'none',  0, 'heal',     0.3,  'climbs', null, 120, 'Get back 30% of your HP.', '回復 30% 體力。', 49, null, null, null, null),
  -- fusions
  ('power_charge',   'Power Charge',    '爆發衝撞',   'strength',  'atk',  85, 'crit',     0.2,  'fusion', null, 0, 'Strength + Endurance. Uses your higher of attack and speed.', '力量 + 耐力。用攻擊同速度之中較高嗰個。', 60, '{strength,endurance}', '{atk,spd}', 3, '{squat_slam,sprint}'),
  ('pullup_burst',   'Pull-up Burst',   '引體爆擊',   'strength',  'atk',  35, 'multi',    null, 'fusion', null, 0, 'Strength + Climbing. Hits 2–3 times.', '力量 + 攀石。連打 2 至 3 下。', 61, '{strength,climbing}', '{atk,tec}', 3, '{row_combo,grip}'),
  ('wind_climb',     'Wind Climb',      '疾風攀登',   'endurance', 'spd',  75, 'flinch',   0.3,  'fusion', null, 0, 'Endurance + Climbing. 30% chance they flinch.', '耐力 + 攀石。30% 機會令對手嚇親。', 62, '{endurance,climbing}', '{spd,tec}', 3, '{sprint,grip}'),
  ('full_circuit',   'Full Circuit',    '全身循環',   'strength',  'none',  0, 'heal_buff',0.35, 'fusion', null, 0, 'Strength + Endurance. Get back 35% HP and raise attack and defence.', '力量 + 耐力。回復 35% 體力，攻擊同防禦都提升。', 63, '{strength,endurance}', null, 2, '{the_pump,second_wind}'),
  ('crimp_crusher',  'Crimp Crusher',   '指力粉碎',   'climbing',  'tec', 110, 'lock',     2,    'fusion', null, 0, 'Strength + Climbing. Locks them down for 2 turns.', '力量 + 攀石。鎖住對手 2 回合。', 64, '{strength,climbing}', '{atk,tec}', 3, '{crimp_lock,chest_cannon}'),
  ('iron_hammer',    'Iron Hammer',     '鐵人重錘',   'strength',  'atk', 130, 'recoil',   0.1,  'fusion', null, 0, 'Strength + Endurance. Huge hit, 10% back to you.', '力量 + 耐力。超重一擊，自己承受 10% 反傷。', 65, '{strength,endurance}', '{atk,spd}', 3, '{deadlift_uproot,marathon_grind}'),
  ('triathlon',      'Triathlon',       '三項全能',   'strength',  'atk', 160, 'nocounter',null, 'fusion', null, 0, 'All three. Never resisted. Once per fight.', '三個屬性。永遠唔會被剋，每場用一次。', 66, '{strength,endurance,climbing}', '{atk,spd,tec}', 1, '{max_out,marathon_grind,dyno}')
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power,
  effect = excluded.effect, effect_val = excluded.effect_val, req_kind = excluded.req_kind, req_cat = excluded.req_cat, req_val = excluded.req_val,
  desc_en = excluded.desc_en, desc_zh = excluded.desc_zh, sort = excluded.sort, types = excluded.types, stats = excluded.stats, uses = excluded.uses, req_moves = excluded.req_moves;

-- what you've got (now with climbs topped and fusions)
create or replace function public.character_moves(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since date := (now() at time zone 'Europe/London')::date - 59;
  lifts jsonb; mx numeric; sets60 int; cardio60 int; grade int; climbs60 int; days60 int; learned text[]; eq text[];
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
  select coalesce(sum(minutes), 0) into cardio60 from cardio_logs where user_id = p_user and performed_on >= since;
  select coalesce(max(s.weight_kg), -1), count(*) into grade, climbs60 from workouts w join workout_sets s on s.workout_id = w.id
    where w.user_id = p_user and w.performed_on >= since and s.exercise_id = 'wall_climb' and s.reps >= 1;
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
  select array(select x from unnest(coalesce(p.battle_moves, '{}')) x where x = any(learned) limit 4) into eq from profiles p where p.id = p_user;
  if coalesce(array_length(eq, 1), 0) < 4 then
    eq := eq || array(select id from moves where id = any(learned) and not id = any(eq)
      order by (case when effect like 'buff%' or effect like 'heal%' then 1 else 0 end), power desc limit 4 - coalesce(array_length(eq, 1), 0));
  end if;
  return jsonb_build_object(
    'basis', jsonb_build_object('lifts', lifts, 'max', round(mx), 'sets', sets60, 'cardio', cardio60, 'grade', grade, 'climbs', climbs60, 'days', days60),
    'learned', to_jsonb(learned), 'equipped', to_jsonb(eq), 'grit', days60 >= 12);
end $$;

-- the move list a fighter carries now includes types, stats and uses
create or replace function public.move_json(x moves) returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object('id', x.id, 'en', x.en, 'zh', x.zh, 'type', x.type, 'stat', x.stat, 'power', x.power,
    'effect', x.effect, 'val', x.effect_val, 'types', to_jsonb(x.types), 'stats', to_jsonb(x.stats), 'uses', x.uses))
$$;

create or replace function public.fighter_snapshot(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c jsonb; mv jsonb; m numeric; lv int;
begin
  c := public.character_card(p_user); mv := public.character_moves(p_user);
  lv := (c->>'level')::int; m := 1 + 0.02 * (lv - 1);
  return jsonb_build_object(
    'id', p_user, 'name', (select display_name from profiles where id = p_user), 'avatar', (select avatar from profiles where id = p_user),
    'level', lv, 'type', c->>'type', 'grit', (mv->>'grit')::boolean,
    'hp', round(((c->'stats'->>'hp')::int + 40) * m),
    'atk', round(greatest((c->'stats'->>'atk')::int, 30) * m),
    'def', round(((c->'stats'->>'def')::int) * m),
    'spd', round(((c->'stats'->>'spd')::int) * m),
    'tec', round(((c->'stats'->>'tec')::int) * m),
    'moves', (select jsonb_agg(public.move_json(x) order by array_position(array(select jsonb_array_elements_text(mv->'equipped')), x.id))
              from moves x where mv->'equipped' ? x.id));
end $$;
revoke all on function public.fighter_snapshot(uuid) from public, anon, authenticated;

-- one move by one side ('a' or 'b'); the checks on who may move are done by the callers
create or replace function public.battle_step(p_id uuid, p_side text, p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  SCALE constant numeric := 3.0;
  bt battles; me text; th text; mv jsonb; st jsonb; ev jsonb; s_me jsonb; s_th jsonb;
  hits int := 1; i int; dmg int; total int := 0; crit boolean; eff numeric; stab numeric; a numeric; d numeric; pw numeric; lv int;
  crits int := 0; dmgs jsonb := '[]'::jsonb; ko boolean := false; flinched boolean := false; hp_th int; hp_me int; amt int;
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

  if ko or hp_me <= 0 or (bt.kind = 'raid' and coalesce((st->>'moves')::int, 0) >= 8) then
    -- the end: in a raid you're timed out after 8 moves; the side still standing wins
    update battles set state = st, log = log || ev, status = 'done', turn = null,
      winner_side = case when ko then me when hp_me <= 0 then th else null end,
      winner = case when ko then (case when me = 'a' then bt.a else bt.b end) when hp_me <= 0 then (case when th = 'a' then bt.a else bt.b end) end,
      updated_at = now(), last_move_at = now() where id = p_id;
    if bt.kind = 'tower' then perform public.tower_finish(p_id);
    elsif bt.kind = 'raid' then perform public.raid_finish(p_id); end if;
  else
    update battles set state = st, log = log || ev,
      turn = case when (case when flinched then me else th end) = 'a' then bt.a else bt.b end,   -- null = the monster's go
      winner_side = null,
      updated_at = now(), last_move_at = now() where id = p_id;
  end if;
  return ev;
end $$;
revoke all on function public.battle_step(uuid, text, text) from public, anon, authenticated;
