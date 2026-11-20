import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { pwnedPasswordCount, type PasswordRangeFetch } from "./pwned-passwords";

function rangeFor(password: string) {
  const hash = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
}

test("pwned password lookup sends only a padded five-character hash range", async () => {
  const password = "StrongPassword123!";
  const { prefix, suffix } = rangeFor(password);
  let requestUrl = "";
  const fetchImpl: PasswordRangeFetch = async (input, init) => {
    requestUrl = String(input);
    assert.equal(init?.headers && new Headers(init.headers).get("Add-Padding"), "true");
    assert.equal(init?.headers && new Headers(init.headers).get("User-Agent"), "CareerForge-Password-Guard/1.0");
    return new Response(`${"0".repeat(35)}:0\r\n${suffix}:27\r\n`);
  };

  assert.equal(await pwnedPasswordCount(password, { fetchImpl }), 27);
  assert.equal(requestUrl, `https://api.pwnedpasswords.com/range/${prefix}`);
  assert.equal(requestUrl.includes(password), false);
  assert.equal(requestUrl.includes(`${prefix}${suffix}`), false);
});

test("pwned password lookup treats padded zero counts and absent suffixes as safe", async () => {
  const password = "AnotherStrongPassword123!";
  const { suffix } = rangeFor(password);
  const paddedMatch: PasswordRangeFetch = async () => new Response(`${suffix}:0\r\n${"A".repeat(35)}:19\r\n`);
  const absent: PasswordRangeFetch = async () => new Response(`${"B".repeat(35)}:3\r\n`);
  assert.equal(await pwnedPasswordCount(password, { fetchImpl: paddedMatch }), 0);
  assert.equal(await pwnedPasswordCount(password, { fetchImpl: absent }), 0);
});

test("pwned password lookup fails closed on timeout and invalid upstream data", async () => {
  const { suffix } = rangeFor("StrongPassword123!");
  const timeoutFetch: PasswordRangeFetch = async (_input, init) => await new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  await assert.rejects(pwnedPasswordCount("StrongPassword123!", { fetchImpl: timeoutFetch, timeoutMs: 5 }), /abort/i);

  for (const fetchImpl of [
    async () => new Response("not-a-range-record"),
    async () => new Response(`${suffix}:0\r\nnot-a-range-record`),
    async () => new Response("", { status: 503 }),
    async () => new Response(`${"A".repeat(35)}:1`, { headers: { "Content-Length": String(300 * 1024) } })
  ] satisfies PasswordRangeFetch[]) {
    await assert.rejects(pwnedPasswordCount("StrongPassword123!", { fetchImpl }));
  }

  const oversizedStream: PasswordRangeFetch = async () => new Response(new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(200 * 1024));
      controller.enqueue(new Uint8Array(100 * 1024));
      controller.close();
    }
  }));
  await assert.rejects(
    pwnedPasswordCount("StrongPassword123!", { fetchImpl: oversizedStream }),
    /too large/i
  );
});
