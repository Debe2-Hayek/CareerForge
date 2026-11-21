-- Owner-only learning roadmap enrolment and progress.
-- Course/topic/project ids reference versioned curriculum stored in the
-- application (src/data/learning). Rows are keyed by stable ids, so progress
-- survives curriculum revisions; ids removed from a later version are simply
-- not displayed. content_version records which curriculum version a row was
-- written against.
create table public.learning_enrollments (
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null check (course_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(course_id) <= 60),
 goal_id text not null check (goal_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(goal_id) <= 60),
 experience_level text not null check (experience_level in ('new', 'some', 'experienced')),
 weekly_hours smallint not null check (weekly_hours between 1 and 40),
 resource_format text not null check (resource_format in ('mixed', 'reading', 'video', 'interactive')),
 content_version integer not null check (content_version between 1 and 10000),
 started_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 last_active_at timestamptz not null default clock_timestamp(),
 primary key (user_id, course_id)
);
create index learning_enrollments_recent on public.learning_enrollments(user_id, last_active_at desc);

create table public.learning_progress (
 user_id uuid not null,
 course_id text not null,
 item_kind text not null check (item_kind in ('topic', 'project')),
 item_id text not null check (item_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(item_id) <= 60),
 state text not null,
 evidence_url text check (evidence_url is null or (char_length(evidence_url) <= 300 and evidence_url ~ '^https://[^\s]+$')),
 content_version integer not null check (content_version between 1 and 10000),
 updated_at timestamptz not null default clock_timestamp(),
 completed_at timestamptz,
 -- One row per owner, course and item: repeated saves update instead of duplicating.
 primary key (user_id, course_id, item_kind, item_id),
 foreign key (user_id, course_id) references public.learning_enrollments(user_id, course_id) on delete cascade,
 constraint learning_progress_state_valid check (
  (item_kind = 'topic' and state in ('in_progress', 'completed', 'known') and evidence_url is null) or
  (item_kind = 'project' and state in ('building', 'completed'))
 ),
 constraint learning_progress_completion_time check ((state in ('completed', 'known')) = (completed_at is not null))
);

-- Server-maintained timestamps: clients cannot backdate enrolment, activity or completion.
create or replace function public.careerforge_learning_enrollment_touch() returns trigger
language plpgsql set search_path = '' as $$
begin
 if tg_op = 'INSERT' then
  new.started_at := clock_timestamp();
  new.updated_at := clock_timestamp();
  new.last_active_at := clock_timestamp();
 else
  new.started_at := old.started_at;
  if (new.goal_id, new.experience_level, new.weekly_hours, new.resource_format, new.content_version)
     is distinct from (old.goal_id, old.experience_level, old.weekly_hours, old.resource_format, old.content_version) then
   new.updated_at := clock_timestamp();
   new.last_active_at := clock_timestamp();
  else
   -- Only the progress trigger below may advance activity without a settings change.
   new.updated_at := old.updated_at;
  end if;
 end if;
 return new;
end $$;

-- Security definer only so a progress save can advance its own enrolment's
-- activity time (clients have no grant on last_active_at). It touches exactly
-- the row identified by the progress row being written, whose owner RLS checks.
create or replace function public.careerforge_learning_progress_touch() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 new.updated_at := clock_timestamp();
 if new.state in ('completed', 'known') then
  new.completed_at := case when tg_op = 'UPDATE' and old.state = new.state then old.completed_at else clock_timestamp() end;
 else
  new.completed_at := null;
 end if;
 if new.user_id = (select auth.uid()) then
  update public.learning_enrollments set last_active_at = clock_timestamp()
   where user_id = new.user_id and course_id = new.course_id;
 end if;
 return new;
end $$;
revoke all on function public.careerforge_learning_enrollment_touch() from public, anon, authenticated;
revoke all on function public.careerforge_learning_progress_touch() from public, anon, authenticated;

create trigger learning_enrollments_touch before insert or update on public.learning_enrollments
 for each row execute function public.careerforge_learning_enrollment_touch();
create trigger learning_progress_touch before insert or update on public.learning_progress
 for each row execute function public.careerforge_learning_progress_touch();

alter table public.learning_enrollments enable row level security;
alter table public.learning_progress enable row level security;
revoke all on public.learning_enrollments, public.learning_progress from public, anon, authenticated;

grant select, delete on public.learning_enrollments, public.learning_progress to authenticated;
grant insert (user_id, course_id, goal_id, experience_level, weekly_hours, resource_format, content_version) on public.learning_enrollments to authenticated;
grant update (goal_id, experience_level, weekly_hours, resource_format, content_version) on public.learning_enrollments to authenticated;
grant insert (user_id, course_id, item_kind, item_id, state, evidence_url, content_version) on public.learning_progress to authenticated;
grant update (state, evidence_url, content_version) on public.learning_progress to authenticated;

create policy learning_enrollments_owner_select on public.learning_enrollments for select to authenticated using ((select auth.uid()) = user_id);
create policy learning_enrollments_owner_insert on public.learning_enrollments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy learning_enrollments_owner_update on public.learning_enrollments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy learning_enrollments_owner_delete on public.learning_enrollments for delete to authenticated using ((select auth.uid()) = user_id);
create policy learning_progress_owner_select on public.learning_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy learning_progress_owner_insert on public.learning_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy learning_progress_owner_update on public.learning_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy learning_progress_owner_delete on public.learning_progress for delete to authenticated using ((select auth.uid()) = user_id);
