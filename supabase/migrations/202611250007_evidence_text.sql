-- Free text check (requirement R1): the text CareerForge read from a proof file on its own
-- server (PDF text layer or OCR with Tesseract), stored for reviewers. Plain code compares it
-- with the claim; no AI and no credits. The AI proof check reuses OCR text for scanned PDFs,
-- and the text fingerprint lets a photo and a PDF of the same certificate match.
-- Only admins can read or write it (owners cannot plant a favourable reading).

create table public.evidence_text (
 evidence_id uuid primary key references public.claim_evidence(id) on delete cascade,
 method text not null check (method in ('pdf_text', 'ocr')),
 text text not null check (char_length(text) <= 20000),
 confidence integer check (confidence is null or confidence between 0 and 100),
 read_by uuid references auth.users(id) on delete set null,
 read_at timestamptz not null default clock_timestamp()
);
alter table public.evidence_text enable row level security;
revoke all on public.evidence_text from public, anon, authenticated;
grant select on public.evidence_text to authenticated;
create policy evidence_text_admin_select on public.evidence_text for select to authenticated using ((select public.careerforge_is_admin()));

create or replace function public.record_evidence_text(p_evidence_id uuid, p_method text, p_text text, p_confidence integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.careerforge_is_admin() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
 if not exists (select 1 from public.claim_evidence e where e.id = p_evidence_id) then raise exception 'Evidence not found' using errcode = 'P0002'; end if;
 insert into public.evidence_text (evidence_id, method, text, confidence, read_by)
 values (p_evidence_id, p_method, left(coalesce(p_text, ''), 20000), p_confidence, auth.uid())
 on conflict (evidence_id) do update set method = excluded.method, text = excluded.text, confidence = excluded.confidence,
  read_by = excluded.read_by, read_at = clock_timestamp();
end $$;
revoke all on function public.record_evidence_text(uuid, text, text, integer) from public, anon;
grant execute on function public.record_evidence_text(uuid, text, text, integer) to authenticated;
