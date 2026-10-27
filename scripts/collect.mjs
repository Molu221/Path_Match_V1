// Collects postings located anywhere in Canada, in every field (each saved with its province), from free sources and writes docs/jobs.json
// (one short record per posting) and docs/d/00.json ... 63.json (the full text of each posting, read by the page only when a card is opened).
// Sources (all free, none needs a login):
//   open feeds of Job Bank Canada and The Muse; Workday career sites (the public JSON behind the career page);
//   public job boards of Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee, Breezy, BambooHR, Personio, Teamtailor;
//   any career page that publishes schema.org JobPosting data; Adzuna, Jooble and Careerjet when their free key is set.
// Sites that forbid or block automated reading (LinkedIn, Indeed, Glassdoor, Monster, ZipRecruiter, Talent.com) are not read.
// No dependencies. Node 20+.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadJobMeta, loadMatcher, loadSkills } from "./umd.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "jobs.json");
const OUT_TEXT = path.join(ROOT, "docs", "d");     // the posting texts, in 64 files (see writeOutput)

export const AREA = /montr[eé]al|laval\b|longueuil|brossard|dorval|saint[- ]laurent|st[- ]laurent|pointe[- ]claire|sainte?[- ]anne[- ]de[- ]bellevue|boucherville|saint[- ]hubert|st[- ]hubert|vaudreuil|terrebonne|mirabel|varennes|candiac|la prairie|saint[- ]bruno|kirkland|lachine|anjou|westmount|verdun|mont[- ]royal|mount royal|saint[- ]eustache|repentigny|blainville|dollard|beaconsfield|pierrefonds|lasalle|ahuntsic|greater montr/i;
// There is no list of wanted job titles: a posting is kept when it is located in Canada, whatever the field.

/* ---------- where in Canada: the province of a location text, or "" when the place is not in Canada ---------- */
/* Names are matched on the lower-case, accent-free text. Two-letter codes (QC, ON...) are matched on the original text, upper case only,
   and the codes that other countries use too (NL Netherlands, SK Slovakia, PE Peru, NT Australia, YT Mayotte) need the word Canada beside them. */
const PROV_NAME = [
  ["QC", AREA, /\bquebec\b|\bgatineau\b|\bsherbrooke\b|\btrois[- ]rivieres\b|\bsaguenay\b|\blevis\b|\bdrummondville\b|\bgranby\b|\bsaint[- ]jerome\b|\brimouski\b|\bchicoutimi\b|\bshawinigan\b|\bjoliette\b/],
  ["ON", /\bontario\b|\btoronto\b|\bottawa\b|\bmississauga\b|\bbrampton\b|\bmarkham\b|\bvaughan\b|\bkitchener\b|\brichmond hill\b|\bscarborough\b|\betobicoke\b|\bnorth york\b|\bguelph\b|\boshawa\b|\boakville\b|\bpickering\b|\bgreater toronto\b/],
  ["BC", /\bbritish columbia\b|\bcolombie[- ]britannique\b|\bvancouver\b|\bburnaby\b|\bkelowna\b|\bcoquitlam\b|\babbotsford\b|\bnanaimo\b/],
  ["AB", /\balberta\b|\bcalgary\b|\bedmonton\b|\bred deer\b|\blethbridge\b|\bfort mcmurray\b/],
  ["SK", /\bsaskatchewan\b|\bsaskatoon\b/],
  ["MB", /\bmanitoba\b|\bwinnipeg\b/],
  ["NB", /\bnew brunswick\b|\bnouveau[- ]brunswick\b|\bfredericton\b|\bmoncton\b/],
  ["NS", /\bnova scotia\b|\bnouvelle[- ]ecosse\b|\bhalifax\b/],
  ["PE", /\bprince edward island\b|\bile[- ]du[- ]prince[- ]edouard\b|\bcharlottetown\b/],
  ["NL", /\bnewfoundland\b|\bterre[- ]neuve\b|\blabrador\b/],
  ["YT", /\byukon\b|\bwhitehorse\b/],
  ["NT", /\bnorthwest territories\b|\bterritoires du nord[- ]ouest\b|\byellowknife\b/],
  ["NU", /\bnunavut\b|\biqaluit\b/],
];
const PROV_CODE = /(?:^|[\s,(\/])(QC|ON|BC|AB|SK|MB|NB|NS|PE|PEI|NL|YT|NT|NU)(?=$|[\s,)\/.])/g;
const CODE_ALSO_ELSEWHERE = new Set(["SK", "PE", "NL", "NT", "YT"]);
const NOT_CANADA = /ontario,?\s*(ca\b|california)|vancouver,?\s*(wa\b|washington)/i;   // cities with a US namesake
export function provinceOf(loc) {
  const raw = String(loc || "");
  if (!raw.trim() || NOT_CANADA.test(raw)) return "";
  const u = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();   // accent-free, case kept (for the codes)
  const t = u.toLowerCase();
  const canada = /\bcanada\b|\bcanadian\b|\bcanadien/.test(t);
  if (!canada && /\b(france|belgium|belgique|suisse|switzerland|luxembourg|morocco|maroc|tunisia|tunisie|algeria|algerie|senegal)\b/.test(t)) return "";   // Anjou, Verdun, Saint-Laurent also exist there
  let best = "", at = Infinity;                          // with several places ("Toronto / Montreal") the first one named wins
  const see = (code, i) => { if (i >= 0 && i < at) { best = code; at = i; } };
  for (const [code, ...res] of PROV_NAME) for (const re of res) see(code, t.search(re));
  for (const m of u.matchAll(PROV_CODE)) {
    const code = m[1] === "PEI" ? "PE" : m[1];
    if (!CODE_ALSO_ELSEWHERE.has(code) || canada) see(code, m.index);
  }
  if (best) return best;
  if (canada) return /remote|teletravail|telework|telecommut|a distance|work from home|anywhere/.test(t) ? "Remote – Canada" : "Canada";
  return "";
}
export const inCanada = (loc) => provinceOf(loc) !== "";

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pretty = (slug) => slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const MAX_DESC = 30000;   // the whole posting: requirements often come after the first 7000 characters

