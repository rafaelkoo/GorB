-- Pet dex, evolution, streak shields and the Sunday summary.
--   Dex: every species you've ever caught is recorded (even if you release it later). Catch all 12 tower
--     species: 150 coins + 100 XP. All 6 bosses: 250 coins + 150 XP. Evolve 6 different species: 200 + 100.
--   Evolution: a pet at level 10 that has been in your team on 20 of your gym days can evolve: the excuse
--     becomes a motivation (Duvet Burrito → Sunrise Runner …), +15% to all its stats, and a new look.
--     Gym days count when you check in (first check-in of the day) with the pet in your team.
--   Streak shields: if you missed your days target last week, a shield keeps your streak going. One free
--     each month (you can hold up to 3), or 100 coins in the shop.
--   Sunday summary: Sunday evening each person gets a push about their week (days vs target, PRs, streak).
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.rewards drop constraint if exists rewards_kind_check;
alter table public.rewards add constraint rewards_kind_check
  check (kind in ('chest', 'comeback', 'summon', 'boss', 'quest', 'season', 'battle', 'spend', 'tower', 'raid', 'lair', 'pet', 'dex'));

-- ---------- evolution ----------
alter table public.monsters add column if not exists evo_en text;
alter table public.monsters add column if not exists evo_zh text;
update public.monsters m set evo_en = v.en, evo_zh = v.zh from (values
  (0, 'Yoga Mat Guardian', '瑜伽墊守護者'), (1, 'Meal-Prep Dragon', '備餐龍'), (2, 'Hustle Slime', '拼搏史萊姆'),
  (3, 'Early-Bird Clock', '早起鬧鐘'), (4, 'Protein Shake Beast', '蛋白奶昔獸'), (5, 'Workout Tracker', '運動紀錄機'),
  (6, 'Meal-Prep Chef', '備餐大廚'), (7, 'Sunrise Runner', '晨跑卷'), (8, 'Rain-or-Shine Cloud', '風雨無阻雲'),
  (9, 'Recovery Jelly', '恢復啫喱'), (10, 'Lunch-Break Lifter', '午休健身鬼'), (11, 'Six-Pack Barrel', '六舊腹肌桶'),
  (12, 'Do-It-Today Dragon', '今日就做龍'), (13, 'Right-Now Phoenix', '即刻鳳凰'), (14, 'Workout-Video Kraken', '跟片運動八爪魚'),
  (15, 'Discipline Golem', '自律魔像'), (16, 'Bench-Press King', '臥推王'), (17, 'Macro Hydra', '營養九頭蛇')
) v(idx, en, zh) where m.idx = v.idx;

alter table public.pets add column if not exists evolved boolean not null default false;
alter table public.pets add column if not exists gym_days int not null default 0;

-- a gym day with the pet in your team (first check-in of the day)
create or replace function public.pets_gym_day() returns trigger
language plpgsql security definer set search_path = public as $$
declare d date := (new.created_at at time zone 'Europe/London')::date;
begin
  if (select count(*) from checkins where user_id = new.user_id and (created_at at time zone 'Europe/London')::date = d) = 1 then
    update pets set gym_days = gym_days + 1 where user_id = new.user_id and slot is not null;
  end if;
  return new;
end $$;
drop trigger if exists pets_gym_day on public.checkins;
create trigger pets_gym_day after insert on public.checkins for each row execute function public.pets_gym_day();

