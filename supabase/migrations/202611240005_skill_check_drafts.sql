-- AI-drafted, admin-approved skill checks (requirement R1: "questions that are well
-- prepared and a time limit"). The AI only drafts; an admin edits and publishes. Published
-- questions join the existing server-graded, server-timed checks. Answer keys and
-- explanations never reach students.

-- 1. A fourth AI feature: drafting questions (admins only).
alter table public.ai_runs drop constraint ai_runs_feature_check;
alter table public.ai_runs add constraint ai_runs_feature_check
 check (feature in ('profile_autofill', 'document_generate', 'evidence_check', 'skill_bank_draft'));

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
  when 'skill_bank_draft' then (case when public.careerforge_is_admin() then 20 end) end;
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

-- 2. Keep every published version (attempts and live sessions refer to theirs); only the
-- latest version of a skill is offered and can be started.
alter table careerforge_internal.skill_check_banks drop constraint skill_check_banks_pkey;
alter table careerforge_internal.skill_check_banks add primary key (skill, version);
alter table careerforge_internal.skill_check_banks add column published_at timestamptz not null default clock_timestamp();
alter table careerforge_internal.skill_check_banks add column source text not null default 'original' check (source in ('original', 'ai_reviewed'));

create or replace function public.skill_check_catalog() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise insufficient_privilege; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('skill', b.skill, 'version', b.version,
   'questions', (select jsonb_agg(q - 'answer') from jsonb_array_elements(b.questions) q)) order by lower(b.skill))
  from (select distinct on (lower(skill)) * from careerforge_internal.skill_check_banks order by lower(skill), version desc) b), '[]'::jsonb);
end $$;

create or replace function public.start_skill_check(p_skill text, p_version integer, p_timing_mode text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid := auth.uid(); session_row public.skill_check_sessions;
  checked_at timestamptz; latest timestamptz;
begin
  if owner_id is null then raise insufficient_privilege; end if;
  if p_timing_mode is null or p_timing_mode not in ('standard', 'extended')
    or p_version is distinct from (select max(version) from careerforge_internal.skill_check_banks where skill = p_skill)
    then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.profiles p, unnest(p.self_reported_skills) selected_skill
    where p.id = owner_id and lower(btrim(selected_skill)) = lower(btrim(p_skill))
  ) then return jsonb_build_object('skillNotSelected', true); end if;

  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 76211));
  checked_at := clock_timestamp();
  update public.skill_check_sessions set state = 'expired', finished_at = checked_at
    where user_id = owner_id and state = 'active' and deadline_at <= checked_at;
  select * into session_row from public.skill_check_sessions where user_id = owner_id and state = 'active' for update;
  if found then
    if session_row.skill = p_skill and session_row.version = p_version then
      return jsonb_build_object('session', careerforge_internal.skill_check_session_payload(session_row, checked_at));
    end if;
    return jsonb_build_object('conflict', true, 'session', careerforge_internal.skill_check_session_payload(session_row, checked_at));
  end if;

  select max(event_time) into latest from (
    select started_at as event_time from public.skill_check_sessions where user_id = owner_id
    union all
    select taken_at as event_time from public.skill_check_attempts where user_id = owner_id
  ) events;
  if latest > checked_at - interval '60 seconds' then
    return jsonb_build_object('rateLimited', true, 'retryAfter', greatest(1, ceil(extract(epoch from latest + interval '60 seconds' - checked_at))::integer));
  end if;
  insert into public.skill_check_sessions(user_id, skill, version, timing_mode, started_at, deadline_at)
    values(owner_id, p_skill, p_version, p_timing_mode, checked_at,
      checked_at + case p_timing_mode when 'standard' then interval '600 seconds' else interval '6000 seconds' end)
    returning * into session_row;
  return jsonb_build_object('session', careerforge_internal.skill_check_session_payload(session_row, checked_at));
end $$;

-- 3. Drafts: admins only, answers and explanations included.
create table public.skill_check_drafts (
 id uuid primary key default gen_random_uuid(),
 skill text not null check (char_length(btrim(skill)) between 1 and 60),
 focus text not null default '' check (char_length(focus) <= 200),
 questions jsonb not null check (jsonb_typeof(questions) = 'array' and octet_length(questions::text) <= 20000),
 status text not null default 'draft' check (status in ('draft', 'published', 'discarded')),
 model text check (model is null or model ~ '^[A-Za-z0-9._:/~-]{1,100}$'),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 published_by uuid references auth.users(id) on delete set null,
 published_at timestamptz,
 published_version integer
);
create index skill_check_drafts_recent_idx on public.skill_check_drafts (status, updated_at desc);
alter table public.skill_check_drafts enable row level security;
revoke all on public.skill_check_drafts from public, anon, authenticated;
grant select on public.skill_check_drafts to authenticated;
create policy skill_check_drafts_admin_select on public.skill_check_drafts for select to authenticated using ((select public.careerforge_is_admin()));