const NAMED = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", hellip: "…", bull: "•" };
export function decode(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => { const n = parseInt(h, 16); return n === 10 || n === 13 ? "\n" : n === 160 ? " " : n > 31 && n < 0x110000 ? String.fromCodePoint(n) : " "; })
    .replace(/&#(\d+);/g, (m, d) => { const n = +d; return n === 10 || n === 13 ? "\n" : n === 160 ? " " : n > 31 && n < 0x110000 ? String.fromCodePoint(n) : " "; })
    .replace(/&([a-z]+);/gi, (m, name) => (name.toLowerCase() in NAMED ? NAMED[name.toLowerCase()] : m));
}
export function stripHtml(s) {
  // Greenhouse returns escaped HTML, so decode first, then strip tags, then decode again.
  return decode(decode(s).replace(/<\s*(br|\/p|\/li|\/h\d|\/div)\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
const hoursSince = (iso, nowMs) => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, (nowMs - t) / 36e5) : null;
};
const typeFrom = (s) => {
  const t = norm(s);
  if (/\b(interns?|internships?|stages?|stagiaires?|co-?ops?|students?|etudiants?)\b/.test(t) && !/\b(early|late|growth|seed)[- ]stage\b|\bstage manager\b/.test(t)) return "Internship";
  if (/part[- ]?time|temps partiel/.test(t)) return "Part-time";
  if (/contract|contrat|temporary|temporaire/.test(t)) return "Contract";
  if (/full[- ]?time|temps plein|permanent/.test(t)) return "Full-time";
  return "";
};

const UA = "Mozilla/5.0 (compatible; path-match/1.0; +https://github.com/Molu221/Path_Match_V1)";
export async function fetchText(url, opts = {}) {
  const { headers, ...rest } = opts;
  const r = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { "User-Agent": UA, Accept: "application/json", ...(headers || {}) }, ...rest });
  if (!r.ok) { const e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
  return r.text();
}
export async function fetchJson(url, opts = {}) {
  const t = await fetchText(url, opts);
  try { return JSON.parse(t); }
  catch { const e = new Error("not JSON (the board does not exist or redirects to a web page)"); e.status = 404; throw e; }
}
export const postJson = (url, body, headers = {}) =>
  fetchJson(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Language": "en-US", ...headers }, body: JSON.stringify(body) });

const keep = (j) => !!j.title && inCanada(j.loc);

/* ---------- Greenhouse ---------- */
export async function greenhouse(slug, nowMs) {
  const d = await fetchJson(`https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
  return (d.jobs || []).map((x) => ({
    company: x.company_name || pretty(slug), title: x.title, loc: (x.location && x.location.name) || "",
    date: String(x.first_published || x.updated_at || "").slice(0, 10), ageH: hoursSince(x.first_published || x.updated_at, nowMs),
    type: typeFrom(x.title), sources: [{ src: "Greenhouse", url: x.absolute_url }], desc: stripHtml(x.content).slice(0, MAX_DESC),
  })).filter((j) => j.title && keep(j));
}
/* ---------- Lever ---------- */
export async function lever(slug, nowMs) {
  const d = await fetchJson(`https://api.lever.co/v0/postings/${slug}?mode=json`);
  return (Array.isArray(d) ? d : []).map((x) => {
    const c = x.categories || {};
    const loc = [c.location, ...(c.allLocations || [])].filter(Boolean).join(" / ");
    const lists = (x.lists || []).map((l) => l.text + ": " + stripHtml(l.content)).join("\n");
    return {
      company: pretty(slug), title: x.text, loc,
      date: x.createdAt ? new Date(x.createdAt).toISOString().slice(0, 10) : "", ageH: x.createdAt ? Math.max(0, (nowMs - x.createdAt) / 36e5) : null,
      type: typeFrom((c.commitment || "") + " " + x.text), sources: [{ src: "Lever", url: x.hostedUrl }],
      desc: ((x.descriptionPlain || stripHtml(x.description)) + "\n" + lists).slice(0, MAX_DESC),
    };
  }).filter((j) => j.title && keep(j));
}
/* ---------- Ashby ---------- */
export async function ashby(slug, nowMs) {
  const d = await fetchJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=false`);
  return (d.jobs || []).filter((x) => x.isListed !== false).map((x) => ({
    company: pretty(slug), title: x.title, loc: [x.location, ...((x.secondaryLocations || []).map((s) => s.location))].filter(Boolean).join(" / "),
    date: String(x.publishedAt || "").slice(0, 10), ageH: hoursSince(x.publishedAt, nowMs),
    type: typeFrom((x.employmentType || "") + " " + x.title), sources: [{ src: "Ashby", url: x.jobUrl }],
    desc: (x.descriptionPlain || stripHtml(x.descriptionHtml)).slice(0, MAX_DESC),
  })).filter((j) => j.title && keep(j));
}
/* ---------- SmartRecruiters ---------- */
export async function smartrecruiters(slug, nowMs) {
  const out = [];
  for (let off = 0; off < 300; off += 100) {
    const d = await fetchJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=100&offset=${off}&country=ca`);
    const items = d.content || [];
    for (const x of items) {
      const l = x.location || {};
      const loc = [l.city, l.region, l.country].filter(Boolean).join(", ");
      if (!inCanada(loc)) continue;
      out.push({
        company: (x.company && x.company.name) || pretty(slug), title: x.name, loc,
        date: String(x.releasedDate || "").slice(0, 10), ageH: hoursSince(x.releasedDate, nowMs),
        type: typeFrom((x.typeOfEmployment && x.typeOfEmployment.label) + " " + x.name),
        sources: [{ src: "SmartRecruiters", url: `https://jobs.smartrecruiters.com/${slug}/${x.id}` }], desc: "", _ref: x.ref,
      });
    }
    if (items.length < 100) break;
  }
  for (const j of out.slice(0, 100)) {
    try {
      const det = await fetchJson(j._ref);
      const s = (det.jobAd && det.jobAd.sections) || {};
      j.desc = ["jobDescription", "qualifications", "additionalInformation"].map((k) => stripHtml(s[k] && s[k].text)).join("\n").slice(0, MAX_DESC);
    } catch {}
    delete j._ref;
  }
  out.forEach((j) => delete j._ref);
  return out;
}
/* ---------- Adzuna ---------- */
export async function adzuna(cfg, id, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    for (let page = 1; page <= cfg.pages; page++) {
      const u = new URL(`https://api.adzuna.com/v1/api/jobs/${cfg.country}/search/${page}`);
      u.search = new URLSearchParams({
        app_id: id, app_key: key, results_per_page: String(cfg.resultsPerPage), what: q, where: cfg.where,
        distance: String(cfg.distanceKm), max_days_old: String(cfg.maxDaysOld), sort_by: "date", "content-type": "application/json",
      }).toString();
      try {
        const d = await fetchJson(u.toString());
        ok++;
        for (const x of d.results || []) {
          out.push({
            company: (x.company && x.company.display_name) || "Unknown", title: x.title, loc: (x.location && x.location.display_name) || "",
            date: String(x.created || "").slice(0, 10), ageH: hoursSince(x.created, nowMs),
            type: x.contract_time === "part_time" ? "Part-time" : typeFrom(x.title + " " + (x.description || "")),
            sources: [{ src: "Adzuna", url: x.redirect_url }], desc: stripHtml(x.description).slice(0, MAX_DESC), partial: true,
          });
        }
        if ((d.results || []).length < cfg.resultsPerPage) break;
      } catch (e) { failed++; log(`Adzuna "${q}" page ${page}: ${e.message}`); if (e.status === 401 || e.status === 403) return { jobs: out, ok, failed, stop: e.message }; }
      await sleep(cfg.delayMs);
    }
  }
  return { jobs: out.filter((j) => j.title), ok, failed };
}

