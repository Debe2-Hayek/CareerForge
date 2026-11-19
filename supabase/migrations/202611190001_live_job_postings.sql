-- Live job listings share the catalog so saving, tracking and learning plans
-- keep working. Fictional seeds keep their IDs; live rows are traceable to a
-- permitted source, deduplicated on (source, external_id) and hidden once they
-- expire or become stale. Only server-side ingestion with database credentials
-- writes this table; signed-in users can still only read it.

alter table public.job_postings
  add column source text not null default 'fictional',
  add column source_board text,
  add column external_id text,
  add column source_url text,
  add column apply_url text,
  add column region text,
  add column seniority text,
  add column salary_text text,
  add column published_at timestamptz,
  add column expires_at timestamptz,
  add column fetched_at timestamptz;

alter table public.job_postings
  drop constraint job_postings_employment_type_check,
  drop constraint job_postings_work_mode_check,
  drop constraint job_postings_skills_check;

alter table public.job_postings
  add constraint job_postings_employment_type_check check (employment_type in ('Full-time', 'Part-time', 'Internship', 'Contract', 'Temporary', 'Not specified')),
  add constraint job_postings_work_mode_check check (work_mode in ('Remote', 'Hybrid', 'On-site', 'Not specified')),
  add constraint job_postings_skills_check check (
    cardinality(skills) <= 40 and array_position(skills, null) is null and char_length(array_to_string(skills, ',')) <= 2400
    and (source <> 'fictional' or cardinality(skills) >= 1)
  ),
  add constraint job_postings_source_check check (source in ('fictional', 'himalayas', 'greenhouse', 'workable')),
  add constraint job_postings_region_check check (region is null or region in ('lebanon', 'mena', 'worldwide', 'international')),
  add constraint job_postings_live_fields_check check (
    (source = 'fictional' and is_fictional and external_id is null and source_url is null and apply_url is null and fetched_at is null)
    or (source <> 'fictional' and not is_fictional and region is not null and fetched_at is not null
      and external_id is not null and char_length(external_id) between 1 and 200
      and source_url ~ '^https://' and char_length(source_url) <= 2000
      and apply_url ~ '^https://' and char_length(apply_url) <= 2000)
  ),
  add constraint job_postings_source_board_check check (source_board is null or source_board ~ '^[a-z0-9-]{1,80}$'),
  add constraint job_postings_seniority_check check (seniority is null or char_length(seniority) between 1 and 120),
  add constraint job_postings_salary_check check (salary_text is null or char_length(salary_text) between 1 and 120);

create unique index job_postings_source_external_idx on public.job_postings(source, external_id) where external_id is not null;
create index job_postings_live_visible_idx on public.job_postings(region, published_at desc) where source <> 'fictional' and is_active;

-- A live listing is visible only while active, unexpired and refreshed within
-- seven days. Owners keep seeing roles they saved so their tracker history stays.
create function public.careerforge_job_is_current(job public.job_postings)
returns boolean language sql stable security invoker set search_path = '' as $$
  select job.is_active and (job.source = 'fictional' or (
    (job.expires_at is null or job.expires_at > now()) and job.fetched_at > now() - interval '7 days'
  ));
$$;
revoke all on function public.careerforge_job_is_current(public.job_postings) from public, anon;
grant execute on function public.careerforge_job_is_current(public.job_postings) to authenticated;

drop policy job_postings_visible on public.job_postings;
create policy job_postings_visible on public.job_postings for select to authenticated using (
  public.careerforge_job_is_current(job_postings)
  or exists (select 1 from public.saved_jobs s where s.job_id = job_postings.id and s.user_id = (select auth.uid()))
);

create or replace function public.careerforge_guard_saved_job()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.job_postings j where j.id = new.job_id and public.careerforge_job_is_current(j)) then
    raise exception 'Job is unavailable for saving' using errcode = '23514';
  end if;
  return new;
end;
$$;

notify pgrst, 'reload schema';
