-- LifeOS · F01 · security advisor 0011: pin search_path on the migration helper.
-- Its body already schema-qualifies everything (public.*, auth.uid()); gen_random_uuid() is in pg_catalog.
alter function public._lifeos_prepare_table(text, boolean) set search_path = '';
