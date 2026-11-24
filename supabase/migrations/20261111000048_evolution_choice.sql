-- Evolution is a choice, and both paths get stronger moves.
--   Pets now level to 20 (XP for level n = 25·n·(n−1); +2% stats a level).
--   Evolve (level 10 + 20 gym days in your team): +25% to all stats and a signature move of its own.
--   Or don't: every level-up after it could evolve you're asked again ("not now"), or you can choose to
--     keep its form for good. A pet that reaches level 20 without evolving learns its type's ultimate,
--     the strongest move there is (power 130–140, 2 uses a fight).
--   Group boss: each pet adds 10% to your damage, an evolved one 15%.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.pets add column if not exists evo_skip_level int not null default 0;
alter table public.pets add column if not exists keep_form boolean not null default false;
alter table public.monsters add column if not exists sig_move text;

create or replace function public.pet_level(p_xp int) returns int language sql immutable as $$
  select least(20, greatest(1, floor((1 + sqrt(1 + 4 * greatest(p_xp, 0) / 25.0)) / 2)::int))
$$;

insert into public.moves (id, en, zh, type, stat, power, effect, effect_val, req_kind, req_val, uses, desc_en, desc_zh, sort) values
  -- signature moves (evolved forms)
  ('sun_salutation', 'Sun Salutation', '拜日式',     'normal',    'none', 0,  'heal_buff', 0.3,  'monster', 0, 2, 'Stretch it out: heal, attack and defence up.', '拉一拉筋：回血，攻擊同防禦都升。', 400),
  ('bento_breath',   'Bento Breath',   '便當吐息',   'strength',  'atk',  75, 'crit', 0.2,  'monster', 0, 3, 'A blast of perfectly portioned fire.', '份量啱啱好嘅火焰。', 401),
  ('hustle_rush',    'Hustle Rush',    '拼搏衝鋒',   'strength',  'atk',  30, 'multi', null, 'monster', 0, 3, 'Again. And again. And again.', '再嚟、再嚟、再嚟。', 402),
  ('dawn_strike',    'Dawn Strike',    '晨光一擊',   'endurance', 'spd',  70, 'flinch', 0.3, 'monster', 0, 3, 'Up before the sun, and before you.', '比太陽早起，比你更早出手。', 403),
  ('protein_slam',   'Protein Slam',   '蛋白重擊',   'strength',  'atk',  85, 'crit', 0.25, 'monster', 0, 3, '30 grams of pure impact.', '30 克純蛋白衝擊。', 404),
  ('pr_alert',       'PR Alert',       '破紀錄提示', 'climbing',  'tec',  60, 'lock', 2,    'monster', 0, 3, 'New personal best. Yours just got locked.', '新紀錄！你就被鎖住。', 405),
  ('chef_special',   'Chef’s Special', '大廚特餐',   'normal',    'none', 0,  'heal', 0.35, 'monster', 0, 2, 'A proper meal: heal 35%.', '食番餐好嘅：回血 35%。', 406),
  ('sunrise_sprint', 'Sunrise Sprint', '晨跑衝刺',   'endurance', 'spd',  80, 'crit', 0.2,  'monster', 0, 3, 'First light, full pace.', '天一光就全速衝。', 407),
  ('rainbow_beam',   'Rainbow Beam',   '彩虹光線',   'climbing',  'tec',  85, 'flinch', 0.2, 'monster', 0, 3, 'Rain or shine, it lands.', '風雨無阻，一定打中。', 408),
  ('ice_bath',       'Ice Bath',       '冰浴',       'normal',    'none', 0,  'heal_buff', 0.3, 'monster', 0, 2, 'Cold, then stronger.', '凍一凍，再強啲。', 409),
  ('lunch_press',    'Lunch-Break Press', '午休推舉', 'strength', 'atk',  85, 'recoil', 0.1, 'monster', 0, 3, 'Thirty minutes is enough.', '三十分鐘就夠。', 410),
  ('core_crunch',    'Core Crunch',    '核心捲腹',   'strength',  'atk',  90, 'flinch', 0.2, 'monster', 0, 3, 'Six packs, one hit.', '六舊腹肌，一下。', 411),
  ('do_it_now',      'Do It Now',      '即刻去做',   'strength',  'atk', 110, 'recoil', 0.2, 'monster', 0, 2, 'Not next Monday. Now.', '唔係下星期一，係而家。', 412),
  ('right_now',      'Right Now',      '即刻出擊',   'endurance', 'spd', 100, 'crit', 0.3,  'monster', 0, 2, 'No “later”.', '冇「遲啲先」。', 413),
  ('follow_along',   'Follow Along',   '跟住做',     'climbing',  'tec',  30, 'multi', null, 'monster', 0, 3, 'Rep for rep with the video.', '跟住片一下一下做。', 414),
  ('discipline',     'Discipline',     '自律',       'normal',    'none', 0,  'buff_both', 2, 'monster', 0, 2, 'Show up anyway: attack and defence way up.', '照樣出現：攻擊同防禦大升。', 415),
  ('max_bench',      'Max Bench',      '極限臥推',   'strength',  'atk', 110, 'recoil', 0.15, 'monster', 0, 2, 'One rep max, straight at them.', '一次最大重量，直推過去。', 416),
  ('macro_feast',    'Macro Feast',    '營養大餐',   'normal',    'none', 0,  'heal_buff', 0.35, 'monster', 0, 2, 'Protein, carbs, greens: heal and grow.', '蛋白、碳水、蔬菜：回血再變強。', 417),
  -- ultimates (never evolved, level 20): the strongest moves there are
  ('titan_lift',     'Titan Lift',     '泰坦舉',     'strength',  'atk', 140, 'crit', 0.25, 'monster', 0, 2, 'The heaviest thing anyone has ever lifted.', '史上最重嘅一舉。', 420),
  ('endless_stride', 'Endless Stride', '無盡長跑',   'endurance', 'spd', 130, 'crit', 0.3,  'monster', 0, 2, 'It never stops running.', '永遠跑唔停。', 421),
  ('summit_strike',  'Summit Strike',  '登頂一擊',   'climbing',  'tec', 135, 'lock', 2,    'monster', 0, 2, 'From the very top of the wall.', '由牆頂直落。', 422),
  ('true_form',      'True Form',      '本色',       'normal',    'atk', 130, 'nocounter', null, 'monster', 0, 2, 'It stayed itself, and it’s never resisted.', '堅持做自己，永遠唔會被剋。', 423)
