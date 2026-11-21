-- Saved drafts and published websites for the visual CV & Portfolio builder.
-- Owners read only their own row; every write goes through the reviewed
-- functions below. The public snapshot is derived from the saved draft inside
-- the database (private notes and CV-only settings removed), so a client can
-- never publish arbitrary JSON. The application re-validates snapshots before
-- rendering them.
create table public.portfolio_sites (
 user_id uuid primary key references auth.users(id) on delete cascade,
 draft jsonb not null check (jsonb_typeof(draft) = 'object' and pg_column_size(draft) <= 1500000),
 revision uuid not null default gen_random_uuid(),
 slug text unique check (slug is null or (char_length(slug) between 3 and 40 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')),
 published jsonb check (published is null or (jsonb_typeof(published) = 'object' and pg_column_size(published) <= 1500000)),
 published_revision uuid,
 is_public boolean not null default false,
 published_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp(),
 constraint portfolio_sites_public_snapshot check (not is_public or (published is not null and slug is not null and published_at is not null))
);

alter table public.portfolio_sites enable row level security;
revoke all on public.portfolio_sites from public, anon, authenticated;
grant select on public.portfolio_sites to authenticated;
create policy portfolio_sites_owner_read on public.portfolio_sites for select to authenticated using ((select auth.uid()) = user_id);

-- Volatile (not stable) so callers below always read the row they just wrote.
create function public.get_portfolio_site() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); item public.portfolio_sites;
begin
  if owner_id is null then raise insufficient_privilege; end if;
  select * into item from public.portfolio_sites where user_id = owner_id;
  if not found then
    return jsonb_build_object('draft', null, 'revision', null, 'slug', null, 'isPublic', false, 'publishedAt', null, 'hasUnpublishedChanges', false);
  end if;
  return jsonb_build_object('draft', item.draft, 'revision', item.revision, 'slug', item.slug,
    'isPublic', item.is_public, 'publishedAt', item.published_at,
    'hasUnpublishedChanges', item.is_public and item.published_revision is distinct from item.revision);
end $$;

-- Optimistic concurrency: the caller must send the revision it last saw
-- (null for a first save). A stale revision returns {conflict: true}.
create function public.save_portfolio_site(p_draft jsonb, p_revision uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); current_revision uuid;
begin
  if owner_id is null then raise insufficient_privilege; end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise invalid_parameter_value; end if;
  select revision into current_revision from public.portfolio_sites where user_id = owner_id for update;
  if not found then
    if p_revision is not null then return jsonb_build_object('conflict', true); end if;
    insert into public.portfolio_sites (user_id, draft) values (owner_id, p_draft);
  elsif current_revision is distinct from p_revision then
    return jsonb_build_object('conflict', true);
  else
    update public.portfolio_sites set draft = p_draft, revision = gen_random_uuid(), updated_at = clock_timestamp()
     where user_id = owner_id;
  end if;
  return public.get_portfolio_site();
end $$;

create function public.publish_portfolio_site(p_slug text, p_revision uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); item public.portfolio_sites;
begin
  if owner_id is null then raise insufficient_privilege; end if;
  if p_slug is null or char_length(p_slug) not between 3 and 40 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise invalid_parameter_value; end if;
  select * into item from public.portfolio_sites where user_id = owner_id for update;
  if not found or item.revision is distinct from p_revision then return jsonb_build_object('conflict', true); end if;
  begin
    update public.portfolio_sites
       set slug = p_slug,
           published = item.draft - 'notes' - 'cvPhoto' - 'cvStyle',
           published_revision = item.revision,
           is_public = true,
           published_at = clock_timestamp(),
           updated_at = clock_timestamp()
     where user_id = owner_id;
  exception when unique_violation then
    return jsonb_build_object('slugTaken', true);
  end;
  return public.get_portfolio_site();
end $$;

-- Unpublishing removes the public snapshot immediately; the address stays reserved for the owner.
create function public.unpublish_portfolio_site() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise insufficient_privilege; end if;
  update public.portfolio_sites set is_public = false, published = null, published_revision = null,
         published_at = null, updated_at = clock_timestamp()
   where user_id = owner_id;
  return public.get_portfolio_site();
end $$;

create function public.get_public_portfolio_site(p_slug text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('site', s.published, 'publishedAt', s.published_at)
    from public.portfolio_sites s
   where s.slug = lower(p_slug) and s.is_public;
$$;

revoke all on function public.get_portfolio_site(), public.save_portfolio_site(jsonb, uuid),
  public.publish_portfolio_site(text, uuid), public.unpublish_portfolio_site(),
  public.get_public_portfolio_site(text) from public, anon, authenticated;
grant execute on function public.get_portfolio_site(), public.save_portfolio_site(jsonb, uuid),
  public.publish_portfolio_site(text, uuid), public.unpublish_portfolio_site() to authenticated;
grant execute on function public.get_public_portfolio_site(text) to anon, authenticated;
