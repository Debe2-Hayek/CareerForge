-- Project interviews (requirement R1: catch fakers). The owner proves control of a public
-- GitHub repository with a one-time code; the AI asks questions that cite exact lines of
-- that code (the quoted lines are copied by code, not by the AI); the database clock limits
-- the interview to 20 minutes; an admin reviews with an AI-suggested score and decides.
-- Two more AI features; reserve_ai_run keeps every earlier limit.
alter table public.ai_runs drop constraint ai_runs_feature_check;
alter table public.ai_runs add constraint ai_runs_feature_check
 check (feature in ('profile_autofill', 'document_generate', 'evidence_check', 'skill_bank_draft', 'cv_analysis', 'career_analysis', 'interview_questions', 'interview_review'));

create or replace function public.reserve_ai_run(p_feature text, p_input_hash text, p_prompt_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 user_limit integer;
 global_limit constant integer := 150;
 used integer;
 global_used integer;
 oldest timestamptz;
 cached jsonb;
 run_id uuid;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 user_limit := case p_feature when 'profile_autofill' then 5 when 'document_generate' then 5
  when 'evidence_check' then (case when public.careerforge_is_admin() then 60 end)
  when 'skill_bank_draft' then (case when public.careerforge_is_admin() then 20 end)
  when 'cv_analysis' then 5
  when 'career_analysis' then 5
  when 'interview_questions' then 3
  when 'interview_review' then (case when public.careerforge_is_admin() then 40 end) end;
 if user_limit is null or p_input_hash !~ '^[0-9a-f]{64}$' or p_prompt_version !~ '^[a-z0-9._-]{1,40}$' then
  raise exception 'Invalid AI run' using errcode = '22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.ai_runs:' || uid::text, 0));
 delete from public.ai_runs where user_id = uid and created_at < clock_timestamp() - interval '30 days';
 select r.output into cached from public.ai_runs r
  where r.user_id = uid and r.feature = p_feature and r.input_hash = p_input_hash
   and r.prompt_version = p_prompt_version and r.status = 'complete'
  order by r.created_at desc limit 1;
 if cached is not null then return jsonb_build_object('status', 'cached', 'output', cached); end if;
 select count(*), min(r.created_at) into used, oldest from public.ai_runs r
  where r.user_id = uid and r.feature = p_feature and r.created_at > clock_timestamp() - interval '24 hours';
 if used >= user_limit then
  return jsonb_build_object('status', 'limited', 'retryAfter',
   greatest(60, ceil(extract(epoch from (oldest + interval '24 hours' - clock_timestamp())))::integer));
 end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.ai_runs:global', 0));
 select count(*) into global_used from public.ai_runs r where r.created_at > clock_timestamp() - interval '24 hours';
 if global_used >= global_limit then return jsonb_build_object('status', 'busy'); end if;
 insert into public.ai_runs (user_id, feature, input_hash, prompt_version)
  values (uid, p_feature, p_input_hash, p_prompt_version) returning id into run_id;
 return jsonb_build_object('status', 'reserved', 'runId', run_id, 'remaining', user_limit - used - 1);
end $$;

create table public.project_interviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 repo_owner text not null check (repo_owner ~ '^[A-Za-z0-9][A-Za-z0-9-]{0,38}$'),
 repo_name text not null check (repo_name ~ '^[A-Za-z0-9._-]{1,100}$'),
 ownership_code text not null default ('careerforge-' || substr(md5(gen_random_uuid()::text), 1, 12)),
 commit_sha text check (commit_sha is null or commit_sha ~ '^[0-9a-f]{40}$'),
 questions jsonb check (questions is null or (jsonb_typeof(questions) = 'array' and octet_length(questions::text) <= 24000)),
 status text not null default 'draft' check (status in ('draft', 'ready', 'in_progress', 'submitted', 'approved', 'rejected', 'expired')),
 started_at timestamptz,
 deadline_at timestamptz,
 submitted_at timestamptz,
 answers jsonb check (answers is null or (jsonb_typeof(answers) = 'object' and octet_length(answers::text) <= 16000)),
 ai_review jsonb check (ai_review is null or octet_length(ai_review::text) <= 24000),
 ai_reviewed_at timestamptz,
 decision_note text check (decision_note is null or char_length(decision_note) <= 500),
 decided_by uuid references auth.users(id) on delete set null,
 decided_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 constraint project_interviews_timing check ((started_at is null) = (deadline_at is null) and (deadline_at is null or deadline_at = started_at + interval '20 minutes'))
);
create index project_interviews_owner_idx on public.project_interviews (user_id, created_at desc);
create index project_interviews_queue_idx on public.project_interviews (submitted_at) where status = 'submitted';
alter table public.project_interviews enable row level security;
revoke all on public.project_interviews from public, anon, authenticated;
-- Owners see everything except the AI's suggested scores; every write goes through the functions below.
grant select (id, user_id, repo_owner, repo_name, ownership_code, commit_sha, questions, status, started_at, deadline_at, submitted_at, answers, decision_note, decided_at, created_at)
 on public.project_interviews to authenticated;
create policy project_interviews_owner_select on public.project_interviews for select to authenticated using ((select auth.uid()) = user_id);