on conflict (id) do update set en = excluded.en, zh = excluded.zh, type = excluded.type, stat = excluded.stat, power = excluded.power, effect = excluded.effect,
  effect_val = excluded.effect_val, req_kind = excluded.req_kind, uses = excluded.uses, desc_en = excluded.desc_en, desc_zh = excluded.desc_zh, sort = excluded.sort;

update public.monsters m set sig_move = v.mv from (values
  (0, 'sun_salutation'), (1, 'bento_breath'), (2, 'hustle_rush'), (3, 'dawn_strike'), (4, 'protein_slam'), (5, 'pr_alert'),
  (6, 'chef_special'), (7, 'sunrise_sprint'), (8, 'rainbow_beam'), (9, 'ice_bath'), (10, 'lunch_press'), (11, 'core_crunch'),
  (12, 'do_it_now'), (13, 'right_now'), (14, 'follow_along'), (15, 'discipline'), (16, 'max_bench'), (17, 'macro_feast')
) v(idx, mv) where m.idx = v.idx;

create or replace function public.ultimate_move(p_type text) returns text language sql immutable as $$
  select case p_type when 'strength' then 'titan_lift' when 'endurance' then 'endless_stride' when 'climbing' then 'summit_strike' else 'true_form' end
$$;

create or replace function public.pet_snapshot(p_pet uuid, p_owner jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pt pets; sp monsters; o jsonb; r jsonb; best numeric; lv numeric; extra text[];
begin
  select * into pt from pets where id = p_pet; if pt.id is null then return null; end if;
  select * into sp from monsters where idx = pt.species;
  o := coalesce(p_owner, public.fighter_snapshot(pt.user_id)); r := sp.ratios;
  -- attack, speed and technique come from your best one, so a climbing pet still hits hard for a lifter
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.85;
  lv := (1 + 0.02 * (public.pet_level(pt.xp) - 1)) * (case when pt.evolved then 1.25 else 1 end);   -- evolved: +25%
  -- extra moves: the scroll move, the evolved form's signature move, or (never evolved, level 20) the ultimate
  extra := array_remove(array[pt.extra_move, case when pt.evolved then sp.sig_move end,
    case when not pt.evolved and public.pet_level(pt.xp) >= 20 then public.ultimate_move(sp.type) end], null);
  return jsonb_build_object('pet', pt.id, 'species', sp.idx, 'name', pt.nickname, 'level', o->'level', 'pet_level', public.pet_level(pt.xp), 'evolved', pt.evolved, 'type', sp.type, 'grit', false,
    'hp',  greatest(20, round((o->>'hp')::numeric * (r->>'hp')::numeric * (1 + (pt.iv->>'hp')::numeric) * lv)),
    'atk', greatest(10, round(best * (r->>'atk')::numeric * (1 + (pt.iv->>'atk')::numeric) * lv)),
    'def', greatest(5,  round((o->>'def')::numeric * (r->>'def')::numeric * (1 + (pt.iv->>'def')::numeric) * lv)),
    'spd', greatest(5,  round(best * (r->>'spd')::numeric * (1 + (pt.iv->>'spd')::numeric) * lv)),
    'tec', greatest(5,  round(best * (r->>'tec')::numeric * (1 + (pt.iv->>'tec')::numeric) * lv)),
    'moves', (select jsonb_agg(public.move_json(x) order by coalesce(array_position(sp.moves, x.id), 99)) from moves x where x.id = any(sp.moves) or x.id = any(extra)));
end $$;
revoke all on function public.pet_snapshot(uuid, jsonb) from public, anon, authenticated;

create or replace function public.my_pets() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me jsonb;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  me := public.fighter_snapshot(auth.uid());
  return coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'species', p.species, 'nickname', p.nickname, 'slot', p.slot, 'iv', p.iv,
      'caught_at', p.caught_at, 'boss', m.boss, 'type', m.type, 'xp', p.xp, 'level', public.pet_level(p.xp),
      'xp_from', public.pet_level_xp(public.pet_level(p.xp)), 'xp_to', case when public.pet_level(p.xp) < 20 then public.pet_level_xp(public.pet_level(p.xp) + 1) end,
      'extra_move', p.extra_move, 'release', public.release_value(p.id), 'evolved', p.evolved, 'gym_days', p.gym_days, 'keep_form', p.keep_form, 'sig_move', m.sig_move, 'ultimate', public.ultimate_move(m.type),
      'evo_ready', not p.evolved and public.pet_level(p.xp) >= 10 and p.gym_days >= 20,
      'evo_prompt', not p.evolved and not p.keep_form and public.pet_level(p.xp) >= 10 and p.gym_days >= 20 and public.pet_level(p.xp) > p.evo_skip_level, 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

create or replace function public.pet_fight_xp() returns trigger
language plpgsql security definer set search_path = public as $$
declare amt int; ready jsonb;
begin
  if new.kind not in ('tower', 'lair', 'raid') or old.status <> 'active' or new.status <> 'done' or new.snap->'party' is null then return new; end if;
  if (new.log->-1->>'t') = 'flee' then return new; end if;
  amt := case when new.winner_side = 'a' then 20 else 5 end;
  with up as (
    update pets p set xp = least(p.xp + amt, public.pet_level_xp(20))
    where p.user_id = new.a and p.id in (select (x->>'pet')::uuid from jsonb_array_elements(new.snap->'party') x where x ? 'pet')
    returning p.id, p.species, p.nickname, p.xp, p.gym_days, p.evolved, p.keep_form, p.evo_skip_level)
  -- pets that just levelled up into being able to evolve (or levelled again while you said "not now")
  select coalesce(jsonb_agg(jsonb_build_object('pet', id, 'species', species, 'name', nickname, 'level', public.pet_level(xp))), '[]'::jsonb) into ready
  from up where not evolved and not keep_form and gym_days >= 20 and public.pet_level(xp) >= 10
    and public.pet_level(xp) > public.pet_level(xp - amt) and public.pet_level(xp) > evo_skip_level;
  new.state := new.state || jsonb_build_object('pet_xp', amt, 'evo_ready', ready);
  return new;
end $$;

create or replace function public.pet_feed(p_pet uuid, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare it shop_items; pt pets;
begin
  select * into pt from pets where id = p_pet and user_id = auth.uid() for update;
  if pt.id is null then raise exception 'Not your pet'; end if;
  select * into it from shop_items where id = p_item and kind = 'food';
  if it.id is null then raise exception 'That’s not food'; end if;
  if public.pet_level(pt.xp) >= 20 then raise exception 'Already level 20'; end if;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = p_item and qty > 0;
  if not found then raise exception 'You don’t have that'; end if;
  update pets set xp = least(xp + it.val::int, public.pet_level_xp(20)) where id = p_pet returning * into pt;
  return jsonb_build_object('xp', pt.xp, 'level', public.pet_level(pt.xp));
end $$;

-- "not now" (ask again at its next level) or keep this form for good (and back again)
create or replace function public.pet_evo_choice(p_pet uuid, p_choice text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from pets where id = p_pet and user_id = auth.uid()) then raise exception 'Not your pet'; end if;
  if p_choice = 'later' then update pets set evo_skip_level = public.pet_level(xp) where id = p_pet;
  elsif p_choice = 'keep' then update pets set keep_form = true where id = p_pet;
  elsif p_choice = 'unkeep' then update pets set keep_form = false, evo_skip_level = public.pet_level(xp) where id = p_pet;
  else raise exception 'Pick later, keep or unkeep'; end if;
end $$;
revoke all on function public.pet_evo_choice(uuid, text) from public, anon;
grant execute on function public.pet_evo_choice(uuid, text) to authenticated;

create or replace function public.raid_finish(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles; dealt int; m numeric; perf numeric; counts int; team_hp int; pets int; bonus numeric;
begin
  select * into bt from battles where id = p_id;
  dealt := greatest(0, (bt.state->'max'->>'b')::int - (bt.state->'hp'->>'b')::int);
  -- measured against YOUR HP (a raid is 8 moves whoever makes them), so stronger trainers score more
  team_hp := coalesce((bt.snap->'party'->0->>'hp')::int, (bt.state->'max'->>'a')::int);
  pets := greatest(0, coalesce(jsonb_array_length(bt.snap->'party'), 1) - 1);
  -- +10% a pet, +15% for an evolved one
  bonus := 1 + 0.1 * pets + 0.05 * (select count(*) from jsonb_array_elements(bt.snap->'party') x where (x->>'evolved')::boolean);
  perf := least(1, dealt / greatest(1, 2.0 * team_hp));
  m := public.underdog_mult(bt.group_id, bt.a);
  counts := round((70 + 60 * perf) * bonus * m);
  update battles set state = state || jsonb_build_object('dealt', dealt, 'perf', round(perf, 2), 'mult', m, 'pets', pets, 'team_bonus', bonus, 'evolved_pets', (select count(*) from jsonb_array_elements(bt.snap->'party') x where (x->>'evolved')::boolean), 'counts', counts, 'coins', 5 + counts / 20) where id = p_id;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (bt.a, 'raid', 'raid:' || p_id, 10, 5 + counts / 20, jsonb_build_object('group', bt.group_id, 'counts', counts))
  on conflict do nothing;
end $$;
revoke all on function public.raid_finish(uuid) from public, anon, authenticated;
