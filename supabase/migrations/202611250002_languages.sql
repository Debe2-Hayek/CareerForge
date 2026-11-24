-- Language proficiency (requirement R1): a profile states each language with a CEFR level
-- (A1 to C2, or native) and, optionally, the external test behind it (IELTS, TOEFL, DELF...)
-- with its score and date. The level is a claim like any other: proof (the score report or
-- its verification link) goes to a reviewer, who sees the level the score converts to
-- (computed by the application). Editing a language after sending proof makes the review
-- no longer apply, exactly like education and experience records.

create table public.profile_languages (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 language text not null check (char_length(btrim(language)) between 2 and 40 and language ~ '^[[:alpha:]][[:alpha:] ()''.-]*$'),
 level text not null check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'native')),
 test text check (test is null or test in ('ielts', 'toefl', 'det', 'cambridge', 'delf_dalf', 'tcf', 'goethe', 'other')),
 score text check (score is null or (char_length(score) between 1 and 20 and score ~ '^[A-Za-z0-9 .,/+-]+$')),
 test_date date check (test_date is null or test_date >= date '1980-01-01'),
 revision uuid not null default gen_random_uuid(),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check ((test is null) = (score is null))
);
create unique index profile_languages_name_key on public.profile_languages (user_id, lower(btrim(language)));
alter table public.profile_languages enable row level security;
revoke all on public.profile_languages from public, anon, authenticated;
-- Read-only for clients; writes go through the functions below.
grant select on public.profile_languages to authenticated;
create policy profile_languages_owner_or_admin_select on public.profile_languages for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_is_admin()));

-- Owner: add (p_id null) or update one language. At most 10. A new revision on every change.
create or replace function public.save_profile_language(p_id uuid, p_language text, p_level text, p_test text, p_score text, p_test_date date)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 saved public.profile_languages;
 v_name text := btrim(coalesce(p_language, ''));
 v_test text := nullif(btrim(coalesce(p_test, '')), '');
 v_score text := nullif(btrim(coalesce(p_score, '')), '');
 v_date date := p_test_date;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if v_test is null then v_score := null; v_date := null; end if;
 if v_test is not null and v_score is null then raise exception 'A score is required' using errcode = '22023'; end if;
 if v_date is not null and v_date > current_date then raise exception 'Test date in the future' using errcode = '22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.languages:' || uid::text, 0));
 if p_id is null then
  if (select count(*) from public.profile_languages l where l.user_id = uid) >= 10 then raise exception 'LANGUAGE_LIMIT_REACHED'; end if;
  insert into public.profile_languages (user_id, language, level, test, score, test_date)
  values (uid, v_name, p_level, v_test, v_score, v_date) returning * into saved;
 else
  update public.profile_languages l set language = v_name, level = p_level, test = v_test, score = v_score,
   test_date = v_date, updated_at = clock_timestamp(),
   revision = case when (l.language, l.level, l.test, l.score, l.test_date) is not distinct from (v_name, p_level, v_test, v_score, v_date)
    then l.revision else gen_random_uuid() end
  where l.id = p_id and l.user_id = uid returning * into saved;
  if not found then raise exception 'Language not found' using errcode = 'P0002'; end if;
 end if;
 return to_jsonb(saved) - 'user_id';
exception when unique_violation then
 raise exception 'LANGUAGE_EXISTS' using errcode = '23505';
end $$;
revoke all on function public.save_profile_language(uuid, text, text, text, text, date) from public, anon;
grant execute on function public.save_profile_language(uuid, text, text, text, text, date) to authenticated;

