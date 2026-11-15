/* talentclef_coverage.js - how much of a public skills taxonomy our dictionary knows.
 *
 * ESCO is the European Union's skills taxonomy. This counts how many of its skills our dictionary
 * recognises, and prints a sample of what it does not, which is the I-19 queue arriving from an
 * independent source instead of from our own postings.
 *
 * Run: node tools/talentclef_coverage.cjs <path to TaskB>
 */
const fs=require("fs"),path=require("path");
const D=process.argv[2]||"TaskB";
const { loadMatcher, docsJson } = require("./umd.cjs");
const M = loadMatcher();
const dict = docsJson("skills.json");
const eng=M.engine(dict);
const tsv=(f)=>fs.readFileSync(path.join(D,f),"utf8").trim().split("\n").slice(1).map(l=>l.split("\t"));
const all=new Map();
for(const f of ["validation/corpus_elements","test/corpus"]) for(const [cid,uri,al] of tsv(f)) all.set(uri,al);
console.log(all.size+" distinct ESCO skills in the file\n");
let known=0;const miss=[];
for(const [uri,al] of all){
  const names=String(al||"").replace(/^\[|\]$/g,"").split(/',\s*'/).map(s=>s.replace(/^'|'$/g,"").trim()).filter(Boolean);
  const main=names[0]||"";
  const hit=names.some(n=>Object.keys(eng.findCv(n)||{}).length>0);
  if(hit)known++;else if(miss.length<25)miss.push(main);
}
console.log(known+" ("+Math.round(100*known/all.size)+"%) are recognised by our dictionary");
console.log((all.size-known)+" ("+Math.round(100*(all.size-known)/all.size)+"%) are not\n");
console.log("a sample of what we do not know:");
for(const m of miss)console.log("   "+m);
