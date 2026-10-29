"""Builds the bilingual NOC library (noc_library.json) from OaSIS / SIPeC 2025 open data.

Usage: python build_library.py <folder with the CSV files> <output folder>

Source: Employment and Social Development Canada, OaSIS / SIPeC 2025 (open.canada.ca dataset
10ce43bd-fb58-4969-806b-4bffebc87bec) and Job Bank open data (dataset ea639e28-...), used under the
Open Government Licence - Canada.
"""
import collections
import glob
import json
import math
import os
import re
import sys
import unicodedata

import pandas as pd

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)


# ---------------------------------------------------------------- reading
def find(*patterns):
    for p in patterns:
        hits = sorted(glob.glob(os.path.join(SRC, p)))
        if hits:
            return hits[0]
    raise FileNotFoundError(patterns)


def read(pattern, sep, skip=0, enc="utf-8-sig"):
    df = pd.read_csv(find(pattern), sep=sep, dtype=str, encoding=enc, encoding_errors="replace", skiprows=skip)
    return df.fillna("")


def norm(s):
    """lowercase, no accents, single spaces: 'Génie  Industriel' -> 'genie industriel'"""
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.replace("’", "'")
    return re.sub(r"\s+", " ", s).strip()


lead_en = read("*lead-statement_oasis_2025*", ",")
lead_fr = read("*enonce-principal_sipec_2025*", ",")
duty_en = read("*main-duties_oasis-2025*", ";")
duty_fr = read("*fonctions-principales_sipec_2025*", ";", skip=1)
tit_en = read("*example-titles_oasis_2025*", ",")
tit_fr = read("*exemples-dappellation-demploi_sipec_2025*", ",")
req_en = read("*employment-requirements_oasis_2025*", ",")
req_fr = read("*exigences-demploi_sipec_2025*", ",")
skills = read("*skills_oasis_2025*", ";")
core_en = read("*corecompetencies_oasis_2025*", ";", enc="utf-8")
core_fr = read("*competencesprincipales_sipec*", ";")
matrix = read("*skills-match-matrix_oasis_2025*", ";")

for df in (lead_en, lead_fr, duty_en, duty_fr, tit_en, tit_fr, req_en, req_fr, core_en, core_fr):
    df.columns = ["code"] + list(df.columns[1:])
skills = skills.rename(columns={skills.columns[0]: "code", skills.columns[1]: "label"})
SKILL_COLS = [c for c in skills.columns if c not in ("code", "label")]

# ---------------------------------------------------------------- keyword extraction
STOP_EN = set("""a an the and or of to in for with on at by from as into onto over under about such other others their them they it
its this that these those be is are was were been being may might must can could will would should shall all any each both either more
most some than then so if when where which who whom whose while within without per via including include includes etc not no only own
same very new related relevant various specific special general specified necessary required appropriate according also up out off down
through between during before after among upon against towards toward across along around make sure manner prior using ensure""".split())
STOP_FR = set("""le la les l un une des du de d et ou a au aux en pour par sur sous dans avec selon afin que qui quoi dont leur leurs ses
son sa ce cet cette ces se s y ne pas plus moins tout tous toute toutes autre autres tel telle tels telles etc lors entre vers chez
comme ainsi aussi ou bien selon notamment conformement relatifs relatives relatif relative divers diverses differents differentes
necessaires necessaire appropries appropriees besoin au-dela il ils elle elles celui celle ceux celles leurs pendant visant
sont etre avoir faire fait afin possible possibles meilleur meilleurs meilleure meilleures lors cours sein moyen moyens partir
compte cas toute nouveau nouvelle nouveaux nouvelles certains certaines plusieurs chaque""".split())
LINK_FR = {"de", "des", "du", "d", "la", "l", "a", "au", "aux", "en"}  # allowed inside a French noun phrase
EXTRA_VERBS = set("allow enhance improve increase reduce provide help keep take give use make meet set promote ensure obtain".split())
WORD = re.compile(r"[a-z0-9][a-z0-9'+&\-]*")
SPLIT_EN = re.compile(r"[,;:()\.–/]|\s-\s|\band\b|\bor\b|\bas well as\b")
SPLIT_FR = re.compile(r"[,;:()\.–/]|\s-\s|\bet\b|\bou\b|\bainsi que\b")
GENERIC = set("""good program study part product care provision service activity information record report system process procedure
policy staff people person client customer member team area unit work job task problem issue matter need requirement standard quality
level operation project plan schedule result method technique equipment material document file data detail type international
local national developing concern size official management implementation facility travaux personnel activite activites service
services client clients tache taches travail produit produits information informations programme programmes systeme systemes
procedure procedures dossier dossiers document documents donnees membre membres equipe equipes besoin besoins niveau""".split())


