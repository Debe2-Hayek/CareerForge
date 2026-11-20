-- Private product feedback and privacy-minimized diagnostic signals.
-- Public functions expose counts only; owner ids and free-text reports remain private.
create table public.roadmap_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 node_id text not null check (node_id ~ '^[a-z0-9-]{1,120}$'),
 kind text not null check (kind in ('upvote', 'friction')),
 summary text,
 created_on date not null default (timezone('utc', clock_timestamp())::date),
 created_at timestamptz not null default clock_timestamp(),
 constraint roadmap_feedback_summary_valid check (
  (kind = 'upvote' and summary is null) or
  (kind = 'friction' and char_length(btrim(summary)) between 8 and 500)
 )
);
create unique index roadmap_feedback_one_upvote_per_owner
 on public.roadmap_feedback(user_id, node_id) where kind = 'upvote';
create unique index roadmap_feedback_one_friction_per_owner_node_day
 on public.roadmap_feedback(user_id, node_id, created_on) where kind = 'friction';
create index roadmap_feedback_node_kind on public.roadmap_feedback(node_id, kind);

create table public.diagnostic_snapshots (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 fingerprint text not null check (fingerprint ~ '^[a-f0-9]{8,64}$'),
 kind text not null check (kind in ('ui-error', 'promise-rejection', 'api-error', 'slow-api', 'not-found', 'rage-click', 'empty-search', 'abandoned-flow')),
 route text not null check (char_length(route) between 1 and 160 and left(route, 1) = '/' and position('?' in route) = 0 and position('#' in route) = 0),
 label text not null check (char_length(label) between 1 and 80 and label ~ '^[A-Za-z0-9 .:/_-]+$'),
 duration_ms integer check (duration_ms between 0 and 120000),
 occurrences integer not null default 1 check (occurrences between 1 and 1000000),
 first_seen timestamptz not null default clock_timestamp(),
 last_seen timestamptz not null default clock_timestamp(),
 unique (user_id, fingerprint)
);
create index diagnostic_snapshots_priority on public.diagnostic_snapshots(kind, last_seen desc);

alter table public.roadmap_feedback enable row level security;
alter table public.diagnostic_snapshots enable row level security;
revoke all on public.roadmap_feedback, public.diagnostic_snapshots from public, anon, authenticated;
grant select, delete on public.roadmap_feedback to authenticated;
grant select, delete on public.diagnostic_snapshots to authenticated;

create policy roadmap_feedback_owner_select on public.roadmap_feedback for select to authenticated using ((select auth.uid()) = user_id);
create policy roadmap_feedback_owner_delete on public.roadmap_feedback for delete to authenticated using ((select auth.uid()) = user_id);
create policy diagnostic_snapshots_owner_select on public.diagnostic_snapshots for select to authenticated using ((select auth.uid()) = user_id);
create policy diagnostic_snapshots_owner_delete on public.diagnostic_snapshots for delete to authenticated using ((select auth.uid()) = user_id);

