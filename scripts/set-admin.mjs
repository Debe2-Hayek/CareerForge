// Makes one existing account a claims reviewer (profiles.role = 'admin'), or back to a
// student with --remove. Runs against the database in DATABASE_URL/DIRECT_URL and refuses
// any project but EXPECTED_SUPABASE_PROJECT_REF. Usage:
//   node scripts/set-admin.mjs someone@example.com [--remove]
import { Client } from "pg";

const email = (process.argv[2] ?? "").trim().toLowerCase();
const role = process.argv.includes("--remove") ? "student" : "admin";
const expected = process.env.EXPECTED_SUPABASE_PROJECT_REF;
const connection = (process.env.DIRECT_URL || process.env.DATABASE_URL || "").trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { console.error("Give the account's email address."); process.exit(2); }
if (!expected || !connection) { console.error("Set EXPECTED_SUPABASE_PROJECT_REF and a database URL."); process.exit(2); }
const url = new URL(connection);
if (!url.hostname.includes(expected) && !decodeURIComponent(url.username).endsWith(`.${expected}`)) { console.error("DATABASE_PROJECT_MISMATCH"); process.exit(2); }

const db = new Client({ connectionString: connection, connectionTimeoutMillis: 15000, statement_timeout: 15000 });
await db.connect();
try {
  const result = await db.query(
    "update public.profiles p set role = $2 from auth.users u where u.id = p.id and lower(u.email) = $1 returning p.full_name",
    [email, role]);
  if (!result.rowCount) { console.error(`No account found for ${email}. Sign up on the site first, then run this again.`); process.exitCode = 1; }
  else console.log(`${email} is now ${role === "admin" ? "an admin (claims reviewer)" : "a student"}.`);
} finally { await db.end().catch(() => {}); }
