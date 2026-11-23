-- Career assistant (report M9): profile-aware answers from context the user chooses to share.
-- A ninth AI feature (20 messages per user per day); reserve_ai_run keeps every earlier limit.
alter table public.ai_runs drop constraint ai_runs_feature_check;
alter table public.ai_runs add constraint ai_runs_feature_check
 check (feature in ('profile_autofill', 'document_generate', 'evidence_check', 'skill_bank_draft', 'cv_analysis', 'career_analysis', 'interview_questions', 'interview_review', 'assistant_chat'));

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
  when 'interview_review' then (case when public.careerforge_is_admin() then 40 end)
  when 'assistant_chat' then 20 end;
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
