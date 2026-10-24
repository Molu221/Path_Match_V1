"""
keyword_extractor.py  -  a tiny, explain-everything keyword extractor.

WHAT IT DOES
    1. Reads a job post (text file) and a CV (text file).
    2. Finds the skills that are WRITTEN in each one (explicit only, no guessing).
    3. Tags each job skill as TASK / REQUIRED / PREFERRED from the section it sits in.
    4. Compares the two lists: matched, missing, and extra.
    5. Flags eligibility items (work permit, security...) to VERIFY. They are not scored.

HOW TO RUN
    python3 keyword_extractor.py job_post.txt sample_cv.txt

Only the Python standard library is used. Nothing to install.
"""
import re
import sys
import json
import pathlib

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))   # find oasis.py next to this file
import oasis   # OaSIS helpers (python/oasis.py). Data file: python/oasis_data.json
import terms   # keywords from the whole posting, with no skill list (python/terms.py)

# ----------------------------------------------------------------------------
# PART 1. THE SKILL LIST  (a "dictionary": official name -> other ways to write it)
# Real ATS tools ship lists with tens of thousands of skills (ESCO, Lightcast...).
# Ours is short so you can read all of it.
# ----------------------------------------------------------------------------
SKILLS = {
    # quality and lean
    "Lean Six Sigma":            ["lean six sigma", "lss"],
    "Six Sigma Green/Black Belt": ["six sigma green belt", "green belt", "black belt"],
    "Lean Manufacturing":        ["lean manufacturing", "production allegee", "fabrication allegee"],
    "PDCA":                      ["pdca", "plan-do-check-act"],
    "8D":                        ["8d"],
    "A3":                        ["a3"],
    "5S":                        ["5s"],
    "Kaizen":                    ["kaizen"],
    "BPM":                       ["bpm", "business process management"],
    "Root cause analysis":       ["root cause analysis", "rca", "analyse des causes profondes", "analyse de cause racine",
                                  "analyse des causes racines", "cause racine", "causes racines"],
    "Process mapping":           ["process map", "process maps", "process mapping", "cartographie des processus",
                                  "cartographie de processus", "cartographie des procedes"],
    "Gap analysis":              ["gap analysis", "gap analyses", "analyse des ecarts", "analyse d'ecarts"],
    "Continuous improvement":    ["continuous improvement", "amelioration continue"],
    "Process improvement":       ["process improvement", "amelioration des processus", "amelioration de processus",
                                  "amelioration des procedes", "amelioration de procedes"],
    "Operational excellence":    ["operational excellence", "excellence operationnelle"],
    "Quality control":           ["quality control", "controle de la qualite", "controle qualite"],
    "KPIs":                      ["kpi", "key performance indicator", "performance indicator", "indicateur de performance",
                                  "indicateurs de performance", "indicateurs cles de performance", "indicateurs cles"],
    "Dashboards":                ["dashboard", "tableau de bord", "tableaux de bord"],
    "Action planning":           ["action plan", "plan d'action", "plans d'action"],
    "Standard operating procedures": ["sop", "standard operating procedure", "procedure operationnelle normalisee",
                                  "procedures operationnelles normalisees", "methode de travail normalisee",
                                  "methodes de travail normalisees"],
    "Flowcharts and process flows":  ["flow chart", "flow diagram", "process flow"],
    "Bottleneck analysis":       ["bottleneck", "goulot d'etranglement", "goulots d'etranglement"],
    "Non-conformance handling":  ["non-conformance", "non-conformity", "non-conformities", "nonconformance",
                                  "non-conformite", "non-conformites", "nonconformite",
                                  "non-conforming", "nonconforming"],
    "Corrective action":         ["corrective action", "action corrective", "actions correctives"],
    "Quality assurance":         ["quality assurance", "assurance qualite", "assurance de la qualite"],
    "Calibration":               ["calibration", "etalonnage"],
    "Technical writing":         ["technical writing", "redaction technique"],
    "Documentation":             ["documentation", "documenting"],
    "Diagramming software":      ["diagram-creation software"],
    "Facilitation":              ["facilitate", "facilitating", "facilitation", "animation d'atelier", "animer des ateliers", "animer des rencontres"],
    # planning and engineering
    "Industrial engineering":    ["industrial engineering", "genie industriel", "ingenierie industrielle"],
    "Project management":        ["project management", "gestion de projet", "gestion des projets", "gestion de projets"],
    "PMP":                       ["pmp"],
    "Inventory control":         ["inventory control", "inventory management", "gestion des stocks", "gestion de stock",
                                  "gestion de l'inventaire", "gestion des inventaires", "controle des stocks", "controle d'inventaire"],
    "Scheduling":                ["scheduling", "ordonnancement"],
    "Simulation":                ["simulation"],
    "Statistical analysis":      ["statistical analysis", "statistics", "analyse statistique", "statistique", "statistiques"],
    "Mechanical engineering":    ["mechanical engineering", "genie mecanique", "ingenierie mecanique"],
    "Operations management":     ["operations management", "operation management", "gestion des operations"],
    "Logistics":                 ["logistic", "logistique"],
    "Planning":                  ["planning", "planification"],
    # the fields that role titles are made of (added so title-only and French postings show their skills too)
    "Supply chain":              ["supply chain", "chaine d'approvisionnement", "chaine logistique", "chaine d approvisionnement"],
    "Procurement":               ["procurement", "purchasing", "approvisionnement", "achats"],
    "Demand forecasting":        ["demand forecast", "demand planning", "forecasting", "prevision de la demande",
                                  "previsions de la demande", "planification de la demande"],
    "Production planning":       ["production planning", "production scheduling", "planification de la production"],
    "Warehouse operations":      ["warehouse operations", "warehousing", "warehouse management", "gestion d'entrepot",
                                  "operations d'entrepot"],
    "Quality engineering":       ["quality engineer", "quality engineering", "ingenieur qualite", "ingenieur en qualite",
                                  "ingenieur de la qualite", "ingenierie de la qualite", "ingenierie qualite"],
    "Methods engineering":       ["methods engineer", "method engineer", "methods engineering", "ingenieur methodes",
                                  "ingenieur des methodes", "ingenierie des methodes"],
    "Process engineering":       ["process engineer", "process engineering", "ingenieur procedes", "ingenieur de procedes",
                                  "ingenierie des procedes", "ingenierie de procedes"],
    "Maintenance and reliability": ["reliability engineering", "maintenance planning", "preventive maintenance",
                                  "maintenance preventive", "fiabilite"],
    # tools
    "Excel":                     ["excel"],
    "Python":                    ["python"],
    "SQL":                       ["sql"],
    "Power BI":                  ["power bi"],
    "Minitab":                   ["minitab"],
    "Arena":                     ["arena"],
    "AutoCAD":                   ["autocad"],
    "SolidWorks":                ["solidworks"],
    "SAP":                       ["sap"],
    "ERP":                       ["erp"],
    "MS Project":                ["ms project", "microsoft project"],
    # added after the progress presentation: terms a person sees in the posts that the first run missed
    "Facility layout":           ["facility layout", "plant layout", "warehouse layout", "production layout", "layout",
                                  "amenagement d'usine", "implantation d'usine", "amenagement des espaces de travail"],
    "Workspace reconfiguration": ["workspace reconfiguration", "reconfiguration"],
    "Industrialization":         ["industrialization", "industrialisation"],
    "Implementation planning":   ["implementation plan", "implementation planning"],
    "Capacity analysis":         ["capacity analysis", "production capacity", "capacity planning", "analyse de capacite",
                                  "planification de la capacite"],
    "Tooling":                   ["tooling", "outillage"],
    "Business cases":            ["business case", "analyse de rentabilite", "dossier d'affaires"],
    "Capital investment":        ["capital investment"],
    "Process optimization":      ["optimize process", "optimize processes", "optimise process", "optimise processes",
                                  "optimisation des processus", "optimisation de processus", "optimiser les processus"],
    "Manufacturing experience":  ["manufacturing/production environment", "manufacturing environment",
                                  "manufacturing experience"],
    "Aerospace experience":      ["aerospace", "aerospatiale", "aeronautique"],
    "Optimization":              ["optimization", "optimisation"],
    "Automation":                ["automation", "automate", "automated", "automatisation", "automatiser"],
    "Data analysis":             ["data analysis", "data analytics", "analyze data", "analyse data", "analyse de donnees",
                                  "analyse des donnees", "analyser des donnees"],
    "Data quality and integrity": ["data quality control", "data quality", "data integrity"],
    "Cross-functional work":     ["cross-functional", "cross functional", "interfonctionnel", "multifonctionnel"],
    "Failure analysis":          ["failure analysis", "failure and defect analysis", "defect analysis", "analyse de defaillance",
                                  "analyse des defaillances", "analyse des defauts"],
    "Technical specifications":  ["technical specification", "specifications techniques"],
    "PowerPoint":                ["powerpoint"],
    # people skills and languages
    "Leadership":                ["leadership"],
    "Attention to detail":       ["attention to detail", "detail-oriented", "detail oriented", "souci du detail", "souci des details",
                                  "sens du detail", "minutie"],
    "Initiative":                ["initiative"],
    "Autonomy":                  ["autonomy", "autonomous", "autonomie", "autonome"],
    "Organizational skills":     ["organizational skill", "organisational skill", "sens de l'organisation", "esprit d'organisation",
                                  "competences organisationnelles"],
    "Explaining complex ideas":  ["simplify concept", "explain complex", "explaining complex", "vulgariser"],
    "Patience":                  ["patience"],
    "Perseverance":              ["perseverance"],
    "Curiosity":                 ["curiosity", "curiosite"],
    "Takes on challenges":       ["take on challenge", "taking on challenge", "relever des defis", "relever les defis"],
    "Problem solving":           ["problem solving", "problem-solving", "resolution de problemes", "resolution de probleme"],
    "Analytical skills":         ["analytical skill", "esprit d'analyse", "esprit analytique", "capacite d'analyse",
                                  "sens de l'analyse", "competences analytiques"],
    "Communication":             ["communication", "communicate", "communicating", "communiquer"],
    "Teamwork":                  ["teamwork", "team work", "team player", "travail d'equipe", "travail en equipe", "esprit d'equipe"],
    "Collaboration":             ["collaborate", "collaborating", "collaboration", "collaborer"],
    "Interpersonal skills":      ["interpersonal skill", "competences interpersonnelles", "habiletes interpersonnelles",
                                  "relations interpersonnelles"],
    "Bilingual (EN/FR)":         ["bilingual", "bilingue"],
    "English":                   ["english", "anglais"],
    "French":                    ["french", "francais"],
}

