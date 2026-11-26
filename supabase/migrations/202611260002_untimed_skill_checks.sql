-- Skill checks without a clock, as part of verification. A passed check is CareerForge's own
-- confirmation of a skill (the "Verified" level), so fairness now comes from the attempt itself:
--  * no timer: an attempt stays open until it is submitted or ended; abandoned ones lapse after 24 hours;
--  * every attempt shows the questions, and each question's options, in a new random order; the browser
--    answers in that order and the server maps the answers back before grading;
--  * after a failed attempt the same skill can be taken again only after 24 hours;
--  * a skill can be added to the profile and its check started in one step.
-- Earlier timed sessions and their results are kept unchanged.

alter table public.skill_check_sessions drop constraint skill_check_session_deadline;
alter table public.skill_check_sessions drop constraint skill_check_sessions_timing_mode_check;
alter table public.skill_check_sessions add constraint skill_check_sessions_timing_mode_check
 check (timing_mode in ('standard', 'extended', 'untimed'));
alter table public.skill_check_sessions add constraint skill_check_session_deadline check (
 deadline_at = started_at + case timing_mode when 'standard' then interval '600 seconds' when 'extended' then interval '6000 seconds' else interval '24 hours' end);
-- The order shown in this attempt: bank question positions, and for each shown question its options.
alter table public.skill_check_sessions add column question_order integer[];
alter table public.skill_check_sessions add column option_orders jsonb;
alter table public.skill_check_sessions add constraint skill_check_session_order check (
 (question_order is null and option_orders is null)
 or (cardinality(question_order) between 1 and 20 and jsonb_typeof(option_orders) = 'array' and jsonb_array_length(option_orders) = cardinality(question_order)));

-- The attempt as the browser sees it: questions (never answers) in this attempt's order.
create or replace function careerforge_internal.skill_check_attempt_payload(p_session public.skill_check_sessions, p_now timestamptz)
returns jsonb language sql stable set search_path = '' as $$
 select jsonb_build_object(
  'id', p_session.id, 'skill', p_session.skill, 'version', p_session.version,
  'timingMode', p_session.timing_mode, 'startedAt', p_session.started_at, 'deadlineAt', p_session.deadline_at,
  'state', case when p_session.state = 'active' and p_session.deadline_at <= p_now then 'expired' else p_session.state end,
  'serverNow', p_now,
  'questions', coalesce((
   select jsonb_agg(jsonb_build_object(
     'id', q->>'id', 'prompt', q->>'prompt',
     'options', (select jsonb_agg(q->'options'->((o.value)::int) order by o.ordinality)
                 from jsonb_array_elements_text(coalesce(p_session.option_orders->(pos.ordinality::int - 1), '[0,1,2]'::jsonb)) with ordinality o)
    ) order by pos.ordinality)
   from unnest(coalesce(p_session.question_order, array[0, 1, 2, 3, 4])) with ordinality pos(idx, ordinality)
   join careerforge_internal.skill_check_banks b on b.skill = p_session.skill and b.version = p_session.version
   cross join lateral (select b.questions->pos.idx as q) picked
   where picked.q is not null), '[]'::jsonb)
 );
$$;
revoke all on function careerforge_internal.skill_check_attempt_payload(public.skill_check_sessions, timestamptz) from public, anon, authenticated;

create or replace function public.current_skill_check_session() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid(); session_row public.skill_check_sessions;
begin
 if owner_id is null then raise insufficient_privilege; end if;
 select * into session_row from public.skill_check_sessions where user_id = owner_id and state = 'active' order by started_at desc limit 1;
 if not found then return jsonb_build_object('session', null); end if;
 return jsonb_build_object('session', careerforge_internal.skill_check_attempt_payload(session_row, clock_timestamp()));
end $$;

-- Start (or resume) the check for a skill. p_add_to_profile adds the skill to the profile first.
create or replace function public.start_untimed_skill_check(p_skill text, p_add_to_profile boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 owner_id uuid := auth.uid(); session_row public.skill_check_sessions; bank careerforge_internal.skill_check_banks;
 checked_at timestamptz; latest timestamptz; last_fail timestamptz; last_pass timestamptz; v_count integer; v_qorder integer[]; v_oorders jsonb;
begin
 if owner_id is null then raise insufficient_privilege; end if;
 if p_skill is null or char_length(btrim(p_skill)) not between 1 and 60 then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;
 select * into bank from careerforge_internal.skill_check_banks where lower(skill) = lower(btrim(p_skill)) order by version desc limit 1;
 if not found then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;

 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 76211));
 if not exists (select 1 from public.profiles p, unnest(p.self_reported_skills) s where p.id = owner_id and lower(btrim(s)) = lower(bank.skill)) then
  if not coalesce(p_add_to_profile, false) then return jsonb_build_object('skillNotSelected', true); end if;
  if (select cardinality(coalesce(self_reported_skills, '{}')) from public.profiles where id = owner_id) >= 40 then return jsonb_build_object('profileFull', true); end if;
  update public.profiles set self_reported_skills = array_append(coalesce(self_reported_skills, '{}'), bank.skill) where id = owner_id;
 end if;

 checked_at := clock_timestamp();
 update public.skill_check_sessions set state = 'expired', finished_at = checked_at where user_id = owner_id and state = 'active' and deadline_at <= checked_at;
 select * into session_row from public.skill_check_sessions where user_id = owner_id and state = 'active' for update;
 if found then
  if lower(session_row.skill) = lower(bank.skill) then return jsonb_build_object('session', careerforge_internal.skill_check_attempt_payload(session_row, checked_at)); end if;
  return jsonb_build_object('conflict', true, 'activeSkill', session_row.skill);
 end if;

 -- 24 hours after a failed attempt at this skill (unless a later attempt passed).
 select max(taken_at) filter (where not passed), max(taken_at) filter (where passed) into last_fail, last_pass
  from public.skill_check_attempts where user_id = owner_id and lower(skill) = lower(bank.skill);
 if last_fail is not null and (last_pass is null or last_pass < last_fail) and last_fail > checked_at - interval '24 hours' then
  return jsonb_build_object('cooldown', true, 'retryAt', last_fail + interval '24 hours');
 end if;
 select max(event_time) into latest from (
  select started_at as event_time from public.skill_check_sessions where user_id = owner_id
  union all select taken_at from public.skill_check_attempts where user_id = owner_id) events;
 if latest > checked_at - interval '60 seconds' then
  return jsonb_build_object('rateLimited', true, 'retryAfter', greatest(1, ceil(extract(epoch from latest + interval '60 seconds' - checked_at))::integer));
 end if;

 v_count := jsonb_array_length(bank.questions);
 select array_agg(i order by random()) into v_qorder from generate_series(0, v_count - 1) i;
 -- Each question gets its own option order (the inner query refers to n, so it runs once per question).
 select jsonb_agg((select jsonb_agg(o order by random()) from generate_series(0, 2) o where n > 0) order by n) into v_oorders from generate_series(1, v_count) n;
 insert into public.skill_check_sessions(user_id, skill, version, timing_mode, started_at, deadline_at, question_order, option_orders)
  values(owner_id, bank.skill, bank.version, 'untimed', checked_at, checked_at + interval '24 hours', v_qorder, v_oorders)
  returning * into session_row;
 return jsonb_build_object('session', careerforge_internal.skill_check_attempt_payload(session_row, checked_at));