def lemma_en(w):
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith(("shes", "ches", "sses", "xes", "zes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is", "ics")):
        return w[:-1]
    return w


FR_KEEP_S = set("temps corps fois prix repas poids succes acces proces progres pays mois cours avis bois jus tapis".split())


def lemma_fr(w):
    if len(w) > 4 and w.endswith("s") and w not in FR_KEEP_S and not w.endswith(("as", "is", "os", "us", "ss", "ys")):
        return w[:-1]
    return w


def is_fr_infinitive(w):
    return len(w) > 4 and ((w.endswith("er") and not w.endswith("ier")) or w.endswith(("ir", "ire")) and w not in ("loisir", "plaisir", "avenir", "souvenir", "dossier"))


def learn_verbs(sentences, split):
    """Verbs = words that start a duty, or start a segment right after a one-word verb ("Enact, amend or repeal laws")."""
    v = set()
    for s in sentences:
        only_verbs = True
        for seg in split.split(norm(s)):
            words = WORD.findall(seg)
            if not words:
                continue
            if only_verbs:
                v.add(words[0])
            only_verbs = only_verbs and len(words) == 1
    return v


def phrases(text, lang, verbs):
    split, stop = (SPLIT_EN, STOP_EN) if lang == "en" else (SPLIT_FR, STOP_FR)
    out = []
    for seg in split.split(norm(text)):
        words = WORD.findall(seg.replace("'", " "))
        while words and (words[0] in verbs or words[0] in stop or (lang == "en" and words[0].endswith("ing")
                                                                    and (words[0][:-3] in verbs or words[0][:-3] + "e" in verbs))):
            words = words[1:]
        cur = []
        for w in words + [None]:
            inside_link = lang == "fr" and w in LINK_FR and cur
            if w is not None and inside_link:
                cur.append(w)
                continue
            if w is None or w in stop or (lang == "en" and w.endswith("ly")) or len(w) < 3 or w.isdigit():
                while cur and cur[-1] in LINK_FR:  # never end on "de", "des"...
                    cur.pop()
                p = cur[-4:] if lang == "fr" else cur[-3:]
                while p and p[0] in LINK_FR:
                    p = p[1:]
                while len(p) > 1 and (p[0] in verbs or (lang == "fr" and is_fr_infinitive(p[0]))):
                    p = p[1:]
                    while p and (p[0] in LINK_FR or p[0] in stop):
                        p = p[1:]
                while len(p) > 1 and lang == "en" and p[-1].endswith("ed"):
                    p = p[:-1]
                if p and not (len(p) == 1 and (p[0] in verbs or p[0] in GENERIC or lemma_fr(p[0]) in GENERIC or len(p[0]) < 4)):
                    if lang == "en":
                        out.append(" ".join(p[:-1] + [lemma_en(p[-1])]))
                    elif not is_fr_infinitive(p[0]):  # French: "controle des stocks" -> "controle de stock"
                        out.append(" ".join(w if w in LINK_FR else lemma_fr(w) for w in p))
                cur = []
            else:
                cur.append(w)
    return out


verbs_en = learn_verbs(duty_en.iloc[:, 1], SPLIT_EN) | EXTRA_VERBS
verbs_fr = learn_verbs(duty_fr.iloc[:, 1], SPLIT_FR)


