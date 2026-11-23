-- OpenRouter model names include the vendor ("deepseek/deepseek-v4.1-flash").
-- Allow "/" in the recorded model name; everything else stays as before.
alter table public.ai_runs drop constraint ai_runs_model_check;
alter table public.ai_runs add constraint ai_runs_model_check
 check (model is null or model ~ '^[A-Za-z0-9._:/~-]{1,100}$');