/* ---------- helpers for the sources below ---------- */
const cut = (s) => String(s || "").slice(0, MAX_DESC);
const cdata = (s) => String(s || "").replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
const xmlGet = (block, tag) => { const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(block); return m ? cdata(m[1]).trim() : ""; };
const xmlAll = (xml, tag) => [...String(xml).matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"))].map((m) => m[1]);
/* some feeds give the whole posting as one paragraph: put the usual headings on their own line so the page can tag Required / Task / Preferred */
export function breakHeadings(text) {
  if ((String(text).match(/\n/g) || []).length > 6) return text;
  return String(text).replace(/\s*\b(What You'?ll Be Doing|A Day in the Life|Preferred Qualifications|Minimum Qualifications|Requirements?|Requirments|Qualifications|Responsibilities|Nice to Have|Education|Skills|Duties|Exigences|Qualifications requises|Responsabilit[ée]s|Atouts?)\s*:\s*/gi, "\n$1\n");
}
/* schema.org JobPosting data that many career pages publish for Google for Jobs */
export function jsonLdJobs(html) {
  const out = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) return o.forEach(walk);
    const t = o["@type"];
    if (t === "JobPosting" || (Array.isArray(t) && t.includes("JobPosting"))) out.push(o);
    if (o["@graph"]) walk(o["@graph"]);
  };
  for (const m of String(html).matchAll(/<script[^>]+application\/ld(?:\+|&#x2B;|&#43;|&plus;)json[^>]*>([\s\S]*?)<\/script>/gi)) {   // some sites write the plus sign as an entity
    try { walk(JSON.parse(m[1].trim())); } catch { /* not valid JSON: skip this block */ }
  }
  return out;
}
export function jobFromJsonLd(x, nowMs, srcName, pageUrl) {
  const locs = [].concat(x.jobLocation || []).map((l) => { const a = (l && l.address) || {}; return [a.addressLocality, a.addressRegion, typeof a.addressCountry === "string" ? a.addressCountry : (a.addressCountry && a.addressCountry.name)].filter(Boolean).join(", "); });
  const org = x.hiringOrganization;
  return {
    company: (org && (org.name || (typeof org === "string" && org))) || "", title: x.title || x.name || "", loc: locs.filter(Boolean).join(" / "),
    date: String(x.datePosted || "").slice(0, 10), ageH: hoursSince(x.datePosted, nowMs),
    type: typeFrom([].concat(x.employmentType || []).join(" ") + " " + (x.title || "")),
    sources: [{ src: srcName, url: x.url || pageUrl }], desc: cut(stripHtml(x.description)),
  };
}

/* ---------- Job Bank Canada (free, public; robots.txt asks for 5 seconds between requests) ---------- */
export function atomEntries(xml) {
  const out = [];
  for (const m of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1], link = (/<link[^>]*href="([^"]+)"/.exec(e) || [])[1] || "";
    const sum = cdata(xmlGet(e, "summary"));
    const field = (label) => { const x = new RegExp("<strong>" + label + ":</strong>\\s*([^<]*)", "i").exec(sum); return x ? decode(x[1]).trim() : ""; };
    out.push({ title: decode(xmlGet(e, "title")), url: link, id: (/jobposting\/(\d+)/.exec(link) || [])[1], updated: xmlGet(e, "updated"), loc: field("Location"), employer: field("Employer"), salary: field("Salary") });
  }
  return out;
}
export function jobbankDetail(html) {
  const pick = (re) => { const m = re.exec(html); return m ? stripHtml(m[1]).trim() : ""; };
  const srcTitle = pick(/<span class="orig-title-label">[\s\S]*?<\/span>\s*([^<]+)</);
  const nocTitle = pick(/<span property="title">\s*([^<]+?)\s*<\/span>/);
  const employer = pick(/property="hiringOrganization"[\s\S]*?<span property="name">\s*(?:<strong>)?\s*([^<]+?)\s*(?:<\/strong>)?\s*<\/span>/);
  const description = pick(/<span class="hidden" property="description">([\s\S]*?)<\/span>/);
  const ext = /<a[^>]+id="externalJobLink"[^>]+href="([^"]+)"[^>]*>[\s\S]*?<span class="job-source[^"]*"><\/span>\s*([^<]+?)\s*<span/.exec(html);
  const brief = (/<ul class="job-posting-brief[^"]*">([\s\S]*?)<\/ul>/.exec(html) || [])[1] || "";
  const summary = stripHtml(brief.replace(/<\/li>/g, "\n").replace(/<span class="wb-inv">([^<]*)<\/span>/g, "$1: ")).split("\n").map((l) => l.trim()).filter((l) => l && !/^Salary:\s*$/.test(l)).join("\n");
  // a direct posting keeps its requirements in separate blocks
  const req = [...html.matchAll(/<(?:div|section)[^>]*class="[^"]*job-posting-detail-requirements[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section)>\s*(?=<(?:div|section)|$)/g)].map((m) => stripHtml(m[1].replace(/<\/(li|p|h\d)>/g, "\n"))).join("\n");
  return { title: srcTitle || nocTitle, nocTitle, employer, summary, description, req, partner: ext ? { url: decode(ext[1]), name: ext[2].trim() } : null };
}
/* an internship stays an internship even when the posting is part time; otherwise the "Terms of employment" line decides */
const jbType = (title, summary) => { const t = typeFrom(title); return t === "Internship" ? t : typeFrom(summary) || t; };
/* The feed gives at most 100 postings per search and has no second page, so the number of postings found is the number of different searches:
   keywords across the whole country, one search per province with no keyword, and the busiest keywords in each big city. */
