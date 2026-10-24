"""Runs python/keyword_extractor.py on every job post in posts/ against a CV in cv/.

Usage: python3 scripts/run_reports.py [cv/sample_cv.txt]
Writes reports/<post>.json plus docs/reports.json (read by docs/reports.html)
and reports/summary.md. Uses only the standard library.
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))
import keyword_extractor as kx  # noqa: E402


def header(job_text, key):
    for line in job_text.splitlines():
        if line.startswith(key + ":"):
            return line.split(":", 1)[1].strip()
    return ""


def main():
    cv_path = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "cv" / "sample_cv.txt"
    cv_text = cv_path.read_text(encoding="utf-8")
    cv_kw = kx.extract_cv_keywords(cv_text)
    (ROOT / "reports").mkdir(exist_ok=True)
    rows = []
    for post in sorted((ROOT / "posts").glob("*.txt")):
        text = post.read_text(encoding="utf-8")
        job_kw = kx.extract_job_keywords(text)
        matched, missing, extra, related = kx.compare(job_kw, cv_kw)
        cover = kx.pct1(len(matched), len(job_kw))
        row = {
            "file": post.name,
            "title": header(text, "JOB"),
            "company": header(text, "COMPANY").split("|")[0].strip(),
            "coverage_pct": cover,
            "matched": matched,
            "missing": missing,
            "related_not_counted": [list(r) for r in related],
            "flags": kx.find_flags(text),
            "job_skills": job_kw,
        }
        ts = kx.term_summary(text, cv_text)
        row["phrases_counted"] = ts["counted"]
        row["phrases_matched"] = ts["matched"]
        row["phrases_close"] = ts["close"]
        row["phrase_coverage_pct"] = ts["pct"]
        row["phrase_coverage_with_close_pct"] = ts["pct_with_close"]
        row["phrases"] = ts["phrases"]
        row.update(kx.oasis_report_data(text, cv_text, matched, missing, cv_kw, related, job_kw))
        rows.append(row)
        (ROOT / "reports" / (post.stem + ".json")).write_text(
            json.dumps(row, indent=2, ensure_ascii=False), encoding="utf-8")
    rows.sort(key=lambda r: -r["coverage_pct"])
    out = {"cv": cv_path.name, "posts": rows,
           "note": "Heuristic keyword coverage = matched / job skills. Related skills are listed, not counted. Flags are to verify, not scored."}
    (ROOT / "docs" / "reports.json").write_text(json.dumps(out, indent=2, ensure_ascii=False), encoding="utf-8")
    md = ["# Keyword report", "", f"CV: `{cv_path.name}`", "",
          "| Company | Role | Skill coverage | Matched | Missing | All-phrase coverage | Flags to verify |", "|---|---|---|---|---|---|---|"]
    for r in rows:
        md.append(f"| {r['company']} | {r['title']} | {r['coverage_pct']}% | {len(r['matched'])} | {len(r['missing'])} | {r['phrase_coverage_pct']}% of {r['phrases_counted']} | {', '.join(r['flags'])} |")
    (ROOT / "reports" / "summary.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
