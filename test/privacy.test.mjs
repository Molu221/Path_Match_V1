/* privacy.test.mjs - the privacy page says what the site keeps, and its button deletes only Path Match's own data.
 * Run: node test/privacy.test.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let pass = 0, fail = 0;
const ok = (what, cond, got) => {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + JSON.stringify(got) : "")); }
};
const html = fs.readFileSync(path.join(ROOT, "docs", "privacy.html"), "utf8");
const index = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");

/* a browser storage, as small as the page needs */
const store = (init) => { const m = new Map(Object.entries(init)); return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), keys: () => [...m.keys()] }; };
const src = /function wipePathMatch[\s\S]*?\n}\n/.exec(html)[0];
const ctx = {}; vm.createContext(ctx); vm.runInContext(src, ctx);
const local = store({ pm_prefs: "{}", pm_saved: "[]", pm_pasted: "{}", pm_extras: "{}", other_site_key: "keep me", theme: "dark" });
const session = store({ pm_cv: "My CV", other: "x" });
const n = ctx.wipePathMatch(local, session);
ok("the button deletes every Path Match item in this browser", n === 5 && !local.keys().some((k) => k.startsWith("pm_")) && session.getItem("pm_cv") === null, local.keys());
ok("...and nothing that belongs to another site on the same address", local.getItem("other_site_key") === "keep me" && local.getItem("theme") === "dark" && session.getItem("other") === "x");
ok("a second press finds nothing left", ctx.wipePathMatch(local, session) === 0);

ok("the page says the CV stays in the browser tab", /never sent to us/.test(html) && /session storage/.test(html));
ok("it lists every place the site keeps something", ["CV text", "choices", "Saved postings", "Profile extras"].every((w) => html.includes(w)));
ok("it names the outside services that see a visit", ["GitHub Pages", "Google Fonts", "cdnjs", "jsDelivr"].every((w) => html.includes(w)));
ok("about email it only says the features are coming", /Email features are coming\./.test(html) && !/Read-only/.test(html) && /arrivent bientôt/.test(html));
ok("it names the person in charge and the Quebec regulator (Law 25)", /Loïg Glo/.test(html) && /cai\.gouv\.qc\.ca/.test(html) && /Law 25/.test(html));
ok("it has a French summary", /lang="fr"/.test(html) && /Loi 25/.test(html));
ok("the start page and the CV page link to it", (index.match(/href="privacy\.html"/g) || []).length >= 2);
for (const f of ["impact-assessment.md", "incident-log.md", "email-rules.md"]) ok(`privacy/${f} is there`, fs.existsSync(path.join(ROOT, "privacy", f)));
ok("the incident log says to keep filled entries out of this public repository", /Keep the filled log private/.test(fs.readFileSync(path.join(ROOT, "privacy", "incident-log.md"), "utf8")));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