export function jobbankSearches(cfg) {
  const out = [];
  for (const q of cfg.nationwide || []) out.push({ q, where: "" });
  for (const where of cfg.provinces || []) out.push({ q: "", where });
  const places = cfg.places && cfg.places.length ? cfg.places : cfg.where ? [cfg.where] : [];
  for (const q of cfg.queries || []) for (const where of places.length ? places : [""]) out.push({ q, where });
  return out;
}
export async function jobbank(cfg, nowMs, log, pause = sleep) {
  const base = "https://www.jobbank.gc.ca/jobsearch/";
  const seen = new Map();
  let ok = 0, failed = 0, skipped = 0;
  const started = Date.now();
  const searches = jobbankSearches(cfg);
  for (const { q, where } of searches) {
    if (cfg.budgetMs && Date.now() - started > cfg.budgetMs) { skipped++; continue; }
    const u = `${base}feed/jobSearchRSSfeed?searchstring=${encodeURIComponent(q)}&locationstring=${encodeURIComponent(where)}&fage=${cfg.maxDaysOld}&sort=D&rows=100`;
    try {
      const xml = await fetchText(u, { headers: { Accept: "application/atom+xml,application/xml,*/*" } }); ok++;
      let n = 0, fresh = 0;
      for (const e of atomEntries(xml)) { n++; if (e.id && !seen.has(e.id)) { seen.set(e.id, { ...e, q: q || where }); fresh++; } }
      if (cfg.verbose !== false) log(`Job Bank "${q}" in "${where}": ${n} listed, ${fresh} new`);
    }
    catch (e) { failed++; log(`Job Bank "${q}" in ${where}: ${e.message}`); }
    await pause(cfg.delayMs);
  }
  if (skipped) log(`Job Bank: ${skipped} searches skipped (time budget of ${Math.round(cfg.budgetMs / 60000)} minutes used)`);
  const all = [...seen.values()].filter((e) => inCanada(e.loc)).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
  /* one lane per search word, newest first, taken in turn: the postings that are opened (5 seconds each) then come from every kind of work, not only from the word that found the most */
  const lanes = new Map();
  for (const e of all) { if (!lanes.has(e.q)) lanes.set(e.q, []); lanes.get(e.q).push(e); }
  const queue = [], L = [...lanes.values()];
  for (let i = 0; L.some((l) => i < l.length); i++) for (const l of L) if (i < l.length) queue.push(l[i]);
  const cand = queue.slice(0, cfg.maxDetails);
  const jobs = [];
  for (const e of cand) {
    const url = `https://www.jobbank.gc.ca/jobsearch/jobposting/${e.id}`;
    let d = null;
    try { d = jobbankDetail(await fetchText(url, { headers: { Accept: "text/html" } })); } catch (err) { failed++; log(`Job Bank ${e.id}: ${err.message}`); }
    await pause(cfg.delayMs);
    if (d && !d.description && !d.req) {      // partner postings show their text only on the French page
      try { const fr = jobbankDetail(await fetchText(`https://www.guichetemplois.gc.ca/jobsearch/jobposting/${e.id}`, { headers: { Accept: "text/html" } })); d.description = fr.description; d.req = fr.req; } catch { /* keep what we have */ }
      await pause(cfg.delayMs);
    }
    const body = d ? breakHeadings([d.summary && "Job summary:\n" + d.summary, d.description, d.req].filter(Boolean).join("\n")) : "";
    const full = d && (d.description || d.req);
    jobs.push({
      company: (d && d.employer) || e.employer || "Unknown", title: (d && d.title) || e.title, loc: e.loc.replace(/\s*\((\w\w)\)\s*$/, ", $1"),
      date: e.updated.slice(0, 10), ageH: hoursSince(e.updated, nowMs),
      type: jbType(((d && d.title) || e.title) + " " + e.title, (d && d.summary) || ""),
      sources: [{ src: "Job Bank", url }, ...(d && d.partner ? [{ src: d.partner.name, url: d.partner.url }] : [])], desc: cut(body), ...(full ? {} : { partial: true }),
    });
  }
  /* the rest of the list is not opened one by one (5 seconds each): it is kept with its title, employer, place and date only */
  for (const e of queue.slice(cfg.maxDetails, cfg.maxDetails + (cfg.maxListed ?? 1e6))) {
    jobs.push({
      company: e.employer || "Unknown", title: e.title, loc: e.loc.replace(/\s*\((\w\w)\)\s*$/, ", $1"),
      date: e.updated.slice(0, 10), ageH: hoursSince(e.updated, nowMs), type: typeFrom(e.title),
      sources: [{ src: "Job Bank", url: `https://www.jobbank.gc.ca/jobsearch/jobposting/${e.id}` }], desc: "", partial: true,
    });
  }
  return { jobs: jobs.filter((j) => j.title), ok, failed, listed: seen.size, inArea: all.length, ...(skipped ? { skipped } : {}) };
}

/* ---------- The Muse (free public API, no key needed for testing: 500 requests an hour) ---------- */
export async function muse(cfg, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  const key = process.env.MUSE_API_KEY ? `&api_key=${encodeURIComponent(process.env.MUSE_API_KEY)}` : "";
  const places = cfg.locations && cfg.locations.length ? cfg.locations : [cfg.location];
  for (const place of places) {
    for (const level of cfg.levels) {
      for (let page = 0; page < cfg.pages; page++) {
        try {
          const d = await fetchJson(`https://www.themuse.com/api/public/jobs?page=${page}&location=${encodeURIComponent(place)}&level=${encodeURIComponent(level)}${key}`);
          ok++;
          for (const x of d.results || []) out.push({
            company: (x.company && x.company.name) || "Unknown", title: x.name, loc: (x.locations || []).map((l) => l.name).join(" / "),
            date: String(x.publication_date || "").slice(0, 10), ageH: hoursSince(x.publication_date, nowMs),
            type: (x.levels || []).some((l) => /intern/i.test(l.name)) ? "Internship" : typeFrom(x.name),
            sources: [{ src: "The Muse", url: (x.refs && x.refs.landing_page) || "" }], desc: cut(stripHtml(x.contents)),
          });
          if (page + 1 >= (d.page_count || 0)) break;
        } catch (e) { failed++; log(`The Muse ${place} ${level} page ${page}: ${e.message}`); break; }
        await sleep(250);
      }
    }
  }
  return { jobs: out.filter(keep), ok, failed };
}

