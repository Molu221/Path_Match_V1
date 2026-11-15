/* How a CV file is turned into text. Loaded by index.html, and by the tests in tests/.
   Every function here is pure: give it the same input and it gives the same output,
   so each one can be checked on its own. */
/* Many CVs put a sidebar or a second column beside the main text. Read column by column,
   or every line comes out with two unrelated halves glued together. A column break is a
   vertical band that almost nothing crosses, with real text on both sides. */
function groupLines(its){
  its=its.slice().sort((a,b)=>(b.y-a.y)||(a.x-b.x));
  const lines=[];let cur=null;
  for(const it of its){
    if(!cur||Math.abs(cur.y-it.y)>Math.max(2,it.h*0.5)){cur={y:it.y,items:[it]};lines.push(cur);}
    else cur.items.push(it);
  }
  for(const L of lines)L.items.sort((a,b)=>a.x-b.x);
  return lines;
}
function lineText(L){
  let s="",end=null,ph=10;
  for(const it of L.items){
    if(end!=null){
      const gap=it.x-end,sp=Math.max(1.2,0.25*Math.max(ph,it.h));
      if(gap>sp*3)s+="   ";else if(gap>sp)s+=" ";
    }
    s+=it.s;end=it.x+it.w;ph=it.h||ph;
  }
  return s.replace(/[ \t]+$/,"");
}
function columnCuts(its){
  if(its.length<12)return [];
  let lo=Infinity,hi=-Infinity,chars=0;
  for(const it of its){if(it.x<lo)lo=it.x;if(it.x+it.w>hi)hi=it.x+it.w;chars+=it.s.length;}
  const span=hi-lo;if(span<140)return [];
  const row=it=>Math.round(it.y/6);
  const allRows=new Set(its.map(row)).size;
  /* Count the LINES that cross each narrow vertical band, not the pieces of text:
     a file that stores one letter at a time would otherwise make a band look almost
     empty while it is in fact slicing through twenty lines of a paragraph. */
  const STEP=2,n=Math.ceil(span/STEP)+1,seen=[];
  for(let k=0;k<n;k++)seen.push(null);
  for(const it of its){
    const a=Math.max(0,Math.floor((it.x-lo)/STEP)),b=Math.min(n-1,Math.ceil((it.x+it.w-lo)/STEP)),r=row(it);
    for(let k=a;k<b;k++){(seen[k]||(seen[k]=new Set())).add(r);}
  }
  const tol=Math.max(1,Math.round(allRows*0.04));
  const cand=[];let run=0;
  for(let k=0;k<=n;k++){
    if(k<n&&(!seen[k]||seen[k].size<=tol)){run++;continue;}
    if(run*STEP>=14){
      const mid=lo+(k-run/2)*STEP;
      if(mid-lo>span*0.15&&hi-mid>span*0.15)cand.push(mid);
    }
    run=0;
  }
  /* Keep a break only when both sides are real columns: text on many lines on each side.
     This is what tells a column apart from the empty strip before a right-aligned date. */
  const rowsOf=a=>new Set(a.map(row)).size;
  const charsOf=a=>a.reduce((n,it)=>n+it.s.length,0);
  return cand.filter(c=>{
    const L=its.filter(it=>it.x+it.w/2<=c),R=its.filter(it=>it.x+it.w/2>c);
    const rl=rowsOf(L),rr=rowsOf(R);
    if(Math.min(rl,rr)<4)return false;
    if(Math.min(rl,rr)/Math.max(rl,rr)<0.3)return false;
    return Math.min(charsOf(L),charsOf(R))>=chars*0.08;
  });
}
/* One page of a PDF as lines of text, rebuilt from where each piece sits on the page.
   pdf.js gives a list of pieces; a piece can be a whole word or a single letter.
   Two pieces are joined with no space when the second starts where the first ended,
   one space for a normal word gap, three for a wide gap (a tab stop or a date column). */
