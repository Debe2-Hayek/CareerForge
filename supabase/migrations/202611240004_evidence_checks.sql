-- AI proof check (requirement R1, part 2). An admin asks the AI to read one proof file;
-- plain code compares what it read with the claim. Results are written only by admins
-- (owners cannot plant a favourable result), and they are hints: the reviewer decides.

-- 1. A third AI feature in the usage ledger, with its own daily limit.
alter table public.ai_runs drop constraint ai_runs_feature_check;
alter table public.ai_runs add constraint ai_runs_feature_check check (feature in ('profile_autofill', 'document_generate', 'evidence_check'));

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
  when 'evidence_check' then (case when public.careerforge_is_admin() then 60 end) end;
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

-- 2. One AI check per proof file.
create table public.evidence_checks (
 evidence_id uuid primary key references public.claim_evidence(id) on delete cascade,
 status text not null check (status in ('consistent', 'attention', 'unreadable')),
 model text check (model is null or model ~ '^[A-Za-z0-9._:/~-]{1,100}$'),
 prompt_version text not null check (prompt_version ~ '^[a-z0-9._-]{1,40}$'),
 extracted jsonb not null check (octet_length(extracted::text) <= 16384),
 findings jsonb not null check (octet_length(findings::text) <= 16384),
 checked_by uuid references auth.users(id) on delete set null,
 checked_at timestamptz not null default clock_timestamp()
);
alter table public.evidence_checks enable row level security;
revoke all on public.evidence_checks from public, anon, authenticated;
grant select on public.evidence_checks to authenticated;
create policy evidence_checks_owner_or_admin_select on public.evidence_checks for select to authenticated
 using ((select public.careerforge_is_admin()) or exists (select 1 from public.claim_evidence e where e.id = evidence_id and e.user_id = (select auth.uid())));

create or replace function public.record_evidence_check(p_evidence_id uuid, p_status text, p_model text, p_prompt_version text, p_extracted jsonb, p_findings jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if not exists (select 1 from public.claim_evidence e where e.id = p_evidence_id) then raise exception 'Evidence not found' using errcode = 'P0002'; end if;
 insert into public.evidence_checks (evidence_id, status, model, prompt_version, extracted, findings, checked_by)
 values (p_evidence_id, p_status, p_model, p_prompt_version, p_extracted, p_findings, auth.uid())
 on conflict (evidence_id) do update set status = excluded.status, model = excluded.model, prompt_version = excluded.prompt_version,
  extracted = excluded.extracted, findings = excluded.findings, checked_by = excluded.checked_by, checked_at = clock_timestamp();
end $$;
revoke all on function public.record_evidence_check(uuid, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.record_evidence_check(uuid, text, text, text, jsonb, jsonb) to authenticated;

-- 3. The queue now carries what the comparison needs: the record's fields and each
-- file's id, fingerprint and latest AI check.
create or replace function public.claim_review_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 return coalesce((
  select jsonb_agg(item order by (item->>'updatedAt')) from (
   select jsonb_build_object(
    'id', c.id, 'kind', c.kind, 'subject', c.subject, 'updatedAt', c.updated_at,
    'ownerName', coalesce(nullif(p.full_name, ''), 'Unnamed user'), 'own', c.user_id = (select auth.uid()),
    'record', case
      when c.kind = 'degree' then (select jsonb_build_object('institution', r.institution, 'title', r.degree, 'startDate', r.start_date, 'endDate', r.end_date, 'isCurrent', r.is_current) from public.education_records r where r.id = c.education_id)
      when c.kind = 'employment' then (select jsonb_build_object('institution', r.company, 'title', r.role, 'startDate', r.start_date, 'endDate', r.end_date, 'isCurrent', r.is_current) from public.experience_records r where r.id = c.experience_id)
      else jsonb_build_object('institution', null, 'title', c.skill, 'startDate', null, 'endDate', null, 'isCurrent', false) end,
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'path', e.storage_path, 'fileName', e.file_name, 'mime', e.mime, 'size', e.size_bytes, 'uploadedAt', e.created_at, 'sha256', e.sha256,
      'duplicateOwners', (select count(distinct d.user_id) from public.claim_evidence d where d.sha256 = e.sha256 and d.user_id <> c.user_id),
      'check', (select jsonb_build_object('status', k.status, 'model', k.model, 'extracted', k.extracted, 'findings', k.findings, 'checkedAt', k.checked_at)
                from public.evidence_checks k where k.evidence_id = e.id))
      order by e.created_at desc) from public.claim_evidence e where e.claim_id = c.id), '[]'::jsonb)
   ) as item
   from public.claims c left join public.profiles p on p.id = c.user_id
   where c.status = 'evidence_submitted'
   order by c.updated_at limit 100
  ) queue
 ), '[]'::jsonb);
end $$;
