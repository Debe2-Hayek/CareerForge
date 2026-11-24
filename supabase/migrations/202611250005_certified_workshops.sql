-- CareerForge workshops with verifiable certificates (requirement R4).
--
-- Admins create a workshop, record the trainer agreement (a reference to the signed
-- agreement; signing itself happens outside CareerForge) and assign a trainer by email.
-- Learners enroll and choose whether their name may appear on the public certificate.
-- After the session starts, the trainer or an admin records attendance (and the score for
-- assessed workshops). After it ends, they issue certificates: once per learner, only from
-- that completion evidence. Learners can never issue or change anything. Each certificate
-- has an unguessable id; the public check shows minimal fields and whether it was revoked.
-- Attendance-only and assessed certificates are always labelled as such, and neither
-- implies accreditation, a degree or professional mastery.

create table public.certified_workshops (
 id uuid primary key default gen_random_uuid(),
 title text not null check (char_length(btrim(title)) between 3 and 120),
 summary text not null default '' check (char_length(summary) <= 600),
 mode text not null check (mode in ('online', 'in_person')),
 location text not null default '' check (char_length(location) <= 120),
 starts_at timestamptz not null,
 ends_at timestamptz not null,
 capacity integer not null check (capacity between 1 and 500),
 certificate_kind text not null check (certificate_kind in ('attendance', 'assessed')),
 pass_mark integer check (pass_mark is null or pass_mark between 1 and 100),
 trainer_id uuid references auth.users(id) on delete set null,
 trainer_display text not null default '' check (char_length(trainer_display) <= 80),
 agreement_note text not null default '' check (char_length(agreement_note) <= 300),
 status text not null default 'draft' check (status in ('draft', 'open', 'closed', 'cancelled')),
 created_by uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 check (ends_at > starts_at),
 check ((certificate_kind = 'assessed') = (pass_mark is not null))
);