def tfidf_keywords(duty_df, lang, verbs, k=20):
    docs = duty_df.groupby("code")[duty_df.columns[1]].apply(list)
    tf = {c: collections.Counter(p for d in ds for p in phrases(d, lang, verbs)) for c, ds in docs.items()}
    df = collections.Counter(p for c in tf for p in tf[c])
    n = len(tf)
    out = {}
    for c, counts in tf.items():
        sc = {p: m * math.log(n / df[p]) * (1 + 0.4 * p.count(" ")) for p, m in counts.items()
              if df[p] / n < 0.12 and p not in GENERIC}
        out[c] = [p for p, _ in sorted(sc.items(), key=lambda x: (-x[1], x[0]))[:k]]
    return out, tf


kw_en, tf_en = tfidf_keywords(duty_en, "en", verbs_en)
kw_fr, tf_fr = tfidf_keywords(duty_fr, "fr", verbs_fr)

# ---------------------------------------------------------------- EN <-> FR keyword pairs (from aligned duty sentences)
pair_count, n_en, n_fr = collections.Counter(), collections.Counter(), collections.Counter()
for (_, e), (_, f) in zip(duty_en.iterrows(), duty_fr.iterrows()):
    pe, pf = set(phrases(e.iloc[1], "en", verbs_en)), set(phrases(f.iloc[1], "fr", verbs_fr))
    for a in pe:
        n_en[a] += 1
    for b in pf:
        n_fr[b] += 1
    for a in pe:
        for b in pf:
            pair_count[(a, b)] += 1
cand = collections.defaultdict(list)
for (a, b), c in sorted(pair_count.items()):
    if c < 3:
        continue
    dice = round(2 * c / (n_en[a] + n_fr[b]), 2)
    if dice >= 0.8 and b.split(" ")[0] not in LINK_FR:
        cand[a].append((dice, b))
# a pair is kept only when it is the single best on both sides (a tie means the duties cannot tell the words apart)
best = {}
for a, lst in cand.items():
    lst.sort(reverse=True)
    if len(lst) == 1 or lst[0][0] > lst[1][0]:
        best[a] = (lst[0][1], lst[0][0])
by_fr = collections.defaultdict(list)
for a, (b, d) in best.items():
    by_fr[b].append((d, a))
for b, lst in by_fr.items():
    lst.sort(reverse=True)
    for d, a in (lst if len(lst) > 1 and lst[0][0] == lst[1][0] else lst[1:]):
        del best[a]
kw_pairs = dict(sorted((a, b) for a, (b, _) in best.items()))
kw_pair_strength = {a: d for a, (_, d) in best.items()}

# ---------------------------------------------------------------- titles
def title_variants(t):
    """'coordonnateur/coordonnatrice de la production' -> masculine and feminine forms."""
    t = norm(t)
    if "/" not in t:
        return [t]
    toks = t.split(" ")
    left = " ".join(x.split("/")[0] for x in toks)
    right = " ".join(x.split("/")[-1] for x in toks)
    halves = [h.strip() for h in t.split("/")]
    return list(dict.fromkeys([left, right] + halves))


def titles_for(df, code):
    sub = df[df.code == code]
    return {
        "example": list(dict.fromkeys(sub[sub.iloc[:, 2].str.startswith("Ex")].iloc[:, 3])),
        "all": list(dict.fromkeys(sub.iloc[:, 3])),
    }


ex_en = tit_en[tit_en.iloc[:, 2] == "Example"].groupby(["code", tit_en.columns[1]]).nth(0)
ex_fr = tit_fr[tit_fr.iloc[:, 2] == "Exemple"].groupby(["code", tit_fr.columns[1]]).nth(0)
title_pairs = {}
fr_by_key = {(r.code, r.iloc[1]): r.iloc[3] for _, r in ex_fr.iterrows()}
for _, r in ex_en.iterrows():
    f = fr_by_key.get((r.code, r.iloc[1]))
    if f:
        title_pairs[r.iloc[3]] = f

