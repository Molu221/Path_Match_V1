import { loadUmd, loadMatcher, loadJobMeta, loadSkills, loadCredentials, docsFile } from "../scripts/umd.mjs";
/* words.test.js - phase 3: the words on both sides, the CV and the posting.
 * Run: node tests/words.test.js        (no browser needed)
 *
 * Every case here comes from a line really seen on one of the four test CVs or in one of the frozen
 * postings. Nothing is invented.
 */
const M = loadMatcher();
const eng = M.engine(loadSkills());

let pass = 0, fail = 0;
function ok(what, cond, got) {
  if (cond) { pass++; console.log("  ok   " + what); }
  else { fail++; console.log("  FAIL " + what + (got !== undefined ? "   got: " + got : "")); }
}
const on = (text) => Object.keys(eng.findCv(text));
const has = (text, skill) => on(text).includes(skill);
const kw = (title, body) => eng.profile(title, body, 40).kw.map((c) => c.slice(3));

console.log("I-18 · one word must not switch on a skill");
ok("patent portfolio management is not Financial analysis",
   !has("SKILLS\nPatent Portfolio Management, Prior Art Search\n", "Financial analysis"));
ok("...and is read as patents instead",
   has("SKILLS\nPatent Portfolio Management, Prior Art Search\n", "Patents and intellectual property"));
ok("an investment portfolio still is Financial analysis",
   has("SKILLS\nInvestment portfolio management for private clients\n", "Financial analysis"));
ok("liquid detergent dispensing is not Healthcare",
   !has("WORK EXPERIENCE\nSet up liquid detergent dispensing equipment\n", "Healthcare and clinical"));
ok("dispensing medication still is Healthcare",
   has("WORK EXPERIENCE\nDispensing medication under a pharmacist\n", "Healthcare and clinical"));
ok("working with branch managers is not Banking",
   !has("WORK EXPERIENCE\nSupported branch managers across Ontario\n", "Banking"));
ok("coordinating with subcontractors is not Construction",
   !has("WORK EXPERIENCE\nCoordinated with vendors and subcontractors\n", "Construction and estimating"));
ok("a bill of materials is not a technical drawing",
   !has("WORK EXPERIENCE\nBOM component purchasing and bill of materials upkeep\n", "Technical drawings"));
ok("...and is a skill of its own",
   has("WORK EXPERIENCE\nBOM component purchasing and bill of materials upkeep\n", "Bill of materials (BOM)"));
ok("a factory Production Coordinator is not media production",
   !has("WORK EXPERIENCE\nProduction Coordinator\n", "Media production management"));
ok("asking suppliers for quotes is not a sales proposal",
   !has("WORK EXPERIENCE\nRequested supplier quotes for project cost estimates\n", "Sales proposals"));
ok("a grade point average is not Consignment and VMI",
   !has("EDUCATION\nAchieved 8.3/10 GPA (top 10% of class)\n", "Consignment and VMI"));
ok("helping with data collection is not Data scraping APIs",
   !has("WORK EXPERIENCE\nAssisted faculty with data collection and literature review\n", "Data scraping APIs"));
ok("listing Operating Systems: Windows 10 is not Systems programming",
   !has("SKILLS\nOperating Systems: Windows 10\n", "Systems programming"));
ok("...and is not Windows administration either",
   !has("SKILLS\nOperating Systems: Windows 10\n", "Windows client administration"));
ok("the word organized alone is not a skill",
   !has("WORK EXPERIENCE\nOrganized the daily route sheets\n", "Organizational skills"));
ok("a stated organizational skill still counts",
   has("SKILLS\nStrong organizational skills and attention to detail\n", "Organizational skills"));
ok("the word deadlines alone is not Time management",
   !has("WORK EXPERIENCE\nWorked to tight deadlines\n", "Time management"));
ok("a stated time management skill still counts",
   has("SKILLS\nTime Management, Problem Solving\n", "Time management"));
ok("seeing how a projet immobilier is designed is not real estate brokerage",
   !has("EXPERIENCE\nJ'ai vu comment les professionnels concoivent un projet immobilier\n", "Real estate brokerage"));

console.log("\nI-04 · the name of an employer or a school is not a skill");
ok("a courier's name is not a skill",
   !has("WORK EXPERIENCE\nCustomer Service Representative, Purolator\n", "Courier and parcel"));
ok("courier work written as work still counts",
   has("WORK EXPERIENCE\nParcel delivery and courier services for 200 stops a day\n", "Courier and parcel"));
ok("the university is dropped, the degree is kept",
   has("EDUCATION\nB.Eng. Industrial Engineering, Concordia University\n", "Industrial engineering"));
ok("a school name does not bring its own words in",
   !has("EDUCATION\nDUT Maintenance, IUT of Lorient, School of Technology\n", "Technology consulting"));
ok("a long sentence that happens to hold a company word is kept",
   has("WORK EXPERIENCE\nI led the inventory control project for the whole group of five plants that year\n", "Inventory control"));

