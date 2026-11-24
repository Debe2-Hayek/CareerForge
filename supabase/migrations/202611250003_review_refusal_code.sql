-- Reviewers saw "The decision did not finish" instead of the reason when the owner had edited a
-- record after sending proof: review_claim refused with SQLSTATE 40001, which PostgREST treats
-- as a serialization failure and retries for about 15 seconds. 55000 is not retried; the
-- application maps both codes to "The owner edited this record after sending proof".
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
  raise exception 'The record changed after the proof was submitted' using errcode = '55000';
 end if;
 update public.claims set status = case when p_decision = 'approve' then 'reviewed' else 'rejected' end,
  status_note = note, decided_by = uid, decided_at = clock_timestamp(), updated_at = clock_timestamp()
 where id = claim.id returning * into claim;
 insert into public.claim_events (claim_id, actor_id, actor, action, note)
 values (claim.id, uid, 'reviewer', case when p_decision = 'approve' then 'approved' else 'rejected' end, note);
 return jsonb_build_object('claimId', claim.id, 'status', claim.status);
end $$;
