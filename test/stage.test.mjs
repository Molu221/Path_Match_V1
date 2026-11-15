import { loadUmd, loadMatcher, loadJobMeta, loadSkills, loadCredentials, docsFile } from "../scripts/umd.mjs";
/* Checks on reading the career stage from a CV. Run: node tests/stage.test.js
   The CVs here are invented. The shapes are the ones that read wrong before phase 2. */
/* which copy of the site to check: node tests/stage.test.js after-2 */
const J=loadJobMeta();
const M=J;
const NOW=new Date('2026-11-14T12:00:00-05:00');
const BAND=['Student or new graduate','Early career','Mid-level','Senior','Executive'];
let pass=0,fail=0;
const ok=(name,cond,extra)=>{if(cond){pass++;console.log('  ok   '+name);}else{fail++;console.log('  FAIL '+name+(extra?'  → '+extra:''));}};
const lvl=t=>M.cvLevel(t,NOW);
const kinds=r=>(r.entries||[]).map(e=>e.kind+':'+e.months).join(' ');

console.log('the same CV written three ways gives the same answer');
const A='WORK EXPERIENCE\nProduction Coordinator, Northwind Manufacturing, March 2023 - Present\nPurchasing and shipments.\nSupply Chain Intern, Lakeside Pharma, January 2022 - April 2022\nRan MRP.\nEDUCATION\nB.Eng. Industrial Engineering, Concordia University, 2016 - 2020\n';
const B='WORK EXPERIENCE\nProduction Coordinator\nNorthwind Manufacturing\nMarch 2023 - Present\nPurchasing and shipments.\nSupply Chain Intern\nLakeside Pharma\nJanuary 2022 - April 2022\nRan MRP.\nEDUCATION\nB.Eng. Industrial Engineering\nConcordia University\n2016 - 2020\n';
const C='WORK EXPERIENCE\nMarch 2023 - Present    Production Coordinator, Northwind Manufacturing\n                        Purchasing and shipments.\nJanuary 2022 - April 2022    Supply Chain Intern, Lakeside Pharma\n                        Ran MRP.\nEDUCATION\n2016 - 2020    B.Eng. Industrial Engineering, Concordia University\n';
const ra=lvl(A),rb=lvl(B),rc=lvl(C);
ok('dates on the title line, on their own line, or in a column agree',
   ra.years===rb.years&&rb.years===rc.years&&ra.band===rb.band&&rb.band===rc.band,
   `${ra.years} / ${rb.years} / ${rc.years}`);
ok('an internship is student work whichever way it is written',
   [ra,rb,rc].every(r=>kinds(r).includes('junior:4')),kinds(rb));

console.log('what counts as work');
ok('an apprenticeship is student work',
   kinds(lvl('WORK EXPERIENCE\nApprentice technician\nOrtec, Lorient\nSeptember 2024 - August 2025\n')).includes('junior'));
ok('an alternance is student work',
   kinds(lvl('EXPERIENCES\nAlternance en maintenance industrielle\nBrunet Snere\nseptembre 2024 - aout 2025\n')).includes('junior'));
ok('a research assistant during a degree is student work',
   kinds(lvl('WORK EXPERIENCE\nResearch Assistant\nUniversity lab\nSeptember 2018 - August 2021\n')).includes('junior'));
ok('"1 month each" is two months, not a year',
   kinds(lvl('WORK EXPERIENCE\nSeasonal operator\nMr Bricolage\nAugust 2022 - 2023 (1 month each)\n')).includes(':2'),
   kinds(lvl('WORK EXPERIENCE\nSeasonal operator\nMr Bricolage\nAugust 2022 - 2023 (1 month each)\n')));
ok('a scholarship is not work',
   kinds(lvl('AWARDS\nMerit scholarship\n2019 - 2022\n')).indexOf('work')<0);
ok('an award is not work',
   kinds(lvl('ACHIEVEMENTS\nPrincipal’s list student\n2015 - 2017\n')).indexOf('work')<0);
ok('a degree is not work',
   kinds(lvl('EDUCATION\nB.Eng. Industrial Engineering\nConcordia University\n2016 - 2020\n')).indexOf('work')<0);

console.log('studying now');
const studentCV='EDUCATION\nMaster of Engineering\nConcordia University\nSeptember 2025 - May 2027\nWORK EXPERIENCE\nMechanical Engineer\nAcme Ltd\nJanuary 2021 - June 2024\n';
ok('a student with no job running now is a student, whatever they did before',lvl(studentCV).band===0,BAND[lvl(studentCV).band]);
const workingStudent='EDUCATION\nMaster of Engineering\nConcordia University\nSeptember 2025 - May 2027\nWORK EXPERIENCE\nProduction Coordinator\nWajax\nMarch 2021 - Present\n';
ok('a student who also works full time keeps the stage their years give',lvl(workingStudent).band===2,BAND[lvl(workingStudent).band]);
ok('the reason is written down',(lvl(studentCV).why||[]).join(' ').includes('studying now'));

