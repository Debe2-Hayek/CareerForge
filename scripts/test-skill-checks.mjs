// Database rules for skill checks (untimed since migration 202611260002), checked inside one
// transaction that is always rolled back. Run on DEVELOPMENT only: npm run test:skill-checks
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import nextEnv from "@next/env";
import { Client } from "pg";

nextEnv.loadEnvConfig(process.cwd());
const url = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
const db = new Client({ connectionString: url, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
const [a, b] = [randomUUID(), randomUUID()];

async function asUser(id) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: id, role: "authenticated" })]);
  await db.query("set local role authenticated");
}
async function asOwner() { await db.query("reset role"); }
async function rejected(sql, params = []) {
  await db.query("savepoint rejected");
  try { await assert.rejects(db.query(sql, params)); }
  finally { await db.query("rollback to savepoint rejected"); }
}
const rpc = async (sql, params = []) => (await db.query(`select ${sql} as data`, params)).rows[0].data;
/** Moves this person's history back in time, so the one-minute and 24-hour rules can be tested now. */
async function age(id, interval) {
  await asOwner();
  await db.query(`update public.skill_check_attempts set taken_at = taken_at - interval '${interval}' where user_id = $1`, [id]);
  await db.query(`update public.skill_check_sessions set started_at = started_at - interval '${interval}', deadline_at = deadline_at - interval '${interval}' where user_id = $1`, [id]);
}
/** The answers a person gives in the shown order: right ones from the bank, or wrong ones. */
function answersFor(session, bank, correct) {
  return Object.fromEntries(session.questions.map(question => {
    const source = bank.find(item => item.id === question.id);
    const right = question.options.indexOf(source.options[source.answer]);
    return [question.id, correct ? right : (right + 1) % 3];
  }));
}

try {
  if (url.includes("gmrribyxcpcmqlqhdwea")) throw new Error("Never run this against production.");
  await db.connect();
  await db.query("begin");
  for (const id of [a, b]) await db.query("insert into auth.users(id,email) values($1,$2)", [id, `${id}@careerforge.invalid`]);
  await db.query("update public.profiles set self_reported_skills = array['SQL'] where id = $1", [a]);
  const banks = Object.fromEntries((await db.query("select distinct on (lower(skill)) skill, questions from careerforge_internal.skill_check_banks order by lower(skill), version desc")).rows.map(row => [row.skill, row.questions]));

  await asUser(a);
  assert.equal(JSON.stringify(await rpc("public.skill_check_catalog()")).includes('"answer"'), false, "the catalog never contains answers");
  await rejected("select * from careerforge_internal.skill_check_banks");
  await rejected("insert into public.skill_check_attempts(user_id,skill,version,score,passed) values($1,'React',1,5,true)", [a]);
  await rejected("select public.start_skill_check('React',1,'standard')");
  await rejected("select public.submit_timed_skill_check($1,'{}'::jsonb)", [randomUUID()]);
  assert.equal((await rpc("public.start_untimed_skill_check('React', false)")).skillNotSelected, true, "a skill missing from the profile needs consent");

  const first = (await rpc("public.start_untimed_skill_check('react', true)")).session;
  assert.equal(first.timingMode, "untimed");
  assert.equal(Date.parse(first.deadlineAt) - Date.parse(first.startedAt), 86400000, "an open attempt lapses after 24 hours");
  assert.equal(first.questions.length, 5);
  assert.equal(JSON.stringify(first).includes('"answer"'), false, "no answers in the attempt");
  await asOwner();
  assert.ok((await db.query("select 'React' = any(self_reported_skills) v from public.profiles where id = $1", [a])).rows[0].v, "consent adds the skill to the profile");
  const order = (await db.query("select question_order, option_orders from public.skill_check_sessions where id = $1", [first.id])).rows[0];
  assert.deepEqual([...order.question_order].sort(), [0, 1, 2, 3, 4], "every question appears once");
  assert.ok(order.option_orders.every(item => [...item].sort().join() === "0,1,2"), "every option appears once");
  await asUser(a);
  assert.equal((await rpc("public.start_untimed_skill_check('React', false)")).session.id, first.id, "starting again resumes the open attempt");
  assert.equal((await rpc("public.start_untimed_skill_check('SQL', false)")).conflict, true, "one open attempt at a time");
  await asUser(b);
  assert.equal((await rpc("public.submit_untimed_skill_check($1, $2::jsonb)", [first.id, JSON.stringify(answersFor(first, banks.React, true))])).notFound, true, "another person cannot submit");

  await age(a, "2 minutes");
  await asUser(a);
  await rejected("select public.submit_untimed_skill_check($1, $2::jsonb)", [first.id, JSON.stringify({ r1: 9 })]);
  const passed = await rpc("public.submit_untimed_skill_check($1, $2::jsonb)", [first.id, JSON.stringify(answersFor(first, banks.React, true))]);
  assert.equal(passed.score, 5, "right answers in the shown order are mapped back and graded");
  assert.equal(passed.passed, true);
  assert.equal(passed.retryAt, null);
  assert.equal((await rpc("public.submit_untimed_skill_check($1, $2::jsonb)", [first.id, JSON.stringify(answersFor(first, banks.React, false))])).score, 5, "a repeated submit returns the recorded result");
  assert.equal((await rpc("public.start_untimed_skill_check('SQL', false)")).rateLimited, true, "one minute between attempts");

  await age(a, "2 minutes");
  await asUser(a);
  const second = (await rpc("public.start_untimed_skill_check('SQL', false)")).session;
  await age(a, "2 minutes");
  await asUser(a);
  const failed = await rpc("public.submit_untimed_skill_check($1, $2::jsonb)", [second.id, JSON.stringify(answersFor(second, banks.SQL, false))]);
  assert.equal(failed.passed, false);
  assert.equal(Date.parse(failed.retryAt) - Date.parse(failed.takenAt), 86400000, "a failed attempt names its retry time");
  await age(a, "2 minutes");
  await asUser(a);
  assert.equal((await rpc("public.start_untimed_skill_check('SQL', false)")).cooldown, true, "a failed skill waits 24 hours");
  assert.ok((await rpc("public.start_untimed_skill_check('React', false)")).session, "other skills are not blocked");
  await asOwner();
  await db.query("update public.skill_check_sessions set state = 'cancelled', finished_at = now() where user_id = $1 and state = 'active'", [a]);
  await age(a, "25 hours");
  await asUser(a);
  assert.ok((await rpc("public.start_untimed_skill_check('SQL', false)")).session, "after 24 hours it can be taken again");
  assert.equal((await rpc("public.cancel_skill_check($1)", [second.id])).cancelled, true);

  await asOwner();
  await db.query("select set_config('request.jwt.claims', '', true)");
  await db.query("set local role anon");
  await rejected("select public.start_untimed_skill_check('SQL', false)");
  await rejected("select public.submit_untimed_skill_check($1, '{}'::jsonb)", [first.id]);
  console.log("PASS: untimed attempts with a 24-hour lifetime, consent to add the skill, per-attempt question and option shuffling mapped back for grading, resume, one open attempt, owner-only submit, idempotent results, one-minute pacing, 24-hour wait after a fail (per skill), retired timed functions, anonymous denial");
} catch (error) {
  console.error("Skill-check DB verification failed:", error.code ?? "", error.message);
  process.exitCode = 1;
} finally {
  await db.query("rollback").catch(() => {});
  await db.end().catch(() => {});
  console.log("Temporary DB verification transaction rolled back.");
}