create or replace function public.evolve_pet(p_pet uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare pt pets;
begin
  select * into pt from pets where id = p_pet and user_id = auth.uid() for update;
  if pt.id is null then raise exception 'Not your pet'; end if;
  if pt.evolved then raise exception 'Already evolved'; end if;
  if public.pet_level(pt.xp) < 10 then raise exception 'It needs to be level 10'; end if;
  if pt.gym_days < 20 then raise exception 'It needs 20 gym days in your team (it has %)', pt.gym_days; end if;
  update pets set evolved = true where id = p_pet;
  insert into pet_dex (user_id, species, evolved) values (auth.uid(), pt.species, true)
  on conflict (user_id, species) do update set evolved = true;
  return jsonb_build_object('evolved', true, 'species', pt.species);
end $$;

create or replace function public.pet_snapshot(p_pet uuid, p_owner jsonb default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare pt pets; sp monsters; o jsonb; r jsonb; best numeric; lv numeric;
begin
  select * into pt from pets where id = p_pet; if pt.id is null then return null; end if;
  select * into sp from monsters where idx = pt.species;
  o := coalesce(p_owner, public.fighter_snapshot(pt.user_id)); r := sp.ratios;
  -- attack, speed and technique come from your best one, so a climbing pet still hits hard for a lifter
  best := greatest((o->>'atk')::numeric, (o->>'spd')::numeric, (o->>'tec')::numeric) * 0.85;
  lv := (1 + 0.02 * (public.pet_level(pt.xp) - 1)) * (case when pt.evolved then 1.15 else 1 end);   -- evolved: +15%
  return jsonb_build_object('pet', pt.id, 'species', sp.idx, 'name', pt.nickname, 'level', o->'level', 'pet_level', public.pet_level(pt.xp), 'evolved', pt.evolved, 'type', sp.type, 'grit', false,
    'hp',  greatest(20, round((o->>'hp')::numeric * (r->>'hp')::numeric * (1 + (pt.iv->>'hp')::numeric) * lv)),
    'atk', greatest(10, round(best * (r->>'atk')::numeric * (1 + (pt.iv->>'atk')::numeric) * lv)),
    'def', greatest(5,  round((o->>'def')::numeric * (r->>'def')::numeric * (1 + (pt.iv->>'def')::numeric) * lv)),
    'spd', greatest(5,  round(best * (r->>'spd')::numeric * (1 + (pt.iv->>'spd')::numeric) * lv)),
    'tec', greatest(5,  round(best * (r->>'tec')::numeric * (1 + (pt.iv->>'tec')::numeric) * lv)),
    'moves', (select jsonb_agg(public.move_json(x) order by coalesce(array_position(sp.moves, x.id), 99)) from moves x where x.id = any(sp.moves) or x.id = pt.extra_move));
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
      'xp_from', public.pet_level_xp(public.pet_level(p.xp)), 'xp_to', case when public.pet_level(p.xp) < 10 then public.pet_level_xp(public.pet_level(p.xp) + 1) end,
      'extra_move', p.extra_move, 'release', public.release_value(p.id), 'evolved', p.evolved, 'gym_days', p.gym_days, 'snap', public.pet_snapshot(p.id, me)) order by p.slot nulls last, p.caught_at desc)
    from pets p join monsters m on m.idx = p.species where p.user_id = auth.uid()), '[]'::jsonb);
end $$;

-- ---------- the dex ----------
create table if not exists public.pet_dex (
  user_id uuid not null references public.profiles (id) on delete cascade,
  species int not null references public.monsters (idx),
  first_caught timestamptz not null default now(),
  evolved boolean not null default false,
  primary key (user_id, species)
);
alter table public.pet_dex enable row level security;
drop policy if exists "own and groupmates dex" on public.pet_dex;
create policy "own and groupmates dex" on public.pet_dex for select to authenticated using (user_id = auth.uid() or public.shares_group(user_id));
grant select on public.pet_dex to authenticated;
insert into public.pet_dex (user_id, species, first_caught, evolved)
  select user_id, species, min(caught_at), bool_or(evolved) from public.pets group by 1, 2
on conflict (user_id, species) do nothing;

create or replace function public.pet_dex_add() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pet_dex (user_id, species) values (new.user_id, new.species) on conflict do nothing;
  return new;
