-- Claim verification (requirement R1, part 1): private proof for a profile fact,
-- a reviewer decision, and an append-only history.
--
-- A claim row exists only once proof is submitted; anything without one is
-- self-declared. Skills passed in a CareerForge check are verified from
-- skill_check_attempts and need no row. A claim records the revision of the
-- education/experience record it was reviewed against: editing that record
-- afterwards makes the review no longer apply (the application compares them).

create or replace function public.careerforge_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select coalesce((select p.role = 'admin' from public.profiles p where p.id = (select auth.uid())), false)
$$;
revoke all on function public.careerforge_is_admin() from public, anon;
grant execute on function public.careerforge_is_admin() to authenticated;

create table public.claims (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('degree', 'employment', 'skill')),
 education_id uuid references public.education_records(id) on delete cascade,
 experience_id uuid references public.experience_records(id) on delete cascade,
 skill text check (skill is null or char_length(skill) between 1 and 60),
 source_revision uuid,
 subject text not null check (char_length(subject) between 1 and 400),
 status text not null default 'evidence_submitted' check (status in ('evidence_submitted', 'reviewed', 'rejected')),
 status_note text check (status_note is null or char_length(status_note) <= 500),
 decided_by uuid references auth.users(id) on delete set null,
 decided_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check (
  (kind = 'degree' and education_id is not null and experience_id is null and skill is null) or
  (kind = 'employment' and experience_id is not null and education_id is null and skill is null) or
  (kind = 'skill' and skill is not null and education_id is null and experience_id is null)
 )
);
create unique index claims_education_key on public.claims (education_id) where education_id is not null;
create unique index claims_experience_key on public.claims (experience_id) where experience_id is not null;
create unique index claims_skill_key on public.claims (user_id, lower(skill)) where skill is not null;
create index claims_owner_idx on public.claims (user_id);
create index claims_queue_idx on public.claims (updated_at) where status = 'evidence_submitted';

create table public.claim_evidence (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.claims(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 storage_path text not null unique check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|png|jpg)$'),
 file_name text not null check (char_length(file_name) between 1 and 200),
 mime text not null check (mime in ('application/pdf', 'image/png', 'image/jpeg')),
 size_bytes integer not null check (size_bytes between 1 and 4194304),
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 created_at timestamptz not null default clock_timestamp()
);
create index claim_evidence_claim_idx on public.claim_evidence (claim_id, created_at desc);
-- The same file under two accounts is a strong signal for reviewers.
create index claim_evidence_sha_idx on public.claim_evidence (sha256);

create table public.claim_events (
 id bigint generated always as identity primary key,
 claim_id uuid not null references public.claims(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 actor text not null check (actor in ('owner', 'reviewer')),
 action text not null check (action in ('evidence_added', 'approved', 'rejected')),
 note text check (note is null or char_length(note) <= 500),
 created_at timestamptz not null default clock_timestamp()
);
create index claim_events_claim_idx on public.claim_events (claim_id, id);

alter table public.claims enable row level security;
alter table public.claim_evidence enable row level security;
alter table public.claim_events enable row level security;
revoke all on public.claims, public.claim_evidence, public.claim_events from public, anon, authenticated;
-- Read-only for clients; every write goes through the RPCs below.
grant select on public.claims, public.claim_evidence, public.claim_events to authenticated;
create policy claims_owner_or_admin_select on public.claims for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_is_admin()));
create policy claim_evidence_owner_or_admin_select on public.claim_evidence for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_is_admin()));
create policy claim_events_owner_or_admin_select on public.claim_events for select to authenticated
 using (exists (select 1 from public.claims c where c.id = claim_id and c.user_id = (select auth.uid())) or (select public.careerforge_is_admin()));

-- Private proof files: <owner id>/<random id>.<ext>. Owners upload into their own
-- folder and may remove a file only while no claim references it (failed submits).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('claim-evidence', 'claim-evidence', false, 4194304, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy claim_evidence_files_owner_insert on storage.objects for insert to authenticated
 with check (bucket_id = 'claim-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy claim_evidence_files_owner_or_admin_select on storage.objects for select to authenticated
 using (bucket_id = 'claim-evidence' and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.careerforge_is_admin())));
create policy claim_evidence_files_owner_delete_unreferenced on storage.objects for delete to authenticated
 using (bucket_id = 'claim-evidence' and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.claim_evidence e where e.storage_path = name));

