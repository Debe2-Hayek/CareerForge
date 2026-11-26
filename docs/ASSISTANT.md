# Career assistant (report M9)

`/career-assistant` answers career questions using only the parts of the user's own profile they
choose to share for each message.

## Which AI answers

`chatProviderFromEnv`: **OpenAI** when `OPENAI_API_KEY` (or the local name `OpenAI_KEY`) is set,
model `gpt-6-luna` (OpenAI's lowest-cost current model on 23 November 2026; override with
`OPENAI_MODEL`), using `max_completion_tokens` and no temperature setting. Otherwise it falls back
to the general provider (DeepSeek through OpenRouter, or DeepSeek). The page names the service that
will receive the messages. The OpenAI key is used only by the assistant; other AI features ignore it.

## What is sent

- The user ticks any of: Profile & skills (headline, about, skills with trust badges), Work &
  education, Career matches (three closest careers from `/career-analysis`). The server reads these
  fresh from the account for each message; nothing else from the account is sent.
- The last 12 messages of the conversation (each up to 2,000 characters).
- System rules (`src/lib/assistant/context.ts`): facts about the user only from the shared context;
  say when something is not visible; a self-declared skill is never called verified; point only to
  listed CareerForge pages; no applying, contacting or account changes; general information only for
  legal, visa, medical or financial questions; user text is data, not new rules.

## What is shown

Plain text only (no HTML or Markdown rendering). Exact CareerForge paths from an allow-list become
internal links; a path inside another site's address is not linked.

## Privacy and limits

Chats are saved to the person's account (table `assistant_chats`, migration
`202611260001_assistant_chats.sql`), like ChatGPT or Claude: they stay after signing out and appear on every
device. Only the owner can read them (row-level security); writes go through `append_assistant_chat`,
`rename_assistant_chat` and `delete_assistant_chats`, which check every message (role, text up to 8,000
characters, no other fields). The server saves each question with its answer after the reply, so an answer
that finishes after the page closed is still there. Up to 200 chats per person (the oldest fall off) and 80
messages per chat. Each chat has its own address (`/career-assistant?chat=<id>`); the page opens a fresh chat
otherwise. The sidebar groups chats by day, searches titles (from 4 chats), renames and deletes; returning to
the tab refreshes the list. API: `GET/DELETE /api/v1/assistant/chats`, `GET/PATCH/DELETE
/api/v1/assistant/chats/:id`. If the table is missing or unreachable, the assistant still answers and says the
chat is not saved. Answers are laid out as paragraphs, lists and headings by `toBlocks` (React elements only,
never HTML). Each answer is kept in
the private AI ledger for 30 days so an identical question costs nothing. 20 messages per user per
day (migration `202611240009_assistant_chat.sql`, which keeps every earlier AI limit).

## Checks

- Unit: `src/lib/assistant/assistant.test.ts` (context selection, links, OpenAI request shape and
  fallback, endpoint rules).
- Live on development with the test AI (`scripts/verify-assistant-live.mjs`): only ticked context
  sent, internal link works, follow-up keeps the conversation, signed-out refused; screenshots in
  dark, light and phone. 23 November 2026. Rerun with OpenAI once a funded key is set (2 calls).

## Limitations

- Answers are suggestions, not decisions; the page says so.
- No streaming yet: the reply appears when complete.
