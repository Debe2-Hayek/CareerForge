-- Owner-only workshop bookmarks. Workshops are versioned content or external
-- calendar entries held by the application, so only their stable id is stored.
-- A bookmark outlives an event that has ended: it may return with a recording.
create table public.workshop_bookmarks (
 user_id uuid not null references auth.users(id) on delete cascade,
 workshop_id text not null check (workshop_id ~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$'),
 created_at timestamptz not null default clock_timestamp(),
 -- One row per owner and workshop: saving twice cannot duplicate.
 primary key (user_id, workshop_id)
);

-- Server-maintained time and a bounded list per owner.
create or replace function public.careerforge_workshop_bookmark_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
 new.created_at := clock_timestamp();
 if (select count(*) from public.workshop_bookmarks where user_id = new.user_id) >= 300 then
  raise exception 'Too many saved workshops' using errcode = '23514';
 end if;
 return new;
end $$;
revoke all on function public.careerforge_workshop_bookmark_guard() from public, anon, authenticated;
create trigger workshop_bookmarks_guard before insert on public.workshop_bookmarks
 for each row execute function public.careerforge_workshop_bookmark_guard();

alter table public.workshop_bookmarks enable row level security;
revoke all on public.workshop_bookmarks from public, anon, authenticated;
grant select, delete on public.workshop_bookmarks to authenticated;
grant insert (user_id, workshop_id) on public.workshop_bookmarks to authenticated;

create policy workshop_bookmarks_owner_select on public.workshop_bookmarks for select to authenticated using ((select auth.uid()) = user_id);
create policy workshop_bookmarks_owner_insert on public.workshop_bookmarks for insert to authenticated with check ((select auth.uid()) = user_id);
create policy workshop_bookmarks_owner_delete on public.workshop_bookmarks for delete to authenticated using ((select auth.uid()) = user_id);
