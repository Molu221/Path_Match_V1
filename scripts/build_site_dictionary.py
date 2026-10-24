"""
build_site_dictionary.py - export the Python skill list for the website.

Writes docs/skills.json, read by docs/matcher.js, so the page finds the same skills as
python/keyword_extractor.py does:
    skills    every skill with its spellings: the curated list in the extractor plus the English and
              French OaSIS names (python/oasis_data.json, built by build_oasis_dictionary.py)
    cv_headings  lines of a CV that are only a heading ("Languages") and are not skills
    related   the hand-written "looks related, not the same word" pairs from the extractor, with a reason (why)
    flags     the things to check yourself (degree level, years of experience...), never scored
    terms     the filler and broad words used by the open-vocabulary phrase finder (python/terms.py)
    inferred  for each skill, the skills that sit in many of the same OaSIS occupations
              (listed on the page, never counted as a match)

Run:  python3 scripts/build_site_dictionary.py
Standard library only.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))
import keyword_extractor as kx  # noqa: E402
import terms  # noqa: E402
import oasis  # noqa: E402

KEEP_PER_SKILL = 60          # most similar skills kept for each skill (the page needs the top 2 present on a CV)


def inferred_table(data):
    """{skill: [[other skill, jaccard, shared occupations], ...]} sorted exactly like oasis.inferred_related."""
    if not data:
        return {}
    occ = data.get("skill_occupations", {})
    total = data.get("meta", {}).get("occupations") or 0
    limit = oasis.MAX_SHARE * total if total else float("inf")
    sets = {k: set(v) for k, v in occ.items() if oasis.MIN_OCCUPATIONS <= len(v) <= limit}
    out = {}
    for a, sa in sets.items():
        rows = []
        for b, sb in sets.items():
            if a == b:
                continue
            shared = len(sa & sb)
            j = shared / len(sa | sb)
            if j >= oasis.MIN_JACCARD:
                rows.append((round(j, 2), b, shared))
        rows.sort(reverse=True)                      # same order as oasis.inferred_related
        if rows:
            out[a] = [[b, j, n] for j, b, n in rows[:KEEP_PER_SKILL]]
    return out


def build():
    skills = []
    for name, aliases in kx.SKILLS_ALL.items():
        folded = list(dict.fromkeys(oasis.fold(a).strip() for a in aliases if a.strip()))
        skills.append({"n": name, "a": folded, "s": kx.SKILL_SOURCE.get(name, "curated")})
    meta = {"skills": len(skills), "curated": sum(1 for s in skills if s["s"] == "curated")}
    if kx.OASIS:
        meta.update({"source": kx.OASIS["meta"]["source"], "built": kx.OASIS["meta"]["built"],
                     "occupations": kx.OASIS["meta"]["occupations"], "titles": kx.OASIS["meta"]["titles"],
                     "licence": kx.OASIS["meta"]["licence"]})
    else:
        meta["source"] = "curated list only (OaSIS data not built yet)"
    return {"meta": meta, "skills": skills, "related": kx.RELATED, "inferred": inferred_table(kx.OASIS),
            "why": {f"{a}|{b}": reason for (a, b), reason in kx.RELATED_WHY.items()},
            "flags": [{"n": name, "p": pat} for name, pat in kx.FLAG_PATTERNS.items()],
            "cv_headings": kx.CV_HEADINGS, "noPlural": sorted(kx.skills_extra.NO_PLURAL),
            "terms": {"stop": sorted(terms.STOP), "weak": sorted(terms.WEAK)}}


def main():
    out = ROOT / "docs" / "skills.json"
    data = build()
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {out}: {data['meta']['skills']} skills ({data['meta']['curated']} curated), "
          f"{len(data['inferred'])} with inferred links, {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
