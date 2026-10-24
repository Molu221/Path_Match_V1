// Used by test_oasis.py: runs docs/matcher.js on the posts and a CV, prints the answers as JSON.
// Usage: node test/matcher_harness.js skills.json cv.txt post1.txt post2.txt ...
const fs = require("fs");
const path = require("path");
// docs/matcher.js is a plain browser script, so load it the way a page does: into a sandbox with `self`
const vm = require("vm");
const sandbox = { self: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "docs", "matcher.js"), "utf8"), sandbox);
const Matcher = sandbox.self.Matcher;
const [dictPath, cvPath, ...posts] = process.argv.slice(2);
const engine = Matcher.engine(JSON.parse(fs.readFileSync(dictPath, "utf8")));
const cv = engine.findCv(fs.readFileSync(cvPath, "utf8"));
const out = { cv: Object.keys(cv), posts: {} };
for (const p of posts) {
  const text = fs.readFileSync(p, "utf8").split("\n").filter(l => !/^(JOB|COMPANY|SOURCE):/.test(l.trim())).join("\n");
  const r = engine.report(text, cv);
  out.posts[path.basename(p)] = {
    job: Object.keys(r.job), matched: r.matched, missing: r.missing, relatedCurated: r.relatedCurated,
    inferred: r.inferred.map(x => [x[0], x[1]]), coveragePct: r.coveragePct, coverageWithRelatedPct: r.coverageWithRelatedPct
  };
}
console.log(JSON.stringify(out));
