-- Public trust page (requirement R1): an opt-in, unlisted page at /v/<random id> that shows
-- only the facts CareerForge checked, with how and when. Employers reach it from the link
-- printed on the CV or shown on the portfolio. Self-declared facts, proof files, reviewer
-- notes and contact details are never included. Off by default; the owner can turn it off
-- or replace the link (old links stop working) at any time.

create table public.trust_pages (
 user_id uuid primary key references auth.users(id) on delete cascade,
 slug uuid not null unique default gen_random_uuid(),
 enabled boolean not null default true,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
alter table public.trust_pages enable row level security;
revoke all on public.trust_pages from public, anon, authenticated;
grant select on public.trust_pages to authenticated;
create policy trust_pages_owner_select on public.trust_pages for select to authenticated using ((select auth.uid()) = user_id);

-- Owner: turn the page on or off, or replace its link.
create or replace function public.set_trust_page(p_enabled boolean, p_new_link boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 page public.trust_pages;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 insert into public.trust_pages (user_id, enabled) values (uid, coalesce(p_enabled, false))
 on conflict (user_id) do update set enabled = coalesce(p_enabled, false),
  slug = case when p_new_link then gen_random_uuid() else public.trust_pages.slug end, updated_at = clock_timestamp()
 returning * into page;
 return jsonb_build_object('slug', page.slug, 'enabled', page.enabled);
end $$;
revoke all on function public.set_trust_page(boolean, boolean) from public, anon;
grant execute on function public.set_trust_page(boolean, boolean) to authenticated;

-- The confirmed facts of one user (internal: used by the public page and the owner's preview).
-- A reviewed claim counts only while its record is unchanged since the review.
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
     -- A passed CareerForge check (latest pass per skill), else a reviewed proof.
     select distinct on (lower(x.name)) x.name, jsonb_build_object('skill', x.name, 'method', x.method, 'checkedAt', x.checked_at) as item
     from (
      select a.skill as name, 'check' as method, a.taken_at as checked_at, 1 as rank from public.skill_check_attempts a where a.user_id = p_uid and a.passed
      union all
      select c.skill, 'reviewed', c.decided_at, 2 from public.claims c where c.user_id = p_uid and c.kind = 'skill' and c.status = 'reviewed'
     ) x
     order by lower(x.name), x.rank, x.checked_at desc
    ) s), '[]'::jsonb),
  'projects', coalesce((select jsonb_agg(jsonb_build_object('repository', i.repo_owner || '/' || i.repo_name, 'method', 'interview', 'checkedAt', i.decided_at) order by i.decided_at desc)
    from public.project_interviews i where i.user_id = p_uid and i.status = 'approved'), '[]'::jsonb)
 )
 from public.profiles p where p.id = p_uid
$$;
revoke all on function public.careerforge_confirmed_facts(uuid) from public, anon, authenticated;

-- Anyone with the link: the confirmed facts, or null when the page is off or unknown.
create or replace function public.get_trust_page(p_slug uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
 select public.careerforge_confirmed_facts(t.user_id) || jsonb_build_object('updatedAt', clock_timestamp())
 from public.trust_pages t where t.slug = p_slug and t.enabled
$$;
revoke all on function public.get_trust_page(uuid) from public;
grant execute on function public.get_trust_page(uuid) to anon, authenticated;

-- Owner: the same facts, to preview exactly what the page shows.
create or replace function public.my_confirmed_facts()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 return public.careerforge_confirmed_facts(auth.uid());
end $$;
revoke all on function public.my_confirmed_facts() from public, anon;
grant execute on function public.my_confirmed_facts() to authenticated;

-- Published portfolio sites link to the owner's trust page when it is on.
create or replace function public.get_public_portfolio_site(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('site', s.published, 'publishedAt', s.published_at,
    'trustSlug', (select t.slug from public.trust_pages t where t.user_id = s.user_id and t.enabled))
    from public.portfolio_sites s
   where s.slug = lower(p_slug) and s.is_public;
$$;
