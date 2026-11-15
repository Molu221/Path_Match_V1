/* Loads the browser files in docs/ into Node, the way a page does.
   The CommonJS twin of scripts/umd.mjs, for the tools in this folder. */
const fs = require("fs"), path = require("path"), vm = require("vm");
const DOCS = path.join(__dirname, "..", "docs");
function loadUmd(file, name) {
  const sandbox = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DOCS, file), "utf8"), sandbox, { filename: file });
  return sandbox.self[name];
}
module.exports = {
  loadUmd,
  loadMatcher: () => loadUmd("matcher.js", "Matcher"),
  loadJobMeta: () => loadUmd("jobmeta.js", "JobMeta"),
  docsJson: (f) => JSON.parse(fs.readFileSync(path.join(DOCS, f), "utf8")),
  DOCS
};
