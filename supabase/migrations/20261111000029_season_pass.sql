-- Monthly season pass: free reward tiers for gym days this month (London time). Everyone starts from
-- zero on the 1st, so a bad month doesn't follow you. Three tiers also unlock character items that
-- are yours for good: gold top (10 days), crown (15), gold shoes (20).
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.season_pass()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u uuid := auth.uid();
  m date := date_trunc('month', now() at time zone 'Europe/London')::date;
  days int;
begin
  if u is null then return null; end if;
  select count(distinct (created_at at time zone 'Europe/London')::date) into days from checkins
    where user_id = u and (created_at at time zone 'Europe/London')::date >= m;
  return jsonb_build_object('month', m, 'month_end', (m + interval '1 month' - interval '1 day')::date, 'days', days,
    'tiers', (select jsonb_agg(jsonb_build_object('need', need, 'coins', coins, 'xp', xp, 'item', item,
        'claimed', exists (select 1 from rewards r where r.user_id = u and r.ref = 'season:' || m || ':' || need)) order by need)
      from (values (2, 15, 20, null), (4, 20, 30, null), (6, 25, 40, null), (8, 30, 50, null), (10, 30, 60, 'gold_top'),
                   (12, 40, 70, null), (15, 50, 90, 'crown'), (18, 60, 100, null), (20, 80, 150, 'gold_shoes')) t(need, coins, xp, item)));
end $$;
revoke all on function public.season_pass() from public, anon;
grant execute on function public.season_pass() to authenticated;

create or replace function public.claim_season(p_need int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s jsonb; t jsonb;
begin
  s := public.season_pass(); if s is null then return null; end if;
  select x into t from jsonb_array_elements(s->'tiers') x where (x->>'need')::int = p_need;
  if t is null or (s->>'days')::int < p_need or (t->>'claimed')::boolean then return null; end if;
  insert into rewards (user_id, kind, ref, xp, coins, meta)
  values (auth.uid(), 'season', 'season:' || (s->>'month') || ':' || p_need, (t->>'xp')::int, (t->>'coins')::int,
          jsonb_strip_nulls(jsonb_build_object('need', p_need, 'item', t->>'item')))
  on conflict do nothing;
  if not found then return null; end if;
  return t;
end $$;
revoke all on function public.claim_season(int) from public, anon;
grant execute on function public.claim_season(int) to authenticated;