-- Structural rules for a publishable set: 5 questions, 3 distinct options, one answer.
create or replace function careerforge_internal.valid_skill_questions(p_questions jsonb) returns boolean
language sql immutable set search_path = '' as $$
 select jsonb_typeof(p_questions) = 'array' and jsonb_array_length(p_questions) = 5 and not exists (
  select 1 from jsonb_array_elements(p_questions) e where
   jsonb_typeof(e) <> 'object'
   or jsonb_typeof(e->'prompt') is distinct from 'string' or char_length(btrim(e->>'prompt')) not between 10 and 300
   or jsonb_typeof(e->'options') is distinct from 'array' or jsonb_array_length(e->'options') <> 3
   or jsonb_typeof(e->'answer') is distinct from 'number' or (e->>'answer') !~ '^[0-2]$'
   or exists (select 1 from jsonb_array_elements(e->'options') o where jsonb_typeof(o) <> 'string' or char_length(btrim(o #>> '{}')) not between 1 and 160)
   or (select count(distinct lower(btrim(o))) from jsonb_array_elements_text(e->'options') o) <> 3)
$$;

create or replace function public.save_skill_check_draft(p_id uuid, p_skill text, p_focus text, p_questions jsonb, p_model text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare draft_id uuid;
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if jsonb_typeof(p_questions) is distinct from 'array' or jsonb_array_length(p_questions) > 10 then raise exception 'Invalid questions' using errcode = '22023'; end if;
 if p_id is null then
  insert into public.skill_check_drafts (skill, focus, questions, model, created_by)
  values (btrim(p_skill), coalesce(btrim(p_focus), ''), p_questions, p_model, auth.uid()) returning id into draft_id;
 else
  update public.skill_check_drafts set questions = p_questions, updated_at = clock_timestamp()
  where id = p_id and status = 'draft' returning id into draft_id;
  if draft_id is null then raise exception 'Draft not found' using errcode = 'P0002'; end if;
 end if;
 return draft_id;
end $$;

create or replace function public.publish_skill_check_draft(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 draft public.skill_check_drafts;
 next_version integer;
 bank_skill text;
 published jsonb;
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 select * into draft from public.skill_check_drafts where id = p_id and status = 'draft' for update;
 if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
 if not careerforge_internal.valid_skill_questions(draft.questions) then raise exception 'Questions are not complete' using errcode = '23514'; end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.skill_banks', 0));
 -- Keep the spelling of an existing skill so profile matching and old results stay aligned.
 select skill into bank_skill from careerforge_internal.skill_check_banks where lower(skill) = lower(draft.skill) order by version desc limit 1;
 bank_skill := coalesce(bank_skill, draft.skill);
 select coalesce(max(version), 0) + 1 into next_version from careerforge_internal.skill_check_banks where skill = bank_skill;
 -- Only id, prompt, options and answer are published: explanations stay in the draft.
 select jsonb_agg(jsonb_build_object('id', 'q' || n, 'prompt', btrim(e->>'prompt'), 'options',
   (select jsonb_agg(btrim(o)) from jsonb_array_elements_text(e->'options') o), 'answer', (e->>'answer')::integer) order by n)
  into published from jsonb_array_elements(draft.questions) with ordinality as t(e, n);
 insert into careerforge_internal.skill_check_banks (skill, version, questions, source) values (bank_skill, next_version, published, 'ai_reviewed');
 update public.skill_check_drafts set status = 'published', published_by = auth.uid(), published_at = clock_timestamp(),
  published_version = next_version, updated_at = clock_timestamp() where id = draft.id;
 return jsonb_build_object('skill', bank_skill, 'version', next_version);
end $$;

create or replace function public.discard_skill_check_draft(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 update public.skill_check_drafts set status = 'discarded', updated_at = clock_timestamp() where id = p_id and status = 'draft';
 if not found then raise exception 'Draft not found' using errcode = 'P0002'; end if;
end $$;

-- Admin overview of what is live (no answers).
create or replace function public.skill_check_bank_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('skill', b.skill, 'version', b.version, 'source', b.source, 'publishedAt', b.published_at,
   'attempts', (select count(*) from public.skill_check_attempts a where a.skill = b.skill and a.version = b.version),
   'passes', (select count(*) from public.skill_check_attempts a where a.skill = b.skill and a.version = b.version and a.passed)) order by lower(b.skill))
  from (select distinct on (lower(skill)) * from careerforge_internal.skill_check_banks order by lower(skill), version desc) b), '[]'::jsonb);
end $$;

revoke all on function careerforge_internal.valid_skill_questions(jsonb) from public, anon, authenticated;
revoke all on function public.save_skill_check_draft(uuid, text, text, jsonb, text) from public, anon;
grant execute on function public.save_skill_check_draft(uuid, text, text, jsonb, text) to authenticated;
revoke all on function public.publish_skill_check_draft(uuid) from public, anon;
grant execute on function public.publish_skill_check_draft(uuid) to authenticated;
revoke all on function public.discard_skill_check_draft(uuid) from public, anon;
grant execute on function public.discard_skill_check_draft(uuid) to authenticated;
revoke all on function public.skill_check_bank_overview() from public, anon;
grant execute on function public.skill_check_bank_overview() to authenticated;