function pdfPageLines(items,big){
  const its=[],turned=[];
  for(const i of items){
    const str=i.str!=null?i.str:i.s;
    if(!str)continue;
    const t=i.transform;
    const h=Math.abs(i.height||(t?t[3]:i.h))||10;
    /* (5c) text printed sideways, as in a vertical sidebar: read it along its own axis */
    if(t&&Math.abs(t[1])>Math.abs(t[0])*2){turned.push({s:str,x:-t[5],y:t[4],w:i.width||0,h:h});continue;}
    its.push({s:str,x:t?t[4]:i.x,y:t?t[5]:i.y,w:i.width||i.w||0,h:h});
  }
  const cuts=columnCuts(its);
  const parts=[];
  if(!cuts.length)parts.push(its);
  else{
    const edges=[-Infinity].concat(cuts,[Infinity]);
    for(let i=0;i<edges.length-1;i++)
      parts.push(its.filter(it=>{const m=it.x+it.w/2;return m>edges[i]&&m<=edges[i+1];}));
  }
  const out=[],heights=[];
  const take=(part)=>{
    for(const L of groupLines(part)){
      const t=lineText(L);
      if(!t.trim())continue;
      out.push(t);
      heights.push({t:t.trim(),h:Math.max.apply(null,L.items.map(i=>i.h||10))});
    }
  };
  for(const part of parts)take(part);
  if(turned.length>=6)take(turned);
  if(big&&heights.length>6){
    const sorted=heights.map(x=>x.h).slice().sort((a,b)=>a-b);
    const mid=sorted[Math.floor(sorted.length/2)];
    for(const x of heights)if(x.h>=mid*1.15&&x.t.length<=42&&!/\d/.test(x.t))big.add(x.t);
  }
  return out;
}


/* ---------- tidying the text ---------- */
/* Ligatures ("ﬁ" is one character, not "fi"), invisible characters, and words
   split across two lines ("mainte-" + "nance"). Left alone, each one hides a skill. */
function tidyText(t){
  t=String(t||"")
    .replace(/\ufb00/g,"ff").replace(/\ufb01/g,"fi").replace(/\ufb02/g,"fl")
    .replace(/\ufb03/g,"ffi").replace(/\ufb04/g,"ffl").replace(/[\ufb05\ufb06]/g,"st")
    .replace(/[\u00ad\u200b\u200c\u200d\ufeff]/g,"")
    .replace(/[\ue000-\uf8ff]/g," ")
    .replace(/[\u00a0\u2007\u202f]/g," ")
    .replace(/\r\n?/g,"\n");
  return t.replace(/([A-Za-z\u00c0-\u00ff])-\n([a-z\u00e0-\u00ff])/g,"$1$2");
}

/* A page number, or a name repeated at the top of every page, is not part of the CV. */
function dropPageFurniture(pages){
  if(pages.length<2)return pages;
  const key=s=>s.trim().toLowerCase().replace(/\d+/g,"#");
  const seen={};
  for(const pg of pages){
    const L=pg.split("\n");
    for(const ln of L.slice(0,2).concat(L.slice(-2))){const k=key(ln);if(k.length>2)seen[k]=(seen[k]||0)+1;}
  }
  const drop=new Set(Object.keys(seen).filter(k=>seen[k]>=pages.length));
  if(!drop.size)return pages;
  return pages.map(pg=>{
    const L=pg.split("\n");
    return L.filter((ln,i)=>!((i<2||i>=L.length-2)&&drop.has(key(ln)))).join("\n");
  });
}

/* ---------- the person's own section names ---------- */
/* A CV can name its sections anything: "PLACES I HAVE WORKED", "SCHOOLING", "THINGS I LIKE".
   When a line looks like a heading and plainly says what it is, write the standard name
   above it, so the rest of the site knows which section every line belongs to.
   When it is not plain, nothing is added: a wrong section is worse than none. */
