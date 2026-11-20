import assert from "node:assert/strict";
import { test } from "node:test";
import { fingerprintDiagnostic, normalizeDiagnosticRoute, normalizeNotFoundRoute } from "./self-diagnose";

test("diagnostic routes discard queries and normalize record identifiers", () => {
  assert.equal(normalizeDiagnosticRoute("/api/v1/applications/12345?token=secret#part"), "/api/v1/applications/:id");
  assert.equal(normalizeDiagnosticRoute("/education/550e8400-e29b-41d4-a716-446655440000"), "/education/:id");
  assert.equal(normalizeDiagnosticRoute(""), "/");
});

test("404 routes retain only a known top-level area", () => {
  assert.equal(normalizeNotFoundRoute("/jobs/private-candidate-name?token=secret"), "/jobs/*");
  assert.equal(normalizeNotFoundRoute("/person@example.com/reset-secret"), "/*");
  assert.equal(normalizeNotFoundRoute("/roadmap/missing-node"), "/roadmap/*");
});

test("diagnostic fingerprints are stable, bounded and do not preserve source text", () => {
  const input = "ui-error|/account|Unhandled UI error|Error";
  const fingerprint = fingerprintDiagnostic(input);
  assert.match(fingerprint, /^[a-f0-9]{8}$/);
  assert.equal(fingerprintDiagnostic(input), fingerprint);
  assert.equal(fingerprint.includes("account"), false);
});
