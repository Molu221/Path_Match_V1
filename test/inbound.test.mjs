// Runs the real inbound-email Edge Function (TypeScript) in Node with a Deno shim and an in-memory database.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { makeFakeSb } from "./fake_supabase.mjs";

const root = path.resolve(import.meta.dirname, "..");
const TOKEN = "0123456789abcdef01234567";
const fake = makeFakeSb({
  profiles: [{ user_id: "u1", inbox_token: TOKEN }, { user_id: "u2", inbox_token: "ffffffffffffffffffffffff" }],
  applications: [{ id: "a1", user_id: "u1", company: "Bombardier", title: "Intern, Quality Analyst (Winter 2027)", applied_at: new Date(Date.now() - 2 * 864e5).toISOString(), status: "applied" }],
});
globalThis.__fakeSb = fake;

const env = { SUPABASE_URL: "http://x", SUPABASE_SERVICE_ROLE_KEY: "svc", INBOUND_SECRET: "s3cret", INBOUND_DOMAIN: "mail.pathmatch.app" };
let handler;
globalThis.Deno = { env: { get: (k) => env[k] }, serve: (h) => { handler = h; } };

// Load the function source with its imports pointed at local files and the fake client.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pm-inbound-"));
const src = fs.readFileSync(path.join(root, "supabase/functions/inbound-email/index.ts"), "utf8")
  .replace('"npm:@supabase/supabase-js@2"', JSON.stringify("data:text/javascript,export const createClient=()=>globalThis.__fakeSb;"))
  .replace('"../_shared/process.js"', JSON.stringify(pathToFileURL(path.join(root, "supabase/functions/_shared/process.js")).href))
  .replace('"../_shared/http.ts"', JSON.stringify(pathToFileURL(path.join(root, "supabase/functions/_shared/http.ts")).href));
const file = path.join(dir, "inbound.ts");
fs.writeFileSync(file, src);
await import(pathToFileURL(file).href);
assert.equal(typeof handler, "function");

const call = (body, { key = "s3cret", method = "POST", raw } = {}) =>
  handler(new Request(`http://fn/inbound-email${key === null ? "" : `?key=${key}`}`, {
    method, headers: { "content-type": "application/json" },
    ...(method === "GET" ? {} : { body: raw ?? JSON.stringify(body) }) }));

const postmark = (to, extra = {}) => ({
  From: "Bombardier Careers <bombardier@myworkday.com>", FromFull: { Email: "bombardier@myworkday.com", Name: "Bombardier Careers" },
  OriginalRecipient: to, To: "student@gmail.com", Subject: "Thank you for applying - Intern, Quality Analyst (Winter 2027)",
  TextBody: "We have received your application.", Date: new Date().toUTCString(),
  Headers: [{ Name: "Message-ID", Value: "<abc@workday>" }], ...extra });

assert.equal((await call({}, { method: "GET" })).status, 405);
assert.equal((await call(postmark(`${TOKEN}@mail.pathmatch.app`), { key: "wrong" })).status, 401);
assert.equal((await call(postmark(`${TOKEN}@mail.pathmatch.app`), { key: null })).status, 401);
assert.equal((await call(null, { raw: "not json" })).status, 400);
assert.equal(fake.db.email_events.length, 0, "rejected requests store nothing");

// address on a different domain, or an unknown token: acknowledged (so the provider stops retrying) but ignored
let res = await call(postmark(`${TOKEN}@evil.example`));
assert.equal(res.status, 200); assert.equal(fake.db.email_events.length, 0);
res = await call(postmark("aaaaaaaaaaaaaaaaaaaaaaaa@mail.pathmatch.app"));
assert.equal(res.status, 200); assert.equal((await res.json()).ignored, "unknown address"); assert.equal(fake.db.email_events.length, 0);

// good delivery: routed to the right user, matched, status function called
res = await call(postmark(`${TOKEN}@mail.pathmatch.app`));
assert.equal(res.status, 200);
assert.equal(fake.db.email_events.length, 1);
assert.equal(fake.db.email_events[0].user_id, "u1");
assert.equal(fake.db.email_events[0].application_id, "a1");
assert.equal(fake.db.email_events[0].message_id, "<abc@workday>");
assert.equal(fake.rpcCalls.length, 1);

// provider retry of the same message: no second event
await call(postmark(`${TOKEN}@mail.pathmatch.app`));
assert.equal(fake.db.email_events.length, 1);

// plus-addressing works
res = await call(postmark(`${TOKEN}+x@mail.pathmatch.app`, { Headers: [{ Name: "Message-ID", Value: "<def@workday>" }], Subject: "Update", TextBody: "Unfortunately, we have decided to pursue other candidates." }));
assert.equal(fake.db.email_events.length, 2);
assert.equal(fake.db.email_events[1].kind, "rejection");

// the other user's data is never touched
assert.ok(fake.db.email_events.every((e) => e.user_id === "u1"));

fs.rmSync(dir, { recursive: true, force: true });
console.log("inbound: all checks passed");
