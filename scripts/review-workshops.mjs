// Operator review of workshops learners suggested. Uses the administrative database
// connection, shows no account details, and validates each record before approval.
//   node --import tsx scripts/review-workshops.mjs list
//   node --import tsx scripts/review-workshops.mjs approve <id#fingerprint>
//   node --import tsx scripts/review-workshops.mjs reject  <id#fingerprint> "Reason shown to the learner"
// The part after # identifies the exact text that was reviewed, so two learners'
// different descriptions of one link, or a replaced one, cannot be approved by mistake.
import nextEnv from "@next/env";
import { Client } from "pg";
import { resolveAdminDatabaseUrl } from "./database-url.mjs";
import { parseApproved } from "../src/lib/workshops/suggestions.ts";

nextEnv.loadEnvConfig(process.cwd());
const [command = "list", reference, note] = process.argv.slice(2);
const [id, digest] = (reference ?? "").split("#");
const client = new Client({ connectionString: resolveAdminDatabaseUrl(), connectionTimeoutMillis: 15000, statement_timeout: 15000 });
const today = new Date().toISOString().slice(0, 10);
// Control characters in a title must not be able to alter the terminal.
const plain = value => String(value ?? "").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").slice(0, 300);

try {
  if (command !== "list" && !(/^local-[0-9a-f]{16}$/.test(id) && /^[0-9a-f]{32}$/.test(digest ?? ""))) throw new Error("Give the id shown by list.");
  if (command === "reject" && !(note?.trim().length >= 5 && note.length <= 300)) throw new Error("Give a short reason for the learner (5 to 300 characters).");
  await client.connect();
  if (command === "list") {
    const { rows } = await client.query("select workshop_id, record, left(encode(sha256(convert_to(record::text, 'UTF8')), 'hex'), 32) as digest, min(created_at) as since, count(*)::int as times from public.workshop_suggestions where status = 'pending' group by workshop_id, record order by since limit 100");
    if (!rows.length) console.log("Nothing is waiting for review.");
    for (const row of rows) {
      const [workshop] = parseApproved([{ workshop_id: row.workshop_id, record: row.record, reviewed_on: today }]);
      console.log(`\n${row.workshop_id}#${row.digest}  suggested ${row.times}x since ${row.since.toISOString().slice(0, 10)}`);
      if (!workshop) { console.log("  INVALID: this record cannot be shown; reject it."); continue; }
      console.log(`  ${plain(workshop.title)}\n  ${plain(workshop.outcomeHook)}\n  ${plain(workshop.registrationOrWatchUrl)}\n  ${workshop.category} | ${workshop.difficulty} | ${workshop.format} | ${workshop.priceType} | ${workshop.durationMinutes} min${workshop.startDateTime ? ` | ${workshop.startDateTime}` : ""}`);
    }
    if (rows.length) console.log("\nOpen each link and check title, cost, time and safety before approving.");
  } else if (command === "approve" || command === "reject") {
    const { rows } = await client.query("select workshop_id, record from public.workshop_suggestions where workshop_id = $1 and left(encode(sha256(convert_to(record::text, 'UTF8')), 'hex'), 32) = $2 and status = 'pending' limit 1", [id, digest]);
    if (!rows.length) throw new Error("No pending suggestion has that id.");
    if (command === "approve" && !parseApproved([{ ...rows[0], reviewed_on: today }]).length) throw new Error("This record is not valid and cannot be approved.");
    const result = await client.query("update public.workshop_suggestions set status = $2, review_note = $3 where workshop_id = $1 and left(encode(sha256(convert_to(record::text, 'UTF8')), 'hex'), 32) = $4 and status = 'pending'", [id, command === "approve" ? "approved" : "rejected", command === "reject" ? note.trim() : null, digest]);
    console.log(`${command === "approve" ? "Approved" : "Rejected"}: ${result.rowCount} suggestion(s).`);
  } else throw new Error("Use list, approve or reject.");
} catch (error) {
  console.error("Review failed:", error.code ?? error.message);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }
