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

# ----------------------------------------------------------------------------
# PART 1. THE SKILL LIST  (a "dictionary": official name -> other ways to write it)
# Real ATS tools ship lists with tens of thousands of skills (ESCO, Lightcast...).
# Ours is short so you can read all of it.
# ----------------------------------------------------------------------------
SKILLS = {
    # quality and lean
    "Lean Six Sigma":            ["lean six sigma", "lss"],
    "Six Sigma Green/Black Belt": ["six sigma green belt", "green belt", "black belt"],
    "Lean Manufacturing":        ["lean manufacturing"],
    "PDCA":                      ["pdca", "plan-do-check-act"],
    "8D":                        ["8d"],
    "A3":                        ["a3"],
    "5S":                        ["5s"],
    "Kaizen":                    ["kaizen"],
    "BPM":                       ["bpm", "business process management"],
    "Root cause analysis":       ["root cause analysis", "rca"],
    "Process mapping":           ["process map", "process maps", "process mapping"],
    "Gap analysis":              ["gap analysis", "gap analyses"],
    "Continuous improvement":    ["continuous improvement"],
    "Process improvement":       ["process improvement"],
    "Operational excellence":    ["operational excellence"],
    "Quality control":           ["quality control"],
    "KPIs":                      ["kpi", "key performance indicator", "performance indicator"],
    "Dashboards":                ["dashboard"],
    "Action planning":           ["action plan"],
    "Standard operating procedures": ["sop", "standard operating procedure"],
    "Flowcharts and process flows":  ["flow chart", "flow diagram", "process flow"],
    "Bottleneck analysis":       ["bottleneck"],
    "Non-conformance handling":  ["non-conformit"],
    "Corrective action":         ["corrective action"],
    "Quality assurance":         ["quality assurance"],
    "Calibration":               ["calibration"],
    "Technical writing":         ["technical writing"],
    "Documentation":             ["documentation", "documenting"],
    "Diagramming software":      ["diagram-creation software"],
    "Facilitation":              ["facilitate", "facilitation"],
    # planning and engineering
    "Industrial engineering":    ["industrial engineering"],
    "Project management":        ["project management"],
    "PMP":                       ["pmp"],
    "Inventory control":         ["inventory control", "inventory management"],
    "Scheduling":                ["scheduling"],
    "Simulation":                ["simulation"],
    "Statistical analysis":      ["statistical analysis", "statistics"],
    "Mechanical engineering":    ["mechanical engineering"],
    "Operations management":     ["operations management", "operation management"],
    "Logistics":                 ["logistic"],
    "Planning":                  ["planning"],
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
    # people skills and languages
    "Problem solving":           ["problem solving", "problem-solving"],
    "Analytical skills":         ["analytical skill"],
    "Communication":             ["communication"],
    "Teamwork":                  ["teamwork"],
    "Collaboration":             ["collaborate", "collaboration"],
    "Interpersonal skills":      ["interpersonal skill"],
    "Bilingual (EN/FR)":         ["bilingual"],
    "English":                   ["english"],
    "French":                    ["french"],
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
}

# Words that mean "check this yourself". Shown as flags, never scored.
FLAG_PATTERNS = {
    "Work authorization in Canada": r"legally entitled to work|authorized to work|eligible to work",
    "Controlled Goods Program":     r"controlled goods",
    "Police clearance":             r"police clearance|criminal (record|check)",
    "Bilingual required":           r"bilingual",
    "Hybrid / on-site":             r"on-site|hybrid",
    "Students only, not new graduates": r"students only",
    "Degree level / program stated": r"co-op bachelor|bachelor's degree|master's degree|study at baa",
    "Term and duration":            r"duration: \d+ months|winter 2027",
    "Travel outside Canada":        r"travel outside",
    "French required":              r"french is required",
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
}


# ----------------------------------------------------------------------------
# PART 2. THE TOOLS
# ----------------------------------------------------------------------------
def build_patterns():
    """Turn each alias into a 'regular expression' (a smart find).
    The (?<![a-z0-9]) and (?![a-z0-9]) parts mean: match whole words only,
    so 'sap' is not found inside 'sapphire' and 'a3' is not found inside 'a30'."""
    patterns = {}
    for name, aliases in SKILLS.items():
        parts = []
        for alias in aliases:
            alias = re.escape(alias).replace(r"\ ", r"[\s-]+")   # allow space or hyphen
            parts.append(alias + r"s?")                           # allow a plural 's'
        patterns[name] = re.compile(r"(?<![a-z0-9])(?:" + "|".join(parts) + r")(?![a-z0-9])")
    return patterns


PATTERNS = build_patterns()


def clean(text):
    """Make the text easy to search: lowercase, fix fancy quotes, one space between words."""
    text = text.lower().replace("\u2011", "-").replace("’", "'").replace("–", "-").replace("—", "-")
    return text


def find_skills_in_line(line):
    """Return every skill from our list that is WRITTEN in this line."""
    line = clean(line)
    return [name for name, pat in PATTERNS.items() if pat.search(line)]


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
               "certifications", "languages"]


def split_cv_sections(cv_text):
    """Same idea for the CV: a line that is only a heading word starts a new section."""
    current = "HEADER"
    result = []
    for raw in cv_text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.lower() in CV_HEADINGS:
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

    print("STEP 6  Flags to VERIFY (not scored)")
    for f in find_flags(job_text):
        print("  -", f)

    out = {"job_skills": job_kw, "cv_skills": cv_kw, "matched": matched, "missing": missing,
           "extra": extra, "related_not_counted": related, "coverage_pct": round(cover, 1),
           "flags": find_flags(job_text)}
    with open("results.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("\nSaved: results.json")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python3 keyword_extractor.py job_post.txt sample_cv.txt")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
