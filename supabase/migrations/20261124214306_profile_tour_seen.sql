-- LifeOS · app tour: when this account finished or skipped the first-run tour.
-- Additive: null = not seen yet (the tour shows once after setup).
alter table public.profile add column tour_seen_at timestamptz;