var HEAD_MAP=[
  [/\b(interests?|hobb(y|ies)|passions?|loisirs?|interets?)\b|things i (like|enjoy|love)|outside (of )?(work|the office)|beyond work|fun facts/,"INTERESTS"],
  [/\b(awards?|honou?rs?|distinctions?|scholarships?|bourses?|achievements?|recognition)\b/,"AWARDS"],
  [/\b(volunteer\w*|benevol\w*|community)\b/,"VOLUNTEER EXPERIENCE"],
  [/\b(certifications?|certificates?|licen[cs]es?|accreditations?|credentials?)\b/,"CERTIFICATIONS"],
  [/\b(languages?|langues?)\b/,"LANGUAGES"],
  [/\b(education|schooling|school|academics?|academic|studies|degrees?|formation|scolarite|etudes)\b/,"EDUCATION"],
  [/\b(skills?|competences?|tools?|software|logiciels?|expertise|proficienc\w*|strengths?)\b|what i (do|am) (best|good|great)|core strengths/,"SKILLS"],
  [/\b(projects?|projets?|portfolio)\b/,"PROJECTS"],
  [/\b(publications?|patents?|research)\b/,"PUBLICATIONS"],
  [/\b(experience|experiences|employment|work|worked|working|career|emploi\w*|parcours)\b/,"WORK EXPERIENCE"],
  [/\b(summary|profile|objective|about)\b/,"SUMMARY"]
];
/* The Europass CV writes its section labels in ordinary text, not in capitals.
   These exact labels are safe to treat as headings; anything else still needs
   capitals or a larger size. */
var EXACT_HEAD={"education and training":"EDUCATION","personal skills":"SKILLS",
  "communication skills":"SKILLS","organisational skills":"SKILLS","organizational skills":"SKILLS",
  "job-related skills":"SKILLS","computer skills":"SKILLS","digital skills":"SKILLS",
  "mother tongue":"LANGUAGES","other languages":"LANGUAGES","personal information":"SUMMARY",
  "work experience":"WORK EXPERIENCE","additional information":"AWARDS","top skills":"SKILLS","honors-awards":"AWARDS","licenses & certifications":"CERTIFICATIONS"};
