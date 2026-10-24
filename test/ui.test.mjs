// Browser-level test: loads the real docs/index.html + account.js in jsdom with a fake Supabase backend and drives
// sign-in, saving, "I applied", the tracker, pasted emails, review, blocking and sign-out.
// Optional: needs jsdom.  npm i --no-save jsdom && node test/ui.test.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { makeFakeSb } from "./fake_supabase.mjs";
import { processEmail, parsePastedEmail } from "../supabase/functions/_shared/process.js";

let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = await import("jsdom")); }
catch { console.log("ui: skipped (jsdom not installed; run: npm i --no-save jsdom)"); process.exit(0); }

const root = path.resolve(import.meta.dirname, "..");
const read = (f) => fs.readFileSync(path.join(root, "docs", f), "utf8");
const USER = { id: "11111111-1111-4111-8111-111111111111", email: "student@example.com" };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000, what = "condition") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { try { if (fn()) return; } catch (_) {} await wait(25); }
  throw new Error("timed out waiting for " + what);
}

function pageHtml(config) {
  return read("index.html")
    .replace(/<script src="https:\/\/cdnjs[^>]*><\/script>\s*/g, "")
    .replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>\s*/g, "")
    .replace(/<link[^>]*>\s*/g, "")
    .replace('<script src="config.js"></script>', `<script>window.PM_CONFIG=${JSON.stringify(config)}</script>`)
    .replace('<script src="account.js"></script>', `<script>${read("account.js")}</script>`)
    .replace("</head>", `<style>${read("account.css")}</style></head>`);
}

function boot(config, backend) {
  const errors = [];
  const vc = new VirtualConsole();
  // jsdom cannot follow a download link (the export button); a real browser just saves the file.
  vc.on("jsdomError", (e) => { if (!/Not implemented: navigation/.test(String(e.message))) errors.push(String(e.message || e)); });
  vc.on("error", (e) => errors.push(String(e)));
  let authCb = null, session = null;
  const client = backend && {
    from: backend.from, rpc: backend.rpc,
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithOtp: async () => ({ error: null }), signInWithOAuth: async () => ({}),
      signOut: async () => { session = null; authCb && authCb("SIGNED_OUT", null); return { error: null }; },
    },
    functions: {
      invoke: async (name, { body } = {}) => {
        if (name === "paste-email") {
          const id = "paste-" + createHash("sha256").update(body.text).digest("hex").slice(0, 32);
          return { data: await processEmail(backend, USER.id, { ...parsePastedEmail(body.text), messageId: id }), error: null };
        }
        if (name === "delete-account") { for (const t of Object.keys(backend.db)) backend.db[t].splice(0); return { data: { ok: true }, error: null }; }
        return { data: null, error: { message: "unknown function" } };
      },
    },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
  };
  const dom = new JSDOM(pageHtml(config), {
    runScripts: "dangerously", pretendToBeVisual: true, url: "https://molu221.github.io/Path_Match_V1/", virtualConsole: vc,
    beforeParse(w) { w.confirm = () => true; if (client) w.supabase = { createClient: () => client }; },
  });
  return { dom, w: dom.window, doc: dom.window.document, errors, signIn: () => { session = { user: USER }; authCb("SIGNED_IN", session); } };
}

const SEED_OLD = Date.now() - 40 * 864e5;
const backend = makeFakeSb({
  applications: [{ id: "seed-old", user_id: USER.id, job_key: "labatt|ancient role", company: "Labatt",
    title: '<img src=x onerror="window.__xss=1">Ancient role', url: "javascript:alert(1)",
    status: "applied", status_source: "applied", applied_at: new Date(SEED_OLD).toISOString(), status_updated_at: new Date(SEED_OLD).toISOString() }],
}, { userId: USER.id });

const CONFIG = { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "anon", inboundDomain: "mail.pathmatch.app", providers: ["google"] };
const { w, doc, errors, signIn } = boot(CONFIG, backend);
const $ = (s) => doc.querySelector(s), $$ = (s) => [...doc.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true }));
const change = (el, v) => { el.value = v; el.dispatchEvent(new w.Event("change", { bubbles: true })); };
const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ");