# Words that mean "this skill is only a nice-to-have" on the line where they appear.
PREFERRED_WORDS = ["asset", "nice to have", "preferred"]

# The headings we look for in the JOB POST, and what kind of skills sit under them.
JOB_SECTIONS = {
    "the role we are offering you": "ROLE",
    "are you ready to":             "TASK",
    "our ideal candidate has":      "REQUIRED",
    "preferred education":          "EDUCATION",
    "eligibility":                  "ELIGIBILITY",
    # headings used by the ABB and Bombardier posts
    "role and responsibilities":    "TASK",
    "requirements":                 "REQUIRED",
    "what are your contributions to the team?": "TASK",
    "how to thrive in this role?":  "REQUIRED",
    "boarding information":         "TERMS",
    # headings used by the Domtar and Rolls-Royce posts
    "your challenges":              "TASK",
    "key responsibilities":         "TASK",
    "key accountabilities":         "TASK",
    "your team":                    "ROLE",
    "your profile":                 "REQUIRED",
    "your skills":                  "REQUIRED",
    "basic requirements":           "REQUIRED",
}

# Words that mean "check this yourself". Shown as flags, never scored.
FLAG_PATTERNS = {
    "Work authorization in Canada": r"legally entitled to work|authorized to work|eligible to work",
    "Controlled Goods Program":     r"controlled goods",
    "Police clearance":             r"police clearance|criminal (record|check)",
    "Bilingual required":           r"bilingual",
    "Hybrid / on-site":             r"on-site|hybrid",
    "Students only, not new graduates": r"students only",
    "Degree level / program stated": r"co-op bachelor|bachelor'?s degree|master'?s degree|university degree|college diploma|degree in|study at baa",
    "Term and duration":            r"duration: \d+ months|winter 2027",
    "Travel outside Canada":        r"travel outside",
    "French required":              r"french is required",
    "Years of experience stated":   r"\d+(?:\s*(?:to|-|–)\s*\d+)?\+?\s*years|minimum of \d+ years|years of experience",
    "Citizen / permanent resident": r"canadian citizen|permanent resident|citoyen canadien|resident permanent",
    "OIQ membership":               r"\boiq\b|order of engineers|ordre des ingenieurs",
    "Security clearance":           r"security clearance|secret clearance|reliability status|cote de securite",
}

