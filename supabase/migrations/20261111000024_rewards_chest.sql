-- Rewards ledger for the game layer (chests, comeback bonus, summons, boss loot, quests, season pass).
-- Every reward has a ref that's unique per person (e.g. 'chest:2026-11-23'), so nothing can be
-- claimed twice. Rows are only ever written by functions here, never straight from the app.
-- character_card now adds the ledger's XP and coins on top of what training earns.
-- Applied by GitHub Actions. Safe to run more than once.

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('chest', 'comeback', 'summon', 'boss', 'quest', 'season', 'battle', 'spend')),
  ref text not null,
  xp int not null default 0,
  coins int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, ref)
);
create index if not exists rewards_user on public.rewards (user_id, created_at desc);
alter table public.rewards enable row level security;
drop policy if exists "see own rewards" on public.rewards;
create policy "see own rewards" on public.rewards for select to authenticated using (user_id = auth.uid());
grant select on public.rewards to authenticated;

-- First check-in of the day (London time): a treasure chest, and a small welcome-back bonus after 3+
-- days away. Chest: usually 5–20 coins; 15% of the time a big one (40–60 coins + 30 XP); and never
-- more than 5 small ones in a row (the 6th is always big).
-- The welcome-back bonus is small on purpose (10–50 XP; a gym day alone is 20) so regulars stay ahead.
create or replace function public.checkin_rewards() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  d date := (new.created_at at time zone 'Europe/London')::date;
  prev date; gap int; small_run int; big boolean; c int; x int;
begin
  if exists (select 1 from rewards where user_id = new.user_id and ref = 'chest:' || d) then return new; end if;
  select max((ch.created_at at time zone 'Europe/London')::date) into prev
    from checkins ch where ch.user_id = new.user_id and ch.id <> new.id and (ch.created_at at time zone 'Europe/London')::date < d;
  if prev is not null then
    gap := d - prev - 1;
    if gap >= 3 then
      insert into rewards (user_id, kind, ref, xp, coins, meta)
      values (new.user_id, 'comeback', 'comeback:' || d, least(gap - 2, 5) * 10, 0, jsonb_build_object('days_away', gap))
      on conflict do nothing;
    end if;
  end if;
  select count(*) into small_run from rewards r
    where r.user_id = new.user_id and r.kind = 'chest'
      and r.created_at > coalesce((select max(b.created_at) from rewards b where b.user_id = new.user_id and b.kind = 'chest' and (b.meta->>'big')::boolean), '-infinity'::timestamptz);
  big := random() < 0.15 or small_run >= 5;
  if big then c := 40 + floor(random() * 21)::int; x := 30; else c := 5 + floor(random() * 16)::int; x := 0; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (new.user_id, 'chest', 'chest:' || d, x, c, jsonb_build_object('big', big))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists checkin_rewards on public.checkins;
create trigger checkin_rewards after insert on public.checkins for each row execute function public.checkin_rewards();

-- character_card = training (the original, kept as character_card_base) + the ledger
do $$
begin
  if not exists (select 1 from pg_proc where proname = 'character_card_base' and pronamespace = 'public'::regnamespace) then
    alter function public.character_card(uuid) rename to character_card_base;
  end if;
end $$;
revoke all on function public.character_card_base(uuid) from public, anon, authenticated;

create or replace function public.character_card(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  base jsonb; lx int; lc int; xp bigint; lvl int := 1; need int := 100; left_xp bigint;
begin
  if auth.uid() is not null and p_user <> auth.uid() and not public.shares_group(p_user) then return null; end if;
  base := public.character_card_base(p_user);
  select coalesce(sum(r.xp), 0), coalesce(sum(r.coins), 0) into lx, lc from rewards r where r.user_id = p_user;
  xp := (base->>'xp')::bigint + lx; left_xp := xp;
  while left_xp >= need loop left_xp := left_xp - need; lvl := lvl + 1; need := 100 + 40 * (lvl - 1); end loop;
  return base || jsonb_build_object('xp', xp, 'level', lvl, 'xp_in_level', left_xp, 'xp_for_next', need,
    'coins', (base->>'coins')::int + lc, 'bonus_xp', lx, 'bonus_coins', lc);
end $$;
revoke all on function public.character_card(uuid) from public, anon;
grant execute on function public.character_card(uuid) to authenticated;
