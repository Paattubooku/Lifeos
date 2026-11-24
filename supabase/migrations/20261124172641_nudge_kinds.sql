-- F24: accountability nudges. Widens nudge_log.kind and adds `ref` (e.g. the
-- pinned block's client_id). Additive: existing rows are unaffected.
alter table public.nudge_log drop constraint nudge_log_kind_check;
alter table public.nudge_log add constraint nudge_log_kind_check check (kind in (
  'missed_day', 'interrupt_11', 'interrupt_15', 'interrupt_19', 'fallback', 'reality_weight', 'reality_audit',
  'interrupt', 'pinned', 'strict_week', 'rescue_eggs', 'rescue_walk', 'rescue_water', 'rescue_plank'
));
alter table public.nudge_log add column ref text;
comment on column public.nudge_log.ref is 'What the nudge points at, e.g. the pinned block''s client_id (F24).';