console.log("\nI-20 · a French word that only looks like an English one");
const cvDetail = eng.findCv("WORK EXPERIENCE\nAttention to details and accuracy in all reports\n");
const rep = eng.report("Ventes au detail\nVentes au detail en magasin.", cvDetail);
ok("the posting's 'ventes au detail' is not matched by 'attention to details'",
   !(rep.matched || []).concat(rep.links || []).some((r) => /detail/i.test(JSON.stringify(r))),
   JSON.stringify((rep.matched || []).map((r) => r.n || r)).slice(0, 120));

console.log("\nI-13 · the posting's own junk is not a keyword");
const body = "Position Title: Operations Analyst\nJob ID: 12345\nApplication Deadline: Nov 30, 2026\n" +
  "Contact: Camille Leung\nAddress: 14 King St, Bolton, ON L0M 1B5\nOPS OPS: Post Internally\n" +
  "Salary: $75,000 per annum\n\nThe Operations Analyst prepares and maintains reports, supports " +
  "maintenance planning, and ensures compliance with safety standards.\nEducation: Bachelor degree in engineering.\n" +
  "Experience: 3 years in a manufacturing environment.\n\nWe are an equal opportunity employer. " +
  "Only those selected for an interview will be contacted.";
const K = kw("Operations Analyst", body);
for (const junk of ["Camille Leung", "L0M 1B5", "OPS OPS", "Post Internally", "12345", "75,000"])
  ok('"' + junk + '" is not a keyword of the posting', !K.some((k) => k.toLowerCase().includes(junk.toLowerCase())), K.join(" | "));
ok("what the posting says about the work is still read",
   ["Reporting", "Maintenance and reliability", "Compliance", "Health and safety", "Manufacturing experience"]
     .every((k) => K.includes(k)), K.join(" | "));
ok("the degree the posting asks for is still read", K.some((k) => /bachelor/i.test(k)), K.join(" | "));

console.log("\nI-03 · hobbies, prizes and school lines do not feed the matching");
ok("cooking as a hobby is not Culinary arts",
   !has("INTERESTS\nCooking: beginner. Soccer and basketball.\n", "Culinary arts"));
ok("cooking as work still is Culinary arts",
   has("WORK EXPERIENCE\nLine cook: cooking and plating for 80 covers\n", "Culinary arts"));
ok("sports as a hobby are not a skill",
   !has("INTERESTS\nSoccer, basketball, running\n", "Team sports"));
ok("a scholarship line is not matched",
   !has("AWARDS\nMerit scholarship in financial analysis\n", "Financial analysis"));
ok("a high-school line is not matched",
   !has("EDUCATION\nHigh school diploma, option mechanical design\n", "Mechanical design"));
ok("a university line is still matched",
   has("EDUCATION\nMaster of Engineering, mechanical design option\n", "Mechanical design"));

console.log("\nI-13 round 2 · the Job Bank occupations' own keyword lists");
for (const junk of ["efficient manner", "oversee operational", "coordinate activities", "accessible manner",
                    "information obtained", "Store items", "general clean", "internal usage"])
  ok('"' + junk + '" is not kept as a keyword', !eng.usefulKw("Kt|" + junk));
for (const label of ["Description", "Schedule", "Standard", "Fri", "ops", "Conditions"])
  ok('the form label "' + label + '" is not kept as a keyword', !eng.usefulKw("Kt|" + label));
for (const real of ["sort incoming parts", "construction supervisors", "schedule production runs",
                    "production schedule", "office administration"])
  ok('"' + real + '" is still a keyword', eng.usefulKw("Kt|" + real));
for (const skill of ["Microsoft Office", "Scheduling", "Inventory control"])
  ok('the skill "' + skill + '" is never dropped', eng.usefulKw("Ks|" + skill));

console.log("\nFrench form-filler is not a skill (I-13, the French side)");
/* Every line here was really asked for by a posting in the frozen set, as if it were a skill.
   1,010 postings carried at least one. */
const frJunk = ["personne retenue", "conduire valide", "Faire preuve", "Détenir", "diplôme reconnu",
  "tâches suivantes", "discipline connexe", "intérêt marqué", "remarque ci-dessous", "critères suivants",
  "équivalence reconnue", "expertise reconnue", "adresse suivante", "souhaitez parfaire", "consentement"];
for (const j of frJunk) ok("\"" + j + "\" is not asked for as a skill", !eng.usefulKw("|k|" + j));

console.log("\n...and real French skills still are");
/* The guard on the guard: these must survive, or the filter is too blunt. The lesson from phase 3,
   where one word list for both ends of a phrase threw away 771 real keywords. */
const frReal = ["gestion de marque", "image de marque", "soudure TIG", "dessin technique",
  "conduite de chariot élévateur", "maintenance préventive", "contrôle de la qualité",
  "service à la clientèle", "gestion des stocks", "sécurité au travail"];
for (const j of frReal) ok("\"" + j + "\" is still a keyword", eng.usefulKw("|k|" + j));

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
