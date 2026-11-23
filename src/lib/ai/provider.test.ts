import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { AiError, completeJson, createDeepSeekProvider } from "./provider";
import { SourceText } from "./grounding";

function fakeFetch(reply: () => Response | Promise<Response>) {
  const seen: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => { seen.push({ url, init }); return reply(); }) as unknown as typeof fetch;
  return { impl, seen };
}

test("DeepSeek requests use JSON mode, no thinking, bounded tokens and the key only in the header", async () => {
  const { impl, seen } = fakeFetch(() => Response.json({ model: "deepseek-flash", choices: [{ message: { content: "{\"ok\":true}" }, finish_reason: "stop" }] }));
  const provider = createDeepSeekProvider({ apiKey: "sk-test-secret", fetchImpl: impl });
  const result = await provider.complete({ system: "Return json", user: "<source>x</source>", maxTokens: 500 });
  assert.equal(result.content, "{\"ok\":true}");
  assert.equal(seen[0].url, "https://api.deepseek.com/chat/completions");
  const body = JSON.parse(String(seen[0].init.body));
  assert.equal(body.model, "deepseek-flash");
  assert.deepEqual(body.response_format, { type: "json_object" });
  assert.deepEqual(body.thinking, { type: "disabled" });
  assert.equal(body.max_tokens, 500);
  assert.equal(String(seen[0].init.body).includes("sk-test-secret"), false);
  assert.equal((seen[0].init.headers as Record<string, string>).Authorization, "Bearer sk-test-secret");
});

test("provider errors never expose the response body", async () => {
  const { impl } = fakeFetch(() => new Response("{\"error\":\"key sk-test-secret invalid\"}", { status: 401 }));
  const provider = createDeepSeekProvider({ apiKey: "sk-test-secret", fetchImpl: impl });
  await assert.rejects(provider.complete({ system: "json", user: "x", maxTokens: 10 }), (error: AiError) => error.code === "AI_UNAVAILABLE" && !error.message.includes("sk-test"));
});

test("truncated answers and timeouts are distinct errors", async () => {
  const cut = createDeepSeekProvider({ apiKey: "k", fetchImpl: fakeFetch(() => Response.json({ choices: [{ message: { content: "{" }, finish_reason: "length" }] })).impl });
  await assert.rejects(cut.complete({ system: "json", user: "x", maxTokens: 10 }), (error: AiError) => error.code === "AI_INVALID_OUTPUT");
  const slow = createDeepSeekProvider({ apiKey: "k", timeoutMs: 5, fetchImpl: ((_url: string, init: RequestInit) => new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))) as unknown as typeof fetch });
  // AbortSignal.timeout does not keep Node alive; hold the event loop open while it fires.
  const keepAlive = setInterval(() => {}, 1000);
  try { await assert.rejects(slow.complete({ system: "json", user: "x", maxTokens: 10 }), (error: AiError) => error.code === "AI_TIMEOUT"); }
  finally { clearInterval(keepAlive); }
});

test("completeJson validates the schema and retries exactly once", async () => {
  const answers = ["not json", "{\"name\":\"Rana\"}"];
  let calls = 0;
  const provider = { async complete() { calls++; return { content: answers.shift() ?? "", model: "m" }; } };
  const result = await completeJson(provider, z.object({ name: z.string() }), { system: "json", user: "x", maxTokens: 10 });
  assert.deepEqual(result.value, { name: "Rana" });
  assert.equal(calls, 2);
});

test("grounding matches whole words in order, verbatim contacts and prose without new numbers", () => {
  const source = new SourceText("Rana Haddad — B.Sc. Computer Science, Lebanese American University (2016-2020). JavaScript, C++, Node.js. rana.haddad@mail.com, linkedin.com/in/rana-h. Built dashboards used by 300 staff.");
  assert.equal(source.hasPhrase("Lebanese American University"), true);
  assert.equal(source.hasPhrase("Lebanese University"), false);
  assert.equal(source.hasPhrase("Java"), false);
  assert.equal(source.hasPhrase("JavaScript"), true);
  assert.equal(source.hasPhrase("C++"), true);
  assert.equal(source.hasPhrase("Node.js"), true);
  assert.equal(source.hasPhrase("B.Sc."), true);
  assert.equal(source.hasPhrase("lebanese american university"), true, "case-insensitive");
  assert.equal(source.hasExact("rana.haddad@mail.com"), true);
  assert.equal(source.hasExact("https://www.linkedin.com/in/rana-h"), true);
  assert.equal(source.hasExact("rana@mail.com"), false);
  assert.equal(source.supportsProse("Built dashboards used by 300 staff members."), true);
  assert.equal(source.supportsProse("Built dashboards used by 3,000 staff."), false);
  assert.equal(source.supportsProse("Led a global cloud migration initiative."), false);
  const dated = new SourceText("Murex, Backend Developer, Sep 2020 – Present. Intern 06/2019 - 08/2019.");
  assert.equal(dated.hasMonth(2020, 9), true);
  assert.equal(dated.hasMonth(2019, 6), true);
  assert.equal(dated.hasMonth(2020, 3), false);
  assert.equal(dated.hasMonth(2019, 1), false);
});