create table public.workshop_enrollments (
 id uuid primary key default gen_random_uuid(),
 workshop_id uuid not null references public.certified_workshops(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 show_name boolean not null default false,
 status text not null default 'enrolled' check (status in ('enrolled', 'withdrawn')),
 attended boolean,
 score integer check (score is null or score between 0 and 100),
 marked_by uuid references auth.users(id) on delete set null,
 marked_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 unique (workshop_id, user_id)
);
create index workshop_enrollments_user_idx on public.workshop_enrollments (user_id);

create table public.workshop_certificates (
 id uuid primary key default gen_random_uuid(),
 enrollment_id uuid not null unique references public.workshop_enrollments(id) on delete cascade,
 workshop_id uuid not null references public.certified_workshops(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check (kind in ('attendance', 'assessed')),
 scope text not null check (char_length(scope) between 1 and 200),
 holder_name text check (holder_name is null or char_length(holder_name) <= 120),
 issued_by uuid references auth.users(id) on delete set null,
 issued_at timestamptz not null default clock_timestamp(),
 revoked_at timestamptz,
 revoked_by uuid references auth.users(id) on delete set null,
 revoke_reason text check (revoke_reason is null or char_length(revoke_reason) <= 300),
 check ((revoked_at is null) = (revoke_reason is null))
);
create index workshop_certificates_user_idx on public.workshop_certificates (user_id);

create table public.workshop_events (
 id bigint generated always as identity primary key,
 workshop_id uuid not null references public.certified_workshops(id) on delete cascade,
 enrollment_id uuid references public.workshop_enrollments(id) on delete cascade,
 certificate_id uuid references public.workshop_certificates(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 action text not null check (action in ('created', 'updated', 'trainer_assigned', 'enrolled', 'withdrew', 'completion_marked', 'issued', 'revoked')),
 note text check (note is null or char_length(note) <= 300),
 created_at timestamptz not null default clock_timestamp()
);
create index workshop_events_workshop_idx on public.workshop_events (workshop_id, id);

-- Staff for one workshop: an admin or its assigned trainer.
create or replace function public.careerforge_workshop_staff(p_workshop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select public.careerforge_is_admin() or exists (select 1 from public.certified_workshops w where w.id = p_workshop and w.trainer_id = (select auth.uid()))
$$;
revoke all on function public.careerforge_workshop_staff(uuid) from public, anon;
grant execute on function public.careerforge_workshop_staff(uuid) to authenticated;

alter table public.certified_workshops enable row level security;
alter table public.workshop_enrollments enable row level security;
alter table public.workshop_certificates enable row level security;
alter table public.workshop_events enable row level security;
revoke all on public.certified_workshops, public.workshop_enrollments, public.workshop_certificates, public.workshop_events from public, anon, authenticated;
-- Read-only for clients; every write goes through the functions below. The trainer
-- agreement note is for staff only (column grant excludes it; staff read it through RPCs).
grant select (id, title, summary, mode, location, starts_at, ends_at, capacity, certificate_kind, pass_mark, trainer_display, status, created_at, updated_at)
 on public.certified_workshops to authenticated;
grant select on public.workshop_enrollments, public.workshop_certificates to authenticated;
create policy certified_workshops_visible on public.certified_workshops for select to authenticated
 using (status in ('open', 'closed') or (select public.careerforge_workshop_staff(id)));
create policy workshop_enrollments_owner_or_staff on public.workshop_enrollments for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_workshop_staff(workshop_id)));
create policy workshop_certificates_owner_or_staff on public.workshop_certificates for select to authenticated
 using ((select auth.uid()) = user_id or (select public.careerforge_workshop_staff(workshop_id)));

-- Admin: create (p_id null) or update a workshop.
create or replace function public.save_certified_workshop(p_id uuid, p jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 saved uuid;
 kind text := p->>'certificateKind';
begin
 if uid is null or not public.careerforge_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
 if p_id is null then
  insert into public.certified_workshops (title, summary, mode, location, starts_at, ends_at, capacity, certificate_kind, pass_mark, trainer_display, agreement_note, status, created_by)
  values (btrim(p->>'title'), coalesce(p->>'summary', ''), p->>'mode', coalesce(p->>'location', ''), (p->>'startsAt')::timestamptz, (p->>'endsAt')::timestamptz,
   (p->>'capacity')::integer, kind, case when kind = 'assessed' then (p->>'passMark')::integer end, coalesce(p->>'trainerDisplay', ''), coalesce(p->>'agreementNote', ''),
   coalesce(p->>'status', 'draft'), uid)
  returning id into saved;
  insert into public.workshop_events (workshop_id, actor_id, action) values (saved, uid, 'created');
 else
  -- The certificate rules cannot change once certificates exist.
  if exists (select 1 from public.workshop_certificates c join public.certified_workshops w on w.id = c.workshop_id
             where c.workshop_id = p_id and (w.certificate_kind <> kind or w.pass_mark is distinct from case when kind = 'assessed' then (p->>'passMark')::integer end)) then
   raise exception 'Certificate rules are locked' using errcode = '55000';
  end if;
  update public.certified_workshops w set title = btrim(p->>'title'), summary = coalesce(p->>'summary', ''), mode = p->>'mode', location = coalesce(p->>'location', ''),
   starts_at = (p->>'startsAt')::timestamptz, ends_at = (p->>'endsAt')::timestamptz, capacity = (p->>'capacity')::integer, certificate_kind = kind,
   pass_mark = case when kind = 'assessed' then (p->>'passMark')::integer end, trainer_display = coalesce(p->>'trainerDisplay', ''),
   agreement_note = coalesce(p->>'agreementNote', ''), status = coalesce(p->>'status', w.status), updated_at = clock_timestamp()
  where w.id = p_id returning w.id into saved;
  if saved is null then raise exception 'Workshop not found' using errcode = 'P0002'; end if;
  insert into public.workshop_events (workshop_id, actor_id, action) values (saved, uid, 'updated');
 end if;
 return saved;
end $$;
revoke all on function public.save_certified_workshop(uuid, jsonb) from public, anon;
grant execute on function public.save_certified_workshop(uuid, jsonb) to authenticated;

-- Admin: assign (or clear with an empty email) the trainer by their account email.
create or replace function public.assign_workshop_trainer(p_workshop uuid, p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 trainer uuid;
begin
 if uid is null or not public.careerforge_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
 if nullif(btrim(coalesce(p_email, '')), '') is not null then
  select u.id into trainer from auth.users u where lower(u.email) = lower(btrim(p_email));
  if trainer is null then return false; end if;
 end if;
 update public.certified_workshops set trainer_id = trainer, updated_at = clock_timestamp() where id = p_workshop;
 if not found then raise exception 'Workshop not found' using errcode = 'P0002'; end if;
 insert into public.workshop_events (workshop_id, actor_id, action) values (p_workshop, uid, 'trainer_assigned');
 return true;
end $$;
revoke all on function public.assign_workshop_trainer(uuid, text) from public, anon;
grant execute on function public.assign_workshop_trainer(uuid, text) to authenticated;

-- Learner: enroll in an open workshop before it starts (or change the name choice).
create or replace function public.enroll_certified_workshop(p_workshop uuid, p_show_name boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 w public.certified_workshops;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 select * into w from public.certified_workshops where id = p_workshop for update;
 if not found or w.status <> 'open' then raise exception 'Workshop not open' using errcode = 'P0002'; end if;
 if w.starts_at <= clock_timestamp() then raise exception 'Workshop already started' using errcode = '55000'; end if;
 if not exists (select 1 from public.workshop_enrollments e where e.workshop_id = p_workshop and e.user_id = uid and e.status = 'enrolled')
  and (select count(*) from public.workshop_enrollments e where e.workshop_id = p_workshop and e.status = 'enrolled') >= w.capacity then
  raise exception 'Workshop full' using errcode = '23514';
 end if;
 insert into public.workshop_enrollments (workshop_id, user_id, show_name) values (p_workshop, uid, coalesce(p_show_name, false))
 on conflict (workshop_id, user_id) do update set status = 'enrolled', show_name = coalesce(p_show_name, false);
 insert into public.workshop_events (workshop_id, enrollment_id, actor_id, action)
 select p_workshop, e.id, uid, 'enrolled' from public.workshop_enrollments e where e.workshop_id = p_workshop and e.user_id = uid;
end $$;
revoke all on function public.enroll_certified_workshop(uuid, boolean) from public, anon;
grant execute on function public.enroll_certified_workshop(uuid, boolean) to authenticated;

create or replace function public.withdraw_certified_workshop(p_workshop uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 enrollment uuid;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if exists (select 1 from public.certified_workshops w where w.id = p_workshop and w.starts_at <= clock_timestamp()) then
  raise exception 'Workshop already started' using errcode = '55000';
 end if;
 update public.workshop_enrollments set status = 'withdrawn' where workshop_id = p_workshop and user_id = uid and status = 'enrolled' returning id into enrollment;
 if enrollment is null then raise exception 'Not enrolled' using errcode = 'P0002'; end if;
 insert into public.workshop_events (workshop_id, enrollment_id, actor_id, action) values (p_workshop, enrollment, uid, 'withdrew');
end $$;
revoke all on function public.withdraw_certified_workshop(uuid) from public, anon;
grant execute on function public.withdraw_certified_workshop(uuid) to authenticated;

-- Staff: the roster with names, for one workshop.
create or replace function public.certified_workshop_roster(p_workshop uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.careerforge_workshop_staff(p_workshop) then raise exception 'Staff access required' using errcode = '42501'; end if;
 return jsonb_build_object(
  'agreementNote', (select w.agreement_note from public.certified_workshops w where w.id = p_workshop),
  'hasTrainer', (select w.trainer_id is not null from public.certified_workshops w where w.id = p_workshop),
  'trainerEmail', (select u.email from public.certified_workshops w join auth.users u on u.id = w.trainer_id where w.id = p_workshop and public.careerforge_is_admin()),
  'learners', coalesce((select jsonb_agg(jsonb_build_object('enrollmentId', e.id, 'name', coalesce(nullif(p.full_name, ''), 'Unnamed learner'), 'status', e.status,
    'attended', e.attended, 'score', e.score, 'showName', e.show_name,
    'certificate', (select jsonb_build_object('id', c.id, 'issuedAt', c.issued_at, 'revokedAt', c.revoked_at) from public.workshop_certificates c where c.enrollment_id = e.id))
    order by p.full_name) from public.workshop_enrollments e left join public.profiles p on p.id = e.user_id where e.workshop_id = p_workshop), '[]'::jsonb));
end $$;
revoke all on function public.certified_workshop_roster(uuid) from public, anon;
grant execute on function public.certified_workshop_roster(uuid) to authenticated;

-- Staff: record attendance and, for assessed workshops, the score. Only after the start,
-- and not once the learner's certificate is issued.
create or replace function public.mark_workshop_completion(p_enrollment uuid, p_attended boolean, p_score integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
 e public.workshop_enrollments;
 w public.certified_workshops;
begin
 select * into e from public.workshop_enrollments where id = p_enrollment for update;
 if not found then raise exception 'Enrollment not found' using errcode = 'P0002'; end if;
 if not public.careerforge_workshop_staff(e.workshop_id) then raise exception 'Staff access required' using errcode = '42501'; end if;
 select * into w from public.certified_workshops where id = e.workshop_id;
 if w.starts_at > clock_timestamp() then raise exception 'Workshop has not started' using errcode = '55000'; end if;
 if e.status <> 'enrolled' then raise exception 'Learner withdrew' using errcode = '55000'; end if;
 if exists (select 1 from public.workshop_certificates c where c.enrollment_id = p_enrollment) then raise exception 'Certificate already issued' using errcode = '55000'; end if;
 if p_score is not null and (w.certificate_kind <> 'assessed' or p_score not between 0 and 100) then raise exception 'Invalid score' using errcode = '22023'; end if;
 update public.workshop_enrollments set attended = p_attended, score = case when p_attended then p_score end, marked_by = auth.uid(), marked_at = clock_timestamp() where id = p_enrollment;
 insert into public.workshop_events (workshop_id, enrollment_id, actor_id, action, note)
 values (e.workshop_id, p_enrollment, auth.uid(), 'completion_marked', case when p_attended then 'attended' || coalesce(', score ' || p_score, '') else 'absent' end);
end $$;
revoke all on function public.mark_workshop_completion(uuid, boolean, integer) from public, anon;
grant execute on function public.mark_workshop_completion(uuid, boolean, integer) to authenticated;

-- Staff: issue certificates to every learner who completed, once each. Requires a
-- recorded trainer agreement and an assigned trainer, and only after the workshop ends.
create or replace function public.issue_workshop_certificates(p_workshop uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare
 w public.certified_workshops;
 issued integer := 0;
 e record;
 cert uuid;
begin
 if not public.careerforge_workshop_staff(p_workshop) then raise exception 'Staff access required' using errcode = '42501'; end if;
 select * into w from public.certified_workshops where id = p_workshop for update;
 if w.status = 'cancelled' or w.status = 'draft' then raise exception 'Workshop not running' using errcode = '55000'; end if;
 if w.ends_at > clock_timestamp() then raise exception 'Workshop has not ended' using errcode = '55000'; end if;
 if w.trainer_id is null or btrim(w.agreement_note) = '' then raise exception 'Trainer and agreement required' using errcode = '55000'; end if;
 for e in select en.*, p.full_name from public.workshop_enrollments en left join public.profiles p on p.id = en.user_id
  where en.workshop_id = p_workshop and en.status = 'enrolled' and en.attended
   and (w.certificate_kind = 'attendance' or coalesce(en.score, -1) >= w.pass_mark)
   and not exists (select 1 from public.workshop_certificates c where c.enrollment_id = en.id)
 loop
  insert into public.workshop_certificates (enrollment_id, workshop_id, user_id, kind, scope, holder_name, issued_by)
  values (e.id, p_workshop, e.user_id, w.certificate_kind,
   case when w.certificate_kind = 'attendance' then 'Attended the full workshop'
    else format('Passed the workshop assessment: %s/100 (pass mark %s)', e.score, w.pass_mark) end,
   case when e.show_name then nullif(btrim(e.full_name), '') end, auth.uid())
  returning id into cert;
  insert into public.workshop_events (workshop_id, enrollment_id, certificate_id, actor_id, action) values (p_workshop, e.id, cert, auth.uid(), 'issued');
  issued := issued + 1;
 end loop;
 update public.certified_workshops set status = 'closed', updated_at = clock_timestamp() where id = p_workshop and status = 'open';
 return issued;
end $$;
revoke all on function public.issue_workshop_certificates(uuid) from public, anon;
grant execute on function public.issue_workshop_certificates(uuid) to authenticated;

-- Admin: revoke a certificate with a reason (shown publicly only as "revoked on <date>").
create or replace function public.revoke_workshop_certificate(p_certificate uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
 c public.workshop_certificates;
 reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
 if not public.careerforge_is_admin() then raise exception 'Admin access required' using errcode = '42501'; end if;
 if reason is null or char_length(reason) > 300 then raise exception 'A reason is required' using errcode = '22023'; end if;
 update public.workshop_certificates set revoked_at = clock_timestamp(), revoked_by = auth.uid(), revoke_reason = reason
 where id = p_certificate and revoked_at is null returning * into c;
 if c.id is null then raise exception 'Certificate not found or already revoked' using errcode = 'P0002'; end if;
 insert into public.workshop_events (workshop_id, enrollment_id, certificate_id, actor_id, action, note) values (c.workshop_id, c.enrollment_id, c.id, auth.uid(), 'revoked', reason);
end $$;
revoke all on function public.revoke_workshop_certificate(uuid, text) from public, anon;
grant execute on function public.revoke_workshop_certificate(uuid, text) to authenticated;

-- Anyone with the certificate id: minimal fields and revocation state.
create or replace function public.verify_workshop_certificate(p_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('id', c.id, 'kind', c.kind, 'scope', c.scope, 'holderName', c.holder_name, 'issuedAt', c.issued_at, 'revokedAt', c.revoked_at,
  'workshop', jsonb_build_object('title', w.title, 'mode', w.mode, 'startsAt', w.starts_at, 'endsAt', w.ends_at, 'trainer', nullif(w.trainer_display, '')))
 from public.workshop_certificates c join public.certified_workshops w on w.id = c.workshop_id where c.id = p_id
$$;
revoke all on function public.verify_workshop_certificate(uuid) from public;
grant execute on function public.verify_workshop_certificate(uuid) to anon, authenticated;

-- The checked-profile page lists valid CareerForge certificates too.
create or replace function public.careerforge_confirmed_facts(p_uid uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object(
  'name', coalesce(nullif(btrim(p.full_name), ''), 'CareerForge member'),
  'headline', nullif(btrim(p.headline), ''),
  'education', coalesce((select jsonb_agg(jsonb_build_object('title', r.degree, 'organisation', r.institution, 'startDate', r.start_date, 'endDate', r.end_date,
     'isCurrent', r.is_current, 'method', 'reviewed', 'checkedAt', c.decided_at) order by r.end_date desc nulls first)
    from public.claims c join public.education_records r on r.id = c.education_id
    where c.user_id = p_uid and c.status = 'reviewed' and c.source_revision = r.revision), '[]'::jsonb),
  'experience', coalesce((select jsonb_agg(jsonb_build_object('title', r.role, 'organisation', r.company, 'startDate', r.start_date, 'endDate', r.end_date,
     'isCurrent', r.is_current, 'method', 'reviewed', 'checkedAt', c.decided_at) order by r.start_date desc nulls last)
    from public.claims c join public.experience_records r on r.id = c.experience_id
    where c.user_id = p_uid and c.status = 'reviewed' and c.source_revision = r.revision), '[]'::jsonb),
  'languages', coalesce((select jsonb_agg(jsonb_build_object('language', r.language, 'level', r.level, 'test', r.test, 'score', r.score, 'testDate', r.test_date,
     'method', 'reviewed', 'checkedAt', c.decided_at) order by r.created_at)
    from public.claims c join public.profile_languages r on r.id = c.language_id
    where c.user_id = p_uid and c.status = 'reviewed' and c.source_revision = r.revision), '[]'::jsonb),
  'skills', coalesce((select jsonb_agg(s.item order by s.name) from (
     select distinct on (lower(x.name)) x.name, jsonb_build_object('skill', x.name, 'method', x.method, 'checkedAt', x.checked_at) as item
     from (
      select a.skill as name, 'check' as method, a.taken_at as checked_at, 1 as rank from public.skill_check_attempts a where a.user_id = p_uid and a.passed
      union all
      select c.skill, 'reviewed', c.decided_at, 2 from public.claims c where c.user_id = p_uid and c.kind = 'skill' and c.status = 'reviewed'
     ) x
     order by lower(x.name), x.rank, x.checked_at desc
    ) s), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object('repository', i.repo_owner || '/' || i.repo_name, 'method', 'interview', 'checkedAt', i.decided_at) order by i.decided_at desc)
    from public.project_interviews i where i.user_id = p_uid and i.status = 'approved'), '[]'::jsonb),
  'certificates', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'title', w.title, 'kind', c.kind, 'scope', c.scope, 'checkedAt', c.issued_at) order by c.issued_at desc)
    from public.workshop_certificates c join public.certified_workshops w on w.id = c.workshop_id where c.user_id = p_uid and c.revoked_at is null), '[]'::jsonb)
 )
 from public.profiles p where p.id = p_uid
$$;

-- The workshops the signed-in user teaches (ids), for the trainer's view.
create or replace function public.my_taught_workshops()
returns jsonb language sql stable security definer set search_path = '' as $$
 select coalesce(jsonb_agg(w.id order by w.starts_at), '[]'::jsonb) from public.certified_workshops w where w.trainer_id = (select auth.uid())
$$;
revoke all on function public.my_taught_workshops() from public, anon;
grant execute on function public.my_taught_workshops() to authenticated;
