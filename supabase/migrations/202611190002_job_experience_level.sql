-- Deterministic experience level for live listings (internship/entry/mid/senior/lead),
-- inferred at import from the title, explicitly requested years and the source tag.
-- `seniority` keeps the short display label. Fictional demo roles are entry level.
alter table public.job_postings
  add column if not exists experience_level text;

alter table public.job_postings
  drop constraint if exists job_postings_experience_level_check;
alter table public.job_postings
  add constraint job_postings_experience_level_check
  check (experience_level is null or experience_level in ('internship', 'entry', 'mid', 'senior', 'lead'));

update public.job_postings set experience_level = 'entry' where source = 'fictional' and experience_level is null;