# Pairs that LOOK related but are different words. We list them, we do NOT count them.
RELATED = {
    "Continuous improvement": ["Process improvement", "Lean Six Sigma", "Kaizen"],
    "Lean Manufacturing":     ["Lean Six Sigma", "5S"],
    "Project management":     ["Industrial engineering"],
    "KPIs":                   ["Dashboards"],
    "Flowcharts and process flows": ["Process mapping"],
    "Quality assurance":      ["Quality control"],
    "Planning":               ["Scheduling"],
    "Operations management":  ["Industrial engineering"],
    "Logistics":              ["Inventory control"],
    "Tooling":                ["Facility layout"],
    "Process optimization":   ["Process improvement"],
    "Failure analysis":       ["Root cause analysis"],
    "Workspace reconfiguration": ["Facility layout"],
    "Supply chain":           ["Logistics", "Inventory control", "Procurement"],
    "Quality engineering":    ["Quality control", "Quality assurance"],
    "Methods engineering":    ["Industrial engineering", "Process improvement"],
    "Process engineering":    ["Process improvement", "Industrial engineering"],
    "Production planning":    ["Planning", "Scheduling"],
    "Warehouse operations":   ["Inventory control", "Logistics"],
    "Demand forecasting":     ["Planning"],
}

# Why a pair is "close". Shown next to the pair on the website. Pairs without a line get a generic reason.
RELATED_WHY = {
    ("Continuous improvement", "Kaizen"):               "Kaizen is a continuous improvement method",
    ("Continuous improvement", "Lean Six Sigma"):       "Lean Six Sigma is a continuous improvement method",
    ("Continuous improvement", "Process improvement"):  "process improvement is the same idea in other words",
    ("Lean Manufacturing", "Lean Six Sigma"):           "Lean Six Sigma includes lean",
    ("Lean Manufacturing", "5S"):                       "5S is a lean tool",
    ("Quality assurance", "Quality control"):           "quality control is part of quality assurance",
    ("Planning", "Scheduling"):                         "scheduling is a form of planning",
    ("Logistics", "Inventory control"):                 "inventory control is part of logistics",
    ("KPIs", "Dashboards"):                             "a dashboard is where KPIs are shown",
    ("Flowcharts and process flows", "Process mapping"): "process mapping draws the flow",
    ("Tooling", "Facility layout"):                     "layout work and tooling are both about equipment and space",
    ("Process optimization", "Process improvement"):    "improving a process is optimizing it",
    ("Failure analysis", "Root cause analysis"):        "root cause analysis is how a failure is analysed",
    ("Workspace reconfiguration", "Facility layout"):   "a layout study is reconfiguration work",
    ("Operations management", "Industrial engineering"): "industrial engineering covers operations",
    ("Project management", "Industrial engineering"):   "industrial engineering includes project work",
    ("Supply chain", "Logistics"):                      "logistics moves the goods along the supply chain",
    ("Supply chain", "Inventory control"):              "inventory control is one part of a supply chain",
    ("Supply chain", "Procurement"):                    "procurement is the buying end of a supply chain",
    ("Quality engineering", "Quality control"):         "quality control is a core task of quality engineering",
    ("Quality engineering", "Quality assurance"):       "quality assurance is a core task of quality engineering",
    ("Methods engineering", "Industrial engineering"):  "methods engineering is a branch of industrial engineering",
    ("Methods engineering", "Process improvement"):     "methods work is about improving how a task is done",
    ("Process engineering", "Process improvement"):     "process engineering designs and improves processes",
    ("Process engineering", "Industrial engineering"):  "industrial engineering covers process design",
    ("Production planning", "Planning"):                "production planning is planning applied to production",
    ("Production planning", "Scheduling"):              "scheduling sets the order of production",
    ("Warehouse operations", "Inventory control"):      "inventory control is part of running a warehouse",
    ("Warehouse operations", "Logistics"):              "warehouses are part of logistics",
    ("Demand forecasting", "Planning"):                 "forecasts feed planning",
}


