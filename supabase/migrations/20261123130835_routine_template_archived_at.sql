-- F04: a template used by a day_log in the last 7 days can't be deleted; it can be archived.
alter table public.routine_template add column archived_at timestamptz;
comment on column public.routine_template.archived_at is 'Hidden from lists and weekday matching; past day_logs still resolve to it (PRD F04).';
