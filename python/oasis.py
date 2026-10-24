"""
oasis.py - helpers that connect the keyword extractor to OaSIS data.

OaSIS = Occupational and Skills Information System (Employment and Social
Development Canada), published under the Open Government Licence - Canada.
The data file python/oasis_data.json is built by scripts/build_oasis_dictionary.py
from the official English and French CSV files (all occupations).

Three things come out of the data, and each is labelled in the report:
    1. ALIASES      English and French names of OaSIS skills, abilities, work
                    activities... are added as extra spellings of a skill.
                    A skill written in either language is a normal MATCH.
    2. OCCUPATIONS  Job titles (example titles, English and French) point to
                    NOC/OaSIS codes. If the job post and the CV mention titles
                    from the same occupation, that is shown. It is NOT scored.
    3. INFERRED     Two skills that appear in many of the same occupations are
                    listed as RELATED (inferred). They are listed, never counted
                    as a match, and never added to the CV.

Standard library only.
"""
import json
import pathlib
import re
import unicodedata

DATA_PATH = pathlib.Path(__file__).with_name("oasis_data.json")

# Tuning knobs for the inferred links. Raise them for fewer, safer links.
MIN_OCCUPATIONS = 3      # a skill must appear in at least this many occupations
MIN_JACCARD = 0.25       # share of occupations the two skills have in common
MIN_DESCRIPTOR_LEN = 5   # ignore very short descriptor names


def fold(text):
    """Lowercase, straighten quotes and dashes, remove accents.
    'Qualité' and 'qualite' become the same word, so French CVs match."""
    text = text.lower()
    for a, b in (("’", "'"), ("‘", "'"), ("‑", "-"), ("–", "-"), ("—", "-")):
        text = text.replace(a, b)
    text = unicodedata.normalize("NFKD", text)
    return "".join(c for c in text if not unicodedata.combining(c))


def tokens(text):
    return re.findall(r"[a-z0-9]+", fold(text))


def norm_title(text):
    """A job title in a form that can be looked up: 'industrial engineer'."""
    return " ".join(tokens(text))


def load(path=None):
    """Return the OaSIS data, or None if it has not been built yet."""
    path = pathlib.Path(path) if path else DATA_PATH
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def merge_skills(skills, data):
    """Add OaSIS names as extra aliases (or new skills) to the curated list.
    Returns (merged_skills, source) where source says where each skill came from."""
    merged = {name: list(aliases) for name, aliases in skills.items()}
    source = {name: "curated" for name in merged}
    if not data:
        return merged, source
    index = {}
    for name, aliases in merged.items():
        for alias in aliases:
            index[fold(alias)] = name
    for d in data.get("descriptors", []):
        en, fr = fold(d.get("en", "")).strip(), fold(d.get("fr", "")).strip()
        label = (d.get("en") or d.get("fr") or "").strip()
        if len(en or fr) < MIN_DESCRIPTOR_LEN:
            continue
        target = None
        for key in (en, en.rstrip("s"), fr, fr.rstrip("s")):
            if key and key in index:
                target = index[key]
                break
        if target:                                   # new spelling of a skill we already have
            for alias in (en, fr):
                if alias and alias not in index:
                    merged[target].append(alias)
                    index[alias] = target
        elif label not in merged:                    # a skill we did not have
            aliases = [a for a in (en, fr) if a and a not in index]
            if not aliases:
                continue
            merged[label] = aliases
            source[label] = "OaSIS " + d.get("file", "descriptor")
            for alias in aliases:
                index[alias] = label
    return merged, source


def find_titles(text, titles, max_words=8):
    """Find OaSIS job titles written in `text`. Returns {code: title}."""
    found = {}
    for line in text.splitlines():
        words = tokens(line)
        for i in range(len(words)):
            for n in range(2, max_words + 1):
                chunk = " ".join(words[i:i + n])
                if chunk in titles:
                    for code in titles[chunk]:
                        found.setdefault(code, chunk)
    return found


def occupation_alignment(job_text, cv_text, data):
    """Occupations (NOC/OaSIS codes) that both the job post and the CV mention by title."""
    if not data or not data.get("titles"):
        return []
    titles = data["titles"]
    job, cv = find_titles(job_text, titles), find_titles(cv_text, titles)
    labels = data.get("occupations", {})
    return [{"code": c, "label": labels.get(c, {}).get("label", ""),
             "job_title": job[c], "cv_title": cv[c]} for c in sorted(set(job) & set(cv))]


def inferred_related(missing, cv_skills, data, already=()):
    """Skills the job wants and the CV lacks, that sit in the same occupations as a CV skill.
    Returns (job_skill, cv_skill, jaccard, shared_occupations) tuples. Not counted as matches."""
    if not data:
        return []
    occ = data.get("skill_occupations", {})
    seen = set(already)
    out = []
    for m in missing:
        a = set(occ.get(m, []))
        if len(a) < MIN_OCCUPATIONS:
            continue
        scored = []
        for c in cv_skills:
            if (m, c) in seen:
                continue
            b = set(occ.get(c, []))
            if len(b) < MIN_OCCUPATIONS:
                continue
            shared = len(a & b)
            j = shared / len(a | b)
            if j >= MIN_JACCARD:
                scored.append((round(j, 2), c, shared))
        for j, c, shared in sorted(scored, reverse=True)[:2]:
            out.append((m, c, j, shared))
    return out
