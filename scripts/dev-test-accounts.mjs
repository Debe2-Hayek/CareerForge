// Creates (or resets the passwords of) two DEVELOPMENT test accounts:
//   careerforge-admin@careerforge.invalid   role admin (reviews claims at /admin/claims)
//   careerforge-student@careerforge.invalid a student with a sample profile, one degree and one job
// Passwords are random on every run and written to the git-ignored
// .deployment/dev-test-accounts.txt, never printed. Refuses any project but the expected one.
//   EXPECTED_SUPABASE_PROJECT_REF=<dev ref> node --env-file=.env scripts/dev-test-accounts.mjs
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Client } from "pg";

const expected = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
if (!expected || !connection) throw new Error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL.");
const url = new URL(connection);
if (!url.hostname.includes(expected) && !decodeURIComponent(url.username).endsWith(`.${expected}`)) throw new Error("DATABASE_PROJECT_MISMATCH");
if (expected === "gmrribyxcpcmqlqhdwea") throw new Error("Refusing to create test accounts on production.");

const password = () => `Cf-${randomBytes(9).toString("base64url")}-${randomBytes(3).toString("hex")}!`;
const accounts = [
  { email: "careerforge-admin@careerforge.invalid", role: "admin", password: password(), profile: { full_name: "CareerForge Reviewer", headline: "Claims reviewer (test account)", skills: [] } },
  { email: "careerforge-student@careerforge.invalid", role: "student", password: password(), profile: { full_name: "Rana Haddad", headline: "Backend developer (test account)", skills: ["React", "Java", "Docker"] } }
];
const out = resolve(process.argv[2] ?? "../CareerForge/.deployment/dev-test-accounts.txt");
const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
await db.connect();
try {
  await db.query("begin");
  for (const account of accounts) {
    const existing = await db.query("select id from auth.users where email = $1", [account.email]);
    let id = existing.rows[0]?.id;
    if (id) {
      await db.query("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), updated_at = now() where id = $1", [id, account.password]);
    } else {
      id = randomUUID();
      await db.query(`insert into auth.users
        (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token)
        values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')`, [id, account.email, account.password]);
      await db.query(`insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at)
        values ($1, $2::text, $2::uuid, $3, 'email', now(), now())`, [randomUUID(), id, JSON.stringify({ sub: id, email: account.email, email_verified: true })]);
      await db.query("update public.profiles set full_name = $2, headline = $3, self_reported_skills = $4 where id = $1", [id, account.profile.full_name, account.profile.headline, account.profile.skills]);
      if (account.role === "student") {
        await db.query("insert into public.education_records (user_id, request_id, institution, degree, start_date, end_date) values ($1, $2, 'Lebanese American University', 'B.E. Computer Engineering', '2016-09-01', '2020-06-01')", [id, randomUUID()]);
        await db.query("insert into public.experience_records (user_id, request_id, company, role, description, start_date, is_current) values ($1, $2, 'Murex', 'Backend Developer', 'Building payment APIs in Java.', '2020-09-01', true)", [id, randomUUID()]);
      }
    }
    await db.query("update public.profiles set role = $2 where id = $1", [id, account.role]);
    console.log(`${existing.rows[0] ? "Reset" : "Created"}: ${account.email} (${account.role})`);
  }
  await db.query("commit");
} catch (error) {
  await db.query("rollback").catch(() => {});
  throw error;
} finally { await db.end().catch(() => {}); }

await mkdir(dirname(out), { recursive: true });
await writeFile(out, [
  "CareerForge DEVELOPMENT test accounts (local only; passwords change every time the script runs)",
  "Use them on http://localhost:3100 (development database), not on the live site.",
  "",
  ...accounts.map(account => `${account.role === "admin" ? "Admin / reviewer" : "Student"}\n  Email:    ${account.email}\n  Password: ${account.password}\n`)
].join("\n"), "utf8");
console.log(`Passwords written to ${out}`);