create or replace function public.delete_profile_language(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 delete from public.profile_languages l where l.id = p_id and l.user_id = auth.uid();
 if not found then raise exception 'Language not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.delete_profile_language(uuid) from public, anon;
grant execute on function public.delete_profile_language(uuid) to authenticated;

-- Claims: a fourth kind.
alter table public.claims add column language_id uuid references public.profile_languages(id) on delete cascade;
create unique index claims_language_key on public.claims (language_id) where language_id is not null;
alter table public.claims drop constraint claims_kind_check;
alter table public.claims add constraint claims_kind_check check (kind in ('degree', 'employment', 'skill', 'language'));
alter table public.claims drop constraint claims_check;
alter table public.claims add constraint claims_check check (
 (kind = 'degree' and education_id is not null and experience_id is null and skill is null and language_id is null) or
 (kind = 'employment' and experience_id is not null and education_id is null and skill is null and language_id is null) or
 (kind = 'skill' and skill is not null and education_id is null and experience_id is null and language_id is null) or
 (kind = 'language' and language_id is not null and education_id is null and experience_id is null and skill is null)
);

-- Shared by the two owner functions: the claim subject and revision of one of the owner's facts.
create or replace function public.careerforge_claim_source(p_uid uuid, p_kind text, p_record_id uuid, p_skill text, out subj text, out rev uuid)
language plpgsql stable security definer set search_path = '' as $$
begin
 if p_kind = 'degree' then
  select r.degree || ' · ' || r.institution, r.revision into subj, rev from public.education_records r where r.id = p_record_id and r.user_id = p_uid;
 elsif p_kind = 'employment' then
  select r.role || ' · ' || r.company, r.revision into subj, rev from public.experience_records r where r.id = p_record_id and r.user_id = p_uid;
 elsif p_kind = 'skill' then
  select s into subj from public.profiles p, unnest(p.self_reported_skills) s where p.id = p_uid and lower(s) = lower(btrim(p_skill)) limit 1;
 elsif p_kind = 'language' then
  select r.language || ' · ' || case when r.level = 'native' then 'Native' else r.level end, r.revision into subj, rev
  from public.profile_languages r where r.id = p_record_id and r.user_id = p_uid;
 else
  raise exception 'Invalid claim kind' using errcode = '22023';
 end if;
end $$;
revoke all on function public.careerforge_claim_source(uuid, text, uuid, text) from public, anon, authenticated;

create or replace function public.submit_claim_evidence(p_kind text, p_record_id uuid, p_skill text,
 p_storage_path text, p_file_name text, p_mime text, p_size integer, p_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 src record;
 claim public.claims;
 files integer;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if p_storage_path is null or split_part(p_storage_path, '/', 1) <> uid::text then
  raise exception 'Invalid evidence path' using errcode = '22023';
 end if;
 if not exists (select 1 from storage.objects o where o.bucket_id = 'claim-evidence' and o.name = p_storage_path) then
  raise exception 'Evidence file missing' using errcode = '22023';
 end if;
 select * into src from public.careerforge_claim_source(uid, p_kind, p_record_id, p_skill);
 if src.subj is null then raise exception 'Claim source not found' using errcode = 'P0002'; end if;

 perform pg_advisory_xact_lock(hashtextextended('careerforge.claims:' || uid::text, 0));
 select * into claim from public.claims c where c.user_id = uid and (
  (p_kind = 'degree' and c.education_id = p_record_id) or
  (p_kind = 'employment' and c.experience_id = p_record_id) or
  (p_kind = 'language' and c.language_id = p_record_id) or
  (p_kind = 'skill' and lower(c.skill) = lower(src.subj)));
 if found then
  if claim.status = 'reviewed' and claim.source_revision is not distinct from src.rev then
   raise exception 'Already reviewed' using errcode = '23514';
  end if;
  select count(*) into files from public.claim_evidence e where e.claim_id = claim.id;
  if files >= 5 then raise exception 'Too many files' using errcode = '23514'; end if;
  update public.claims set status = 'evidence_submitted', subject = src.subj, source_revision = src.rev,
   status_note = null, decided_by = null, decided_at = null, updated_at = clock_timestamp()
  where id = claim.id returning * into claim;
 else
  insert into public.claims (user_id, kind, education_id, experience_id, language_id, skill, source_revision, subject)
  values (uid, p_kind,
   case when p_kind = 'degree' then p_record_id end,
   case when p_kind = 'employment' then p_record_id end,
   case when p_kind = 'language' then p_record_id end,
   case when p_kind = 'skill' then src.subj end, src.rev, src.subj)
  returning * into claim;
 end if;
 insert into public.claim_evidence (claim_id, user_id, storage_path, file_name, mime, size_bytes, sha256)
 values (claim.id, uid, p_storage_path, p_file_name, p_mime, p_size, p_sha256);
 insert into public.claim_events (claim_id, actor_id, actor, action) values (claim.id, uid, 'owner', 'evidence_added');
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;

create or replace function public.add_claim_link(p_kind text, p_record_id uuid, p_skill text, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 src record;
 claim public.claims;
 links integer;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if p_url is null or char_length(p_url) > 500 or p_url ~ '\s' or not (
  p_url ~ '^https://(www\.)?(coursera\.org|credly\.com|youracclaim\.com|linkedin\.com|freecodecamp\.org|udemy\.com|credential\.net|hackerrank\.com|datacamp\.com)/'
  or p_url ~ '^https://(learn\.microsoft\.com|ude\.my)/') then
  raise exception 'Unsupported link' using errcode = '22023';
 end if;
 select * into src from public.careerforge_claim_source(uid, p_kind, p_record_id, p_skill);
 if src.subj is null then raise exception 'Claim source not found' using errcode = 'P0002'; end if;

 perform pg_advisory_xact_lock(hashtextextended('careerforge.claims:' || uid::text, 0));
 select * into claim from public.claims c where c.user_id = uid and (
  (p_kind = 'degree' and c.education_id = p_record_id) or
  (p_kind = 'employment' and c.experience_id = p_record_id) or
  (p_kind = 'language' and c.language_id = p_record_id) or
  (p_kind = 'skill' and lower(c.skill) = lower(src.subj)));
 if found then
  if claim.status = 'reviewed' and claim.source_revision is not distinct from src.rev then
   raise exception 'Already reviewed' using errcode = '23514';
  end if;
  if exists (select 1 from public.claim_links l where l.claim_id = claim.id and l.url = p_url) then
   raise exception 'Link already added' using errcode = '23505';
  end if;
  select count(*) into links from public.claim_links l where l.claim_id = claim.id;
  if links >= 3 then raise exception 'Too many links' using errcode = '23514'; end if;
  update public.claims set status = 'evidence_submitted', subject = src.subj, source_revision = src.rev,
   status_note = null, decided_by = null, decided_at = null, updated_at = clock_timestamp()
  where id = claim.id returning * into claim;
 else
  insert into public.claims (user_id, kind, education_id, experience_id, language_id, skill, source_revision, subject)
  values (uid, p_kind,
   case when p_kind = 'degree' then p_record_id end,
   case when p_kind = 'employment' then p_record_id end,
   case when p_kind = 'language' then p_record_id end,
   case when p_kind = 'skill' then src.subj end, src.rev, src.subj)
  returning * into claim;
 end if;
 insert into public.claim_links (claim_id, user_id, url) values (claim.id, uid, p_url);
 insert into public.claim_events (claim_id, actor_id, actor, action) values (claim.id, uid, 'owner', 'link_added');
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;

-- Reviewers: a language edited after proof was sent cannot be approved for the old version.
create or replace function public.review_claim(p_claim_id uuid, p_decision text, p_note text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 claim public.claims;
 note text := nullif(btrim(coalesce(p_note, '')), '');
begin
 if uid is null or not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if p_decision not in ('approve', 'reject') then raise exception 'Invalid decision' using errcode = '22023'; end if;
 if p_decision = 'reject' and note is null then raise exception 'A reason is required' using errcode = '22023'; end if;
 if char_length(coalesce(note, '')) > 500 then raise exception 'Reason too long' using errcode = '22023'; end if;
 select * into claim from public.claims c where c.id = p_claim_id for update;
 if not found then raise exception 'Claim not found' using errcode = 'P0002'; end if;
 if claim.user_id = uid then raise exception 'Reviewers cannot review their own claims' using errcode = '42501'; end if;
 if claim.status <> 'evidence_submitted' then raise exception 'Claim is not awaiting review' using errcode = '23514'; end if;
 if (claim.kind = 'degree' and not exists (select 1 from public.education_records r where r.id = claim.education_id and r.revision = claim.source_revision))
  or (claim.kind = 'employment' and not exists (select 1 from public.experience_records r where r.id = claim.experience_id and r.revision = claim.source_revision))
  or (claim.kind = 'language' and not exists (select 1 from public.profile_languages r where r.id = claim.language_id and r.revision = claim.source_revision)) then
  raise exception 'The record changed after the proof was submitted' using errcode = '40001';
 end if;
 update public.claims set status = case when p_decision = 'approve' then 'reviewed' else 'rejected' end,
  status_note = note, decided_by = uid, decided_at = clock_timestamp(), updated_at = clock_timestamp()
 where id = claim.id returning * into claim;
 insert into public.claim_events (claim_id, actor_id, actor, action, note)
 values (claim.id, uid, 'reviewer', case when p_decision = 'approve' then 'approved' else 'rejected' end, note);
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;

-- The review queue: language claims carry the stated language, level and test details.
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
      when c.kind = 'language' then (select jsonb_build_object('institution', null, 'title', r.language, 'startDate', null, 'endDate', r.test_date, 'isCurrent', false) from public.profile_languages r where r.id = c.language_id)
      else jsonb_build_object('institution', null, 'title', c.skill, 'startDate', null, 'endDate', null, 'isCurrent', false) end,
    'language', (select jsonb_build_object('language', r.language, 'level', r.level, 'test', r.test, 'score', r.score, 'testDate', r.test_date)
                 from public.profile_languages r where r.id = c.language_id),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
      'id', e.id, 'path', e.storage_path, 'fileName', e.file_name, 'mime', e.mime, 'size', e.size_bytes, 'uploadedAt', e.created_at,
      'sha256', coalesce(f.sha256, e.sha256),
      'fingerprint', case when f.evidence_id is null then 'pending' when f.sha256 = e.sha256 then 'verified' else 'altered' end,
      'duplicateOwners', (select count(distinct d.user_id) from public.claim_evidence d left join public.evidence_fingerprints fd on fd.evidence_id = d.id
        where coalesce(fd.sha256, d.sha256) = coalesce(f.sha256, e.sha256) and d.user_id <> c.user_id),
      'matches', public.careerforge_evidence_matches(e.id),
      'check', (select jsonb_build_object('status', k.status, 'model', k.model, 'extracted', k.extracted, 'findings', k.findings, 'checkedAt', k.checked_at)
                from public.evidence_checks k where k.evidence_id = e.id))
      order by e.created_at desc) from public.claim_evidence e left join public.evidence_fingerprints f on f.evidence_id = e.id where e.claim_id = c.id), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'url', l.url, 'addedAt', l.created_at,
      'check', (select jsonb_build_object('status', x.status, 'holderName', x.holder_name, 'title', x.title, 'issuer', x.issuer, 'issuedOn', x.issued_on, 'checkedAt', x.checked_at)
                from public.link_checks x where x.link_id = l.id))
      order by l.created_at) from public.claim_links l where l.claim_id = c.id), '[]'::jsonb)
   ) as item
   from public.claims c left join public.profiles p on p.id = c.user_id
   where c.status = 'evidence_submitted'
   order by c.updated_at limit 100
  ) queue
 ), '[]'::jsonb);
end $$;
