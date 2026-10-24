"""
build_oasis_dictionary.py - turn the official OaSIS CSV files into python/oasis_data.json.

OaSIS (Occupational and Skills Information System, ESDC) covers every NOC occupation.
Licence: Open Government Licence - Canada. Dataset page:
https://open.canada.ca/data/en/dataset/eeb3e442-9f19-4d12-8b38-c488fe4f6e5e

WHAT IT BUILDS
    python/oasis_data.json   used by python/keyword_extractor.py
        occupations        code -> label
        titles             job title (English and French example titles) -> codes
        descriptors        skills, abilities, work activities... English and French names
        skill_occupations  skill -> occupations where it appears or is rated high
    python/oasis_vocab.csv   every word and phrase in the occupation texts, English and
                             French, with the number of occupations it appears in (for review)

HOW TO RUN
    python3 scripts/build_oasis_dictionary.py                 # downloads, then builds
    python3 scripts/build_oasis_dictionary.py --local-dir DIR # use CSV files already on disk
                                                              # named <key>_en.csv / <key>_fr.csv

The column layout of the official files is detected from the data (the code column is the one
full of NOC/OaSIS codes, number columns are ratings, the rest is text). If a file does not look
like that, the script stops and prints the file's headers so the rules can be adjusted.
Standard library only.
"""
import argparse
import csv
import datetime
import io
import json
import pathlib
import re
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))
import oasis  # noqa: E402
import keyword_extractor as kx  # noqa: E402

BASE = "https://open.canada.ca/data/dataset/eeb3e442-9f19-4d12-8b38-c488fe4f6e5e/resource/"
# key: (kind, English file, French file). "text" files hold words; "rating" files hold skill ratings.
RESOURCES = {
    "lead_statement": ("text",
        "f1b0b3c4-8982-4104-ba96-794044ad65e8/download/lead-statement_oasis_2022_v1.0.csv",
        "c41c84ee-0df4-43ec-8690-bbd2424eed83/download/enonce-principal_sipec_2022_v1.0.csv"),
    "example_titles": ("text",
        "266f49d4-59ba-4c50-8171-bc7fde509eda/download/example-titles_oasis-2022_v1.0.csv",
        "77e0f199-93c9-466c-9643-c52e7f62820e/download/exemples-dappellation-demploi_sipec_2022_v1.0.csv"),
    "main_duties": ("text",
        "7453d044-7b41-44cc-b9c6-1112e9e886b5/download/main-duties_oasis-2022_v1.0.csv",
        "7f0337ed-aaab-46a9-a988-1c50286770c7/download/fonctions-principales_sipec_2022_v1.0.csv"),
    "employment_requirements": ("text",
        "b12666f4-cba7-405e-9610-f36318e0f7d5/download/employment-requirements_oasis_2022_v1.0.csv",
        "1852cf7f-5c40-49ab-b2dc-5d1180545166/download/exigences-demploi_sipec_2022_v1.0.csv"),
    "additional_information": ("text",
        "0b56ac41-244f-40ca-8c52-a5e376d3e72a/download/additional-information_oasis_2022_v1.0.csv",
        "c8813ce9-49d2-45fb-b903-bf89f29816d9/download/renseignements-supplementaires_sipec_2022_v1.0.csv"),
    "workplaces_employers": ("text",
        "c3e16f83-5d09-43be-b1b4-49526cc25ed8/download/workplaces-employers_oasis_2022_v1.0.csv",
        "84ee84bb-90e8-41be-b9f5-b1807b895404/download/lieux-de-travail-employeurs_sipec_2022_v1.0.csv"),
    "skills": ("rating",
        "34eecbcc-c3aa-4568-8715-c946de99df33/download/skills_oasis_2022_v1.0.csv",
        "9376bda5-2d80-4b0b-a34d-cf5d64d9b9a8/download/competences_sipec_2022_v1.0.csv"),
    "abilities": ("rating",
        "e1d0f684-4f3d-4f6a-adc8-b3a9d0e120fd/download/abilities_oasis_2022_v1.0.csv",
        "2aed2904-4db4-45f5-8ca8-121de70d2815/download/habiletes_sipec_2022_v1.0.csv"),
    "personal_attributes": ("rating",
        "42a2b00e-94f3-4168-81c4-c8bf671e1562/download/personal-attributes_oasis_2022_v1.0.csv",
        "be3b4321-a730-4d86-8004-29779282f02c/download/attributs-personnels_sipec_2022_v1.0.csv"),
    "work_activities": ("rating",
        "2315640d-6bb5-4914-9a46-e8226829e2c0/download/workactivities_oasis_2022_v1.0.csv",
        "28a77959-c72e-4c55-82e7-9a8cdbae7ecd/download/activites-du-travail_sipec_2022_v1.0.csv"),
    "work_context": ("rating",
        "2eaf68a6-de91-4366-b3d0-d55f3732ec8c/download/workcontext_oasis_2022_v1.0.csv",
        "8696d108-77a9-4eb1-a995-10bfd4905602/download/contexte-de-travail_sipec_2022_v1.0.csv"),
}