// ---------------------------------------------------------------- signed out
await until(() => $("#acct"), 2000, "account panel");
assert.match($("#acct").textContent, /Email me a sign-in link/);
assert.ok($("#acctGoogle"), "Google button shown when listed in providers");
assert.equal($('.tab[data-t="apps"]').hidden, false);
click($("#sample"));
await until(() => $$("details.job").length > 10, 3000, "ranked list");
const firstJob = $("details.job");
assert.ok(firstJob.querySelector('button[data-pm="signin"]'), "signed-out visitors see a sign-in hint instead of a tracker button");
assert.equal(backend.db.matches.length, 0, "nothing is saved before sign-in");
click($('.tab[data-t="apps"]'));
assert.match($("#view").textContent, /Sign in to track your applications/);
click($('.tab[data-t="main"]'));

// ---------------------------------------------------------------- sign in: profile + matches saved privately
signIn();
await until(() => /Signed in as/.test($("#acct").textContent), 3000, "signed-in panel");
assert.match($("#acct").textContent, /student@example\.com/);
await until(() => backend.db.matches.length > 0, 5000, "matches saved");
const prof = backend.db.profiles.find((p) => p.user_id === USER.id);
assert.equal(backend.db.matches.length, 50);
assert.ok(backend.db.matches.every((m) => m.user_id === USER.id));
assert.ok(Object.keys(prof.cv_keywords.hits).length > 10, "keyword profile saved");
assert.ok(!("text" in prof.cv_keywords), "full CV text is not stored");
assert.equal(prof.work_permit, "unknown");
assert.ok(/^[0-9a-f]{24}$/.test(prof.inbox_token));

// ghosted history shows on that company's other postings
await until(() => $$(".pm-pill").some((p) => /Ghosted you before/.test(p.textContent)), 2000, "ghosted-before pill");

// consent: with "save" switched off, a new run stores nothing; switching it back on stores the latest state
const savedAt = prof.cv_saved_at;
$("#acctSave").checked = false; $("#acctSave").dispatchEvent(new w.Event("change", { bubbles: true }));
change($("#permit"), "ok");
await wait(2200);
assert.equal(prof.cv_saved_at, savedAt, "nothing saved while saving is off");
assert.equal(prof.work_permit, "unknown");
$("#acctSave").checked = true; $("#acctSave").dispatchEvent(new w.Event("change", { bubbles: true }));
await until(() => prof.work_permit === "ok", 5000, "saved after switching saving back on");

// ---------------------------------------------------------------- "I applied"
const target = $$("details.job").find((d) => d.querySelector('button[data-pm="applied"]') && !/labatt/.test(norm(d.dataset.key)));
const tKey = target.dataset.key, tCompany = tKey.split("|")[0];
click(target.querySelector('button[data-pm="applied"]'));
await until(() => backend.db.applications.some((a) => a.job_key === tKey), 2000, "application saved");
const app = backend.db.applications.find((a) => a.job_key === tKey);
assert.equal(app.status, "applied");
await until(() => /Tracked/.test(target.querySelector(".pm-actions").textContent), 2000, "button turns into Tracked");
assert.ok(target.querySelector(".pm-pill").textContent.includes("Applied"));

// ---------------------------------------------------------------- tracker tab
click($('.tab[data-t="apps"]'));
await until(() => $(".pm-table"), 2000, "tracker table");
assert.match($(".pm-addr").textContent, /^[0-9a-f]{24}@mail\.pathmatch\.app$/);
assert.ok($("#view").textContent.includes(app.title));
// XSS: hostile title is shown as text, hostile URL is neutralised
assert.equal($("#view img"), null, "no element injected from a posting title");
assert.equal(w.__xss, undefined);
const evilRow = $$(".pm-table tbody tr").find((r) => r.dataset.app === "seed-old");
assert.ok(evilRow.textContent.includes("<img"), "title rendered as text");
assert.equal(evilRow.querySelector("a").getAttribute("href"), "#");
assert.match(evilRow.textContent, /Ghosted\?/);