# ----------------------------------------------------------------------------
# PART 2. THE TOOLS
# ----------------------------------------------------------------------------
def build_patterns(skills=None):
    """Turn each alias into a 'regular expression' (a smart find).
    The (?<![a-z0-9]) and (?![a-z0-9]) parts mean: match whole words only,
    so 'sap' is not found inside 'sapphire' and 'a3' is not found inside 'a30'."""
    patterns = {}
    for name, aliases in (SKILLS if skills is None else skills).items():
        parts = []
        for alias in aliases:
            alias = re.escape(alias).replace(r"\ ", r"[\s-]+")   # allow space or hyphen
            parts.append(alias + r"s?")                           # allow a plural 's'
        patterns[name] = re.compile(r"(?<![a-z0-9])(?:" + "|".join(parts) + r")(?![a-z0-9])")
    return patterns


# Add the English and French OaSIS names as extra spellings (if python/oasis_data.json was built).
OASIS = oasis.load()
SKILLS_ALL, SKILL_SOURCE = oasis.merge_skills(SKILLS, OASIS)
PATTERNS = build_patterns(SKILLS_ALL)


def clean(text):
    """Make the text easy to search: lowercase, fix fancy quotes, one space between words."""
    return oasis.fold(text)      # lowercase, straight quotes and dashes, accents removed (qualité = qualite)


