"""Path Match NOC library: helpers to use noc_library.json (Python 3.8+, no extra packages).

    import noc_library as nl
    lib = nl.load("noc_library.json")
    fits = nl.find_occupations(lib, cv_text)                # CV -> best occupations
    result = nl.compare(lib, cv_text, "13201.01",            # CV vs an occupation (or a Job Bank job)
                        posting_language="English and French")
    nl.translate(lib, "inventory control")                  # English <-> French
    nl.similar(lib, "13201.01")                             # nearby occupations

Every item gets one of 3 labels: Matched, Missing, Guess (see lib["rules"]).
Data: OaSIS / SIPeC 2025 (ESDC). Contains information licensed under the Open Government Licence - Canada.
"""
import json
import math
import re
import unicodedata

LINKS = set("de des du d la l a au aux en le les of the and et ou or to for in on".split())
STOP = LINKS | set("un une with par pour sur dans avec by from as at".split())


# ------------------------------------------------------------------ text helpers
def norm(text):
    """lowercase, no accents, apostrophes and punctuation become spaces."""
    t = unicodedata.normalize("NFD", str(text or "").lower())
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    t = re.sub(r"[’'`]", " ", t)
    t = re.sub(r"[^a-z0-9+#&\-\. ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def stem(w):
    """Very light plural removal, the same for English and French."""
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 4 and w.endswith(("ches", "shes", "sses", "xes", "zes")):
        return w[:-2]
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is", "as", "os", "ys")):
        return w[:-1]
    return w


def fuzzy(w):
    """Word family: the first 6 letters of a long word (coordinate, coordinating, coordination -> 'coordi')."""
    return w[:6] if len(w) >= 7 else w


def tokens(text):
    return [stem(w.strip(".-")) for w in norm(text).split(" ") if w.strip(".-")]


class Text:
    """A CV (or any text) prepared once for fast phrase lookups."""

    def __init__(self, text):
        self.raw = text or ""
        self.norm = norm(text)
        self.toks = tokens(text)
        self.pos, self.fpos = {}, {}
        for i, t in enumerate(self.toks):
            self.pos.setdefault(t, []).append(i)
            self.fpos.setdefault(fuzzy(t), []).append(i)

    def has(self, phrase, window=6, loose=False):
        """True if all content words of `phrase` appear close together (any order).
        loose=True also accepts other forms of a word (coordinate / coordinating / coordination)."""
        words = [t for t in tokens(phrase) if t not in STOP]
        if not words:
            return False
        pos = self.pos
        if loose:
            words, pos = [fuzzy(w) for w in words], self.fpos
        first = pos.get(words[0])
        if not first:
            return False
        if len(words) == 1:
            return True
        for i in first:
            if all(any(abs(j - i) <= window + len(words) for j in pos.get(w, [])) for w in words[1:]):
                return True
        return False


def load(path="noc_library.json"):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


# ------------------------------------------------------------------ CV -> occupations
FIELD_TO_TITLE = [("engineering", "engineer"), ("nursing", "nurse"), ("accounting", "accountant"), ("pharmacy", "pharmacist"),
                  ("dentistry", "dentist"), ("architecture", "architect"), ("physiotherapy", "physiotherapist"),
                  ("genie industriel", "ingenieur industriel"), ("genie mecanique", "ingenieur mecanique"),
                  ("genie civil", "ingenieur civil"), ("genie electrique", "ingenieur electricien"), ("soins infirmiers", "infirmier")]
def find_occupations(lib, cv_text, top=5):
    """Return the occupations the CV fits best, with the evidence. 'clear_fit' = strong enough for guesses."""
    cv = cv_text if isinstance(cv_text, Text) else Text(cv_text)
    w = lib["rules"]["occupation_detection"]
    score, evidence = {}, {}
    # 1) job titles written on the CV (longer titles count more)
    n = len(cv.toks)
    seen = set()
    words = cv.norm.split(" ")
    for size in range(6, 0, -1):
        for i in range(0, max(0, len(words) - size + 1)):
            gram = " ".join(words[i:i + size])
            if gram in seen:
                continue
            seen.add(gram)
            label, factor = "title: ", 1.0
            if gram not in lib["title_index"]:
                # a field of study points to its occupation ("industrial engineering" -> "industrial engineer"),
                # as weaker evidence that is never a clear fit on its own
                field = next((gram[: -len(a)] + b for a, b in FIELD_TO_TITLE if gram.endswith(a)), None)
                if not field or field not in lib["title_index"] or size < 2:
                    continue
                gram, label, factor = field, "field of study: ", 0.5
            codes = lib["title_index"][gram]
            weight = factor * w["title_found_on_cv"] * (1.0 if size >= 2 else 0.35) / max(1, len(codes)) ** 0.5
            for c in codes:
                score[c] = score.get(c, 0) + weight
                evidence.setdefault(c, []).append(label + gram)
    # 2) duty keywords and 3) core competencies
    for code, p in lib["profiles"].items():
        hits = [k for k in p["keywords"]["en"] + p["keywords"]["fr"] if cv.has(k)]
        if hits:
            pts = sum(1.0 if " " in h else 0.25 for h in hits)
            score[code] = score.get(code, 0) + w["keyword_found"] * min(pts, 4) * 0.5
            evidence.setdefault(code, []).extend("duty: " + h for h in hits[:5])
        comp = [c for c in {x for cc in p["core_competencies"] for x in cc["parts"]} if cv.has(c)]
        if comp:
            score[code] = score.get(code, 0) + w["core_competency_found"] * min(len(comp), 4) * 0.5
    ranked = sorted(score.items(), key=lambda x: -x[1])[:top]
    out = []
    for code, s in ranked:
        p = lib["profiles"][code]
        out.append({"code": code, "noc": p["noc"], "name": p["name"], "score": math.floor(s * 100 + 0.5) / 100,  # same rounding as JavaScript
                    "clear_fit": s >= w["clear_fit_min_score"] and any(e.startswith("title:") for e in evidence[code]),
                    "evidence": evidence[code][:8]})
    return out


# ------------------------------------------------------------------ education, certifications, languages
EDU_CV = [  # (pattern on normalized CV text, level)
    (r"\bph\.? ?d\b|doctorat|doctorate|\bdoctor of\b", 6),
    (r"\bmaster|\bm\.? ?(eng|sc|ba|a)\b|\bmba\b|maitrise", 5),
    (r"\bbachelor|\bb\.? ?(comm|eng|sc|a|ba)\b|baccalaureat|\bbac\b|university degree|diplome universitaire", 4),
    (r"\bdec\b|cegep|college|diploma|\bdiplome d etudes collegiales|\baec\b|\bdep\b|apprenticeship|apprentissage", 3),
    (r"high school|secondary school|\bdes\b|secondaire", 2),
]
IN_PROGRESS = re.compile(r"in progress|expected|ongoing|current|present|en cours|prevu|a ce jour")
CERT_CV = {
    "Red Seal endorsement": r"red seal|sceau rouge",
    "Professional Engineer licence (P.Eng.)": r"p\.? ?eng|professional engineer|\bing\.? |ingenieur junior|\beit\b|engineer in training",
    "CPA designation": r"\bcpa\b|chartered professional accountant",
    "Driver's licence": r"driver s licen|drivers licen|permis de conduire|class [1-5a-g] ",
    "Trade certification": r"journeyman|journeyperson|certificate of qualification|certificat de qualification|compagnon",
    "Registration with a regulatory body": r"registered with|registration (with|number|no)|licen[cs]e (number|no)|membre de l ordre|"
                                           r"\bordre des\b|registered (nurse|psychiatric nurse|practical nurse|dietitian|massage|social worker)|"
                                           r"infirmi\w* autoris|licensed practical nurse|\blpn\b|\brn\b|\brpn\b",
    "Licence": r"licen[cs]e (number|no|holder)|licensed|permis (de|d) ",
    "Certification": r"certified|certification|certifie|certificat",
}
LANG_WORDS = {"English": r"\benglish\b|\banglais\b|bilingual|bilingue",
              "French": r"\bfrench\b|\bfrancais\b|bilingual|bilingue"}
FR_SCHOOLS = re.compile(r"universite (de montreal|laval|du quebec|de sherbrooke)|\buqam\b|\buqtr\b|\buqac\b|cegep|polytechnique montreal|hec montreal|\bets\b")
FR_STOP = set("le la les des du de et pour avec dans sur une un est sont au aux".split())
EN_STOP = set("the and of to with for in on a an is are at by from".split())


def cv_language_guess(cv):
    fr = sum(1 for t in cv.norm.split(" ") if t in FR_STOP)
    en = sum(1 for t in cv.norm.split(" ") if t in EN_STOP)
    return "French" if fr > en * 1.3 else "English" if en > fr * 1.3 else ""


def cv_education(cv):
    best, best_progress = 0, 0
    for line in re.split(r"[\n;]|\s{2,}", cv.raw):
        n = norm(line)
        for pat, lvl in EDU_CV:
            if re.search(pat, n):
                if IN_PROGRESS.search(n) or re.search(r"20\d\d ?- ?(20\d\d )?\(?expected|20\d\d ?- ?present", n):
                    best_progress = max(best_progress, lvl)
                else:
                    best = max(best, lvl)
                break
    return best, best_progress


def item(part, en, fr, label, why):
    return {"part": part, "en": en, "fr": fr, "label": label, "why": why}


# ------------------------------------------------------------------ CV vs occupation
def compare(lib, cv_text, code, posting_language=None, fits=None, max_duties=12, max_skills=12):
    """Compare a CV with one occupation profile (a NOC code like '13201' or a profile code like '13201.01').
    posting_language: 'English', 'French' or 'English and French' (Job Bank's Official Language column)."""
    cv = cv_text if isinstance(cv_text, Text) else Text(cv_text)
    if code not in lib["profiles"]:
        code = lib["nocs"][code[:5]]["profiles"][0]
    p = lib["profiles"][code]
    fits = fits if fits is not None else find_occupations(lib, cv)
    clear = [lib["profiles"][f["code"]] for f in fits if f["clear_fit"]]
    pairs = lib["translations"]["keywords_en_fr"]
    out = []

    # 1) duties: each main duty sentence of the occupation
    clear_codes = {c["code"] for c in clear}
    near = {x["code"] for c in clear for x in c["similar"] if x["level"] == "very similar"}
    for d in p["duties"][:max_duties]:
        keys = d["keys"] + d.get("keys_fr", [])
        found = [k for k in keys if cv.has(k)]
        if d["keys"] and len([k for k in d["keys"] if k in found or pairs.get(k) in found]) >= max(1, (len(d["keys"]) + 1) // 2):
            out.append(item("duties", d["en"], d["fr"], "Matched", "on the CV: " + ", ".join(found[:3])))
        elif code in clear_codes or code in near:
            out.append(item("duties", d["en"], d["fr"], "Guess", "usual duty of an occupation your CV clearly fits"))
        else:
            out.append(item("duties", d["en"], d["fr"], "Missing", "not on the CV"))

    # 2) skills: core competencies + skills rated 4-5
    skills = []
    for cc in p["core_competencies"]:
        for part in cc["parts"]:
            if part not in skills:
                skills.append(part)
    for s in p["skills"]:  # already sorted from highest rating
        if s["rating"] >= 4 and s["en"] not in skills:
            skills.append(s["en"])
    skills = skills[:max_skills]
    comp_fr = lib["translations"]["competencies_en_fr"]
    for s in skills:
        fr = comp_fr.get(s.lower(), "")
        if cv.has(s, loose=True) or (fr and cv.has(fr, loose=True)):
            out.append(item("skills", s, fr, "Matched", "written on the CV"))
        else:
            src = next((c for c in clear if any(s in cc["parts"] for cc in c["core_competencies"])
                        or any(x["en"] == s and x["rating"] >= 4 for x in c["skills"])), None)
            if src:
                out.append(item("skills", s, fr, "Guess", "core skill of " + src["name"]["en"] + ", an occupation your CV fits"))
            else:
                out.append(item("skills", s, fr, "Missing", "not on the CV"))

    # 3) education
    edu = p["requirements"]["education"]
    if edu:
        have, progress = cv_education(cv)
        if have >= edu["level"]:
            out.append(item("education", edu["en"], edu["fr"], "Matched", "your CV shows this level or higher"))
        elif progress >= edu["level"]:
            out.append(item("education", edu["en"], edu["fr"], "Guess", "degree in progress on your CV"))
        else:
            out.append(item("education", edu["en"], edu["fr"], "Missing", "usually required for this occupation"))

    # 4) certifications and licences (required ones only; never guessed)
    for c in p["requirements"]["certifications"]:
        if not c["required"]:
            continue
        pat = CERT_CV.get(c["name"])
        found = bool(pat and re.search(pat, cv.norm + " "))
        out.append(item("certifications", c["name"], c["fr"], "Matched" if found else "Missing",
                        "on your CV" if found else c["en"]))

    # 5) languages (Job Bank "Official Language": English, French, English or French, Bilingual)
    if not posting_language:
        mix = {k: v for k, v in lib["nocs"].get(p["noc"], {}).get("languages_in_postings", {}).items() if "no data" not in k.lower()}
        posting_language = max(mix, key=mix.get) if mix else ""
    pl = (posting_language or "").lower()
    if "bilingual" in pl or "and" in pl or " et " in pl:
        needed = [["English"], ["French"]]                 # both required
    elif " or " in pl or " ou " in pl:
        needed = [["English", "French"]]                   # either one is enough
    else:
        needed = [[l] for l in ("English", "French") if l.lower() in pl]
    written_in = cv_language_guess(cv)
    fr_name = {"English": "Anglais", "French": "Français"}
    for options in needed:
        en, fr = " or ".join(options), " ou ".join(fr_name[o] for o in options)
        if any(re.search(LANG_WORDS[o], cv.norm) for o in options):
            out.append(item("languages", en, fr, "Matched", "listed on the CV"))
        elif written_in in options or ("French" in options and FR_SCHOOLS.search(cv.norm)):
            out.append(item("languages", en, fr, "Guess", "your CV is written in it or shows studies in it"))
        else:
            out.append(item("languages", en, fr, "Missing", "not on the CV"))

    summary = {lab: sum(1 for x in out if x["label"] == lab) for lab in ("Matched", "Guess", "Missing")}
    return {"code": code, "noc": p["noc"], "name": p["name"], "summary": summary, "items": out}


# ------------------------------------------------------------------ small lookups
def translate(lib, term):
    """English <-> French for keywords, competencies and job titles."""
    t = norm(term)
    tr = lib["translations"]
    hits = []
    for table in ("keywords_en_fr", "keywords_fr_en"):
        if t in tr[table]:
            hits.append(tr[table][t])
    for en, fr in tr["competencies_en_fr"].items():
        if norm(en) == t:
            hits.append(fr)
        elif norm(fr) == t:
            hits.append(en)
    for en, fr in tr["titles_en_fr"].items():
        if norm(en) == t:
            hits.append(fr)
        elif t in [norm(x) for x in fr.split("/")] or norm(fr) == t:
            hits.append(en)
    return list(dict.fromkeys(hits))


def similar(lib, code):
    if code not in lib["profiles"]:
        code = lib["nocs"][code[:5]]["profiles"][0]
    return [{**s, "name": lib["profiles"][s["code"]]["name"]} for s in lib["profiles"][code]["similar"]]


def occupations_for_keyword(lib, keyword):
    k = norm(keyword)
    return [{"code": c, "name": lib["profiles"][c]["name"]} for c in lib["keyword_index"].get(k, [])]
