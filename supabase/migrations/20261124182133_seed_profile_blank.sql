-- LifeOS · F25 · multi-user: a new account's profile starts without the
-- example body numbers (170 cm, 91 → 75 kg). First-run setup asks for them.
--
-- The example plan itself (routine, meals, workouts, categories, targets) is
-- still seeded as the starting point. Additive: existing profiles are never
-- changed — only a profile created by this very call is blanked.

alter function public.seed_defaults() rename to _seed_example_plan;

create function public.seed_defaults()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  result jsonb;
begin
  result := public._seed_example_plan();
  if (result ->> 'profile')::boolean then
    update profile
       set height_cm = null, start_weight_kg = null, goal_weight_kg = null
     where user_id = auth.uid() and onboarded_at is null;
  end if;
  return result;
end;
$$;

revoke all on function public.seed_defaults() from public, anon;
grant execute on function public.seed_defaults() to authenticated;
revoke all on function public._seed_example_plan() from public, anon;