/* ---------- Workday career sites (the JSON behind every myworkdayjobs.com page, no login) ---------- */
/* a Workday career page address (https://cae.wd3.myworkdayjobs.com/en-US/career) is enough: the tenant is the first part of the host */
export function workdayFromUrl(url, name) {
  const u = new URL(url);
  const parts = u.pathname.split("/").filter(Boolean).filter((x) => !/^[a-z]{2}-[A-Z]{2}$/.test(x));
  const tenant = u.hostname.split(".")[0];
  if (!/\.myworkdayjobs\.com$/.test(u.hostname) || !parts[0]) throw new Error("not a Workday career page address: " + url);
  return { name: name || pretty(tenant), host: u.hostname, tenant, site: parts[0] };
}
const WD_AGE = (t) => { const s = norm(t); if (/today|aujourd/.test(s)) return 8; if (/yesterday|hier/.test(s)) return 32; const m = /(\d+)\+?\s*(?:days?|jours?)/.exec(s); return m ? (+m[1]) * 24 + (/\+/.test(s) ? 24 : 12) : null; };
/* Workday lists the countries of a career site in the `facets` of its answer. The one called Canada selects every posting in Canada. */
export function canadaFacet(facets) {
  let found = null;
  const walk = (list) => {
    for (const f of list || []) {
      if (found) return;
      if (/country/i.test(f.facetParameter || "")) {
        const v = (f.values || []).find((x) => /^canada$/i.test(String(x.descriptor || "").trim()));
        if (v && v.id) { found = { param: f.facetParameter, id: v.id, count: v.count }; return; }
      }
      walk(f.values);      // the groups nest: locationMainGroup -> locationCountry -> Canada
    }
  };
  walk(facets);
  return found;
}
const WD_CITIES = ["Canada", "Montreal", "Toronto", "Vancouver", "Calgary", "Ottawa", "Edmonton", "Winnipeg", "Halifax", "Quebec", "Mississauga", "stage", "intern"];
/* Every Canadian posting of a career site: the title, place and age of all of them (20 per request), and the full text of the newest `maxDetails`. */
export async function workday(b, nowMs, log) {
  const base = `https://${b.host}/wday/cxs/${b.tenant}/${b.site}`;
  const maxList = b.maxList || 3000, maxDetails = b.maxDetails ?? 100;
  const page = (applied, off, q) => postJson(`${base}/jobs`, { appliedFacets: applied, limit: 20, offset: off, searchText: q || "" });
  const first = await page({}, 0, "");
  const fac = canadaFacet(first.facets);
  const found = new Map();
  const read = async (applied, q, limit, head) => {
    for (let off = 0; off < limit; off += 20) {
      const d = off === 0 && head ? head : await page(applied, off, q);
      const rows = d.jobPostings || [];
      for (const p of rows) found.set(p.externalPath, p);
      if (rows.length < 20 || (d.total != null && off + 20 >= d.total)) break;
      await sleep(80);
    }
  };
  if (fac) await read({ [fac.param]: [fac.id] }, "", maxList);                                  // the site says which postings are in Canada
  else if ((first.total || 0) <= maxList) await read({}, "", maxList, first);                   // a site without that facet: read it all
  else for (const q of b.queries || WD_CITIES) await read({}, q, 400);                          // a very big site without it: search the Canadian cities
  const known = (p) => !!fac || inCanada(p.locationsText || "");
  const rows = [...found.values()].filter((p) => known(p) || /\d+\s+locations?/i.test(p.locationsText || "") || !p.locationsText)
    .sort((x, y) => (WD_AGE(x.postedOn) ?? 1e9) - (WD_AGE(y.postedOn) ?? 1e9));
  const out = [];
  for (const p of rows.slice(0, maxDetails)) {
    try {
      const det = await fetchJson(`${base}${p.externalPath}`, { headers: { Accept: "application/json", "Accept-Language": "en-US" } });
      const i = det.jobPostingInfo || {};
      const loc = [i.location, ...(i.additionalLocations || [])].filter(Boolean).join(" / ") || p.locationsText || "";
      const posted = i.startDate ? Date.parse(i.startDate + "T00:00:00Z") : null;
      out.push({
        company: b.name, title: i.title || p.title, loc: fac && !inCanada(loc) ? (loc ? loc + ", Canada" : "Canada") : loc, date: i.startDate || "",
        ageH: posted ? Math.max(0, (nowMs - posted) / 36e5) : WD_AGE(i.postedOn || p.postedOn),
        type: typeFrom(`${i.timeType || ""} ${i.title || p.title}`),
        sources: [{ src: "Workday", url: i.externalUrl || `https://${b.host}/${b.site}${p.externalPath}` }], desc: cut(stripHtml(i.jobDescription)),
      });
    } catch (e) { if (e.status !== 404) log(`Workday ${b.tenant} ${p.externalPath}: ${e.message}`); }
    await sleep(80);
  }
  /* the rest of the list is kept with its title, place and age only; the age is turned into a date so the record does not change from one day to the next */
  for (const p of rows.slice(maxDetails)) {
    if (!known(p)) continue;
    const age = WD_AGE(p.postedOn);
    const date = age == null ? "" : new Date(nowMs - age * 36e5).toISOString().slice(0, 10);
    const loc = p.locationsText || "";
    out.push({
      company: b.name, title: p.title, loc: inCanada(loc) ? loc : (loc ? loc + ", Canada" : "Canada"), date,
      ageH: date ? hoursSince(date + "T12:00:00Z", nowMs) : null, type: typeFrom(p.title),
      sources: [{ src: "Workday", url: `https://${b.host}/${b.site}${p.externalPath}` }], desc: "", partial: true,
    });
  }
  return out.filter(keep);
}

