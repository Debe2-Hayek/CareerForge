import assert from "node:assert/strict";
import { test } from "node:test";
import {
  hasStrongPasswordShape,
  PASSWORD_MAX_LENGTH,
  PASSWORD_SYMBOLS
} from "./password-policy";

test("new-password policy matches the exact Supabase ASCII symbol set", () => {
  for (const symbol of PASSWORD_SYMBOLS) {
    assert.equal(hasStrongPasswordShape(`Password123${symbol}`), true, `expected ${JSON.stringify(symbol)} to be accepted`);
  }
  for (const unsupported of ["Password123 ", "Password123é", "Password123🙂", "password123!", "PASSWORD123!", "PasswordOnly!"]) {
    assert.equal(hasStrongPasswordShape(unsupported), false, `expected ${JSON.stringify(unsupported)} to be rejected`);
  }
  assert.equal(hasStrongPasswordShape(`Aa1!${"x".repeat(PASSWORD_MAX_LENGTH - 4)}`), true);
  assert.equal(hasStrongPasswordShape(`Aa1!${"x".repeat(PASSWORD_MAX_LENGTH - 3)}`), false);
});
