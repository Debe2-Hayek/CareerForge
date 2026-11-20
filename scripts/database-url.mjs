function normalized(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function assertExpectedSupabaseProject(connectionString, expectedProjectRef) {
  const expected = normalized(expectedProjectRef);
  if (!expected) return;
  if (!/^[a-z0-9]{10,40}$/.test(expected)) throw new Error("INVALID_EXPECTED_SUPABASE_PROJECT_REF");

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch {
    throw new Error("INVALID_DATABASE_URL");
  }
  const hostname = parsed.hostname.toLowerCase();
  const username = decodeURIComponent(parsed.username).toLowerCase();
  const directHost = `db.${expected}.supabase.co`;
  const poolerUser = `postgres.${expected}`;
  if (hostname !== directHost && username !== poolerUser) throw new Error("DATABASE_PROJECT_MISMATCH");
}

export function resolveAdminDatabaseUrl(env = process.env) {
  // Administrative and migration work must prefer the non-pooled direct URL.
  const connectionString = normalized(env.DIRECT_URL) ?? normalized(env.DATABASE_URL);
  if (!connectionString) throw new Error("MISSING_DATABASE_URL");
  assertExpectedSupabaseProject(connectionString, env.EXPECTED_SUPABASE_PROJECT_REF);
  return connectionString;
}
