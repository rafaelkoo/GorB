-- Check-in photos are deleted after a week; the check-in itself stays.
-- photo_expired marks a check-in whose picture is gone, so the feed shows a placeholder.
-- A pg_cron job calls the cleanup-photos Edge Function once a day (photos have to be removed
-- through the Storage API, not by deleting rows here).
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.checkins add column if not exists photo_expired boolean not null default false;
create index if not exists checkins_photo_expiry on public.checkins (created_at) where not photo_expired;

do $$
begin
  -- pg_cron and pg_net come with Supabase; a plain Postgres (local tests) just skips this part
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    execute 'create extension if not exists pg_cron with schema pg_catalog';
    execute 'create extension if not exists pg_net with schema extensions';
    perform cron.unschedule(jobid) from cron.job where jobname = 'gob-photo-cleanup';
    -- every day at 03:17 UTC
    perform cron.schedule('gob-photo-cleanup', '17 3 * * *', $job$
      select net.http_post(
        url := 'https://uzawqjiczhbfxhylogir.supabase.co/functions/v1/cleanup-photos',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $job$);
  end if;
end $$;
