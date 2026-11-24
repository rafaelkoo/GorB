-- The follow-up questions for your goal (Me page), e.g. "Which lift?" for Strength or "Fat loss or
-- muscle first?" for Body recomp. The answers tune the training guide: recomp → fat-loss or muscle
-- rep ranges, weekly cardio minutes, how much cardio while losing weight, which lifts come first in
-- your strength levels. Gym days and kilos to lose go straight into the settings that already exist.
-- Also drops group_lifts: the old group PB board that never made it onto a page.
-- Applied by GitHub Actions. Safe to run more than once.

alter table public.body_profiles add column if not exists goal_answers jsonb not null default '{}'::jsonb;

drop function if exists public.group_lifts(uuid, text[]);