const slug = tCompany.replace(/[^a-z0-9]+/g, "");
const paste = async (text) => { $("#pmPaste").value = text; click($('[data-pm="paste"]')); const n = backend.db.email_events.length; await until(() => backend.db.email_events.length > n || /ignored|already/.test($("#pmPasteMsg").textContent), 3000, "pasted email processed"); };

// confirmation: matched to the right application, status unchanged
await paste(`From: "${tCompany} Careers" <careers@${slug}.com>\nSubject: Thank you for applying - ${app.title}\n\nWe have received your application. If your qualifications match, we will contact you to schedule an interview.`);
let ev = backend.db.email_events.at(-1);
assert.equal(ev.kind, "confirmation"); assert.equal(ev.application_id, app.id); assert.equal(app.status, "applied");
assert.ok(app.confirmed_at);
await until(() => /matched to/.test($("#pmPasteMsg").textContent), 2000, "match message");

// interview invitation: status moves to interview
await wait(5);
await paste(`From: "${tCompany} Careers" <careers@${slug}.com>\nSubject: Interview invitation - ${app.title}\n\nWe would like to invite you to a video interview. Please select a time that works for you.`);
assert.equal(app.status, "interview"); assert.equal(app.status_source, "email");
await until(() => $$(".pm-table tbody tr").find((r) => r.dataset.app === app.id).querySelector("select").value === "interview", 2000, "table shows interview");

// not a job email: ignored, nothing stored
const before = backend.db.email_events.length;
$("#pmPaste").value = "From: News <news@example.com>\nSubject: Weekly newsletter\n\nHere is what happened this week in the world of widgets and gadgets.";
click($('[data-pm="paste"]'));
await until(() => /ignored/.test($("#pmPasteMsg").textContent), 2000, "ignored message");
assert.equal(backend.db.email_events.length, before);

// second application at the same company, then an email that names neither: must go to review, not be guessed
click($('.tab[data-t="main"]'));
const sibling = $$("details.job").find((d) => d.dataset.key.startsWith(tCompany + "|") && d.dataset.key !== tKey && d.querySelector('button[data-pm="applied"]'));
assert.ok(sibling, "test needs a second posting at the same company");
click(sibling.querySelector('button[data-pm="applied"]'));
await until(() => backend.db.applications.some((a) => a.job_key === sibling.dataset.key), 2000, "second application");
const app2 = backend.db.applications.find((a) => a.job_key === sibling.dataset.key);
click($('.tab[data-t="apps"]'));
await until(() => $(".pm-table"), 2000, "tracker");
await paste(`From: "${tCompany} Careers" <careers@${slug}.com>\nSubject: Update on your application\n\nUnfortunately, we have decided to pursue other candidates.`);
ev = backend.db.email_events.at(-1);
assert.equal(ev.kind, "rejection"); assert.equal(ev.needs_review, true); assert.equal(ev.application_id, null);
assert.ok(ev.candidates.includes(app.id) && ev.candidates.includes(app2.id));
assert.equal(app2.status, "applied", "nothing was changed by a guess");
await until(() => $(".pm-ev"), 2000, "review card");
change($(".pm-ev select"), app2.id);
click($('.pm-ev [data-pm="assign"]'));
await until(() => app2.status === "rejected", 2000, "assigned and applied");
assert.equal(app.status, "interview", "the other application is untouched");
await until(() => !$(".pm-ev"), 2000, "review card cleared");

// manual status change beats nothing else; stored as manual
change($$(".pm-table tbody tr").find((r) => r.dataset.app === app2.id).querySelector("select"), "withdrawn");
await until(() => app2.status === "withdrawn", 2000, "manual status");
assert.equal(app2.status_source, "manual");

// ghost window setting
change($("#pmGhost"), "45");
await until(() => prof.ghost_days === 45, 2000, "ghost days saved");
await until(() => !/Ghosted\?/.test($$(".pm-table tbody tr").find((r) => r.dataset.app === "seed-old").textContent), 2000, "40 days is within 45");