-- Bind the owner server-side and admit only curated product nodes. Direct table
-- inserts stay revoked so a signed-in client cannot poison public aggregates.
create function public.record_roadmap_feedback(
 p_node_id text, p_kind text, p_summary text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
 if owner_id is null then raise insufficient_privilege; end if;
 if p_node_id not in (
  'private-profile-foundation',
  'evidence-skill-checks',
  'application-tracker',
  'product-roadmap-experience',
  'self-diagnosing-signals',
  'autonomous-evolution-prs',
  'live-job-source',
  'public-email-delivery',
  'reviewed-claim-evidence'
 ) then raise invalid_parameter_value; end if;

 if p_kind = 'upvote' then
  if p_summary is not null then raise invalid_parameter_value; end if;
  insert into public.roadmap_feedback(user_id, node_id, kind, summary)
  values (owner_id, p_node_id, 'upvote', null)
  on conflict (user_id, node_id) where kind = 'upvote' do nothing;
 elsif p_kind = 'friction' then
  if p_summary is null or char_length(btrim(p_summary)) not between 8 and 500 then
   raise invalid_parameter_value;
  end if;
  insert into public.roadmap_feedback(user_id, node_id, kind, summary)
  values (owner_id, p_node_id, 'friction', btrim(p_summary))
  on conflict (user_id, node_id, created_on) where kind = 'friction' do update set
   summary = excluded.summary,
   created_at = clock_timestamp();
 else
  raise invalid_parameter_value;
 end if;
end;
$$;
revoke all on function public.record_roadmap_feedback(text, text, text) from public, anon;
grant execute on function public.record_roadmap_feedback(text, text, text) to authenticated;

create function public.record_diagnostic_snapshot(
 p_fingerprint text, p_kind text, p_route text, p_label text, p_duration_ms integer default null
) returns void language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
 if owner_id is null then raise insufficient_privilege; end if;
 if p_fingerprint !~ '^[a-f0-9]{8,64}$'
  or p_kind not in ('ui-error', 'promise-rejection', 'api-error', 'slow-api', 'not-found', 'rage-click', 'empty-search', 'abandoned-flow')
  or char_length(p_route) not between 1 and 160 or left(p_route, 1) <> '/' or position('?' in p_route) > 0 or position('#' in p_route) > 0
  or char_length(p_label) not between 1 and 80 or p_label !~ '^[A-Za-z0-9 .:/_-]+$'
  or (p_duration_ms is not null and p_duration_ms not between 0 and 120000) then raise invalid_parameter_value; end if;
 if not exists (
  select 1 from public.diagnostic_snapshots
  where user_id = owner_id and fingerprint = p_fingerprint
 ) and (
  select count(*) from public.diagnostic_snapshots where user_id = owner_id
 ) >= 250 then raise program_limit_exceeded; end if;
 insert into public.diagnostic_snapshots(user_id, fingerprint, kind, route, label, duration_ms)
 values (owner_id, p_fingerprint, p_kind, p_route, p_label, p_duration_ms)
 on conflict (user_id, fingerprint) do update set
  occurrences = least(public.diagnostic_snapshots.occurrences + 1, 1000000),
  duration_ms = greatest(public.diagnostic_snapshots.duration_ms, excluded.duration_ms),
  last_seen = clock_timestamp();
end;
$$;
revoke all on function public.record_diagnostic_snapshot(text, text, text, text, integer) from public, anon;
grant execute on function public.record_diagnostic_snapshot(text, text, text, text, integer) to authenticated;

create function public.roadmap_feedback_counts()
returns table(node_id text, upvotes bigint, friction_reports bigint)
language sql stable security definer set search_path = '' as $$
 select feedback.node_id,
  count(*) filter (where feedback.kind = 'upvote') as upvotes,
  count(*) filter (where feedback.kind = 'friction') as friction_reports
 from public.roadmap_feedback feedback group by feedback.node_id;
$$;
revoke all on function public.roadmap_feedback_counts() from public;
grant execute on function public.roadmap_feedback_counts() to anon, authenticated;

create function public.diagnostic_signal_summary()
returns table(fingerprint text, kind text, route text, label text, occurrences bigint, affected_users bigint, max_duration_ms integer, last_seen timestamptz)
language sql stable security definer set search_path = '' as $$
 select snapshot.fingerprint, snapshot.kind, snapshot.route, snapshot.label,
  sum(snapshot.occurrences)::bigint, count(distinct snapshot.user_id)::bigint,
  max(snapshot.duration_ms), max(snapshot.last_seen)
 from public.diagnostic_snapshots snapshot
 group by snapshot.fingerprint, snapshot.kind, snapshot.route, snapshot.label
 having count(distinct snapshot.user_id) >= 3;
$$;
revoke all on function public.diagnostic_signal_summary() from public;
grant execute on function public.diagnostic_signal_summary() to anon, authenticated;
notify pgrst, 'reload schema';
