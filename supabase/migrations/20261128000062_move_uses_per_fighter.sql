-- Limited-use moves (boosts, heals, fusions…) are counted per team member, not per side: if two of your pets know
-- the same move, using it with one no longer uses up the other's. The count is kept under "<team slot>:<move>"
-- in state.used.a when you fight with a team; fights without a team keep the plain move id.
-- Applied by GitHub Actions. Safe to run more than once.

CREATE OR REPLACE FUNCTION public.battle_step(p_id uuid, p_side text, p_move text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  SCALE constant numeric := 3.0;
  bt battles; me text; th text; mv jsonb; st jsonb; ev jsonb; s_me jsonb; s_th jsonb;
  hits int := 1; i int; dmg int; total int := 0; crit boolean; eff numeric; stab numeric; a numeric; d numeric; pw numeric; lv int;
  crits int := 0; dmgs jsonb := '[]'::jsonb; ko boolean := false; flinched boolean := false; hp_th int; hp_me int; amt int; nxt int; uk text;
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
    -- each team member has its own count: with a team the key is "<team slot>:<move>", so two pets with the same move don't share it
    uk := case when st ? 'party' and st ? 'active' and me = 'a' then (st->>'active') || ':' || p_move else p_move end;
    if coalesce((st->'used'->me->>uk)::int, 0) >= coalesce((mv->>'uses')::int, case when mv->>'effect' in ('heal', 'heal_buff') then 2 else 3 end) then raise exception 'No uses left for that move'; end if;
    st := jsonb_set(st, array['used'], coalesce(st->'used', '{"a":{},"b":{}}'::jsonb));
    st := jsonb_set(st, array['used', me], coalesce(st->'used'->me, '{}'::jsonb));
    st := jsonb_set(st, array['used', me, uk], to_jsonb(coalesce((st->'used'->me->>uk)::int, 0) + 1));
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
end $function$;
