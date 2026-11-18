"""Bring the NOC library's job titles and posting languages up to the newest Job Bank month.

The library was built from the September 2026 Job Bank file (4,166 titles used in real postings). Every month the collector
saves the newest Job Bank open data in docs/jobs/noc (postings.json: each posting with the official title of its occupation,
in English and French; index.json: languages per occupation). This script adds the official titles the library does not know
yet, each pointing to its occupation, and replaces the languages-in-postings counts with the newest month. Nothing else in the
library changes, and a title the library already knows is never moved to another occupation.

Usage: python3 noc_library/update_titles.py [docs folder]      (no extra packages)
"""
import json
import os
import re
import sys
import unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def norm(text):
    """The same as norm() in docs/noc/noc_library.js, so the keys match what the page looks up."""
    t = unicodedata.normalize("NFD", str(text or "").lower())
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = re.sub(r"[’'`]", " ", t)
    t = re.sub(r"[^a-z0-9+#&\-. ]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def forms(title):
    """'coordonnateur/coordonnatrice de la production' -> both forms, as the library stores French titles."""
    t = str(title or "").strip()
    if not t:
        return []
    m = re.match(r"^\s*([^/\s]+)\s*/\s*([^/\s]+)(.*)$", t)
    if m:
        a, b, rest = m.group(1), m.group(2), m.group(3)
        return [norm(a + rest), norm(b + rest)]
    return [norm(t)]


LANG = {"not stated": "*No data"}

# the same list as build_library.py: one-word titles that say nothing about the occupation on their own
# ("intern" is a medical intern in OaSIS, and the October 2026 file uses it that way too)
VAGUE = set("""intern interns internship student students trainee apprentice assistant helper worker labourer clerk manager supervisor
director officer agent specialist consultant coordinator analyst technician technologist engineer operator associate representative
administrator advisor adviser attendant volunteer employee staff member partner owner lead head junior senior
stagiaire stagiaires etudiant etudiante apprenti apprentie adjoint adjointe aide commis conseiller conseillere technicien technicienne
analyste coordonnateur coordonnatrice gestionnaire directeur directrice superviseur superviseure ingenieur ingenieure operateur
operatrice prepose preposee representant representante employe employee agente""".split())


def update(lib, postings, index):
    nocs, ti = lib["nocs"], lib["title_index"]
    added, seen = 0, set()
    for noc, rows in postings.items():
        if noc not in nocs or not nocs[noc].get("profiles"):
            continue
        code = nocs[noc]["profiles"][0]
        for p in rows:
            for t in (p.get("s"), p.get("f")):
                for k in forms(t):
                    if not k or k in seen or k in VAGUE:
                        continue
                    seen.add(k)
                    if k not in ti:
                        ti[k] = [code]
                        added += 1
    langs = 0
    for noc, v in (index.get("nocs") or {}).items():
        if noc in nocs and v.get("lang"):
            nocs[noc]["languages_in_postings"] = {LANG.get(k, k): n for k, n in sorted(v["lang"].items(), key=lambda kv: -kv[1])}
            langs += 1
    meta = lib["meta"]
    c = meta.setdefault("counts", {})
    c["titles_index"] = len(ti)
    c["titles_from_job_bank"] = c.get("titles_from_job_bank", 0) + added
    month = index.get("label") or index.get("month") or "the newest month"
    meta["job_bank_month"] = index.get("month")
    meta["built_from"] = re.sub(r"; Job Bank titles and languages updated to .*$", "", meta.get("built_from", "")) + \
        f"; Job Bank titles and languages updated to {month}"
    return {"added": added, "languages": langs, "month": month, "titles": len(ti)}


def main():
    docs = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "docs")
    lib_file = os.path.join(docs, "noc", "noc_library.lite.json")
    with open(lib_file, encoding="utf-8") as fh:
        lib = json.load(fh)
    with open(os.path.join(docs, "jobs", "noc", "postings.json"), encoding="utf-8") as fh:
        postings = json.load(fh)
    with open(os.path.join(docs, "jobs", "noc", "index.json"), encoding="utf-8") as fh:
        index = json.load(fh)
    if lib["meta"].get("job_bank_month") == index.get("month") and "--force" not in sys.argv:
        print(f"The library already has the titles of {index.get('label')}.")
        return
    r = update(lib, postings, index)
    with open(lib_file, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(lib, ensure_ascii=False, separators=(",", ":")))
    print(f"{r['month']}: {r['added']} new official titles, languages updated for {r['languages']} occupations, {r['titles']} titles in all.")


if __name__ == "__main__":
    main()
