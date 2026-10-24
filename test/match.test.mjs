// Offline tests for matching an email to the right tracked application. Run: npm test
import assert from "node:assert/strict";
import { matchApplication } from "../supabase/functions/_shared/match.js";

const RECEIVED = new Date("2026-10-20T15:00:00Z");
const day = (n) => new Date(RECEIVED.getTime() - n * 864e5).toISOString();
const apps = [
  { id: "bb-qa",  company: "Bombardier", title: "Intern, Quality Analyst (Winter 2027)", applied_at: day(3) },
  { id: "bb-oe",  company: "Bombardier", title: "Intern, Operational Excellence (Winter 2027)", applied_at: day(3) },
  { id: "bb-ind", company: "Bombardier", title: "Intern, Industrialization (Winter 2027)", applied_at: day(3) },
  { id: "cae",    company: "CAE", title: "Stagiaire - Spécialiste de données", applied_at: day(4) },
  { id: "mod",    company: "Moderna", title: "Co-Op, Supply Chain Planning", applied_at: day(2) },
  { id: "pw",     company: "Pratt & Whitney", title: "Internship - Material Management Lead - Winter 2027", applied_at: day(5) },
  { id: "ipex",   company: "IPEX by Aliaxis", title: "Project Engineering Co-op Student, Winter 2027", applied_at: day(5) },
  { id: "old",    company: "Kruger Inc.", title: "Stagiaire analyse industrielle", applied_at: day(200) },
];
const m = (email, list = apps) => matchApplication({ body: "", fromName: "", fromEmail: "", subject: "", ...email }, list, RECEIVED);

// the title picks the right Bombardier application, even through a shared ATS sender
let r = m({ fromEmail: "bombardier@myworkday.com", fromName: "Bombardier Careers", subject: "Thank you for applying - Intern, Quality Analyst (Winter 2027)" });
assert.equal(r.appId, "bb-qa");

// three Bombardier applications and no title in the email: never guess, offer the candidates
r = m({ fromEmail: "careers@bombardier.com", subject: "Thank you for applying to Bombardier", body: "We received your application." });
assert.equal(r.appId, null);
assert.deepEqual([...r.candidates].sort(), ["bb-ind", "bb-oe", "bb-qa"]);

// short company names match on the whole domain label
assert.equal(m({ fromEmail: "careers@cae.com", subject: "Update on your application" }).appId, "cae");

// long names can be contained in the sender domain
assert.equal(m({ fromEmail: "no-reply@modernatx.com", subject: "We received your application" }).appId, "mod");

// punctuation and "&" in company names
assert.equal(m({ fromEmail: "talent@prattwhitney.com", subject: "Your application" }).appId, "pw");
assert.equal(m({ fromEmail: "hr@ipexna.com", fromName: "IPEX Talent", subject: "Your application" }).appId, "ipex");

// a title-only resemblance without the company is not enough
assert.equal(m({ fromEmail: "jobs@acme.com", subject: "Intern, Quality Analyst (Winter 2027)" }).appId, null);

// an email that predates the application cannot be a reply to it
const strongCae = { fromEmail: "careers@cae.com", fromName: "CAE Careers", subject: "CAE: Stagiaire Spécialiste de données" };
assert.equal(m(strongCae).appId, "cae", "sanity: this email is strong enough to match on its own");
assert.equal(m(strongCae, [{ ...apps[3], applied_at: new Date(RECEIVED.getTime() + 5 * 864e5).toISOString() }]).appId, null);

// very old applications are ignored
const strongKruger = { fromEmail: "careers@kruger.com", fromName: "Kruger Careers", subject: "Kruger - Stagiaire analyse industrielle" };
assert.equal(m(strongKruger, [{ ...apps[7], applied_at: day(20) }]).appId, "old", "sanity: matches when recent");
assert.equal(m(strongKruger).appId, null);

// shared ATS domains alone identify nobody
assert.equal(m({ fromEmail: "no-reply@greenhouse.io", subject: "Thanks for applying" }).appId, null);

console.log("match: all checks passed");
