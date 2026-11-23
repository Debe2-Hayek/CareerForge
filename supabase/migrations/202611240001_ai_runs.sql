-- AI usage ledger: per-user daily limits, a global daily ceiling, a 30-day
-- result cache and the prompt/model audit trail required by report 15.2/15.4.
-- Clients get no table privileges; the server calls the RPCs below with the
-- signed-in user's session, so auth.uid() always identifies the owner.
create table public.ai_runs (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 feature text not null check (feature in ('profile_autofill', 'document_generate')),
 input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
 prompt_version text not null check (prompt_version ~ '^[a-z0-9._-]{1,40}$'),
 model text check (model is null or model ~ '^[A-Za-z0-9._:-]{1,80}$'),
 status text not null default 'pending' check (status in ('pending', 'complete', 'failed')),
 output jsonb check (output is null or octet_length(output::text) <= 65536),
 created_at timestamptz not null default clock_timestamp(),
 finished_at timestamptz
);
create index ai_runs_owner_window_idx on public.ai_runs (user_id, feature, created_at desc);
create index ai_runs_cache_idx on public.ai_runs (user_id, feature, input_hash, prompt_version) where status = 'complete';
create index ai_runs_global_window_idx on public.ai_runs (created_at);

alter table public.ai_runs enable row level security;
revoke all on public.ai_runs from public, anon, authenticated;

-- Reserve one AI call, or return a cached result for the same input.
-- Limits are fixed here, never caller-supplied: a client calling this RPC
-- directly can only spend its own allowance.
create or replace function public.reserve_ai_run(p_feature text, p_input_hash text, p_prompt_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 user_limit integer;
 global_limit constant integer := 150;
 used integer;
 global_used integer;
 oldest timestamptz;
 cached jsonb;
 run_id uuid;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 user_limit := case p_feature when 'profile_autofill' then 5 when 'document_generate' then 5 end;
 if user_limit is null or p_input_hash !~ '^[0-9a-f]{64}$' or p_prompt_version !~ '^[a-z0-9._-]{1,40}$' then
  raise exception 'Invalid AI run' using errcode = '22023';
 end if;
 -- One reservation per user at a time, so parallel requests cannot overshoot.
 perform pg_advisory_xact_lock(hashtextextended('careerforge.ai_runs:' || uid::text, 0));
 delete from public.ai_runs where user_id = uid and created_at < clock_timestamp() - interval '30 days';

 select r.output into cached from public.ai_runs r
  where r.user_id = uid and r.feature = p_feature and r.input_hash = p_input_hash
   and r.prompt_version = p_prompt_version and r.status = 'complete'
  order by r.created_at desc limit 1;
 if cached is not null then return jsonb_build_object('status', 'cached', 'output', cached); end if;

 select count(*), min(r.created_at) into used, oldest from public.ai_runs r
  where r.user_id = uid and r.feature = p_feature and r.created_at > clock_timestamp() - interval '24 hours';
 if used >= user_limit then
  return jsonb_build_object('status', 'limited', 'retryAfter',
   greatest(60, ceil(extract(epoch from (oldest + interval '24 hours' - clock_timestamp())))::integer));
 end if;

 perform pg_advisory_xact_lock(hashtextextended('careerforge.ai_runs:global', 0));
 select count(*) into global_used from public.ai_runs r where r.created_at > clock_timestamp() - interval '24 hours';
 if global_used >= global_limit then return jsonb_build_object('status', 'busy'); end if;

 insert into public.ai_runs (user_id, feature, input_hash, prompt_version)
  values (uid, p_feature, p_input_hash, p_prompt_version) returning id into run_id;
 return jsonb_build_object('status', 'reserved', 'runId', run_id, 'remaining', user_limit - used - 1);
end $$;
revoke all on function public.reserve_ai_run(text, text, text) from public, anon;
grant execute on function public.reserve_ai_run(text, text, text) to authenticated;

-- Finish the caller's own pending run. A failed run still counts toward the
-- limit, so retries after errors cannot drain the provider balance.
create or replace function public.finish_ai_run(p_run_id uuid, p_model text, p_output jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 update public.ai_runs set
  status = case when p_output is null then 'failed' else 'complete' end,
  model = p_model, output = p_output, finished_at = clock_timestamp()
 where id = p_run_id and user_id = auth.uid() and status = 'pending';
 if not found then raise exception 'AI run not found' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.finish_ai_run(uuid, text, jsonb) from public, anon;
grant execute on function public.finish_ai_run(uuid, text, jsonb) to authenticated;