def find_skills_in_line(line):
    """Return every skill from our list that is WRITTEN in this line.
    A skill is not counted when every place it appears sits inside a longer skill's words
    ('Writing' inside 'technical writing', 'quality control' inside 'data quality controls'),
    so one phrase is not counted twice."""
    line = clean(line)
    spans = {}
    for name, pat in PATTERNS.items():
        found = [m.span() for m in pat.finditer(line)]
        if found:
            spans[name] = found
    kept = []
    for name, own in spans.items():
        others = [sp for other, lst in spans.items() if other != name for sp in lst]
        if all(any(o[0] <= a and b <= o[1] and (o[1] - o[0]) > (b - a) for o in others) for a, b in own):
            continue
        kept.append(name)
    return kept


def kept_spans(line):
    """Where the dictionary skills sit on an already folded line (nested ones left out, as in find_skills_in_line).
    terms.py cuts these words out before it reads the other phrases."""
    spans = {name: [m.span() for m in pat.finditer(line)] for name, pat in PATTERNS.items()}
    spans = {n: s for n, s in spans.items() if s}
    allsp = [(n, sp) for n, lst in spans.items() for sp in lst]
    out = []
    for name, own in spans.items():
        if all(any(o != name and x <= a and b <= y and (y - x) > (b - a) for o, (x, y) in allsp) for a, b in own):
            continue
        out.extend(own)
    return out


def extract_terms(text):
    """Every phrase of the text that is not one of the dictionary skills (see terms.py)."""
    return terms.extract_terms(text, kept_spans)


def term_report(job_text, cv_text):
    """The phrases of a posting compared with the CV: {key: (status, info)}, status M / R / G."""
    found = extract_terms(job_text)
    return found, terms.match_terms(found, terms.index_cv(cv_text))


def term_summary(job_text, cv_text):
    """Every phrase of the posting (not only the dictionary skills) against the CV.
    Phrases from the company / benefits part ("About") are listed but not counted.
    Returns {"phrases": [...], "counted", "matched", "close", "pct", "pct_with_close"}."""
    found, hits = term_report(job_text, cv_text)
    tags = terms.line_tags(job_text)
    rows = []
    for key, e in found.items():
        status, info = hits[key]
        tag = terms.term_tag(e, tags)
        rows.append({"phrase": e["name"], "count": e["count"], "where": tag or "-", "status": status,
                     "counted": tag != "About",
                     "cv_line": (info or {}).get("line", ""),
                     "shared_words": (info or {}).get("shared", []) if status == "R" else []})
    counted = [r for r in rows if r["counted"]]
    m = sum(r["status"] == "M" for r in counted)
    c = sum(r["status"] == "R" for r in counted)
    n = len(counted)
    pct = lambda v: round(100 * v / n, 1) if n else 0.0
    return {"phrases": rows, "counted": n, "matched": m, "close": c, "pct": pct(m), "pct_with_close": pct(m + 0.5 * c)}


def split_job_sections(job_text):
    """Walk through the job post line by line. When a line is a known heading,
    switch the 'current section'. Every other line belongs to the current section."""
    current = "HEADER"
    result = []                                   # list of (section, line)
    for raw in job_text.splitlines():
        line = raw.strip()
        if not line or line.startswith(("JOB:", "COMPANY:", "SOURCE:")):
            continue
        key = line.lower().strip(":")
        if key in JOB_SECTIONS:
            current = JOB_SECTIONS[key]
            continue
        result.append((current, line))
    return result


