-- Workshops a learner adds. Private to their owner until the owner suggests one;
-- a suggestion becomes visible to others only after an operator approves it, and
-- then without any information about who suggested it.
create table public.workshop_suggestions (
 user_id uuid not null references auth.users(id) on delete cascade,
 workshop_id text not null check (workshop_id ~ '^local-[0-9a-f]{16}$'),
 -- Validated again by the application every time it is read.
 record jsonb not null check (jsonb_typeof(record) = 'object' and octet_length(record::text) <= 4000),
 status text not null default 'private' check (status in ('private', 'pending', 'approved', 'rejected')),
 review_note text check (review_note is null or char_length(review_note) <= 300),
 created_at timestamptz not null default clock_timestamp(),
 reviewed_at timestamptz,
 primary key (user_id, workshop_id),
 constraint workshop_suggestions_review_time check ((status in ('approved', 'rejected')) = (reviewed_at is not null))
);
create index workshop_suggestions_status on public.workshop_suggestions(status, created_at);

-- Learners may only add privately, suggest and withdraw. Only an administrative
-- connection can approve or reject.
create or replace function public.careerforge_workshop_suggestion_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 if current_user in ('authenticated', 'anon') then
  if tg_op = 'INSERT' then
   new.created_at := clock_timestamp();
   if new.status not in ('private', 'pending') then
    raise exception 'Review is required' using errcode = '42501';
   end if;
   if (select count(*) from public.workshop_suggestions where user_id = new.user_id) >= 50 then
    raise exception 'Too many workshops' using errcode = '23514';
   end if;
  elsif new.status not in ('private', 'pending') or old.status not in ('private', 'pending') then
   raise exception 'Review is required' using errcode = '42501';
  end if;
 elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
  new.reviewed_at := case when new.status in ('approved', 'rejected') then clock_timestamp() else null end;
 end if;
 return new;
end $$;
revoke all on function public.careerforge_workshop_suggestion_guard() from public, anon, authenticated;
create trigger workshop_suggestions_guard before insert or update on public.workshop_suggestions
 for each row execute function public.careerforge_workshop_suggestion_guard();

alter table public.workshop_suggestions enable row level security;
revoke all on public.workshop_suggestions from public, anon, authenticated;
grant select, delete on public.workshop_suggestions to authenticated;
grant insert (user_id, workshop_id, record, status) on public.workshop_suggestions to authenticated;
grant update (status) on public.workshop_suggestions to authenticated;

create policy workshop_suggestions_owner_select on public.workshop_suggestions for select to authenticated using ((select auth.uid()) = user_id);
create policy workshop_suggestions_owner_insert on public.workshop_suggestions for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workshop_suggestions_owner_update on public.workshop_suggestions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy workshop_suggestions_owner_delete on public.workshop_suggestions for delete to authenticated using ((select auth.uid()) = user_id);

-- Approved workshops for signed-in learners: content only, never the suggester.
create or replace function public.careerforge_approved_workshops()
returns table (workshop_id text, record jsonb, reviewed_on date)
language sql stable security definer set search_path = '' as $$
 select s.workshop_id, s.record, s.reviewed_at::date
 from public.workshop_suggestions s
 where s.status = 'approved'
 order by s.reviewed_at desc
 limit 200
$$;
revoke all on function public.careerforge_approved_workshops() from public, anon;
grant execute on function public.careerforge_approved_workshops() to authenticated;