# ---------------------------------------------------------------- requirements: education, certifications
EDU = [  # (pattern on normalized EN text, level, label EN, label FR)
    (r"doctor|ph\.?d|doctoral|medical degree|degree in medicine|dentistry|veterinary medicine", 6, "Doctorate or professional degree", "Doctorat ou diplôme professionnel"),
    (r"master'?s", 5, "Master's degree", "Maîtrise"),
    (r"bachelor'?s|university degree|university program|undergraduate", 4, "Bachelor's degree", "Baccalauréat"),
    (r"college|post-secondary|cegep|technical program|diploma program", 3, "College or post-secondary program", "Études collégiales ou postsecondaires"),
    (r"apprenticeship|trade certification|vocational", 3, "Apprenticeship or vocational training", "Apprentissage ou formation professionnelle"),
    (r"secondary school|high school", 2, "Secondary school", "Études secondaires"),
]
CERT = re.compile(r"licen[cs]|certif|registration|registered with|accredit|designation|red seal|p\.eng|\bcpa\b|permit|membership|"
                  r"must be a member|endorsement|qualification card")
OPTIONAL = re.compile(r"voluntary|may be required|may require|is available|an asset|optional|in some provinces|for some")


CERT_NAMES = [
    (r"red seal", "Red Seal endorsement"), (r"p\.eng|professional engineer", "Professional Engineer licence (P.Eng.)"),
    (r"chartered professional accountant|\bcpa\b", "CPA designation"), (r"driver'?s licen[cs]e|class \w+ licen", "Driver's licence"),
    (r"trade certification", "Trade certification"), (r"registration with a regulatory body|registered with|registration", "Registration with a regulatory body"),
    (r"licen[cs]", "Licence"), (r"certif", "Certification"), (r"designation", "Professional designation"), (r"permit", "Permit"),
    (r"membership|member of", "Membership in a professional body"),
]


def cert_name(n):
    for pat, name in CERT_NAMES:
        if re.search(pat, n):
            return name
    return "Certification or licence"


def requirements(code):
    en = req_en[req_en.code == code].iloc[:, 1].tolist()
    fr = req_fr[req_fr.code == code].iloc[:, 1].tolist()
    aligned = len(en) == len(fr)
    edu_levels, certs = [], []
    for i, s in enumerate(en):
        n = norm(s)
        f = fr[i] if aligned else ""
        if "required" in n or "usually" in n or "completion" in n:
            for pat, lvl, le, lf in EDU:
                if re.search(pat, n):
                    edu_levels.append((lvl, le, lf, s, f))
        if CERT.search(n) and not n.startswith("completion of"):
            certs.append({"name": cert_name(n), "en": s, "fr": f,
                          "required": not OPTIONAL.search(n) and ("required" in n or "must" in n)})
    edu = None
    if edu_levels:
        lvl, le, lf, s, f = min(edu_levels, key=lambda x: x[0])  # the minimum level that is accepted
        edu = {"level": lvl, "en": le, "fr": lf, "source_en": s, "source_fr": f}
    return {"text_en": en, "text_fr": fr if aligned or fr else [], "education": edu, "certifications": certs}


# ---------------------------------------------------------------- skills and core competencies
ALL_EN = {x.strip().lower(): x.strip() for x in core_en.iloc[:, 2]} | {s.lower(): s for s in SKILL_COLS}


def decompose(name, known, joiners=(", and ", " and ", ", ")):
    """'Critical Thinking, Decision Making and Problem Solving' -> its known single names, else [name]."""
    low = name.strip().lower()
    if not low:
        return []
    for k in sorted(known, key=len, reverse=True):
        if low == k:
            return [k]
        for j in joiners:
            if low.startswith(k + j):
                rest = decompose(low[len(k) + len(j):], known, joiners)
                if all(r in known for r in rest):
                    return [k] + rest
    return [low]


ATOMIC_EN = set()
for low in ALL_EN:
    parts = decompose(low, set(ALL_EN) - {low})
    if parts == [low] or not all(p in ALL_EN for p in parts):
        ATOMIC_EN.add(low)


def split_comp(name):
    return [ALL_EN.get(p, p) for p in decompose(name, ATOMIC_EN)]


