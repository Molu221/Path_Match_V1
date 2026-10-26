// Loads the browser files docs/matcher.js and docs/jobmeta.js (plain scripts that set a global) into Node, the way a page does.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const DOCS = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs");
export function loadUmd(file, name) {
  const sandbox = { self: {} };
  vm.runInNewContext(fs.readFileSync(path.join(DOCS, file), "utf8"), sandbox, { filename: file });
  return sandbox.self[name];
}
export const loadJobMeta = () => loadUmd("jobmeta.js", "JobMeta");
export const loadMatcher = () => loadUmd("matcher.js", "Matcher");
export const loadSkills = () => JSON.parse(fs.readFileSync(path.join(DOCS, "skills.json"), "utf8"));