CV_HEADINGS = ["summary", "education", "experience", "projects", "skills",
               "certifications", "languages", "patents and activities", "activities", "awards", "publications",
               "work experience", "professional experience", "technical skills", "volunteer experience",
               "sommaire", "profil", "formation", "experience professionnelle", "projets", "competences",
               "langues", "certificats", "activites"]


def split_cv_sections(cv_text):
    """Same idea for the CV: a line that is only a heading word starts a new section."""
    current = "HEADER"
    result = []
    for raw in cv_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if oasis.fold(line).strip() in CV_HEADINGS:
            current = line.upper()
            continue
        result.append((current, line))
    return result


# ----------------------------------------------------------------------------
# PART 3. THE STEPS
# ----------------------------------------------------------------------------
def extract_job_keywords(job_text):
    """For each job skill, remember: its tag (TASK/REQUIRED/PREFERRED) and the line it came from."""
    found = {}
    for section, line in split_job_sections(job_text):
        for skill in find_skills_in_line(line):
            tag = section if section in ("TASK", "REQUIRED") else "OTHER"
            if any(w in line.lower() for w in PREFERRED_WORDS):
                tag = "PREFERRED"
            # keep the strongest tag if a skill appears twice (REQUIRED > TASK > PREFERRED > OTHER)
            rank = {"REQUIRED": 3, "TASK": 2, "PREFERRED": 1, "OTHER": 0}
            if skill not in found or rank[tag] > rank[found[skill]["tag"]]:
                found[skill] = {"tag": tag, "evidence": line}
    return found


def extract_cv_keywords(cv_text):
    """For each CV skill, remember which CV section it was written in, and the line."""
    found = {}
    for section, line in split_cv_sections(cv_text):
        for skill in find_skills_in_line(line):
            found.setdefault(skill, {"section": section, "evidence": line})
    return found


def find_flags(job_text):
    return [name for name, pat in FLAG_PATTERNS.items() if re.search(pat, job_text.lower())]


def compare(job_kw, cv_kw):
    matched = [s for s in job_kw if s in cv_kw]
    missing = [s for s in job_kw if s not in cv_kw]
    extra = [s for s in cv_kw if s not in job_kw]
    related = []
    for s in missing:
        for other in RELATED.get(s, []):
            if other in cv_kw:
                related.append((s, other))
    return matched, missing, extra, related


# ----------------------------------------------------------------------------
# PART 4. RUN EVERYTHING AND PRINT A REPORT
# ----------------------------------------------------------------------------
def related_coverage(matched, missing, related, inferred, total):
    """(Match + 0.5 x Related) / total, the project formula. A missing skill counts once."""
    linked = {a for a, _ in related} | {a for a, _, _, _ in inferred}
    return round(100 * (len(matched) + 0.5 * len(linked & set(missing))) / total, 1) if total else 0.0


def oasis_report_data(job_text, cv_text, matched, missing, cv_kw, related, job_kw):
    """The OaSIS part of the report as data (no printing). Empty if the data is not built."""
    total = len(job_kw)
    if not OASIS:
        return {"oasis": {"loaded": False}, "inferred_related": [], "occupation_alignment": [],
                "coverage_with_related_pct": related_coverage(matched, missing, related, [], total)}
    inferred = oasis.inferred_related(missing, list(cv_kw), OASIS, already=related)
    from_oasis = sorted({k for k in list(job_kw) + list(cv_kw) if SKILL_SOURCE.get(k, "curated") != "curated"})
    return {"oasis": {"loaded": True, "built": OASIS["meta"]["built"]},
            "skills_from_oasis": from_oasis,
            "inferred_related": [list(x) for x in inferred],
            "occupation_alignment": oasis.occupation_alignment(job_text, cv_text, OASIS),
            "coverage_with_related_pct": related_coverage(matched, missing, related, inferred, total)}