comp_pairs = {}
for (_, e), (_, f) in zip(core_en.iterrows(), core_fr.iterrows()):
    comp_pairs.setdefault(e.iloc[2].strip().lower(), f.iloc[2].strip())   # whole names first
for (_, e), (_, f) in zip(core_en.iterrows(), core_fr.iterrows()):
    pe = decompose(e.iloc[2], ATOMIC_EN)
    pf = [x.strip() for x in re.split(r",\s*et\s+|\s+et\s+|,\s*", f.iloc[2].strip()) if x.strip()]
    if len(pe) > 1 and len(pe) == len(pf):
        for a, b in zip(pe, pf):
            comp_pairs.setdefault(a, b)
SKILL_FR_FALLBACK = {"digital systems production": "Production numérique"}  # SIPeC's own term in its core competencies
skill_names = [{"en": s, "fr": comp_pairs.get(s.lower()) or SKILL_FR_FALLBACK.get(s.lower(), "")} for s in SKILL_COLS]
skill_fr = {s["en"]: s["fr"] for s in skill_names}

# ---------------------------------------------------------------- similar occupations
matrix = matrix.set_index(matrix.columns[0])
matrix.index = [str(i).strip() for i in matrix.index]
RANK = {"Very Similar": 3, "Similar": 2, "Somewhat Similar": 1}


def similar(code):
    if code not in matrix.columns:
        return []
    col = matrix[code]
    pairs = [(c, RANK.get(v.strip(), 0)) for c, v in col.items() if c != code and RANK.get(v.strip(), 0) >= 2]
    pairs.sort(key=lambda x: (-x[1], x[0]))
    return [{"code": c, "level": "very similar" if r == 3 else "similar"} for c, r in pairs[:15]]


# ---------------------------------------------------------------- Job Bank (optional): NOC names EN/FR and languages
noc_name, lang_mix = {}, {}
jb_en = sorted(glob.glob(os.path.join(SRC, "job-bank-open-data-all-job-postings-en-*.csv")))
jb_fr = sorted(glob.glob(os.path.join(SRC, "job-bank-open-data-all-job-postings-fr-*.csv")))
if jb_en:
    e = pd.read_csv(jb_en[-1], sep="\t", encoding="utf-16", dtype=str,
                    usecols=["WIC Job Location Snapshot ID", "Job Title", "Original Job Title", "NOC21 Code", "NOC21 Code Name", "Official Language"])
    e = e.dropna(subset=["NOC21 Code"])
    e["noc"] = e["NOC21 Code"].str.zfill(5)
    for n, g in e.groupby("noc"):
        noc_name.setdefault(n, {})["en"] = g["NOC21 Code Name"].iloc[0]
        lang_mix[n] = {k: int(v) for k, v in g["Official Language"].fillna("Not stated").value_counts().items()}
    if jb_fr:
        f = pd.read_csv(jb_fr[-1], sep="\t", encoding="utf-16", dtype=str,
                        usecols=["Appellation d'emploi", "Code CNP 2021", "Code CNP21 nom"]).dropna(subset=["Code CNP 2021"])
        f["noc"] = f["Code CNP 2021"].str.zfill(5)
        for n, g in f.groupby("noc"):
            noc_name.setdefault(n, {})["fr"] = g["Code CNP21 nom"].iloc[0]
    else:
        f = None
    # titles used in real postings -> NOC (kept when one NOC holds most postings with that title)
    jb_titles = collections.defaultdict(collections.Counter)
    for col in ("Job Title", "Original Job Title"):
        for t, n in zip(e[col].fillna(""), e["noc"]):
            t = re.sub(r"\(.*?\)|[-|,].*$", "", norm(t)).strip()
            if 2 < len(t) <= 60:
                jb_titles[t][n] += 1
    if f is not None:
        for t, n in zip(f["Appellation d'emploi"].fillna(""), f["noc"]):
            for v in [norm(x) for x in title_variants(t)]:
                if 2 < len(v) <= 60:
                    jb_titles[v][n] += 1
else:
    jb_titles = {}

