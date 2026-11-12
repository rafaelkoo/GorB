-- Your own exercises can now be timed holds: kind 'timed' = sets of weight × seconds
-- (e.g. holding a weight for 30 s). Seconds are stored in workout_sets.reps; the app shows them as seconds.
-- Applied by GitHub Actions. Safe to run more than once.
alter table public.custom_exercises drop constraint if exists custom_exercises_kind_check;
alter table public.custom_exercises drop constraint if exists custom_exercises_kind_ok;
alter table public.custom_exercises add constraint custom_exercises_kind_ok check (kind in ('weight', 'timed', 'minutes'));