console.log('counting');
const overlap='WORK EXPERIENCE\nProduction Coordinator\nNorthwind\nJanuary 2022 - December 2024\nPart-time server\nCafe\nJune 2022 - August 2022\n';
ok('a student job inside a full-time job is not counted twice',Math.abs(lvl(overlap).years-3)<0.2,String(lvl(overlap).years));

console.log('date formats');
const job=(d)=>'WORK EXPERIENCE\nProduction Coordinator\nNorthwind Manufacturing\n'+d+'\nPurchasing and shipments.\n';
for (const [d,lo,hi] of [['March 2023 - Present',3.5,4],['03/2023 - Present',3.5,4],
    ['2023-03 to 2026-08',3.2,3.8],['Since March 2023',3.5,4],['Depuis mars 2023',3.5,4],
    ['From January 2022',4.7,5.2],['2023 - 2026',2.8,3.3],['Mar. 2023 \u2013 Aug. 2026',3.2,3.8]])
  ok('"'+d+'" is read as a job that long',lvl(job(d)).years>=lo&&lvl(job(d)).years<=hi,String(lvl(job(d)).years));
ok('a job that has not started yet is not counted',kinds(lvl(job('January 2027 - May 2027'))).indexOf('work')<0);

console.log('student words that are not studies');
const senior='WORK EXPERIENCE\nOperations Manager\nWajax\nJune 2014 - July 2026\nVOLUNTEERING\nTreasurer, student association\n2012 - 2013\n';
ok('a senior who helped a student association is not a student',lvl(senior).band===3,BAND[lvl(senior).band]+' '+lvl(senior).years+'y');
const grad='WORK EXPERIENCE\nMechanical Engineer\nAcme Ltd\nJune 2021 - November 2026\nPROFILE\nRecent graduate of Concordia University\n';
ok('"recent graduate" on its own does not undo five years of work',lvl(grad).band>=2,BAND[lvl(grad).band]+' '+lvl(grad).years+'y');

console.log('two-column reading order');
const award='WORK EXPERIENCE\nInnovation Engineer\nHavells\nFebruary 2023 - Present\nACHIEVEMENTS\nDean\u2019s Merit scholarship for the top 10% at TIET, Patiala\n(07/2019 - 07/2022)\nGraduate Engineer Trainee\nJindal Steel and Power Ltd\n07/2022 - 01/2023\n';
ok('a job carried in under an ACHIEVEMENTS heading still counts as work',
   kinds(lvl(award)).split(' ').filter(k=>k.startsWith('work')).length===2,kinds(lvl(award)));
ok('a scholarship under the same heading still does not count as work',
   (lvl(award).entries||[]).some(e=>e.kind==='other'&&/scholarship/i.test(e.label)),
   JSON.stringify((lvl(award).entries||[]).map(e=>e.kind+':'+e.label)));
const vol='WORK EXPERIENCE\nInventory Planner\nWajax\nJanuary 2021 - Present\nVOLUNTEER EXPERIENCE\nTutor\nLocal library\nSeptember 2015 - September 2016\n';
ok('volunteering never counts as work, job title or not',
   !(lvl(vol).entries||[]).some(e=>e.kind==='work'&&/tutor/i.test(e.label)),
   JSON.stringify((lvl(vol).entries||[]).map(e=>e.kind+':'+e.label)));

ok('a prize with a job-ish word in its name is not work',
   !(lvl('WORK EXPERIENCE\nProduction Coordinator\nWajax\nMarch 2024 - Present\nAWARDS\nInspirational Boy Student Award\nSeptember 2015 - October 2016\n').entries||[])
     .some(e=>(e.kind==='work'||e.kind==='junior')&&/Award/i.test(e.label||'')),
   JSON.stringify((lvl('WORK EXPERIENCE\nProduction Coordinator\nWajax\nMarch 2024 - Present\nAWARDS\nInspirational Boy Student Award\nSeptember 2015 - October 2016\n').entries||[]).map(e=>e.kind+':'+e.label)));

console.log('names on the page');
const lab='WORK EXPERIENCE\nProduction Coordinator\nWajax Limited\nMarch 2026 - Present\nBuying and shipments.\n';
ok('an entry is named by its job title, not by its employer',
   (lvl(lab).entries||[]).some(e=>/Production Coordinator/.test(e.label)),
   JSON.stringify((lvl(lab).entries||[]).map(e=>e.label)));
const head='EDUCATION\nB.Eng. Industrial Engineering\nConcordia University\n2016 - 2020\n';
ok('an entry is never named after a heading',
   !(lvl(head).entries||[]).some(e=>/^EDUCATION$/i.test(e.label)),
   JSON.stringify((lvl(head).entries||[]).map(e=>e.label)));
const cg='EDUCATION\nB.Tech Mechanical Engineering\nTIET Patiala\n, CGPA 9.3 (Top 10% of Branch)\n2018 - 2022\n';
ok('an entry is never named after a grade average',
   !(lvl(cg).entries||[]).some(e=>/CGPA/i.test(e.label)),
   JSON.stringify((lvl(cg).entries||[]).map(e=>e.label)));

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