# ---------------------------------------------------------------- assemble profiles
label_en = dict(zip(skills.code, skills.label))
label_fr = dict(zip(core_fr.code, core_fr.iloc[:, 1]))
label_en.update({c: l for c, l in zip(core_en.code, core_en.iloc[:, 1]) if c not in label_en})
codes = sorted(set(lead_en.code) | set(skills.code))
srow = skills.set_index("code")
profiles = {}
for code in codes:
    de = duty_en[duty_en.code == code].iloc[:, 1].tolist()
    dfr = duty_fr[duty_fr.code == code].iloc[:, 1].tolist()
    ce = core_en[core_en.code == code]
    cf = core_fr[core_fr.code == code]
    core = []
    for i in range(len(ce)):
        e = ce.iloc[i]
        f = cf.iloc[i] if len(cf) == len(ce) else None
        core.append({"en": e.iloc[2], "fr": f.iloc[2] if f is not None else "",
                     "why_en": e.iloc[3], "why_fr": f.iloc[3] if f is not None else "",
                     "parts": split_comp(e.iloc[2])})
    rated = []
    if code in srow.index:
        for s in SKILL_COLS:
            try:
                v = int(float(srow.loc[code, s] or 0))
            except ValueError:
                v = 0
            if v >= 3:
                rated.append({"en": s, "fr": skill_fr.get(s, ""), "rating": v})
        rated.sort(key=lambda x: -x["rating"])
    noc = code[:5]
    profiles[code] = {
        "code": code, "noc": noc,
        "name": {"en": label_en.get(code, ""), "fr": label_fr.get(code, "")},
        "lead": {"en": next(iter(lead_en[lead_en.code == code].iloc[:, 1]), ""),
                 "fr": next(iter(lead_fr[lead_fr.code == code].iloc[:, 1]), "")},
        "titles": {"en": titles_for(tit_en, code)["all"], "fr": titles_for(tit_fr, code)["all"]},
        "duties": [{"en": a, "fr": dfr[i] if i < len(dfr) else "",
                    "keys": [k for k in dict.fromkeys(phrases(a, "en", verbs_en)) if k not in GENERIC][:6],
                    "keys_fr": [k for k in dict.fromkeys(phrases(dfr[i], "fr", verbs_fr)) if k not in GENERIC][:6] if i < len(dfr) else []}
                   for i, a in enumerate(de)],
        "keywords": {"en": kw_en.get(code, []), "fr": kw_fr.get(code, [])},
        "skills": rated,
        "core_competencies": core,
        "requirements": requirements(code),
        "similar": similar(code),
    }

nocs = {}
for code, p in profiles.items():
    n = nocs.setdefault(p["noc"], {"noc": p["noc"], "name": {"en": "", "fr": ""}, "profiles": []})
    n["profiles"].append(code)
for n, v in nocs.items():
    first = profiles[v["profiles"][0]]
    v["name"]["en"] = noc_name.get(n, {}).get("en") or first["name"]["en"]
    v["name"]["fr"] = noc_name.get(n, {}).get("fr") or first["name"]["fr"]
    if n in lang_mix:
        v["languages_in_postings"] = lang_mix[n]

# ---------------------------------------------------------------- indexes
title_index = collections.defaultdict(set)
for code, p in profiles.items():
    for t in p["titles"]["en"] + [p["name"]["en"]]:
        title_index[norm(t)].add(code)
    for t in p["titles"]["fr"] + [p["name"]["fr"]]:
        for v in title_variants(t):
            title_index[v].add(code)
added = 0
for t, cnt in jb_titles.items():
    n, c = cnt.most_common(1)[0]
    if c >= 2 and c / sum(cnt.values()) >= 0.6 and n in nocs and t not in title_index:
        title_index[t] = set(nocs[n]["profiles"])
        added += 1
