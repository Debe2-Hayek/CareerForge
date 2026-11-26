-- Assistant chats saved to the account, like ChatGPT or Claude: they stay after signing out and appear on
-- every device. Only the owner can read them; writes go through the functions below. The server saves the
-- question and its answer together after each reply, so an answer that arrives after the page closed is
-- still there later. Up to 200 chats per person (the oldest fall off), 80 messages per chat.

create table public.assistant_chats (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (char_length(btrim(title)) between 1 and 120),
 messages jsonb not null default '[]'::jsonb
  check (jsonb_typeof(messages) = 'array' and jsonb_array_length(messages) <= 80 and pg_column_size(messages) <= 400000),
 created_at timestamptz not null default clock_timestamp(),
 updated_at timestamptz not null default clock_timestamp()
);
create index assistant_chats_user_updated on public.assistant_chats (user_id, updated_at desc);
alter table public.assistant_chats enable row level security;
revoke all on public.assistant_chats from public, anon, authenticated;
grant select on public.assistant_chats to authenticated;
create policy assistant_chats_owner_select on public.assistant_chats for select to authenticated
 using ((select auth.uid()) = user_id);

-- One question and its answer, appended to the chat (created on first use). Messages are checked here too.
create or replace function public.append_assistant_chat(p_id uuid, p_title text, p_messages jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 v_owner uuid;
 v_all jsonb;
 v_title text := left(btrim(coalesce(p_title, '')), 120);
 v_item jsonb;
begin
 if uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if p_id is null or jsonb_typeof(p_messages) is distinct from 'array' or jsonb_array_length(p_messages) not between 1 and 4 then
  raise exception 'Invalid chat' using errcode = '22023';
 end if;
 for v_item in select value from jsonb_array_elements(p_messages) loop
  if jsonb_typeof(v_item) <> 'object' or (v_item ->> 'role') not in ('user', 'assistant')
   or jsonb_typeof(v_item -> 'content') <> 'string' or char_length(v_item ->> 'content') not between 1 and 8000
   or exists (select 1 from jsonb_object_keys(v_item) k where k not in ('role', 'content', 'test')) then
   raise exception 'Invalid chat message' using errcode = '22023';
  end if;
 end loop;
 if v_title = '' then v_title := 'New chat'; end if;
 perform pg_advisory_xact_lock(hashtextextended('careerforge.assistant_chats:' || uid::text, 0));
 select c.user_id, c.messages into v_owner, v_all from public.assistant_chats c where c.id = p_id;
 if v_owner is not null and v_owner <> uid then raise exception 'Not your chat' using errcode = '42501'; end if;
 if v_owner is null then
  insert into public.assistant_chats (id, user_id, title, messages) values (p_id, uid, v_title, p_messages);
  delete from public.assistant_chats c where c.id in (
   select o.id from public.assistant_chats o where o.user_id = uid order by o.updated_at desc offset 200);
 else
  v_all := v_all || p_messages;
  select coalesce(jsonb_agg(t.value order by t.ordinality), '[]'::jsonb) into v_all
   from jsonb_array_elements(v_all) with ordinality t where t.ordinality > jsonb_array_length(v_all) - 80;
  update public.assistant_chats c set messages = v_all, updated_at = clock_timestamp() where c.id = p_id;
 end if;
end $$;

create or replace function public.rename_assistant_chat(p_id uuid, p_title text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_title text := btrim(coalesce(p_title, ''));
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 if char_length(v_title) not between 1 and 120 then raise exception 'Invalid title' using errcode = '22023'; end if;
 update public.assistant_chats c set title = v_title where c.id = p_id and c.user_id = auth.uid();
 if not found then raise exception 'Chat not found' using errcode = 'P0002'; end if;
end $$;

-- Deletes one chat, or every chat of the person when p_id is null.
create or replace function public.delete_assistant_chats(p_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare removed integer;
begin
 if auth.uid() is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
 delete from public.assistant_chats c where c.user_id = auth.uid() and (p_id is null or c.id = p_id);
 get diagnostics removed = row_count;
 return removed;
end $$;

revoke all on function public.append_assistant_chat(uuid, text, jsonb) from public, anon;
revoke all on function public.rename_assistant_chat(uuid, text) from public, anon;
revoke all on function public.delete_assistant_chats(uuid) from public, anon;
grant execute on function public.append_assistant_chat(uuid, text, jsonb) to authenticated;
grant execute on function public.rename_assistant_chat(uuid, text) to authenticated;
grant execute on function public.delete_assistant_chats(uuid) to authenticated;
