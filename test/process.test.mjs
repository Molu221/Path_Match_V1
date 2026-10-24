// Offline test of the full email pipeline against a tiny in-memory stand-in for the Supabase client.
import assert from "node:assert/strict";
import { processEmail, parsePastedEmail } from "../supabase/functions/_shared/process.js";

import { makeFakeSb } from "./fake_supabase.mjs";
const fakeSb = (apps) => {
  const f = makeFakeSb({ profiles: [{ user_id: "u1" }], applications: apps.map((a) => ({ ...a, user_id: "u1" })) });
  return { ...f, events: f.db.email_events, calls: f.rpcCalls, profile: f.db.profiles[0] };
};
const apps = [{ id: "a1", company: "Bombardier", title: "Intern, Quality Analyst (Winter 2027)", applied_at: "2026-10-15T12:00:00Z", status: "applied" },
              { id: "a2", company: "Bombardier", title: "Intern, Operational Excellence (Winter 2027)", applied_at: "2026-10-15T12:00:00Z", status: "applied" }];
const now = new Date("2026-10-20T15:00:00Z");

// matched confirmation: event stored, status function called, body not stored
let sb = fakeSb(apps);
let r = await processEmail(sb, "u1", { fromEmail: "bombardier@myworkday.com", fromName: "Bombardier Careers", messageId: "<m1>", date: "2026-10-19T10:00:00Z",
  subject: "Thank you for applying - Intern, Quality Analyst (Winter 2027)", body: "We have received your application. SECRET-BODY-TEXT" }, { now });
assert.equal(r.kind, "confirmation"); assert.equal(r.matched, true); assert.equal(r.application.title, apps[0].title);
assert.equal(sb.events.length, 1);
assert.ok(!JSON.stringify(sb.events).includes("SECRET-BODY-TEXT"), "email body must never be stored");
assert.deepEqual(sb.calls[0][1].p_app, "a1");
assert.ok(sb.profile.last_inbound_at, "inbound timestamp recorded");

// the same message delivered twice is ignored
r = await processEmail(sb, "u1", { fromEmail: "bombardier@myworkday.com", fromName: "Bombardier Careers", messageId: "<m1>", subject: "Thank you for applying - Intern, Quality Analyst (Winter 2027)", body: "We have received your application." }, { now });
assert.equal(r.duplicate, true); assert.equal(sb.events.length, 1); assert.equal(sb.calls.length, 1);

// ambiguous: stored for review with candidates, status function NOT called
sb = fakeSb(apps);
r = await processEmail(sb, "u1", { fromEmail: "careers@bombardier.com", messageId: "<m2>", subject: "Update on your application", body: "Unfortunately, we have decided to pursue other candidates." }, { now });
assert.equal(r.kind, "rejection"); assert.equal(r.needsReview, true);
assert.equal(sb.events[0].needs_review, true); assert.equal(sb.events[0].application_id, null); assert.deepEqual([...sb.events[0].candidates].sort(), ["a1", "a2"]);
assert.equal(sb.calls.length, 0);

// ignored mail stores nothing
sb = fakeSb(apps);
r = await processEmail(sb, "u1", { fromEmail: "news@example.com", subject: "Weekly newsletter", body: "hello", messageId: "<m3>" }, { now });
assert.equal(r.stored, false); assert.equal(sb.events.length, 0);

// subject can be kept out of the database
sb = fakeSb(apps);
await processEmail(sb, "u1", { fromEmail: "careers@bombardier.com", messageId: "<m4>", subject: "Thank you for applying - Intern, Quality Analyst", body: "We received your application." }, { now, storeSubject: false });
assert.equal(sb.events[0].subject_hint, null);

// Gmail forwarding code is stored for the UI to show
sb = fakeSb(apps);
r = await processEmail(sb, "u1", { fromEmail: "forwarding-noreply@google.com", subject: "Gmail Forwarding Confirmation", body: "Confirmation code: 987654321", messageId: "<m5>" }, { now });
assert.equal(r.kind, "verification"); assert.equal(sb.events[0].note, "987654321"); assert.equal(sb.calls.length, 0);

// pasted email with header lines
const p = parsePastedEmail('From: "Bombardier Careers" <careers@bombardier.com>\nSubject: Thank you for applying\nDate: Mon, 19 Oct 2026 10:00:00 +0000\n\nWe received your application.');
assert.equal(p.fromEmail, "careers@bombardier.com"); assert.equal(p.fromName, "Bombardier Careers"); assert.equal(p.subject, "Thank you for applying");
assert.equal(parsePastedEmail("just some body text").fromEmail, "");

console.log("process: all checks passed");