# one-word titles that say nothing about the occupation on their own ("intern" is a medical intern in OaSIS)
VAGUE = set("""intern interns internship student students trainee apprentice assistant helper worker labourer clerk manager supervisor
director officer agent specialist consultant coordinator analyst technician technologist engineer operator associate representative
administrator advisor adviser attendant volunteer employee staff member partner owner lead head junior senior
stagiaire stagiaires etudiant etudiante apprenti apprentie adjoint adjointe aide commis conseiller conseillere technicien technicienne
analyste coordonnateur coordonnatrice gestionnaire directeur directrice superviseur superviseure ingenieur ingenieure operateur
operatrice prepose preposee representant representante employe employee agente""".split())
# keys are written the way the helpers (noc_library.py / .js) normalize text, so "cook's helper" or "foreman/woman" can be looked up
def key_norm(t):
    t = re.sub(r"[’'`]", " ", norm(t))
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9+#&\-\. ]+", " ", t)).strip()
merged = collections.defaultdict(set)
for k, v in title_index.items():
    merged[key_norm(k)] |= v
title_index = {k: sorted(v) for k, v in merged.items() if k and len(v) <= 12 and k not in VAGUE}

keyword_index = collections.defaultdict(set)
for code, p in profiles.items():
    for k in p["keywords"]["en"] + p["keywords"]["fr"]:
        keyword_index[k].add(code)
keyword_index = {k: sorted(v) for k, v in keyword_index.items()}

translations = {
    "keywords_en_fr": kw_pairs,
    "keywords_en_fr_strength": kw_pair_strength,
    "keywords_fr_en": {b: a for a, b in kw_pairs.items()},
    "competencies_en_fr": comp_pairs,
    "titles_en_fr": title_pairs,
}

RULES = {
    "labels": ["Matched", "Missing", "Guess"],
    "matched": "The CV clearly shows the item (same words or its translation).",
    "missing": "Nothing on the CV shows the item.",
    "guess": "The CV suggests the item without saying it. Always shown as a guess, and the applicant is asked to confirm.",
    "guess_sources": [
        "The item is a core competency or a skill rated 4-5 of an occupation the CV clearly fits (title found on the CV).",
        "The item is a duty keyword of an occupation the CV clearly fits.",
        "Language: the CV is written in that language or lists studies done in it.",
        "Education: the required degree is in progress on the CV.",
    ],
    "never_guess": ["certifications and licences (always Matched or Missing)", "items from weak links (a single shared word)"],
    "written_proof_wins": True,
    "occupation_detection": {"title_found_on_cv": 3.0, "keyword_found": 1.0, "core_competency_found": 0.5,
                             "clear_fit_min_score": 3.0},
}

meta = {
    "name": "Path Match NOC library", "version": "1.0", "built_from": "OaSIS / SIPeC 2025 (ESDC) and Job Bank open data",
    "licence": "Contains information licensed under the Open Government Licence - Canada.",
    "counts": {"titles_from_job_bank": added, "noc_codes": len(nocs), "profiles": len(profiles), "titles_index": len(title_index),
               "keywords_index": len(keyword_index), "keyword_pairs_en_fr": len(kw_pairs),
               "competency_pairs_en_fr": len(comp_pairs), "title_pairs_en_fr": len(title_pairs)},
    "skills_rated": skill_names,
    "education_levels": [{"level": l, "en": e, "fr": f} for _, l, e, f in sorted(EDU, key=lambda x: x[1])],
}
lib = {"meta": meta, "rules": RULES, "nocs": nocs, "profiles": profiles, "title_index": title_index,
       "keyword_index": keyword_index, "translations": translations}
with open(os.path.join(OUT, "noc_library.json"), "w", encoding="utf-8") as fh:
    json.dump(lib, fh, ensure_ascii=False, separators=(",", ":"))
print(json.dumps(meta["counts"]))

# the lite file the website loads: the same, without the example titles (already in title_index), the "why" texts of the
# core competencies and the full requirement texts
for p in profiles.values():
    p.pop("titles", None)
    p["requirements"].pop("text_en", None)
    p["requirements"].pop("text_fr", None)
    for c in p["core_competencies"]:
        c.pop("why_en", None)
        c.pop("why_fr", None)
with open(os.path.join(OUT, "noc_library.lite.json"), "w", encoding="utf-8") as fh:
    json.dump(lib, fh, ensure_ascii=False, separators=(",", ":"))