end $$;
drop trigger if exists pet_dex_add on public.pets;
create trigger pet_dex_add after insert on public.pets for each row execute function public.pet_dex_add();

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
      from monsters m left join pet_dex d on d.species = m.idx and d.user_id = u),
    'sets', jsonb_build_array(
      jsonb_build_object('id', 'normal', 'have', normal, 'need', 12, 'coins', 150, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:normal')),
      jsonb_build_object('id', 'boss', 'have', boss, 'need', 6, 'coins', 250, 'xp', 150, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:boss')),
      jsonb_build_object('id', 'evo', 'have', evo, 'need', 6, 'coins', 200, 'xp', 100, 'claimed', exists (select 1 from rewards where user_id = u and ref = 'dex:evo'))));
end $$;

create or replace function public.claim_dex(p_set text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s jsonb;
begin
  select x into s from jsonb_array_elements(public.my_dex()->'sets') x where x->>'id' = p_set;
  if s is null or (s->>'have')::int < (s->>'need')::int or (s->>'claimed')::boolean then raise exception 'Not ready yet'; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta) values (auth.uid(), 'dex', 'dex:' || p_set, (s->>'xp')::int, (s->>'coins')::int, jsonb_build_object('set', p_set))
  on conflict do nothing;
  return jsonb_build_object('coins', (s->>'coins')::int, 'xp', (s->>'xp')::int);
end $$;

-- ---------- streak shields ----------
insert into public.shop_items (id, en, zh, kind, price, val, sort, desc_en, desc_zh) values
  ('streak_shield', 'Streak Shield', '連續保護盾', 'shield', 100, null, 8, 'Missed your days target last week? Keep your streak anyway. One free every month.', '上個星期唔夠日數？照樣保住連續紀錄。每月送一個。')
on conflict (id) do update set en = excluded.en, zh = excluded.zh, kind = excluded.kind, price = excluded.price, sort = excluded.sort, desc_en = excluded.desc_en, desc_zh = excluded.desc_zh;
alter table public.profiles add column if not exists shield_month text;
create table if not exists public.streak_protected (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week date not null,
  primary key (user_id, week)
);
alter table public.streak_protected enable row level security;
drop policy if exists "own protected weeks" on public.streak_protected;
create policy "own protected weeks" on public.streak_protected for select to authenticated using (user_id = auth.uid());
grant select on public.streak_protected to authenticated;

-- weeks in a row (before this one) you hit your days target; a shielded week counts as hit
create or replace function public.week_streak(p_user uuid, p_target int) returns int
language plpgsql stable security definer set search_path = public as $$
declare wk date := date_trunc('week', now() at time zone 'Europe/London')::date; n int := 0; days int;
begin
  loop
    exit when n >= 52;
    wk := wk - 7;
    select count(distinct (created_at at time zone 'Europe/London')::date) into days from checkins
      where user_id = p_user and (created_at at time zone 'Europe/London')::date >= wk and (created_at at time zone 'Europe/London')::date < wk + 7;
    exit when days < greatest(1, p_target) and not exists (select 1 from streak_protected where user_id = p_user and week = wk);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.week_streak(uuid, int) from public, anon, authenticated;

-- how your streak stands, and whether a shield would save it (also hands out this month's free shield)
create or replace function public.shield_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); target int; last date := date_trunc('week', now() at time zone 'Europe/London')::date - 7;
  m text := to_char(now() at time zone 'Europe/London', 'YYYY-MM'); days int; have int; before int; prot boolean;
begin
  if u is null then return null; end if;
  if (select shield_month from profiles where id = u) is distinct from m then
    insert into user_items (user_id, item, qty) values (u, 'streak_shield', 1)
    on conflict (user_id, item) do update set qty = least(3, user_items.qty + 1);
    update profiles set shield_month = m where id = u;
  end if;
  select coalesce(days_per_week, 3) into target from profiles where id = u;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days from checkins
    where user_id = u and (created_at at time zone 'Europe/London')::date >= last and (created_at at time zone 'Europe/London')::date < last + 7;
  prot := exists (select 1 from streak_protected where user_id = u and week = last);
  -- the streak that a shield on last week would keep (weeks before last week)
  insert into streak_protected (user_id, week) values (u, last) on conflict do nothing;   -- try it…
  before := public.week_streak(u, target);
  if not prot then delete from streak_protected where user_id = u and week = last; end if;   -- …and undo
  select coalesce((select qty from user_items where user_id = u and item = 'streak_shield'), 0) into have;
  return jsonb_build_object('shields', have, 'target', target, 'last_week_days', days, 'missed', days < greatest(1, target) and not prot,
    'protected', prot, 'streak', public.week_streak(u, target), 'streak_if_shielded', before,
    'worth', days < greatest(1, target) and not prot and before >= 2);
end $$;

create or replace function public.use_shield() returns jsonb
language plpgsql security definer set search_path = public as $$
declare st jsonb; last date := date_trunc('week', now() at time zone 'Europe/London')::date - 7;
begin
  st := public.shield_status();
  if not (st->>'missed')::boolean then raise exception 'Last week doesn’t need a shield'; end if;
  if (st->>'streak_if_shielded')::int < 2 then raise exception 'There’s no streak to protect yet'; end if;
  update user_items set qty = qty - 1 where user_id = auth.uid() and item = 'streak_shield' and qty > 0;
  if not found then raise exception 'You don’t have a shield'; end if;
  insert into streak_protected (user_id, week) values (auth.uid(), last) on conflict do nothing;
  return public.shield_status();
end $$;

-- ---------- Sunday summary ----------
create table if not exists public.week_me_sent (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,
  primary key (user_id, week_start)
);
alter table public.week_me_sent enable row level security;   -- no policies: only the service role touches it

-- your week so far, for the Sunday push (service role only)
create or replace function public.week_summary(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare wk date := date_trunc('week', now() at time zone 'Europe/London')::date; target int; days int; prs int; tower int; lvl int;
begin
  select coalesce(days_per_week, 3), tower_floor into target, tower from profiles where id = p_user;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days from checkins
    where user_id = p_user and (created_at at time zone 'Europe/London')::date >= wk;
  select count(distinct (exercise_id, day)) into prs from (
    select t.exercise_id, t.day, t.top > max(t.top) over w as heavier, t.e1 > max(t.e1) over w as better, count(*) over w as before_n
    from (select s.exercise_id, wo.performed_on as day, max(s.weight_kg) as top,
                 max(s.weight_kg * (case when s.reps <= 1 then 1 else 1 + s.reps / 30.0 end)) as e1
          from workouts wo join workout_sets s on s.workout_id = wo.id
          where wo.user_id = p_user and s.reps between 1 and 30 and s.weight_kg > 0 and s.weight_kg <= 500 and s.exercise_id <> 'wall_climb'
          group by 1, 2) t
    window w as (partition by t.exercise_id order by t.day rows between unbounded preceding and 1 preceding)) q
  where q.day >= wk and q.before_n > 0 and (q.heavier or q.better);
  return jsonb_build_object('week_start', wk, 'days', days, 'target', target, 'prs', prs, 'streak', public.week_streak(p_user, target),
    'hit', days >= target, 'tower', tower,
    'pets_up', (select count(*) from pets where user_id = p_user and slot is not null));
end $$;
revoke all on function public.week_summary(uuid) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.week_summary(uuid) to service_role';
  end if;
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute 'create extension if not exists pg_net with schema extensions';
    perform cron.unschedule(jobid) from cron.job where jobname = 'gob-week-me';
    -- Sundays 18:07 UTC (18:07 in winter, 19:07 in summer, London)
    perform cron.schedule('gob-week-me', '7 18 * * 0', $job$
      select net.http_post(
        url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/weekly-me',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $job$);
  end if;
end $$;

revoke all on function public.evolve_pet(uuid), public.my_dex(), public.claim_dex(text), public.shield_status(), public.use_shield() from public, anon;
grant execute on function public.evolve_pet(uuid), public.my_dex(), public.claim_dex(text), public.shield_status(), public.use_shield() to authenticated;