/* ---------- more public job boards ---------- */
export async function workable(slug, nowMs) {
  const d = await fetchJson(`https://apply.workable.com/api/v1/widget/accounts/${slug}?details=true`);
  return (d.jobs || []).map((x) => ({
    company: d.name || pretty(slug), title: x.title,
    loc: [...new Set([[x.city, x.state, x.country].filter(Boolean).join(", "), ...(x.locations || []).map((l) => [l.city, l.region, l.country].filter(Boolean).join(", "))].filter(Boolean))].join(" / ") + (x.telecommuting ? " / Remote" : ""),
    date: String(x.published_on || x.created_at || "").slice(0, 10), ageH: hoursSince(x.published_on || x.created_at, nowMs),
    type: typeFrom((x.employment_type || "") + " " + x.title), sources: [{ src: "Workable", url: x.url || x.shortlink }], desc: cut(stripHtml(x.description)),
  })).filter((j) => j.title && keep(j));
}
export async function recruitee(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.recruitee.com/api/offers/`);
  return (d.offers || []).map((x) => ({
    company: x.company_name || pretty(slug), title: x.title,
    loc: (x.location || [x.city, x.country].filter(Boolean).join(", ")) + (x.country_code === "CA" && !/canada/i.test(x.location || x.country || "") ? ", Canada" : "") + (x.remote ? " / Remote" : ""),
    date: String(x.published_at || x.created_at || "").slice(0, 10), ageH: hoursSince(x.published_at || x.created_at, nowMs),
    type: typeFrom((x.employment_type_code || "") + " " + x.title), sources: [{ src: "Recruitee", url: x.careers_url }],
    desc: cut(stripHtml((x.description || "") + "\n" + (x.requirements || ""))),
  })).filter((j) => j.title && keep(j));
}
export async function breezy(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.breezy.hr/json`);
  if (!Array.isArray(d)) throw Object.assign(new Error("not a Breezy board"), { status: 404 });
  const jobs = d.map((x) => ({
    company: (x.company && x.company.name) || pretty(slug), title: x.name, loc: (x.location && x.location.name) || "",
    date: String(x.published_date || "").slice(0, 10), ageH: hoursSince(x.published_date, nowMs),
    type: typeFrom(((x.type && x.type.name) || "") + " " + x.name), sources: [{ src: "Breezy", url: x.url }], desc: cut(stripHtml(x.description || "")),
  }));
  for (const j of jobs.filter((j) => !j.desc && inCanada(j.loc)).slice(0, 40)) {   // the list has no text: read the posting's own page
    try { const ld = jsonLdJobs(await fetchText(j.sources[0].url, { headers: { Accept: "text/html" } }))[0]; if (ld) j.desc = cut(stripHtml(ld.description)); } catch { /* keep the title only */ }
  }
  return jobs.filter((j) => j.title && keep(j));
}
export async function bamboohr(slug, nowMs) {
  const d = await fetchJson(`https://${slug}.bamboohr.com/careers/list`);
  if (!d || !Array.isArray(d.result)) throw Object.assign(new Error("not a BambooHR board"), { status: 404 });
  const out = [];
  for (const x of d.result) {
    const loc = [x.location && x.location.city, x.location && x.location.state].filter(Boolean).join(", ");
    if (!inCanada(loc)) continue;
    let desc = "", date = "";
    try { const det = await fetchJson(`https://${slug}.bamboohr.com/careers/${x.id}/detail`); const o = (det.result && det.result.jobOpening) || {}; desc = cut(stripHtml(o.description)); date = String(o.datePosted || "").slice(0, 10); } catch { /* title only */ }
    out.push({ company: pretty(slug), title: x.jobOpeningName, loc, date, ageH: hoursSince(date, nowMs), type: typeFrom((x.employmentStatusLabel || "") + " " + x.jobOpeningName),
      sources: [{ src: "BambooHR", url: `https://${slug}.bamboohr.com/careers/${x.id}` }], desc });
  }
  return out.filter(keep);
}
export async function personio(slug, nowMs) {
  let xml = "", base = "";
  for (const host of [`${slug}.jobs.personio.de`, `${slug}.jobs.personio.com`]) {
    try { xml = await fetchText(`https://${host}/xml?language=en`, { headers: { Accept: "application/xml,text/xml,*/*" } }); } catch (e) { if (e.status === 404) continue; throw e; }
    if (xml.includes("<workzag-jobs")) { base = host; break; }
    xml = "";
  }
  if (!xml) throw Object.assign(new Error("not a Personio board"), { status: 404 });
  return xmlAll(xml, "position").map((p) => {
    const parts = xmlAll(p, "jobDescription").map((d) => `${xmlGet(d, "name")}\n${stripHtml(xmlGet(d, "value"))}`);
    const created = xmlGet(p, "createdAt");
    return { company: xmlGet(p, "subcompany") || pretty(slug), title: xmlGet(p, "name"), loc: [xmlGet(p, "office"), ...xmlAll(p, "additionalOffices").flatMap((a) => xmlAll(a, "office"))].filter(Boolean).join(" / "),
      date: created.slice(0, 10), ageH: hoursSince(created, nowMs), type: typeFrom(`${xmlGet(p, "employmentType")} ${xmlGet(p, "schedule")} ${xmlGet(p, "name")}`),
      sources: [{ src: "Personio", url: `https://${base}/job/${xmlGet(p, "id")}` }], desc: cut(parts.join("\n")) };
  }).filter((j) => j.title && keep(j));
}
export async function teamtailor(slug, nowMs) {
  const xml = await fetchText(`https://${slug}.teamtailor.com/jobs.rss`, { headers: { Accept: "application/rss+xml,application/xml,*/*" } });
  if (!/<rss|<channel/.test(xml)) throw Object.assign(new Error("not a Teamtailor board"), { status: 404 });
  return xmlAll(xml, "item").map((it) => {
    const pub = xmlGet(it, "pubDate");
    const cities = xmlAll(it, "tt:city").map(cdata).filter(Boolean);
    return { company: pretty(slug), title: decode(xmlGet(it, "title")), loc: cities.length ? cities.join(" / ") : xmlGet(it, "tt:location") || "", date: pub ? new Date(pub).toISOString().slice(0, 10) : "",
      ageH: hoursSince(pub, nowMs), type: typeFrom(decode(xmlGet(it, "title"))), sources: [{ src: "Teamtailor", url: xmlGet(it, "link") }], desc: cut(stripHtml(xmlGet(it, "description"))) };
  }).filter((j) => j.title && keep(j));
}
/* any career page or posting page that publishes schema.org JobPosting data */
export async function pages(urls, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const u of urls) {
    try { const html = await fetchText(u, { headers: { Accept: "text/html" } }); ok++; for (const x of jsonLdJobs(html)) out.push(jobFromJsonLd(x, nowMs, "Career page", u)); }
    catch (e) { failed++; log(`Career page ${u}: ${e.message}`); }
    await sleep(500);
  }
  return { jobs: out.filter((j) => j.title && j.company && keep(j)), ok, failed };
}

/* ---------- search services that give a free key (set the key as a repository secret to switch them on) ---------- */
export async function jooble(cfg, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    try {
      const d = await postJson(`https://jooble.org/api/${key}`, { keywords: q, location: cfg.where, page: 1 });
      ok++;
      for (const x of d.jobs || []) out.push({ company: x.company || "Unknown", title: stripHtml(x.title), loc: x.location || "", date: String(x.updated || "").slice(0, 10), ageH: hoursSince(x.updated, nowMs),
        type: typeFrom((x.type || "") + " " + x.title), sources: [{ src: "Jooble", url: x.link }], desc: cut(stripHtml(x.snippet)), partial: true });
    } catch (e) { failed++; log(`Jooble "${q}": ${e.message}`); if (e.status === 401 || e.status === 403) break; }
    await sleep(cfg.delayMs || 1000);
  }
  return { jobs: out.filter((j) => j.title && keep(j)), ok, failed };
}
export async function careerjet(cfg, key, nowMs, log) {
  const out = [];
  let ok = 0, failed = 0;
  for (const q of cfg.queries) {
    try {
      const u = new URL("https://search.api.careerjet.net/v4/query");
      u.search = new URLSearchParams({ locale_code: cfg.locale || "en_CA", keywords: q, location: cfg.where, sort: "date", page: "1", page_size: "50", user_ip: "127.0.0.1", user_agent: UA }).toString();
      const d = await fetchJson(u.toString(), { headers: { Authorization: "Basic " + Buffer.from(key + ":").toString("base64"), Accept: "application/json" } });
      ok++;
      for (const x of d.jobs || []) out.push({ company: x.company || "Unknown", title: stripHtml(x.title), loc: x.locations || "", date: String(x.date || "").slice(0, 10), ageH: hoursSince(x.date, nowMs),
        type: typeFrom(x.title + " " + (x.description || "")), sources: [{ src: "Careerjet", url: x.url }], desc: cut(stripHtml(x.description)), partial: true });
    } catch (e) { failed++; log(`Careerjet "${q}": ${e.message}`); if (e.status === 401 || e.status === 403) break; }
    await sleep(cfg.delayMs || 1000);
  }
  return { jobs: out.filter((j) => j.title && keep(j)), ok, failed };
}

