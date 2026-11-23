-- Battles: one turn-based engine for three kinds of fight, all worked out here so no phone can cheat.
--   tower: you against a monster on a floor of the Gym Tower (migration 032); the monster answers at once
--   raid:  you against this week's group boss; whatever damage you do counts towards the group total
--   pvp:   a friendly match with a groupmate (they accept, then you take turns). No XP, no coins.
--
-- Fighters are a snapshot taken when the battle starts: stats from character_card (each level adds
-- 2%), the 4 equipped moves from character_moves, type and Grit.
-- Damage (Pokémon-style): ((2·Lv/5 + 2) · power · A / D) / 50 + 2, then
--   × 1.5 if the move matches your type, × 1.5 / × 0.67 for type match-ups
--   (strength beats climbing, climbing beats endurance, endurance beats strength),
--   × 0.85–1.0 random, × 1.5 on a critical hit (1 in 16, more for some moves), × SCALE.
--   A is the stat the move uses (attack, speed or technique) with boosts; D is defence with boosts + 50.
-- Battle HP = the HP stat + 40 (attack is at least 30, so newcomers can still hit). If a player doesn't move for 48 hours, the other can claim the win.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.battles (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'pvp' check (kind in ('pvp', 'tower', 'raid')),
  group_id uuid references public.groups (id) on delete cascade,      -- null for the tower
  a uuid not null references public.profiles (id) on delete cascade,   -- the player (challenger in pvp)
  b uuid references public.profiles (id) on delete cascade,            -- null when it's a monster
  floor int,                                                           -- tower floor
  week date,                                                           -- raid week
  winner_side text,
  status text not null default 'pending' check (status in ('pending', 'active', 'done', 'declined', 'cancelled')),
  turn uuid,
  snap jsonb,
  state jsonb,
  log jsonb not null default '[]'::jsonb,
  winner uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_move_at timestamptz,
  notified_key text
);
create index if not exists battles_group on public.battles (group_id, updated_at desc);
create index if not exists battles_players on public.battles (a, b, status);
alter table public.battles enable row level security;
drop policy if exists "group sees battles" on public.battles;
create policy "group sees battles" on public.battles for select to authenticated using (a = auth.uid() or b = auth.uid() or (group_id is not null and public.is_member(group_id)));
grant select on public.battles to authenticated;

-- a fighter, frozen at the start of a battle
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
    'moves', (select jsonb_agg(jsonb_build_object('id', x.id, 'en', x.en, 'zh', x.zh, 'type', x.type, 'stat', x.stat, 'power', x.power, 'effect', x.effect, 'val', x.effect_val) order by array_position(array(select jsonb_array_elements_text(mv->'equipped')), x.id))
              from moves x where mv->'equipped' ? x.id));
end $$;
revoke all on function public.fighter_snapshot(uuid) from public, anon, authenticated;