end $$;

-- Grade an attempt. Answers are option positions as shown in this attempt; they are mapped back here.
create or replace function public.submit_untimed_skill_check(p_session_id uuid, p_answers jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
 owner_id uuid := auth.uid(); session_row public.skill_check_sessions; bank careerforge_internal.skill_check_banks;
 result public.skill_check_attempts; checked_at timestamptz; latest timestamptz; points integer := 0; k integer; q jsonb; given text; original text;
begin
 if owner_id is null then raise insufficient_privilege; end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 76211));
 select * into session_row from public.skill_check_sessions where id = p_session_id and user_id = owner_id for update;
 if not found then return jsonb_build_object('notFound', true); end if;
 if session_row.state = 'submitted' then
  -- A lost reply can be retried: the same result comes back, never a second grade.
  select * into result from public.skill_check_attempts where id = session_row.result_id and user_id = owner_id;
 else
  checked_at := clock_timestamp();
  if session_row.state = 'expired' or (session_row.state = 'active' and session_row.deadline_at <= checked_at) then
   if session_row.state = 'active' then update public.skill_check_sessions set state = 'expired', finished_at = checked_at where id = session_row.id; end if;
   return jsonb_build_object('expired', true);
  end if;
  if session_row.state <> 'active' then return jsonb_build_object('notFound', true); end if;
  select * into bank from careerforge_internal.skill_check_banks where skill = session_row.skill and version = session_row.version;
  if not found then
   update public.skill_check_sessions set state = 'cancelled', finished_at = checked_at where id = session_row.id;
   return jsonb_build_object('bankChanged', true);
  end if;
  if jsonb_typeof(p_answers) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_answers)) <> jsonb_array_length(bank.questions)
   or exists (select 1 from jsonb_array_elements(bank.questions) e where jsonb_typeof(p_answers -> (e->>'id')) is distinct from 'number' or (p_answers ->> (e->>'id')) !~ '^[0-2]$')
   then raise exception 'INVALID_INPUT' using errcode = '22023'; end if;
  select max(taken_at) into latest from public.skill_check_attempts where user_id = owner_id;
  if latest > checked_at - interval '60 seconds' then
   return jsonb_build_object('rateLimited', true, 'retryAfter', greatest(1, ceil(extract(epoch from latest + interval '60 seconds' - checked_at))::integer));
  end if;
  for k in 0 .. jsonb_array_length(bank.questions) - 1 loop
   q := bank.questions -> coalesce(session_row.question_order[k + 1], k);
   given := p_answers ->> (q->>'id');
   original := coalesce(session_row.option_orders -> k ->> given::int, given);
   if original = q->>'answer' then points := points + 1; end if;
  end loop;
  insert into public.skill_check_attempts(user_id, skill, version, score, passed, taken_at)
   values(owner_id, bank.skill, bank.version, points, points >= 4, checked_at) returning * into result;
  update public.skill_check_sessions set state = 'submitted', result_id = result.id, finished_at = checked_at where id = session_row.id;
 end if;
 return jsonb_build_object('skill', result.skill, 'version', result.version, 'score', result.score, 'total', 5, 'passed', result.passed, 'takenAt', result.taken_at,
  'retryAt', case when result.passed then null else result.taken_at + interval '24 hours' end);
end $$;

revoke all on function public.start_untimed_skill_check(text, boolean) from public, anon;
revoke all on function public.submit_untimed_skill_check(uuid, jsonb) from public, anon;
grant execute on function public.start_untimed_skill_check(text, boolean) to authenticated;
grant execute on function public.submit_untimed_skill_check(uuid, jsonb) to authenticated;
-- The timed start and submit are retired, so nobody can skip the 24-hour wait or the shuffled order.
revoke all on function public.start_skill_check(text, integer, text) from public, anon, authenticated;
revoke all on function public.submit_timed_skill_check(uuid, jsonb) from public, anon, authenticated;