var NOT_HEAD=/\b(engineer|ingenieur|coordinator|coordonnateur|manager|gestionnaire|analyst|analyste|technician|technicien|technologue|specialist|specialiste|assistant|intern|stagiaire|director|directeur|supervisor|superviseur|consultant|developer|officer|clerk|commis|representative|designer|nurse|infirmier|accountant|comptable|administrator|operator|worker|agent|advisor|conseiller|president|teacher|enseignant)\b/;
function foldLine(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
function markSections(text,known,big){
  const kn=new Set((known||[]).map(h=>foldLine(h).trim()));
  const lines=String(text||"").split("\n"),out=[];let added=0,last="";
  for(let i=0;i<lines.length;i++){
    const raw=lines[i];let t=raw.trim(),f=foldLine(t),joined=0;
    /* A heading can be broken over two lines by a narrow column ("CENTRES" / "D'INTERET"). When a
       short line and the next one together make a heading we know, read them as one. */
    if(t&&t.length<=22&&t.split(/\s+/).length<=2&&!/\d/.test(t)&&!/[,;:.]/.test(t)){
      for(let j=1;j<=2&&i+j<lines.length;j++){
        const nx=(lines[i+j]||"").trim();
        if(!nx){continue;}
        if(nx.length>22||/\d/.test(nx)||nx.split(/\s+/).length>2)break;
        const pair=foldLine(t+" "+nx);
        if(HEAD_MAP.some(function(pr){return pr[0].test(pair);})&&!HEAD_MAP.some(function(pr){return pr[0].test(f);})){
          t=t+" "+nx;f=pair;joined=j;break;
        }
        break;
      }
    }
    const letters=t.replace(/[^A-Za-z\u00c0-\u00ff]/g,"");
    const caps=letters.length>=3&&letters===letters.toUpperCase();
    const next=(lines[i+1]||"").trim()||(lines[i+2]||"").trim();
    /* the label may sit at the start of the line with its value beside it, as in a table */
    let exact=EXACT_HEAD[f.replace(/[:\s]+$/,"")];
    if(!exact)for(const k in EXACT_HEAD){
      if(f.length>k.length&&f.slice(0,k.length)===k&&/^[:\s]+/.test(f.slice(k.length))){exact=EXACT_HEAD[k];break;}
    }
    const looks=(caps||(big&&big.has(t)))&&t.length<=42&&!/\d/.test(t)&&t.split(/\s+/).length<=5&&!/[,;:.]/.test(t)&&!NOT_HEAD.test(f)&&next.length>0;
    if((looks||exact)&&!kn.has(f)){
      const hit=exact?[null,exact]:HEAD_MAP.find(function(p){return p[0].test(f);});
      if(hit&&foldLine(hit[1])!==f&&foldLine(last)!==foldLine(hit[1])){out.push(hit[1]);added++;}
    }
    out.push(raw);
    if(joined){for(let j=1;j<=joined;j++){out.push(lines[i+j]);}i+=joined;}
    if(t)last=t;
  }
  return {text:out.join("\n"),added:added};
}

/* Safety net: some files give text with a space between every letter ("F r e n c h").
   If most of a line reads that way, glue the single letters back into words:
   one space between two single letters disappears, a wider gap stays a word break. */
function fixLetterSpacing(text){
  /* a run of four or more lone letters anywhere in a line: "F r e n c h" */
  const squeezeRun=(ln)=>ln.replace(/(?:^|(?<=\s))((?:[A-Za-z\u00c0-\u00ff] ){3,}[A-Za-z\u00c0-\u00ff])(?=\s|$)/g,
    (m,run)=>run.replace(/ /g,""));
  const fixLine=(ln)=>{
    const tok=ln.trim().split(/\s+/).filter(Boolean);
    if(tok.length<6)return ln;
    const singles=tok.filter(t=>t.length===1).length;
    if(singles/tok.length<0.8)return ln;   /* a mixed line is handled word by word below */
    return ln.split(/ {2,}/).map(part=>part.replace(/(?<=\S) (?=\S)/g,"")).join(" ");
  };
  return text.split("\n").map(fixLine).map(squeezeRun).join("\n");
}

/* Several versions of the same CV in one file (English + French, old drafts).
   Keep the first page, then drop a later page that says nothing new: either almost all
   of its words were already seen, or it repeats the same dates of work and study. */
var MON_RE="jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|janv|fevr|mars|avri|juin|juil|aout|sept|octo|nove|dece";
function pageWords(s){return new Set((s.toLowerCase().match(/[a-z\u00e0-\u00ff]{4,}/g)||[]));}
function pageDates(s){
  const t=s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  const re=new RegExp("(?:("+MON_RE+")[a-z]*\\.?\\s*)?((?:19|20)\\d{2})\\s*[-\u2013\u2014/]+\\s*(?:("+MON_RE+")[a-z]*\\.?\\s*)?((?:19|20)\\d{2}|present|aujourd)","g");
  const out=new Set();let m;while((m=re.exec(t)))out.add((m[1]||"")+m[2]+"|"+(m[3]||"")+m[4]);
  return out;
}
function dropRepeatedPages(pages){
  const kept=[],seenW=new Set(),seenD=new Set();let dropped=0;
  for(let i=0;i<pages.length;i++){
    const w=pageWords(pages[i]),d=pageDates(pages[i]);
    if(i>0){
      let sw=0;for(const x of w)if(seenW.has(x))sw++;
      let sd=0;for(const x of d)if(seenD.has(x))sd++;
      const sameWords=w.size>=25&&sw/w.size>=0.72;
      const sameDates=d.size>=2&&sd/d.size>=0.6;
      if(sameWords||sameDates){dropped++;continue;}
    }
    kept.push(pages[i]);
    for(const x of w)seenW.add(x);for(const x of d)seenD.add(x);
  }
  return {text:kept.join("\n\n"),dropped:dropped};
}

/* Did the file give us real text? Used to warn instead of ranking against nothing. */
function readQuality(text){
  const t=String(text||"");
  const letters=(t.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
  const tok=t.split(/\s+/).filter(Boolean);
  const singles=tok.filter(x=>x.length===1&&/[A-Za-zÀ-ÿ]/.test(x)).length;
  return {chars:t.trim().length,letters,
    lettersPerWord:tok.length?letters/tok.length:0,
    singleRatio:tok.length?singles/tok.length:0};
}

var CvRead={tidyText:tidyText,fixLetterSpacing:fixLetterSpacing,dropPageFurniture:dropPageFurniture,dropRepeatedPages:dropRepeatedPages,markSections:markSections,groupLines:groupLines,lineText:lineText,columnCuts:columnCuts,pdfPageLines:pdfPageLines,readQuality:readQuality,pageWords:pageWords,pageDates:pageDates};
if(typeof self!=="undefined")self.CvRead=CvRead;
if(typeof module!=="undefined"&&module.exports)module.exports=CvRead;
