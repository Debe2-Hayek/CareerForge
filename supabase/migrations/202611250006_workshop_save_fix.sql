-- save_certified_workshop failed when editing an existing workshop: its variable "kind" was
-- ambiguous with workshop_certificates.kind in the lock check (42702). Same function, the
-- variable renamed to v_kind.
create or replace function public.save_certified_workshop(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 saved uuid;
 v_kind text := p->>'certificateKind';
begin
 if uid is null or not public.careerforge_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
 if p_id is null then
  insert into public.certified_workshops (title, summary, mode, location, starts_at, ends_at, capacity, certificate_kind, pass_mark, trainer_display, agreement_note, status, created_by)
  values (btrim(p->>'title'), coalesce(p->>'summary', ''), p->>'mode', coalesce(p->>'location', ''), (p->>'startsAt')::timestamptz, (p->>'endsAt')::timestamptz,
   (p->>'capacity')::integer, v_kind, case when v_kind = 'assessed' then (p->>'passMark')::integer end, coalesce(p->>'trainerDisplay', ''), coalesce(p->>'agreementNote', ''),
   coalesce(p->>'status', 'draft'), uid)
  returning id into saved;
  insert into public.workshop_events (workshop_id, actor_id, action) values (saved, uid, 'created');
 else
  -- The certificate rules cannot change once certificates exist.
  if exists (select 1 from public.workshop_certificates c join public.certified_workshops w on w.id = c.workshop_id
             where c.workshop_id = p_id and (w.certificate_kind <> v_kind or w.pass_mark is distinct from case when v_kind = 'assessed' then (p->>'passMark')::integer end)) then
   raise exception 'Certificate rules are locked' using errcode = '55000';
  end if;
  update public.certified_workshops w set title = btrim(p->>'title'), summary = coalesce(p->>'summary', ''), mode = p->>'mode', location = coalesce(p->>'location', ''),
   starts_at = (p->>'startsAt')::timestamptz, ends_at = (p->>'endsAt')::timestamptz, capacity = (p->>'capacity')::integer, certificate_kind = v_kind,
   pass_mark = case when v_kind = 'assessed' then (p->>'passMark')::integer end, trainer_display = coalesce(p->>'trainerDisplay', ''),
   agreement_note = coalesce(p->>'agreementNote', ''), status = coalesce(p->>'status', w.status), updated_at = clock_timestamp()
  where w.id = p_id returning w.id into saved;
  if saved is null then raise exception 'Workshop not found' using errcode = 'P0002'; end if;
  insert into public.workshop_events (workshop_id, actor_id, action) values (saved, uid, 'updated');
 end if;
 return saved;
end $$;
