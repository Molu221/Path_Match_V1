/* esco_fit.js - should we import ESCO into the dictionary?
 *
 * The coverage check said our dictionary misses 3,411 ESCO skills, which looked like an argument
 * for importing the lot. This asks the question that matters instead: how many of those are
 * actually asked for by Canadian employers in our own 20,507 postings?
 *
 * Answer: 144, or 4%. And they are generic - "attend meetings", "brainstorm ideas", "clean
 * equipment" - the kind of weak phrase I-04 and phase 3 worked to keep OUT of the matching.
 *
 * Caveat: this scans each posting's title and keywords rather than its full text, so it undercounts.
 * The shape of the answer survives that: the ESCO terms that DO appear here are the ones we would
 * not want.
 *
 * Run: node tools/esco_fit.cjs <path to TaskB>
 */
/* Of the ESCO skills our dictionary does not know, how many does the Canadian market actually ask
 * for? Importing a European taxonomy wholesale adds vocabulary nobody here uses, and every unused
 * entry is a chance for a wrong match. */
const fs=require("fs"),path=require("path");
const D=process.argv[2]||"TaskB";
const { loadMatcher, docsJson } = require("./umd.cjs");
const M = loadMatcher();
const dict = docsJson("skills.json");
const eng=M.engine(dict);
const tsv=(f)=>fs.readFileSync(path.join(D,f),"utf8").trim().split("\n").slice(1).map(l=>l.split("\t"));
const esco=new Map();
for(const f of ["validation/corpus_elements","test/corpus"]) for(const [,uri,al] of tsv(f)) esco.set(uri,al);
/* the ESCO skills we do not know */
const miss=[];
for(const [uri,al] of esco){
  const names=String(al||"").replace(/^\[|\]$/g,"").split(/',\s*'/).map(s=>s.replace(/^'|'$/g,"").trim()).filter(Boolean);
  if(!names.some(n=>Object.keys(eng.findCv(n)||{}).length>0)) miss.push({uri,names});
}
console.log(miss.length+" ESCO skills our dictionary does not know");
/* all the text of our postings, as one haystack of folded words */
const J=docsJson("jobs.json");
const jobs=J.jobs||J;
const fold=(s)=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
const hay=new Map();           /* phrase -> how many postings contain it */
const texts=[];
for(const j of jobs){ const t=fold([j.title||"",(j.kw||[]).map(c=>c.slice(3)).join(" ")].join(" ")); texts.push(t); }
console.log(texts.length+" postings scanned (title and keywords)\n");
let used=0;const hits=[];
for(const m of miss){
  let n=0;
  const probe=m.names.map(fold).filter(x=>x.length>6).slice(0,6);
  if(!probe.length)continue;
  for(const t of texts){ if(probe.some(p=>t.includes(p))){ n++; if(n>=3)break; } }
  if(n>=3){used++;hits.push([m.names[0],n]);}
}
console.log(used+" of them ("+Math.round(100*used/miss.length)+"%) are asked for by at least 3 of our postings");
console.log((miss.length-used)+" are vocabulary the Canadian market in our data never uses\n");
console.log("a sample of the ones worth importing:");
for(const [n,c] of hits.slice(0,20)) console.log("   "+n.slice(0,64));