CODE_RE = re.compile(r"\d{5}(?:\.\d{2})?")
LABEL_RE = re.compile(r"label|libell|profile|profil|occupation|nom\b", re.I)
RATING_CUTOFF = 0.6        # a skill is linked to an occupation when its rating >= 60% of the file maximum

STOP = {
    "en": set("a an and are as at be by for from has have in into is it its of on or that the their this to "
              "with within who may can will also such other more most any all each both than then them these "
              "those which while about across after over under per etc not use used using work works working".split()),
    "fr": set("a au aux avec ce ces dans de des du elle en et est il ils la le les leur leurs lui ou par pas "
              "pour que qui sa se ses son sur un une plus ainsi aussi autres autre tout tous toutes peut "
              "peuvent sont ont etre avoir dont lors entre sans sous travail".split()),
}


# --------------------------------------------------------------------------------------
# reading the files
# --------------------------------------------------------------------------------------
def download(url, dest, tries=3):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "path-match-oasis-builder"})
            with urllib.request.urlopen(req, timeout=120) as r:
                dest.write_bytes(r.read())
            return
        except Exception as e:  # noqa: BLE001 - report and retry
            last = e
            time.sleep(2 * (i + 1))
    raise SystemExit(f"Could not download {url}: {last}")


def read_rows(path):
    raw = path.read_bytes()
    for enc in ("utf-8-sig", "cp1252"):
        try:
            text = raw.decode(enc)
            break
        except UnicodeDecodeError:
            continue
    try:
        dialect = csv.Sniffer().sniff(text[:5000], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    return [r for r in csv.reader(io.StringIO(text), dialect) if any(c.strip() for c in r)]


def code_of(cell):
    cell = cell.strip()
    if not cell or len(cell) > 20:
        return None
    m = CODE_RE.search(cell)
    return m.group(0) if m else None


def is_number(cell):
    try:
        float(cell.strip().replace(",", "."))
        return True
    except ValueError:
        return False


class Table:
    """One CSV file split into: code column, number columns (ratings) and text columns."""

    def __init__(self, path):
        rows = read_rows(path)
        if len(rows) < 2:
            raise SystemExit(f"{path.name} has no data rows")
        self.name = path.name
        self.header = [h.strip() for h in rows[0]]
        self.rows = rows[1:]
        width = len(self.header)
        sample = self.rows[:300]

        def col(i):
            return [r[i].strip() for r in sample if i < len(r) and r[i].strip()]

        self.code = None
        for i in range(width):
            vals = col(i)
            if vals and sum(1 for v in vals if code_of(v)) / len(vals) >= 0.9:
                self.code = i
                break
        if self.code is None:
            raise SystemExit(f"{path.name}: no column of NOC/OaSIS codes found. Headers: {self.header}")
        self.num, self.text = [], []
        for i in range(width):
            if i == self.code:
                continue
            vals = col(i)
            if vals and sum(1 for v in vals if is_number(v)) / len(vals) >= 0.8:
                self.num.append(i)
            elif vals:
                self.text.append(i)

    def cell(self, row, i):
        return row[i].strip() if i < len(row) else ""

    def code_of_row(self, row):
        return code_of(self.cell(row, self.code))


def number(cell):
    return float(cell.strip().replace(",", "."))


# --------------------------------------------------------------------------------------
# what we take from each kind of file
# --------------------------------------------------------------------------------------
def text_by_code(table):
    """{code: [text cells]} for a text file."""
    out = {}
    for row in table.rows:
        code = table.code_of_row(row)
        if not code:
            continue
        for i in table.text:
            value = table.cell(row, i)
            if value:
                out.setdefault(code, []).append(value)
    return out


def labels_by_code(table):
    """The occupation name, if the file has a column that looks like one."""
    cols = [i for i in table.text if LABEL_RE.search(table.header[i])]
    out = {}
    if not cols:
        return out
    for row in table.rows:
        code = table.code_of_row(row)
        value = table.cell(row, cols[0])
        if code and value and code not in out:
            out[code] = value
    return out


def descriptors(table):
    """[(name, [codes rated high])] in file order, for a rating file (wide or long layout)."""
    if not table.num:
        return []
    values = [number(table.cell(r, i)) for r in table.rows for i in table.num if is_number(table.cell(r, i))]
    cutoff = RATING_CUTOFF * max(values) if values else 0
    out = []
    if len(table.num) >= 3 or not table.text:          # wide: one column per descriptor
        for i in table.num:
            codes = [table.code_of_row(r) for r in table.rows
                     if is_number(table.cell(r, i)) and number(table.cell(r, i)) >= cutoff and table.code_of_row(r)]
            out.append((table.header[i], sorted(set(codes))))
        return out
    # long: one row per occupation and descriptor; the descriptor name is the text column
    # with the most distinct values (but not thousands: those are sentences)
    best, best_n = None, 0
    for i in table.text:
        n = len({table.cell(r, i) for r in table.rows})
        if best_n < n <= 600:
            best, best_n = i, n
    if best is None:
        return []
    links, order = {}, []
    for r in table.rows:
        name = table.cell(r, best)
        if not name:
            continue
        if name not in links:
            links[name] = set()
            order.append(name)
        v = table.cell(r, table.num[0])
        if is_number(v) and number(v) >= cutoff and table.code_of_row(r):
            links[name].add(table.code_of_row(r))
    return [(n, sorted(links[n])) for n in order]


def split_titles(cell):
    return [p.strip() for p in re.split(r"[;\n|•]", cell) if p.strip()]


# --------------------------------------------------------------------------------------
# vocabulary (every word and phrase), for review
# --------------------------------------------------------------------------------------
def ngrams(text, lang):
    words = oasis.tokens(text)
    stop = STOP[lang]
    seen = set()
    for n in (1, 2, 3):
        for i in range(len(words) - n + 1):
            chunk = words[i:i + n]
            if chunk[0] in stop or chunk[-1] in stop:
                continue
            if any(len(w) < 3 or w.isdigit() for w in (chunk[0], chunk[-1])):
                continue
            seen.add(" ".join(chunk))
    return seen


def write_vocab(path, corpus, total, cap=20000):
    rows = []
    for lang in ("en", "fr"):
        df, example = {}, {}
        for code, text in corpus[lang].items():
            for g in ngrams(text, lang):
                df[g] = df.get(g, 0) + 1
                example.setdefault(g, []).append(code)
        kept = [(g, n) for g, n in df.items() if n >= 2 and n <= 0.5 * total]
        kept.sort(key=lambda x: (-x[1], x[0]))
        for g, n in kept[:cap]:
            rows.append([g, lang, n, round(n / total, 3), " ".join(example[g][:3])])
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["term", "language", "occupations", "share_of_occupations", "example_codes"])
        w.writerows(rows)
    return len(rows)