-- Owner: attach an uploaded file as proof for one of their own facts.
create or replace function public.submit_claim_evidence(p_kind text, p_record_id uuid, p_skill text,
 p_storage_path text, p_file_name text, p_mime text, p_size integer, p_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 subj text;
 rev uuid;
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
 if p_kind = 'degree' then
  select r.degree || ' · ' || r.institution, r.revision into subj, rev from public.education_records r where r.id = p_record_id and r.user_id = uid;
 elsif p_kind = 'employment' then
  select r.role || ' · ' || r.company, r.revision into subj, rev from public.experience_records r where r.id = p_record_id and r.user_id = uid;
 elsif p_kind = 'skill' then
  select s into subj from public.profiles p, unnest(p.self_reported_skills) s where p.id = uid and lower(s) = lower(btrim(p_skill)) limit 1;
 else
  raise exception 'Invalid claim kind' using errcode = '22023';
 end if;
 if subj is null then raise exception 'Claim source not found' using errcode = 'P0002'; end if;

 perform pg_advisory_xact_lock(hashtextextended('careerforge.claims:' || uid::text, 0));
 select * into claim from public.claims c where c.user_id = uid and (
  (p_kind = 'degree' and c.education_id = p_record_id) or
  (p_kind = 'employment' and c.experience_id = p_record_id) or
  (p_kind = 'skill' and lower(c.skill) = lower(subj)));
 if found then
  if claim.status = 'reviewed' and claim.source_revision is not distinct from rev then
   raise exception 'Already reviewed' using errcode = '23514';
  end if;
  select count(*) into files from public.claim_evidence e where e.claim_id = claim.id;
  if files >= 5 then raise exception 'Too many files' using errcode = '23514'; end if;
  update public.claims set status = 'evidence_submitted', subject = subj, source_revision = rev,
   status_note = null, decided_by = null, decided_at = null, updated_at = clock_timestamp()
  where id = claim.id returning * into claim;
 else
  insert into public.claims (user_id, kind, education_id, experience_id, skill, source_revision, subject)
  values (uid, p_kind,
   case when p_kind = 'degree' then p_record_id end,
   case when p_kind = 'employment' then p_record_id end,
   case when p_kind = 'skill' then subj end, rev, subj)
  returning * into claim;
 end if;
 insert into public.claim_evidence (claim_id, user_id, storage_path, file_name, mime, size_bytes, sha256)
 values (claim.id, uid, p_storage_path, p_file_name, p_mime, p_size, p_sha256);
 insert into public.claim_events (claim_id, actor_id, actor, action) values (claim.id, uid, 'owner', 'evidence_added');
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;
revoke all on function public.submit_claim_evidence(text, uuid, text, text, text, text, integer, text) from public, anon;
grant execute on function public.submit_claim_evidence(text, uuid, text, text, text, text, integer, text) to authenticated;

-- Admin: approve (reviewed) or reject (reason required) a claim awaiting review.
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
  or (claim.kind = 'employment' and not exists (select 1 from public.experience_records r where r.id = claim.experience_id and r.revision = claim.source_revision)) then
  raise exception 'The record changed after the proof was submitted' using errcode = '40001';
 end if;
 update public.claims set status = case when p_decision = 'approve' then 'reviewed' else 'rejected' end,
  status_note = note, decided_by = uid, decided_at = clock_timestamp(), updated_at = clock_timestamp()
 where id = claim.id returning * into claim;
 insert into public.claim_events (claim_id, actor_id, actor, action, note)
 values (claim.id, uid, 'reviewer', case when p_decision = 'approve' then 'approved' else 'rejected' end, note);
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;
revoke all on function public.review_claim(uuid, text, text) from public, anon;
grant execute on function public.review_claim(uuid, text, text) to authenticated;

-- Admin: claims awaiting review, oldest first, with the owner's name and proof files.
-- duplicateOwners counts other accounts that uploaded an identical file.
create or replace function public.claim_review_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 return coalesce((
  select jsonb_agg(item order by (item->>'updatedAt')) from (
   select jsonb_build_object(
    'id', c.id, 'kind', c.kind, 'subject', c.subject, 'updatedAt', c.updated_at,
    'ownerName', coalesce(nullif(p.full_name, ''), 'Unnamed user'), 'own', c.user_id = (select auth.uid()),
    'evidence', coalesce((select jsonb_agg(jsonb_build_object(
      'path', e.storage_path, 'fileName', e.file_name, 'mime', e.mime, 'size', e.size_bytes, 'uploadedAt', e.created_at,
      'duplicateOwners', (select count(distinct d.user_id) from public.claim_evidence d where d.sha256 = e.sha256 and d.user_id <> c.user_id))
      order by e.created_at desc) from public.claim_evidence e where e.claim_id = c.id), '[]'::jsonb)
   ) as item
   from public.claims c left join public.profiles p on p.id = c.user_id
   where c.status = 'evidence_submitted'
   order by c.updated_at limit 100
  ) queue
 ), '[]'::jsonb);
end $$;
revoke all on function public.claim_review_queue() from public, anon;
grant execute on function public.claim_review_queue() to authenticated;