// rotate address, then Gmail verification code appears
const oldToken = prof.inbox_token;
click($('[data-pm="rotate"]'));
await until(() => prof.inbox_token !== oldToken, 2000, "token rotated");
await paste(`From: Gmail Team <forwarding-noreply@google.com>\nSubject: Gmail Forwarding Confirmation - Receive Mail from student@gmail.com\n\nstudent@gmail.com has requested to automatically forward mail to your email address. Confirmation code: 424242424`);
await until(() => /424242424/.test($("#view").textContent), 2000, "verification code shown");

// ---------------------------------------------------------------- block / unblock a company
click($('.tab[data-t="main"]'));
const labatt = $$("details.job").find((d) => d.dataset.key.startsWith("labatt|"));
click(labatt.querySelector('button[data-pm="block"]'));
await until(() => backend.db.blocked_companies.length === 1, 2000, "blocked");
await until(() => !$$("details.job").some((d) => d.dataset.key.startsWith("labatt|")), 2000, "blocked company hidden");
click($('.tab[data-t="apps"]'));
await until(() => $('[data-pm="unblock"]'), 2000, "blocked list");
click($('[data-pm="unblock"]'));
await until(() => backend.db.blocked_companies.length === 0, 2000, "unblocked");
click($('.tab[data-t="main"]'));
await until(() => $$("details.job").some((d) => d.dataset.key.startsWith("labatt|")), 2000, "company back");

// ---------------------------------------------------------------- export, sign out
let downloaded = null;
w.URL.createObjectURL = (b) => { downloaded = b; return "blob:x"; };
click($('.tab[data-t="apps"]'));
await until(() => $('[data-pm="export"]'), 2000, "export button");
click($('[data-pm="export"]'));
await until(() => downloaded, 2000, "export blob");
const exported = JSON.parse(await downloaded.text());
assert.equal(exported.email, USER.email);
assert.ok(exported.applications.length >= 3 && exported.email_events.length >= 3 && exported.matches.length === 50);

click($("#acctOut"));
await until(() => /Email me a sign-in link/.test($("#acct").textContent), 3000, "signed out");
assert.equal($("#paste").value, "", "CV text removed from the page on sign-out");
click($('.tab[data-t="main"]'));
assert.match($("#view").textContent, /Add your CV/);
assert.equal($$("details.job").length, 0, "no matches left on the page after sign-out");
click($('.tab[data-t="apps"]'));
assert.match($("#view").textContent, /Sign in to track/);

// ---------------------------------------------------------------- account deletion
signIn();
await until(() => /Signed in as/.test($("#acct").textContent), 3000, "signed in again");
click($('.tab[data-t="apps"]'));
await until(() => $('[data-pm="delacct"]'), 2000, "delete button");
click($('[data-pm="delacct"]'));
await until(() => backend.db.applications.length === 0 && backend.db.profiles.length === 0, 3000, "account data deleted");

assert.deepEqual(errors, [], "no script errors: " + errors.join(" | "));
w.close();

// ---------------------------------------------------------------- not configured: the site is unchanged
const plain = boot({ supabaseUrl: "", supabaseAnonKey: "", inboundDomain: "", providers: [] }, null);
await wait(100);
assert.equal(plain.doc.querySelector("#acct"), null, "no account panel without keys");
assert.equal(plain.doc.querySelector('.tab[data-t="apps"]').hidden, true, "tracker tab hidden without keys");
plain.doc.getElementById("sample").dispatchEvent(new plain.w.MouseEvent("click", { bubbles: true }));
await until(() => plain.doc.querySelectorAll("details.job").length > 10, 3000, "ranked list without accounts");
assert.equal(plain.doc.querySelectorAll(".pm-actions").length, 0);
assert.deepEqual(plain.errors, [], "no script errors without accounts: " + plain.errors.join(" | "));
plain.w.close();

console.log("ui: all checks passed");
process.exit(0);