-- Owner: a new interview for one public repository (at most 3 open at a time).
create or replace function public.create_project_interview(p_owner text, p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); interview_id uuid;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.interviews:' || uid::text, 0));
 if (select count(*) from public.project_interviews where user_id = uid and status in ('draft', 'ready', 'in_progress', 'submitted')) >= 3 then
  raise exception 'Too many open interviews' using errcode = '23514';
 end if;
 insert into public.project_interviews (user_id, repo_owner, repo_name) values (uid, p_owner, p_name) returning id into interview_id;
 return interview_id;
end $$;

-- Owner (through the server): store the checked commit and the prepared questions.
create or replace function public.prepare_project_interview(p_id uuid, p_commit text, p_questions jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) not between 3 and 5 then raise exception 'Invalid questions' using errcode = '22023'; end if;
 update public.project_interviews set commit_sha = p_commit, questions = p_questions, status = 'ready'
 where id = p_id and user_id = auth.uid() and status in ('draft', 'ready');
 if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
end $$;

-- Owner: start the 20-minute clock (the database's clock, not the browser's).
create or replace function public.start_project_interview(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item public.project_interviews;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 update public.project_interviews set status = 'in_progress', started_at = clock_timestamp(), deadline_at = clock_timestamp() + interval '20 minutes'
 where id = p_id and user_id = auth.uid() and status = 'ready' returning * into item;
 if not found then raise exception 'Interview not ready' using errcode = '23514'; end if;
 return jsonb_build_object('startedAt', item.started_at, 'deadlineAt', item.deadline_at, 'serverNow', clock_timestamp());
end $$;

-- Owner: submit answers before the deadline; after it the interview expires.
create or replace function public.submit_project_interview(p_id uuid, p_answers jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare item public.project_interviews;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 select * into item from public.project_interviews where id = p_id and user_id = auth.uid() for update;
 if not found or item.status <> 'in_progress' then raise exception 'Interview not in progress' using errcode = '23514'; end if;
 if clock_timestamp() > item.deadline_at then
  update public.project_interviews set status = 'expired' where id = p_id;
  return 'expired';
 end if;
 if jsonb_typeof(p_answers) is distinct from 'object' then raise exception 'Invalid answers' using errcode = '22023'; end if;
 update public.project_interviews set status = 'submitted', answers = p_answers, submitted_at = clock_timestamp() where id = p_id;
 return 'submitted';
end $$;

-- Admin: the queue, including what owners cannot see.
create or replace function public.project_interview_queue() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
   'id', i.id, 'ownerName', coalesce(nullif(p.full_name, ''), 'Unnamed user'), 'own', i.user_id = (select auth.uid()),
   'repoOwner', i.repo_owner, 'repoName', i.repo_name, 'ownershipCode', i.ownership_code, 'commitSha', i.commit_sha,
   'questions', i.questions, 'answers', i.answers, 'startedAt', i.started_at, 'submittedAt', i.submitted_at,
   'aiReview', i.ai_review, 'aiReviewedAt', i.ai_reviewed_at) order by i.submitted_at)
  from public.project_interviews i left join public.profiles p on p.id = i.user_id where i.status = 'submitted'), '[]'::jsonb);
end $$;

create or replace function public.record_interview_review(p_id uuid, p_review jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 update public.project_interviews set ai_review = p_review, ai_reviewed_at = clock_timestamp() where id = p_id and status = 'submitted';
 if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
end $$;

create or replace function public.decide_project_interview(p_id uuid, p_decision text, p_note text) returns text
language plpgsql security definer set search_path = '' as $$
declare item public.project_interviews; note text := nullif(btrim(coalesce(p_note, '')), '');
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 if p_decision = 'reject' and note is null then raise exception 'A reason is required' using errcode = '22023'; end if;
 select * into item from public.project_interviews where id = p_id for update;
 if not found then raise exception 'Interview not found' using errcode = 'P0002'; end if;
 if item.user_id = auth.uid() then raise exception 'Reviewers cannot review their own claims' using errcode = '42501'; end if;
 if item.status <> 'submitted' then raise exception 'Not awaiting review' using errcode = '23514'; end if;
 update public.project_interviews set status = case when p_decision = 'approve' then 'approved' else 'rejected' end,
  decision_note = note, decided_by = auth.uid(), decided_at = clock_timestamp() where id = p_id;
 return case when p_decision = 'approve' then 'approved' else 'rejected' end;
end $$;

revoke all on function public.create_project_interview(text, text) from public, anon;
grant execute on function public.create_project_interview(text, text) to authenticated;
revoke all on function public.prepare_project_interview(uuid, text, jsonb) from public, anon;
grant execute on function public.prepare_project_interview(uuid, text, jsonb) to authenticated;
revoke all on function public.start_project_interview(uuid) from public, anon;
grant execute on function public.start_project_interview(uuid) to authenticated;
revoke all on function public.submit_project_interview(uuid, jsonb) from public, anon;
grant execute on function public.submit_project_interview(uuid, jsonb) to authenticated;
revoke all on function public.project_interview_queue() from public, anon;
grant execute on function public.project_interview_queue() to authenticated;
revoke all on function public.record_interview_review(uuid, jsonb) from public, anon;
grant execute on function public.record_interview_review(uuid, jsonb) to authenticated;
revoke all on function public.decide_project_interview(uuid, text, text) from public, anon;
grant execute on function public.decide_project_interview(uuid, text, text) to authenticated;