def oasis_report(job_text, cv_text, matched, missing, cv_kw, related, job_kw):
    """Print the OaSIS part of the report and return it as data for results.json."""
    data = oasis_report_data(job_text, cv_text, matched, missing, cv_kw, related, job_kw)
    if not OASIS:
        print("  OaSIS data not built yet (python/oasis_data.json). Run the 'Build OaSIS dictionary'")
        print("  workflow or: python3 scripts/build_oasis_dictionary.py")
        return data
    print(f"  data: {OASIS['meta']['source']} ({OASIS['meta']['occupations']} occupations)")
    print("  Skills found through OaSIS names:", ", ".join(data["skills_from_oasis"]) or "none")
    print("  Same occupation named in both:   ", "; ".join(
        f"{a['code']} {a['label']} (job '{a['job_title']}', CV '{a['cv_title']}')"
        for a in data["occupation_alignment"]) or "none")
    print("  INFERRED, NOT COUNTED:           ", "; ".join(
        f"job '{a}' ~ CV '{b}' ({n} shared occupations)" for a, b, _, n in data["inferred_related"]) or "none")
    print(f"  Coverage incl. related = (matched + 0.5 x related) / job skills = {data['coverage_with_related_pct']}%")
    return data


def short(text, n=70):
    return text if len(text) <= n else text[: n - 1] + "…"


def main(job_path, cv_path):
    job_text = open(job_path, encoding="utf-8").read()
    cv_text = open(cv_path, encoding="utf-8").read()

    print("STEP 1  Read the files")
    print(f"  job post: {len(job_text.split())} words   CV: {len(cv_text.split())} words\n")

    print("STEP 2  Split each file into sections")
    jobs = split_job_sections(job_text)
    cvs = split_cv_sections(cv_text)
    print("  job sections:", sorted({s for s, _ in jobs}))
    print("  CV sections: ", sorted({s for s, _ in cvs}), "\n")

    print("STEP 3  Find the skills WRITTEN in the job post")
    job_kw = extract_job_keywords(job_text)
    for skill, info in job_kw.items():
        print(f"  [{info['tag']:<9}] {skill:<28} <- \"{short(info['evidence'], 52)}\"")
    print(f"  => {len(job_kw)} job skills\n")

    print("STEP 4  Find the skills WRITTEN in the CV")
    cv_kw = extract_cv_keywords(cv_text)
    for skill, info in cv_kw.items():
        print(f"  [{info['section']:<14}] {skill:<28} <- \"{short(info['evidence'], 46)}\"")
    print(f"  => {len(cv_kw)} CV skills\n")

    print("STEP 5  Compare the two lists (no guessing)")
    matched, missing, extra, related = compare(job_kw, cv_kw)
    print("  MATCHED (in both):      ", ", ".join(matched))
    print("  MISSING (job only):     ", ", ".join(missing))
    print("  EXTRA (CV only):        ", ", ".join(extra))
    print("  RELATED, NOT COUNTED:   ", "; ".join(f"job '{a}' ~ CV '{b}'" for a, b in related) or "none")
    cover = 100 * len(matched) / len(job_kw)
    print(f"  Coverage = {len(matched)} matched / {len(job_kw)} job skills = {cover:.0f}%\n")

    print("STEP 5a EVERY OTHER PHRASE of the post (any field, no list needed; terms.py)")
    ts = term_summary(job_text, cv_text)
    for label, st in (("MATCH (same words on the CV)", "M"), ("CLOSE (not counted as a match)", "R"), ("GAP (not on the CV)", "G")):
        names = [r["phrase"] + (f" x{r['count']}" if r["count"] > 1 else "") for r in ts["phrases"] if r["counted"] and r["status"] == st]
        shown = ", ".join(names[:40]) + (f", ... (+{len(names) - 40} more, see results.json)" if len(names) > 40 else "")
        print(f"  {label}: {len(names)}\n    {shown or 'none'}")
    about = sum(not r["counted"] for r in ts["phrases"])
    print(f"  Phrases from the company / benefits part, listed but not counted: {about}")
    print(f"  Phrase coverage = {ts['matched']} matched / {ts['counted']} phrases = {ts['pct']}%   (with close at half credit: {ts['pct_with_close']}%)\n")

    print("STEP 5b OaSIS: occupations and inferred links (listed, never counted as matches)")
    extra_info = oasis_report(job_text, cv_text, matched, missing, cv_kw, related, job_kw)
    print()

    print("STEP 6  Flags to VERIFY (not scored)")
    for f in find_flags(job_text):
        print("  -", f)

    out = {"job_skills": job_kw, "cv_skills": cv_kw, "matched": matched, "missing": missing,
           "extra": extra, "related_not_counted": related, "coverage_pct": round(cover, 1),
           "flags": find_flags(job_text), "phrases": ts, **extra_info}
    with open("results.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("\nSaved: results.json")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 keyword_extractor.py job_post.txt sample_cv.txt")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
