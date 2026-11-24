-- F19 AC2 at the database: a repeated bank reference is refused with 23505
-- (unique_violation), which ingest-sms reports as {duplicate: true}.
begin;
insert into auth.users (id) values ('00000000-0000-0000-0000-0000000000f9') on conflict do nothing;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f9","role":"authenticated"}', true);

do $$
begin
  insert into public.expense (date, amount_inr, source, txn_ref) values ('2026-06-01', 40, 'sms', '651870302957');
  begin
    insert into public.expense (date, amount_inr, source, txn_ref) values ('2026-06-01', 40, 'sms', '651870302957');
    raise exception 'FAIL: duplicate txn_ref accepted';
  exception when unique_violation then null;
  end;
  -- manual rows have no ref and never collide
  insert into public.expense (date, amount_inr) values ('2026-06-01', 40);
  insert into public.expense (date, amount_inr) values ('2026-06-01', 40);
  -- skipped rows accept the OTP and unmatched classifications
  insert into public.expense_skipped (raw_sms, classification, stage) values ('123 is your OTP', 'otp', 'reject_rule');
  insert into public.expense_skipped (raw_sms, classification, stage) values ('hello', 'unmatched', 'unmatched_default');
  raise notice 'ingest.sql ok';
end $$;
rollback;
