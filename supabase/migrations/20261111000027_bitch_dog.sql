-- Last month's bitch turns into a dog in the pixel gym. To turn back into a person: go to the gym
-- 3 days in one week (Mon–Sun) this month. No dog when there's no finished month yet, the group is
-- one person, or everyone tied.
-- Applied by GitHub Actions. Safe to run more than once.

create or replace function public.group_dogs(p_group uuid)
returns table (user_id uuid, last_month date, last_days int, best_week int, redeemed boolean)
language sql stable security definer set search_path = public as $$
  with lm as (select (date_trunc('month', now() at time zone 'Europe/London') - interval '1 month')::date as m),
  h as (select gh.* from public.group_history(p_group) gh, lm where gh.month = lm.m),
  agg as (select min(days) as lo, max(days) as hi, count(*) as n from h),
  dogs as (select h.user_id, h.month, h.days from h, agg where agg.n > 1 and agg.lo < agg.hi and h.days = agg.lo),
  wk as (
    select d.user_id, date_trunc('week', (c.created_at at time zone 'Europe/London'))::date as w,
      count(distinct (c.created_at at time zone 'Europe/London')::date)::int as n
    from dogs d join checkins c on c.user_id = d.user_id, lm
    where (c.created_at at time zone 'Europe/London') >= lm.m + interval '1 month'
    group by 1, 2
  )
  select d.user_id, d.month, d.days, coalesce(max(wk.n), 0)::int, coalesce(max(wk.n), 0) >= 3
  from dogs d left join wk on wk.user_id = d.user_id
  where public.is_member(p_group)
  group by d.user_id, d.month, d.days;
$$;
revoke all on function public.group_dogs(uuid) from public, anon;
grant execute on function public.group_dogs(uuid) to authenticated;