create or replace function public.challenge(p_opp uuid, p_group uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare bid uuid;
begin
  if auth.uid() is null or p_opp = auth.uid() then raise exception 'You can’t battle yourself'; end if;
  if not (public.is_member(p_group) and exists (select 1 from group_members where group_id = p_group and user_id = p_opp)) then raise exception 'Not in this group'; end if;
  if exists (select 1 from battles where group_id = p_group and status in ('pending', 'active')
             and ((a = auth.uid() and b = p_opp) or (a = p_opp and b = auth.uid()))) then raise exception 'You already have a battle going with them'; end if;
  insert into battles (group_id, a, b) values (p_group, auth.uid(), p_opp) returning id into bid;
  return bid;
end $$;

create or replace function public.respond_battle(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare bt battles; sa jsonb; sb jsonb; first uuid;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.status <> 'pending' or bt.kind <> 'pvp' then raise exception 'This battle isn’t waiting'; end if;
  if auth.uid() = bt.a and not p_accept then update battles set status = 'cancelled', updated_at = now() where id = p_id; return; end if;
  if auth.uid() <> bt.b then raise exception 'Not your challenge'; end if;
  if not p_accept then update battles set status = 'declined', updated_at = now() where id = p_id; return; end if;
  sa := public.fighter_snapshot(bt.a); sb := public.fighter_snapshot(bt.b);
  first := case when (sa->>'spd')::int > (sb->>'spd')::int then bt.a when (sb->>'spd')::int > (sa->>'spd')::int then bt.b
                when random() < 0.5 then bt.a else bt.b end;
  update battles set status = 'active', turn = first, snap = jsonb_build_object('a', sa, 'b', sb),
    state = public.battle_state0(sa, sb),
    log = jsonb_build_array(jsonb_build_object('t', 'start', 'first', case when first = bt.a then 'a' else 'b' end)),
    updated_at = now(), last_move_at = now()
  where id = p_id;
end $$;

-- type match-ups
create or replace function public.type_eff(mt text, dt text) returns numeric language sql immutable as $$
  select case
    when mt = 'strength' and dt = 'climbing' then 1.5 when mt = 'climbing' and dt = 'endurance' then 1.5 when mt = 'endurance' and dt = 'strength' then 1.5
    when mt = 'climbing' and dt = 'strength' then 0.67 when mt = 'endurance' and dt = 'climbing' then 0.67 when mt = 'strength' and dt = 'endurance' then 0.67
    else 1 end
$$;
create or replace function public.stage_mult(s int) returns numeric language sql immutable as $$
  select case when s >= 0 then (2 + s) / 2.0 else 2.0 / (2 - s) end
$$;

-- the state a fight starts from
create or replace function public.battle_state0(sa jsonb, sb jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('hp', jsonb_build_object('a', sa->'hp', 'b', sb->'hp'), 'max', jsonb_build_object('a', sa->'hp', 'b', sb->'hp'),
    'atk', '{"a":0,"b":0}'::jsonb, 'def', '{"a":0,"b":0}'::jsonb, 'lock', '{"a":0,"b":0}'::jsonb,
    'ramp', '{"a":{},"b":{}}'::jsonb, 'used', '{"a":{},"b":{}}'::jsonb, 'grit', '{"a":false,"b":false}'::jsonb, 'moves', 0)
$$;

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
  if mv->>'effect' in ('heal', 'buff_atk', 'buff_def', 'buff_both') then
    if coalesce((st->'used'->me->>p_move)::int, 0) >= (case when mv->>'effect' = 'heal' then 2 else 3 end) then raise exception 'No uses left for that move'; end if;
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
    a := (s_me->>(mv->>'stat'))::numeric * public.stage_mult((st->'atk'->>me)::int);
    d := (s_th->>'def')::numeric * public.stage_mult((st->'def'->>th)::int) + 50;   -- +50 softens big defence gaps
    stab := case when mv->>'type' = s_me->>'type' then 1.5 else 1 end;
    eff := public.type_eff(mv->>'type', s_th->>'type');
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

-- how a monster picks: heal when hurt, boost early on, otherwise mostly its hardest hit
create or replace function public.monster_pick(p_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select x->>'id' from battles bt, jsonb_array_elements(bt.snap->'b'->'moves') x where bt.id = p_id
  order by case
    when x->>'effect' = 'heal' and (bt.state->'hp'->>'b')::int < (bt.state->'max'->>'b')::int * 0.35
      and coalesce((bt.state->'used'->'b'->>(x->>'id'))::int, 0) < 2 and random() < 0.7 then 0
    when x->>'effect' like 'buff%' and coalesce((bt.state->'used'->'b'->>(x->>'id'))::int, 0) < 1 and random() < 0.4 then 1
    when (x->>'power')::int > 0 then 2 + random() * (case when random() < 0.6 then 0.2 else 1 end) - (x->>'power')::numeric / 1000
    else 9 end
  limit 1
$$;
revoke all on function public.monster_pick(uuid) from public, anon, authenticated;

-- the monster takes its turn(s) straight away (it goes again if it made you flinch)
create or replace function public.monster_turns(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; evs jsonb := '[]'::jsonb; n int := 0;
begin
  loop
    select * into bt from battles where id = p_id;
    exit when bt.status <> 'active' or bt.turn is not null or bt.kind = 'pvp' or n >= 5;
    evs := evs || public.battle_step(p_id, 'b', public.monster_pick(p_id)); n := n + 1;
  end loop;
  return evs;
end $$;
revoke all on function public.monster_turns(uuid) from public, anon, authenticated;

-- your move; against a monster, its reply comes back too. Returns the list of what happened.
create or replace function public.battle_move(p_id uuid, p_move text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare bt battles; evs jsonb;
begin
  select * into bt from battles where id = p_id;
  if bt.id is null or bt.status <> 'active' then raise exception 'This battle isn’t on'; end if;
  if bt.turn is distinct from auth.uid() then raise exception 'It’s not your turn'; end if;
  evs := jsonb_build_array(public.battle_step(p_id, case when auth.uid() = bt.a then 'a' else 'b' end, p_move));
  return evs || public.monster_turns(p_id);
end $$;

-- give up (monster fights only; pvp uses the 48-hour rule)
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

-- 48 hours without a move: the other player takes the win
create or replace function public.claim_timeout(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare bt battles;
begin
  select * into bt from battles where id = p_id for update;
  if bt.id is null or bt.kind <> 'pvp' or bt.status <> 'active' or auth.uid() not in (bt.a, bt.b) or bt.turn = auth.uid() then return false; end if;
  if bt.last_move_at > now() - interval '48 hours' then return false; end if;
  update battles set status = 'done', winner = auth.uid(), winner_side = case when auth.uid() = bt.a then 'a' else 'b' end, turn = null, log = log || jsonb_build_object('t', 'timeout', 'who', case when bt.turn = bt.a then 'a' else 'b' end),
    updated_at = now() where id = p_id;
  return true;
end $$;

revoke all on function public.challenge(uuid, uuid), public.respond_battle(uuid, boolean), public.battle_move(uuid, text), public.claim_timeout(uuid), public.battle_flee(uuid) from public, anon;
grant execute on function public.challenge(uuid, uuid), public.respond_battle(uuid, boolean), public.battle_move(uuid, text), public.claim_timeout(uuid), public.battle_flee(uuid) to authenticated;

-- live updates in the app, and a push to whoever needs to act
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'battles') then
    execute 'alter publication supabase_realtime add table public.battles';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_net with schema extensions';
    execute $f$
      create or replace function public.battle_notify() returns trigger language plpgsql security definer set search_path = public as $b$
      begin
        if new.kind <> 'pvp' then return new; end if;   -- monster fights happen there and then, no push needed
        if tg_op = 'UPDATE' and new.status = old.status and new.turn is not distinct from old.turn then return new; end if;
        perform net.http_post(
          url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/notify-reaction',
          headers := '{"Content-Type": "application/json"}'::jsonb,
          body := jsonb_build_object('id', new.id, 'battle', true),
          timeout_milliseconds := 10000);
        return new;
      end $b$;
    $f$;
    execute 'drop trigger if exists battle_notify on public.battles';
    execute 'create trigger battle_notify after insert or update on public.battles for each row execute function public.battle_notify()';
  end if;
end $$;