/* Which postings go into jobs.json. All of them, unless there are more than `maxJobs` (the page keeps every record in memory):
   then the internships, co-ops and part-time jobs go in first (they are the rarest) and the rest are shared out one by one across the
   fields (software, health, trades, finance...), newest first, with at most `perCompany` from one employer, so no field or employer fills the list.
   The posting texts are not in jobs.json (they are in docs/d), so the size of the texts no longer limits how many postings are kept. */
export function selectJobs(jobs, { maxJobs = 60000, perCompany = 1500, rareShare = 0.3 } = {}) {
  const fresh = (a, b) => (a.ageH ?? 1e9) - (b.ageH ?? 1e9);
  if (jobs.length <= maxJobs) return jobs.slice().sort(fresh);
  const meta = loadJobMeta();
  const per = new Map(), taken = new Set(), out = [];
  const take = (j, cap) => {
    const c = norm(j.company);
    if ((per.get(c) || 0) >= cap || out.length >= maxJobs) return false;
    per.set(c, (per.get(c) || 0) + 1); out.push(j); taken.add(j); return true;
  };
  const sorted = jobs.slice().sort(fresh);
  let rare = 0;
  for (const j of sorted) {
    if (!(j.type === "Internship" || j.type === "Part-time" || meta.jobLevel(j.title, "", "").lvl === 0)) continue;
    if (rare >= maxJobs * rareShare) break;
    if (take(j, perCompany * 2)) rare++;
  }
  const queues = new Map();
  for (const j of sorted) {
    if (taken.has(j)) continue;
    const f = meta.fieldOf(j.title).id;
    if (!queues.has(f)) queues.set(f, []);
    queues.get(f).push(j);
  }
  const lists = [...queues.values()], at = lists.map(() => 0);
  let progress = true;
  while (progress && out.length < maxJobs) {
    progress = false;
    for (let k = 0; k < lists.length; k++) {
      while (at[k] < lists[k].length) { if (take(lists[k][at[k]++], perCompany)) { progress = true; break; } }
    }
  }
  return out.sort(fresh);
}

/* ---------- the two kinds of file ---------- */
/* A posting has a short id (from its company and title, the same key that merges duplicates). Its text is saved in one of 64 files by id,
   so the page loads a file only when a card is opened, and the same posting is in the same place and the same order every day (the daily
   change in the repository is then only the postings that came and went). */
export const SHARDS = 64;
export const jobId = (j) => crypto.createHash("sha1").update(norm(j.company) + "|" + norm(j.title)).digest("hex").slice(0, 10);
export const shardOf = (id) => String(parseInt(String(id).slice(0, 2), 16) >> 2).padStart(2, "0");
export function splitJobs(out) {
  const at = Date.parse(out.updatedAt);
  const texts = Array.from({ length: SHARDS }, () => ({}));
  const jobs = out.jobs.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)).map((j) => {
    const { desc, ageH, ...rest } = j;
    if (desc) texts[+shardOf(j.id)][j.id] = desc;
    /* the moment of posting (not "hours ago"), rounded to the second: it does not change from one day to the next */
    return ageH == null ? rest : { ...rest, postedAt: new Date(Math.round((at - ageH * 36e5) / 1000) * 1000).toISOString() };
  });
  return { index: { ...out, jobs }, texts };
}
export function writeOutput(out, { indexFile = OUT, textDir = OUT_TEXT } = {}) {
  const { index, texts } = splitJobs(out);
  fs.mkdirSync(textDir, { recursive: true });
  texts.forEach((t, i) => fs.writeFileSync(path.join(textDir, String(i).padStart(2, "0") + ".json"), JSON.stringify(t)));
  fs.writeFileSync(indexFile, JSON.stringify(index));
  return { jobs: index.jobs.length, indexBytes: fs.statSync(indexFile).size, textBytes: texts.reduce((n, t) => n + JSON.stringify(t).length, 0) };
}

/* The records need the dictionary, the keyword engine and the level rules; when none of these changed, a posting whose text has the same length as
   yesterday keeps yesterday's record (reading a text takes about 40 ms, so 10,000 postings would take minutes). */
export function profileVersion(dir = path.join(ROOT, "docs")) {
  const h = crypto.createHash("sha1");
  for (const f of ["skills.json", "matcher.js", "jobmeta.js"]) { try { h.update(fs.readFileSync(path.join(dir, f))); } catch { h.update(f); } }
  return h.digest("hex").slice(0, 10);
}
export function readPrevious(file = OUT, version = profileVersion()) {
  try {
    const d = JSON.parse(fs.readFileSync(file, "utf8"));
    if (d.profileV !== version) return new Map();
    return new Map((d.jobs || []).filter((j) => j.id && j.kw).map((j) => [j.id, j]));
  } catch { return new Map(); }
}

/* What the page needs to rank a posting without its text, worked out here once: its id, its main keywords (kw, kt), its level (lv), its language (lg),
   things to check in the wording (df) and the length of the text (dl). */
export function addProfiles(jobs, log = console.log, prev = new Map()) {
  let E;
  try { E = loadMatcher().engine(loadSkills()); } catch (e) { log("Keyword profiles skipped: " + e.message); E = null; }
  const meta = loadJobMeta();
  let reused = 0;
  for (const j of jobs) {
    const text = j.desc || "";
    j.id = jobId(j);
    j.dl = text.length;
    const old = prev.get(j.id);
    if (old && old.dl === j.dl) {
      j.lv = old.lv; j.lg = old.lg; j.kw = old.kw; j.kt = old.kt;
      if (old.df) j.df = old.df;
      reused++;
      continue;
    }
    const lv = meta.jobLevel(j.title, text, j.type || "");
    j.lv = [lv.lvl, lv.why];
    j.lg = meta.langOf(j.title, text);
    const df = meta.descFlags(text);
    if (df.length) j.df = df;
    if (E) { const p = E.profile(j.title, text); j.kw = p.kw; j.kt = p.kt; }
  }
  if (prev.size) log(`Records: ${reused} reused from the previous collection, ${jobs.length - reused} read.`);
  return jobs;
}

export function merge(list) {
  const m = new Map();
  for (const j of list) {
    const k = norm(j.company) + "|" + norm(j.title);
    const e = m.get(k);
    if (!e) { m.set(k, { ...j }); continue; }
    if (!e.sources.some((s) => s.url === j.sources[0].url)) e.sources.push(...j.sources);
    if ((e.partial || !e.desc) && j.desc && !j.partial) { e.desc = j.desc; delete e.partial; }
    if (j.ageH != null && (e.ageH == null || j.ageH < e.ageH)) { e.ageH = j.ageH; e.date = j.date || e.date; }
  }
  return [...m.values()];
}

async function pool(items, n, fn) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; results[k] = await fn(items[k]); }
  }));
  return results;
}

