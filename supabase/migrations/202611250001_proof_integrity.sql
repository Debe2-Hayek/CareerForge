-- Proof integrity (requirement R1): catch reused, re-saved and edited proof, and check
-- public issuer verification links.
--
-- 1. Fingerprints. submit_claim_evidence stores the sha256 the caller sends, and a user can
--    call it directly from their own session, so that value can be forged. Admins (the
--    review page) recompute every file's fingerprint from the stored bytes and record it
--    here; only admins can write. A mismatch with the submitted value is itself a red flag.
-- 2. Matches across accounts: the same file, the same PDF text (re-saved or re-exported),
--    the same certificate number (read by the AI check), or a near-identical image
--    (64-bit difference hash, at most 10 bits apart: re-saved, resized, recompressed, or the
--    same design with an edited name). Hints for the reviewer, never a decision.
-- 3. Verification links: owners add the public verification address of a certificate on a
--    known issuer site; admins have it checked (Coursera course certificates automatically,
--    other issuers opened by the reviewer).

-- 1. Fingerprints -------------------------------------------------------------------------
create table public.evidence_fingerprints (
 evidence_id uuid primary key references public.claim_evidence(id) on delete cascade,
 sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
 text_hash text check (text_hash is null or text_hash ~ '^[0-9a-f]{64}$'),
 image_hash bigint,
 computed_by uuid references auth.users(id) on delete set null,
 computed_at timestamptz not null default clock_timestamp()
);
create index evidence_fingerprints_sha_idx on public.evidence_fingerprints (sha256);
create index evidence_fingerprints_text_idx on public.evidence_fingerprints (text_hash) where text_hash is not null;
alter table public.evidence_fingerprints enable row level security;
revoke all on public.evidence_fingerprints from public, anon, authenticated;
grant select on public.evidence_fingerprints to authenticated;
create policy evidence_fingerprints_admin_select on public.evidence_fingerprints for select to authenticated
 using ((select public.careerforge_is_admin()));

create or replace function public.record_evidence_fingerprint(p_evidence_id uuid, p_sha256 text, p_text_hash text, p_image_hash text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' or (p_text_hash is not null and p_text_hash !~ '^[0-9a-f]{64}$')
  or (p_image_hash is not null and p_image_hash !~ '^-?[0-9]{1,19}$') then
  raise exception 'Invalid fingerprint' using errcode = '22023';
 end if;
 if not exists (select 1 from public.claim_evidence e where e.id = p_evidence_id) then raise exception 'Evidence not found' using errcode = 'P0002'; end if;
 insert into public.evidence_fingerprints (evidence_id, sha256, text_hash, image_hash, computed_by)
 values (p_evidence_id, p_sha256, p_text_hash, p_image_hash::bigint, auth.uid())
 on conflict (evidence_id) do update set sha256 = excluded.sha256, text_hash = excluded.text_hash, image_hash = excluded.image_hash,
  computed_by = excluded.computed_by, computed_at = clock_timestamp();
end $$;
revoke all on function public.record_evidence_fingerprint(uuid, text, text, text) from public, anon;
grant execute on function public.record_evidence_fingerprint(uuid, text, text, text) to authenticated;

-- Files still without a recomputed fingerprint: those waiting for review first, then older ones.
create or replace function public.evidence_fingerprint_backlog(p_limit integer)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'path', b.storage_path, 'mime', b.mime)) from (
  select e.id, e.storage_path, e.mime from public.claim_evidence e join public.claims c on c.id = e.claim_id
  where not exists (select 1 from public.evidence_fingerprints f where f.evidence_id = e.id)
  order by (c.status = 'evidence_submitted') desc, e.created_at
  limit least(greatest(coalesce(p_limit, 10), 1), 20)) b), '[]'::jsonb);
end $$;
revoke all on function public.evidence_fingerprint_backlog(integer) from public, anon;
grant execute on function public.evidence_fingerprint_backlog(integer) to authenticated;

