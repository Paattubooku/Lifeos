-- F17: today's top 3 is per day; at most 3 open top-3 tasks (AC1).
alter table public.task add column top3_date date;
comment on column public.task.top3_date is 'Logical day the task was in the top 3 (PRD F17); unfinished ones are suggested the next day.';
alter table public.task
  add constraint task_top3_has_date check (not is_top3 or top3_date is not null);

create or replace function public.task_top3_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_top3 and new.status = 'open' and new.deleted_at is null then
    -- client_id, not id: an upsert's insert attempt carries a fresh id.
    if (
      select count(*) from public.task t
      where t.user_id = new.user_id
        and t.client_id <> new.client_id
        and t.is_top3 and t.status = 'open' and t.deleted_at is null
        and t.top3_date = new.top3_date
    ) >= 3 then
      raise exception 'Top 3 is full for %', new.top3_date using errcode = 'check_violation';
    end if;
  end if;
  return new;
end
$$;

create trigger task_top3_limit
  before insert or update on public.task
  for each row execute function public.task_top3_limit();