/* the employer boards that publish an open feed: one request (or a few) per employer slug */
export const ATS = { greenhouse, lever, ashby, smartrecruiters, workable, recruitee, breezy, bamboohr, personio, teamtailor };
export const LABEL = { greenhouse: "Greenhouse", lever: "Lever", ashby: "Ashby", smartrecruiters: "SmartRecruiters", workable: "Workable", recruitee: "Recruitee", breezy: "Breezy", bamboohr: "BambooHR", personio: "Personio", teamtailor: "Teamtailor" };

/* Every source reports the same few numbers so the page (and you) can see which ones worked:
   jobs (kept for Montreal and the target roles), ok / failed requests, and the first error seen. */
const note = (s, e) => { s.failed = (s.failed || 0) + 1; if (!s.error) s.error = String(e.message || e).slice(0, 160); };

export async function main({ nowMs = Date.now(), log = console.log, write = true, companies, searches, env = process.env, selection = {} } = {}) {
  companies = companies || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "companies.json"), "utf8"));
  searches = searches || JSON.parse(fs.readFileSync(path.join(ROOT, "config", "searches.json"), "utf8"));
  const sources = {};
  const all = [];
  const notFound = [];
  /* Job Bank asks for 5 seconds between requests, so it runs beside everything else instead of after it */
  const run = async (name, cfg, fn) => {
    if (!cfg) return;
    if (cfg.enabled === false) { sources[name] = { skipped: 'switched off ("enabled": false in config/searches.json)' }; return; }
    try {
      const r = await fn();
      sources[name] = { requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length, ...(r.listed != null ? { listed: r.listed, inCanada: r.inArea } : {}), ...(r.skipped ? { searchesSkipped: r.skipped } : {}) };
      all.push(...r.jobs);
    } catch (e) { sources[name] = { jobs: 0, error: String(e.message || e).slice(0, 160) }; log(`${name}: ${e.message}`); }
  };
  const jobBankRun = run("Job Bank", searches.jobbank, () => jobbank(searches.jobbank, nowMs, log));

  /* 1. employer boards that publish an open feed: one request per employer */
  const ats = ATS, label = LABEL;
  const tasks = [];
  for (const k of Object.keys(ats)) {
    const slugs = [...new Set(companies[k] || [])];
    if (!slugs.length) continue;
    sources[label[k]] = { boards: 0, answered: 0, jobs: 0 };
    for (const slug of slugs) tasks.push({ k, slug });
  }
  await pool(tasks, 8, async ({ k, slug }) => {
    const s = sources[label[k]]; s.boards++;
    try { const jobs = await ats[k](slug, nowMs); s.answered++; s.jobs += jobs.length; all.push(...jobs); }
    catch (e) { if (e.status === 404) notFound.push(`${label[k]}:${slug}`); else { note(s, e); log(`${label[k]} ${slug}: ${e.message}`); } }
  });

  /* 2. Workday career sites: a few requests per employer */
  if ((companies.workday || []).length) {
    const s = sources.Workday = { boards: 0, answered: 0, jobs: 0 };
    await pool(companies.workday.map((b) => (typeof b === "string" ? workdayFromUrl(b) : b)), 3, async (b) => {
      s.boards++;
      try { const jobs = await workday(b, nowMs, log); s.answered++; s.jobs += jobs.length; all.push(...jobs); }
      catch (e) { if (e.status === 404 || e.status === 422) notFound.push(`Workday:${b.tenant}/${b.site}`); else { note(s, e); log(`Workday ${b.tenant}: ${e.message}`); } }
    });
  }

  /* 3. career pages that publish schema.org JobPosting data */
  if ((companies.pages || []).length) {
    const r = await pages(companies.pages, nowMs, log);
    sources["Career pages"] = { pages: companies.pages.length, requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length };
    all.push(...r.jobs);
  }

  /* 4. public search boards */
  await run("The Muse", searches.muse, () => muse(searches.muse, nowMs, log));

  /* 5. search services that need a free key: switched on by a repository secret */
  const withKey = async (name, cfg, keys, fn) => {
    if (!cfg) return;
    const missing = keys.filter((k) => !env[k]);
    if (missing.length) { sources[name] = { skipped: `${missing.join(" and ")} ${missing.length > 1 ? "are" : "is"} not set` }; log(`${name} skipped: set ${missing.join(" and ")}`); return; }
    await run(name, cfg, fn);
  };
  const id = env.ADZUNA_APP_ID, key = env.ADZUNA_APP_KEY;
  if (id && key) {
    const r = await adzuna(searches.adzuna, id, key, nowMs, log);
    sources.Adzuna = { queries: searches.adzuna.queries.length, requestsOk: r.ok, requestsFailed: r.failed, jobs: r.jobs.length, ...(r.stop ? { error: r.stop } : {}) };
    all.push(...r.jobs);
  } else {
    sources.Adzuna = { skipped: "ADZUNA_APP_ID and ADZUNA_APP_KEY are not set" };
    log("Adzuna skipped: set ADZUNA_APP_ID and ADZUNA_APP_KEY");
  }
  await withKey("Jooble", searches.jooble, ["JOOBLE_API_KEY"], () => jooble(searches.jooble, env.JOOBLE_API_KEY, nowMs, log));
  await withKey("Careerjet", searches.careerjet, ["CAREERJET_API_KEY"], () => careerjet(searches.careerjet, env.CAREERJET_API_KEY, nowMs, log));

  await jobBankRun;

  /* every kept job is in Canada: save its province (QC, ON, BC... or "Remote – Canada" / "Canada" when the text names no province) */
  const found = merge(all).map((j) => ({ ...j, province: provinceOf(j.loc) })).filter((j) => j.province);
  const jobs = addProfiles(selectJobs(found, selection), log, write ? readPrevious() : new Map());
  const provinces = {}, fields = {};
  const meta = loadJobMeta();
  for (const j of jobs) { provinces[j.province] = (provinces[j.province] || 0) + 1; const f = meta.fieldOf(j.title).id; fields[f] = (fields[f] || 0) + 1; }
  const out = { updatedAt: new Date(nowMs).toISOString(), mock: false, profileV: profileVersion(), sources, notFoundCount: notFound.length, collected: found.length, provinces, fields, jobs };
  log(`Collected ${found.length} postings in Canada, kept ${jobs.length}. ` + Object.entries(sources).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(" | "));
  if (write) {
    if (jobs.length < 10) { log("Fewer than 10 postings. Keeping the previous jobs.json."); process.exitCode = 1; return out; }
    const w = writeOutput(out);
    log(`Wrote docs/jobs.json (${(w.indexBytes / 1e6).toFixed(1)} MB, ${w.jobs} postings) and the texts in docs/d (${(w.textBytes / 1e6).toFixed(1)} MB).`);
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await main();
