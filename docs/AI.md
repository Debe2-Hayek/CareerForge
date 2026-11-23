# AI in CareerForge

CareerForge uses DeepSeek's flash model through **OpenRouter** today
(`deepseek/deepseek-v4.1-flash`: JSON output, thinking off, only hosts that do not
store request data). A direct DeepSeek key (`deepseek-flash`) also works. The OpenAI key is reserved for the planned chat
assistant (M9). Report section 15 is the contract: plain code decides anything
measurable, and the AI only reads and writes language.

## What uses AI

| Feature | Where | Input | Output |
| --- | --- | --- | --- |
| Profile autofill | Profile → "Let AI fill in your profile" (`POST /api/v1/profile/autofill`) | A PDF/Word CV (≤ 4 MB, ≤ 8 pages; Vercel caps request bodies at 4.5 MB) or 40–6,000 characters of notes | Suggested profile details, education and work records, for the owner to review |
| Generate with AI | CV & Portfolio builder (`POST /api/generate`, `/api/v1/documents/generate`) | The builder notes (≤ 8,000 characters) | Builder data (`PortfolioBuilder.jsx` shape) |

Nothing is written to the profile by the AI. Autofill returns suggestions; only the
items the owner ticks are saved, through the normal profile and history APIs, as
**self-declared** records. Verification (certificates, timed checks) is the next
step of requirement R1.

## How a request runs

1. Same-origin check, signed-in user, bounded input, explicit consent (autofill).
2. A CV is read **in memory** (`src/lib/ai/document-text.ts`: `unpdf` for PDF, a
   bounded ZIP reader for `.docx`). The file is never stored.
3. `reserve_ai_run` (`supabase/migrations/202611240001_ai_runs.sql`) either returns
   a cached answer for the same text and prompt version, or reserves one call
   within the limits, or refuses.
4. `src/lib/ai/provider.ts` calls OpenRouter, or DeepSeek directly (45 s timeout). An invalid or blank
   JSON answer is retried once, then reported as an error (report 15.1).
5. `finish_ai_run` stores the answer, the model and the prompt version (15.2).
6. **Grounding** (`src/lib/ai/grounding.ts`, 15.5) runs on every answer, cached or
   fresh. Names, institutions, companies, degrees, titles, skills and languages must
   appear in the source as the same words in the same order ("Lebanese University"
   is not found in "Lebanese American University"). Contacts must appear verbatim.
   Rewritten prose may not add numbers, and most of its words must come from the
   source. Years and months must be written in the source. Anything else is removed
   and listed under "Removed because they weren't in your text".

## Keeping the key cheap

- 5 calls per user per day per feature, 150 calls per day for the whole site
  (fixed in SQL, so clients cannot change them). Failed calls count too.
- The same text is served from the 30-day cache without a new call.
- Inputs are capped (12,000 characters of CV text) and outputs are capped
  (`max_tokens` 1,800–2,200).
- Tests use a fake provider and never call the AI service.
- OpenRouter and DeepSeek are prepaid: the account balance is the final ceiling.
  A spending limit can also be set on the OpenRouter key.
- Live check (2 AI calls, development only): `scripts/verify-ai-live.mjs`; the
  first run on 23 November 2026 answered a CV in 4.5 s with nothing removed.

## Privacy

- The consent text names OpenRouter (a US service) and DeepSeek's model, and says
  only hosts that do not store data are used (`provider.data_collection: "deny"`).
  Nothing is sent before the owner ticks it. If a direct DeepSeek key is used
  instead, the consent text must name DeepSeek and its servers in China.
- `ai_runs` has no client privileges; only the two owner-scoped RPCs touch it.
  Rows older than 30 days are deleted on the owner's next request, and all rows
  are deleted with the account.
- Provider error bodies are never shown or logged; they can echo the prompt.
- The source text is wrapped as untrusted data in the prompt. Grounding limits
  what an injected instruction could add.

## Configuration

Server-only environment variables: `OPENROUTER_API_KEY`, or `DEEPSEEK_API_KEY`
(an `sk-or-` key there is treated as OpenRouter); `AI_MODEL` (optional, default
`deepseek/deepseek-v4.1-flash` on OpenRouter, `deepseek-flash` on DeepSeek). Without a key, autofill
returns 501 with a clear message and the builder keeps its labeled demo fallback.
Production also needs both `ai_runs` migrations (202611240001 and 202611240002)
applied before the key is added.

## Limitations

- Scanned (image-only) CVs have no text layer and are refused; image reading is
  planned with certificate checks.
- Grounding is strict: a CV that writes "LAU" will not produce "Lebanese American
  University". The owner can add details by hand.
- Year-only dates are shown as a hint and not stored, because a record date needs a
  month.
- Profiles do not store languages yet; languages found are shown, not saved.
- Builder generation removes ungrounded facts silently, because the supplied
  component shows only its own messages.
