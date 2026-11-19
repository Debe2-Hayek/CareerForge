import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Called inside the existing rolled-back RLS transaction. Uses its own synthetic users.
export async function verifyLiveJobsRls(client, asUser, denied) {
  await client.query("reset role");
  const c = randomUUID(), d = randomUUID();
  await client.query("insert into auth.users (id, email) values ($1, $2), ($3, $4)", [c, `${c}@careerforge.invalid`, d, `${d}@careerforge.invalid`]);
  const columns = "id,title,company,initials,location,work_mode,employment_type,skills,description,color,is_fictional,source,external_id,source_url,apply_url,region,fetched_at,expires_at";
  const row = (id, extra = {}) => ({ id, title: "Live role", company: "Test Co", initials: "T", location: "Beirut, Lebanon", work_mode: "Not specified",
    employment_type: "Full-time", skills: [], description: "Listing", color: "mint", is_fictional: false, source: "workable",
    external_id: `test:${id}`, source_url: "https://apply.workable.com/j/TEST", apply_url: "https://apply.workable.com/j/TEST/apply",
    region: "lebanon", fetched_at: new Date(), expires_at: null, ...extra });
  const insert = (values) => client.query(`insert into public.job_postings (${columns}) values (${columns.split(",").map((_, i) => `$${i + 1}`).join(",")})`, columns.split(",").map(key => values[key]));
  const day = 86_400_000;
  await insert(row("rls-live-current"));
  await insert(row("rls-live-expired", { expires_at: new Date(Date.now() - day) }));
  await insert(row("rls-live-stale", { fetched_at: new Date(Date.now() - 8 * day) }));
  await insert(row("rls-live-expiring"));

  // Integrity: duplicates, non-HTTPS links, unknown sources/regions and fictional-looking live rows are rejected.
  await denied(`insert into public.job_postings (${columns}) values ('rls-dup','x','x','x','x','Remote','Full-time','{}','x','mint',false,'workable','test:rls-live-current','https://a.workable.com','https://a.workable.com','lebanon',now(),null)`, [], "23505");
  for (const [key, value] of [["source_url", "http://apply.workable.com/j/X"], ["apply_url", "javascript:alert(1)"], ["source", "linkedin"], ["region", "mars"], ["is_fictional", true], ["fetched_at", null], ["external_id", null]]) {
    const bad = row(`rls-bad-${key}`, { [key]: value });
    await client.query("savepoint bad_row");
    await assert.rejects(insert(bad), error => error.code === "23514" || error.code === "23502", `expected ${key}=${value} to be rejected`);
    await client.query("rollback to savepoint bad_row");
  }
  await denied(`insert into public.job_postings (id,title,company,initials,location,work_mode,employment_type,skills,description,color) values ('rls-nos','x','x','x','x','Remote','Full-time','{}','x','mint')`, [], "23514");
  // Experience level accepts only the fixed vocabulary used by the level filter.
  await client.query("savepoint bad_level");
  await assert.rejects(client.query("update public.job_postings set experience_level='expert' where id='rls-live-current'"), error => error.code === "23514", "unknown experience level rejected");
  await client.query("rollback to savepoint bad_level");
  assert.equal((await client.query("update public.job_postings set experience_level='senior' where id='rls-live-current'")).rowCount, 1);

  await asUser(c);
  const visible = (await client.query("select id from public.job_postings where id like 'rls-live-%' order by id")).rows.map(r => r.id);
  assert.deepEqual(visible, ["rls-live-current", "rls-live-expiring"], "expired and stale listings are hidden");
  await denied(`insert into public.job_postings (${columns}) select ${columns.replace("id,", "'rls-student',").replace("external_id", "'test:student'")} from public.job_postings where id='rls-live-current'`);
  await denied("update public.job_postings set title='Edited' where id='rls-live-current'");
  for (const id of ["rls-live-expired", "rls-live-stale"]) await denied("insert into public.saved_jobs (user_id,job_id) values ($1,$2)", [c, id], "23514");
  await client.query("insert into public.saved_jobs (user_id,job_id) values ($1,'rls-live-expiring')", [c]);

  await client.query("reset role");
  await client.query("update public.job_postings set expires_at=now() - interval '1 minute' where id='rls-live-expiring'");
  await asUser(c);
  assert.equal((await client.query("select id from public.job_postings where id='rls-live-expiring'")).rowCount, 1, "owner keeps tracker history");
  await asUser(d);
  assert.equal((await client.query("select id from public.job_postings where id='rls-live-expiring'")).rowCount, 0, "other users no longer see it");
  await denied("insert into public.saved_jobs (user_id,job_id) values ($1,'rls-live-expiring')", [d], "23514");
  await client.query("reset role");
  console.log("PASS: live listings hidden when expired/stale, owner history kept, student writes denied, dedupe and HTTPS/source/region integrity");
}
