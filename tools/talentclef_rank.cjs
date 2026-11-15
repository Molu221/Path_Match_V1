/* talentclef_rank.js - how our matching scores on a public benchmark.
 *
 * TalentCLEF 2026 Task B: given a job title, rank 9,052 ESCO skills, each graded by a panel as core
 * (2) or related (1). It is the closest public task to what Path Match does, and its core/related
 * split is the same one the credentials map uses.
 *
 * This is the first outside measure of our matching. Everything else in the fix plan is our own
 * judgement or Dilex's screenshots.
 *
 * Data (5.5 MB): https://zenodo.org/records/19652670 -> TaskB.zip, unzipped next to this repo.
 * Run: node tools/talentclef_rank.cjs <path to TaskB>
 */
/* Run Path Match's dictionary + occupation library against TalentCLEF Task B.
 * Given a job title, rank the 9,052 ESCO skills. Scored with NDCG, graded (core=2, side=1). */
const fs=require("fs"),path=require("path");
const D=process.argv[2]||"TaskB";
const { loadMatcher, docsJson } = require("./umd.cjs");
const M = loadMatcher();
const dict = docsJson("skills.json");
const eng=M.engine(dict);
const idx=JSON.parse(fs.readFileSync(path.join(__dirname,"..","docs","jobs","noc","index.json"),"utf8"));

const tsv=(f)=>fs.readFileSync(path.join(D,f),"utf8").trim().split("\n").slice(1).map(l=>l.split("\t"));
const queries=tsv("validation/queries");
const corpus=tsv("validation/corpus_elements");
const qrels={};
for(const [q,,c,r] of fs.readFileSync(path.join(D,"validation/qrels.tsv"),"utf8").trim().split("\n").map(l=>l.split("\t")))
  (qrels[q]=qrels[q]||{})[c]=+r;

const norm=(s)=>String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9 ]+/g," ").split(/\s+/).filter(w=>w.length>2);

/* --- our side: each occupation's skills, and the words of its title --- */
const occ=[];
for(const code in idx.nocs){
  const o=idx.nocs[code];
  const kw=(o.kw&&o.kw.en)||[];
  const skills=new Set(), words=new Set(norm(o.en||""));
  for(const c of kw){ if(String(c)[1]==="s") skills.add(c.slice(3)); for(const w of norm(c.slice(3))) words.add(w); }
  occ.push({name:o.en||code,skills,words,title:new Set(norm(o.en||""))});
}
/* --- the corpus: what our dictionary sees in each ESCO skill's aliases --- */
const C=corpus.map(([cid,,aliases])=>{
  const text=String(aliases||"").replace(/[\[\]']/g," ");
  const found=Object.keys(eng.findCv(text)||{});
  return {cid,words:new Set(norm(text)),skills:new Set(found)};
});
/* --- rank, for each job title --- */
const dcg=(g)=>g.reduce((s,v,i)=>s+(Math.pow(2,v)-1)/Math.log2(i+2),0);
let sumG=0,sumB=0,n=0,hits=0,mG=0,mN=0,uG=0,uN=0,wG=0;
for(const [qid,title] of queries){
  const rel=qrels[qid]||{};
  const tw=new Set(norm(title));
  /* the occupation whose title best overlaps this job title */
  let best=null,bs=-1;
  for(const o of occ){ let s=0; for(const w of tw) if(o.title.has(w)) s++; if(s>bs){bs=s;best=o;} }
  if(bs>0)hits++;
  const S=best?best.skills:new Set(), W=best?best.words:new Set();
  const scored=C.map(c=>{
    let s=0;
    for(const x of c.skills) if(S.has(x)) s+=10;         /* same dictionary skill as the occupation */
    for(const w of c.words) if(W.has(w)) s+=1;            /* word overlap with the occupation profile */
    for(const w of c.words) if(tw.has(w)) s+=2;           /* word overlap with the job title itself */
    return [c.cid,s];
  }).sort((a,b)=>b[1]-a[1]);
  const gG=scored.map(([cid])=>rel[cid]||0);
  const gB=gG.map(v=>v?1:0);
  const iG=Object.values(rel).sort((a,b)=>b-a);
  const iB=iG.map(()=>1);
  if(!iG.length)continue;
  const g=dcg(gG)/dcg(iG);
  sumG+=g; sumB+=dcg(gB)/dcg(iB); n++;
  if(bs>0){mG+=g;mN++;}else{uG+=g;uN++;}
  /* ablation: words only, no dictionary */
  const sc2=C.map(c=>{let s=0;for(const w of c.words){if(W.has(w))s+=1;if(tw.has(w))s+=2;}return [c.cid,s];}).sort((a,b)=>b[1]-a[1]);
  wG+=dcg(sc2.map(([cid])=>rel[cid]||0))/dcg(iG);
}
console.log(queries.length+" job titles, "+corpus.length+" ESCO skills, "+Object.keys(qrels).length+" with an answer key");
console.log(hits+" of "+queries.length+" job titles matched one of our 496 occupations by at least one word\n");
console.log("NDCG graded (core=2, related=1):  "+(sumG/n).toFixed(4));
console.log("NDCG binary:                      "+(sumB/n).toFixed(4));
console.log("");
console.log("  where we DID find a matching occupation ("+mN+" titles):  "+(mG/mN).toFixed(4));
console.log("  where we did NOT ("+uN+" titles):                      "+(uG/uN).toFixed(4));
console.log("  same run with the dictionary switched off:         "+(wG/n).toFixed(4));
console.log("\nfor comparison, the published results:");
console.log("  TalentCLEF baseline               0.6204 graded / 0.6634 binary");
console.log("  best system (classum)             0.8068 graded / 0.8340 binary");