-- 2. Matches across accounts (internal helper for the review queue) --------------------------
create or replace function public.careerforge_evidence_matches(p_evidence_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 with me as (
  select e.id, e.user_id, coalesce(f.sha256, e.sha256) as sha, f.text_hash, f.image_hash,
   nullif(regexp_replace(lower(coalesce(k.extracted->>'certificateId', '')), '[^a-z0-9]', '', 'g'), '') as cert
  from public.claim_evidence e
  left join public.evidence_fingerprints f on f.evidence_id = e.id
  left join public.evidence_checks k on k.evidence_id = e.id
  where e.id = p_evidence_id
 ), hits as (
  select o.storage_path, o.mime, o.claim_id, case
    when coalesce(fo.sha256, o.sha256) = me.sha then 'same_file'
    when me.text_hash is not null and fo.text_hash = me.text_hash then 'same_text'
    when char_length(coalesce(me.cert, '')) >= 5 and regexp_replace(lower(coalesce(ko.extracted->>'certificateId', '')), '[^a-z0-9]', '', 'g') = me.cert then 'same_number'
    when me.image_hash is not null and fo.image_hash is not null and bit_count((me.image_hash # fo.image_hash)::bit(64)) <= 10 then 'similar_image'
   end as reason, o.created_at
  from me join public.claim_evidence o on o.user_id <> me.user_id
  left join public.evidence_fingerprints fo on fo.evidence_id = o.id
  left join public.evidence_checks ko on ko.evidence_id = o.id
 ), top as (
  select h.* from hits h where h.reason is not null
  order by array_position(array['same_file', 'same_text', 'same_number', 'similar_image'], h.reason), h.created_at
  limit 5
 )
 select coalesce(jsonb_agg(jsonb_build_object('reason', t.reason, 'path', t.storage_path, 'mime', t.mime,
   'ownerName', coalesce(nullif(p.full_name, ''), 'Unnamed user'), 'subject', c.subject, 'status', c.status, 'uploadedAt', t.created_at)
   order by array_position(array['same_file', 'same_text', 'same_number', 'similar_image'], t.reason), t.created_at), '[]'::jsonb)
 from top t join public.claims c on c.id = t.claim_id left join public.profiles p on p.id = c.user_id
$$;
revoke all on function public.careerforge_evidence_matches(uuid) from public, anon, authenticated;

-- 3. Verification links --------------------------------------------------------------------
alter table public.claim_events drop constraint claim_events_action_check;
alter table public.claim_events add constraint claim_events_action_check check (action in ('evidence_added', 'link_added', 'approved', 'rejected'));

create table public.claim_links (
 id uuid primary key default gen_random_uuid(),
 claim_id uuid not null references public.claims(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 -- Known issuer sites only (the application applies the same list, host by host).
 url text not null check (char_length(url) <= 500 and url !~ '\s' and (
  url ~ '^https://(www\.)?(coursera\.org|credly\.com|youracclaim\.com|linkedin\.com|freecodecamp\.org|udemy\.com|credential\.net|hackerrank\.com|datacamp\.com)/'
  or url ~ '^https://(learn\.microsoft\.com|ude\.my)/')),
 created_at timestamptz not null default clock_timestamp(),
 unique (claim_id, url)
);
create index claim_links_owner_idx on public.claim_links (user_id);
alter table public.claim_links enable row level security;
revoke all on public.claim_links from public, anon, authenticated;
grant select on public.claim_links to authenticated;
create policy claim_links_owner_or_admin_select on public.claim_links for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_is_admin()));

create table public.link_checks (
 link_id uuid primary key references public.claim_links(id) on delete cascade,
 status text not null check (status in ('confirmed', 'name_mismatch', 'not_found', 'failed')),
 holder_name text check (holder_name is null or char_length(holder_name) <= 120),
 title text check (title is null or char_length(title) <= 200),
 issuer text check (issuer is null or char_length(issuer) <= 200),
 issued_on text check (issued_on is null or char_length(issued_on) <= 40),
 checked_by uuid references auth.users(id) on delete set null,
 checked_at timestamptz not null default clock_timestamp()
);
alter table public.link_checks enable row level security;
revoke all on public.link_checks from public, anon, authenticated;
grant select on public.link_checks to authenticated;
create policy link_checks_admin_select on public.link_checks for select to authenticated using ((select public.careerforge_is_admin()));

-- Owner: add a verification link to one of their own facts (creates the claim if needed,
-- exactly like sending a file).
create or replace function public.add_claim_link(p_kind text, p_record_id uuid, p_skill text, p_url text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 subj text;
 rev uuid;
 claim public.claims;
 links integer;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if p_url is null or char_length(p_url) > 500 or p_url ~ '\s' or not (
  p_url ~ '^https://(www\.)?(coursera\.org|credly\.com|youracclaim\.com|linkedin\.com|freecodecamp\.org|udemy\.com|credential\.net|hackerrank\.com|datacamp\.com)/'
  or p_url ~ '^https://(learn\.microsoft\.com|ude\.my)/') then
  raise exception 'Unsupported link' using errcode = '22023';
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
  if exists (select 1 from public.claim_links l where l.claim_id = claim.id and l.url = p_url) then
   raise exception 'Link already added' using errcode = '23505';
  end if;
  select count(*) into links from public.claim_links l where l.claim_id = claim.id;
  if links >= 3 then raise exception 'Too many links' using errcode = '23514'; end if;
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
 insert into public.claim_links (claim_id, user_id, url) values (claim.id, uid, p_url);
 insert into public.claim_events (claim_id, actor_id, actor, action) values (claim.id, uid, 'owner', 'link_added');
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;
revoke all on function public.add_claim_link(text, uuid, text, text) from public, anon;
grant execute on function public.add_claim_link(text, uuid, text, text) to authenticated;

-- Admin: store the result of checking one link (only for claims awaiting review).
create or replace function public.record_link_check(p_link_id uuid, p_status text, p_holder_name text, p_title text, p_issuer text, p_issued_on text)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if not exists (select 1 from public.claim_links l join public.claims c on c.id = l.claim_id where l.id = p_link_id and c.status = 'evidence_submitted') then
  raise exception 'Link not found' using errcode = 'P0002';
 end if;
 insert into public.link_checks (link_id, status, holder_name, title, issuer, issued_on, checked_by)
 values (p_link_id, p_status, left(p_holder_name, 120), left(p_title, 200), left(p_issuer, 200), left(p_issued_on, 40), auth.uid())
 on conflict (link_id) do update set status = excluded.status, holder_name = excluded.holder_name, title = excluded.title,
  issuer = excluded.issuer, issued_on = excluded.issued_on, checked_by = excluded.checked_by, checked_at = clock_timestamp();
end $$;
revoke all on function public.record_link_check(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.record_link_check(uuid, text, text, text, text, text) to authenticated;

-- 4. The review queue now carries, per file, the recomputed fingerprint state and matches in
-- other accounts, and per claim, its verification links with their latest check.
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
revoke all on function public.claim_review_queue() from public, anon;
grant execute on function public.claim_review_queue() to authenticated;
