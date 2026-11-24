-- F21: optional routine block kind `steps` (auto-completes at the daily minimum).
-- Widens the check only; existing rows are unaffected.
alter table public.routine_block drop constraint routine_block_kind_check;
alter table public.routine_block add constraint routine_block_kind_check
  check (kind in ('wake', 'water', 'workout', 'meal', 'task', 'sleep', 'phone_off', 'custom', 'steps'));