# --------------------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local-dir", help="folder with <key>_en.csv and <key>_fr.csv; skips the download")
    ap.add_argument("--raw-dir", default=str(ROOT / "data" / "oasis_raw"))
    ap.add_argument("--out", default=str(ROOT / "python" / "oasis_data.json"))
    ap.add_argument("--vocab", default=str(ROOT / "python" / "oasis_vocab.csv"))
    args = ap.parse_args()

    src_dir = pathlib.Path(args.local_dir or args.raw_dir)
    src_dir.mkdir(parents=True, exist_ok=True)
    if not args.local_dir:
        for key, (_, en, fr) in RESOURCES.items():
            for lang, rel in (("en", en), ("fr", fr)):
                print(f"downloading {key}_{lang}")
                download(BASE + rel, src_dir / f"{key}_{lang}.csv")

    tables = {}
    for key, (kind, _, _) in RESOURCES.items():
        for lang in ("en", "fr"):
            p = src_dir / f"{key}_{lang}.csv"
            if not p.exists():
                raise SystemExit(f"missing file {p}")
            t = Table(p)
            tables[(key, lang)] = t
            print(f"{key}_{lang}: {len(t.rows)} rows, code column '{t.header[t.code]}', "
                  f"{len(t.text)} text and {len(t.num)} rating columns")

    # occupations, labels, titles, text per occupation
    labels, titles = {}, {}
    corpus = {"en": {}, "fr": {}}
    codes = set()
    for lang in ("en", "fr"):
        for key, (kind, _, _) in RESOURCES.items():
            if kind != "text":
                continue
            by_code = text_by_code(tables[(key, lang)])
            codes.update(by_code)
            for code, cells in by_code.items():
                corpus[lang].setdefault(code, "")
                corpus[lang][code] += " " + " ".join(cells)
                if key == "example_titles":
                    for cell in cells:
                        for title in split_titles(cell):
                            norm = oasis.norm_title(title)
                            if 2 <= len(norm.split()) <= 8:
                                titles.setdefault(norm, set()).add(code)
        for code, label in labels_by_code(tables[("lead_statement", lang)]).items():
            labels.setdefault(code, {})["label" if lang == "en" else "label_fr"] = label
    for code in codes:
        labels.setdefault(code, {})

    # descriptors (skills, abilities...), paired English <-> French by position
    desc, links = [], {}
    for key, (kind, _, _) in RESOURCES.items():
        if kind != "rating":
            continue
        en, fr = descriptors(tables[(key, "en")]), descriptors(tables[(key, "fr")])
        if len(en) == len(fr):
            pairs = [(a, b) for a, b in zip(en, fr)]
        else:
            print(f"warning: {key} has {len(en)} English and {len(fr)} French descriptors; not paired")
            pairs = [(a, ("", [])) for a in en] + [(("", []), b) for b in fr]
        for (n_en, c_en), (n_fr, c_fr) in pairs:
            desc.append({"en": n_en, "fr": n_fr, "file": key})
            for name in (n_en, n_fr):
                if name:
                    links.setdefault(oasis.fold(name).strip(), set()).update(c_en, c_fr)

    # skill -> occupations, for the curated skills plus the descriptors
    merged, _ = oasis.merge_skills(kx.SKILLS, {"descriptors": desc})
    patterns = kx.build_patterns(merged)
    folded = {c: oasis.fold(corpus["en"].get(c, "") + " " + corpus["fr"].get(c, "")) for c in codes}
    skill_occ = {}
    for name, pat in patterns.items():
        hit = {c for c, text in folded.items() if pat.search(text)}
        for alias in [name] + merged[name]:
            hit |= links.get(oasis.fold(alias).strip(), set())
        if hit:
            skill_occ[name] = sorted(hit)

    out = {
        "meta": {
            "source": "Occupational and Skills Information System (OaSIS) 2022 v1.0, ESDC",
            "licence": "Open Government Licence - Canada",
            "built": datetime.date.today().isoformat(),
            "occupations": len(codes),
            "titles": len(titles),
            "descriptors": len(desc),
        },
        "occupations": {c: labels[c] for c in sorted(codes)},
        "titles": {t: sorted(c) for t, c in sorted(titles.items())},
        "descriptors": desc,
        "skill_occupations": skill_occ,
    }
    pathlib.Path(args.out).write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    n_vocab = write_vocab(args.vocab, corpus, len(codes))
    print(f"built {args.out}: {len(codes)} occupations, {len(titles)} titles, {len(desc)} descriptors, "
          f"{len(skill_occ)} skills linked; {n_vocab} words and phrases in {args.vocab}")


if __name__ == "__main__":
    main()
