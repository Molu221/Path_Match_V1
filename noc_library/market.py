"""Wages and 3-year job outlooks for every occupation (NOC 2021), from Job Bank's open data. For Grow: what a step on a career
path pays, and whether the occupation is hiring.

Two datasets of the Open Government Portal (Employment and Social Development Canada, Open Government Licence - Canada):
  - Wages:                     https://open.canada.ca/data/en/dataset/adad580f-76b0-4502-bd05-20c125de9116
  - 3-Year Employment Outlooks: https://open.canada.ca/data/dataset/b0e112e9-cf53-4e79-8838-23cd98debe5b
The portal's own API (package_show) gives the newest file of each, so a new year's file is picked up without changing the code.
Their column names change from year to year, so columns are found by what they hold (a NOC code, a median, an outlook...),
and the run prints which column it used for what.

Writes docs/noc/market.json:
  { "meta": {...sources, files, columns used...},
    "nocs": { "21232": { "wage": { "CA": {"low": 33.0, "median": 48.08, "high": 72.12, "per": "hour"}, "QC": {...}, ... },
                         "outlook": { "CA": "Good", "QC": "Good", "ON": "Moderate", ... },
                         "outlookRegions": { "QC": {"Good": 15, "Moderate": 2} } } } }

Usage: python3 noc_library/market.py                      (downloads the newest files; needs the internet, e.g. GitHub Actions)
       python3 noc_library/market.py --wages w.csv --outlook o.csv [--out file]      (files already on disk)
"""
import csv
import io
import json
import os
import re
import statistics
import sys
import urllib.parse
import urllib.request
from collections import Counter, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://open.canada.ca/data/api/action/package_show?id="
WAGES_ID = "adad580f-76b0-4502-bd05-20c125de9116"      # (1dc7cdcd-... is Ontario's 2017 wage file, not Job Bank's)
SEARCH = "https://open.canada.ca/data/api/action/package_search?rows=20&q="
OUTLOOK_ID = "b0e112e9-cf53-4e79-8838-23cd98debe5b"
UA = {"User-Agent": "path-match/1.0 (+https://github.com/Molu221/Path_Match_V1)"}

PROV = {"NL": "NL", "PE": "PE", "NS": "NS", "NB": "NB", "QC": "QC", "ON": "ON", "MB": "MB", "SK": "SK", "AB": "AB", "BC": "BC", "YT": "YT", "NT": "NT", "NU": "NU",
        "NEWFOUNDLAND AND LABRADOR": "NL", "PRINCE EDWARD ISLAND": "PE", "NOVA SCOTIA": "NS", "NEW BRUNSWICK": "NB", "QUEBEC": "QC", "QUÉBEC": "QC",
        "ONTARIO": "ON", "MANITOBA": "MB", "SASKATCHEWAN": "SK", "ALBERTA": "AB", "BRITISH COLUMBIA": "BC", "YUKON": "YT", "YUKON TERRITORY": "YT",
        "NORTHWEST TERRITORIES": "NT", "NUNAVUT": "NU", "NAT": "CA", "CANADA": "CA", "NATIONAL": "CA"}
# the outlook scale Job Bank uses, best first (French in brackets is mapped to the same word)
OUTLOOKS = ["Very good", "Good", "Moderate", "Fair", "Limited", "Very limited", "Undetermined"]
FR = {"tres bonnes": "Very good", "bonnes": "Good", "moderees": "Moderate", "acceptables": "Fair", "limitees": "Limited", "tres limitees": "Very limited", "indeterminees": "Undetermined"}


def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def find_dataset(dataset_id, must, query):
    """the dataset with that id if its title has `must` in it; otherwise the portal is searched for it by name"""
    def title(p):
        t = p.get("title_translated") or p.get("title") or ""
        return t.get("en", "") if isinstance(t, dict) else str(t)
    try:
        pkg = json.loads(fetch(API + dataset_id))["result"]
        if re.search(must, title(pkg), re.I):
            return pkg
        print(f"Dataset {dataset_id} is \"{title(pkg)}\", not what we need: searching the portal.")
    except Exception as e:
        print(f"Dataset {dataset_id}: {e}; searching the portal.")
    for p in json.loads(fetch(SEARCH + urllib.parse.quote(query)))["result"]["results"]:
        if re.search(must, title(p), re.I) and any((r.get("format") or "").upper() == "CSV" for r in p.get("resources", [])):
            print(f"Found: {title(p)} ({p['id']})")
            return p
    raise SystemExit(f"No dataset found for {query!r}")


def newest_csv(dataset_id, must=".", query=""):
    """The newest CSV of a dataset, English or bilingual first, by the date the portal gives (or a year in its name)."""
    pkg = find_dataset(dataset_id, must, query)
    dataset_id = pkg["id"]
    res = pkg["resources"]
    title = pkg.get("title") if isinstance(pkg.get("title"), str) else json.dumps(pkg.get("title_translated") or pkg.get("title"))
    print(f"Dataset {dataset_id}: {title} ({len(res)} files)")
    rows = []
    for r in res:
        fmt = (r.get("format") or "").upper()
        url = r.get("url") or ""
        ext = url.lower().split("?")[0].rsplit(".", 1)[-1]
        if ext not in ("csv", "xlsx"):                             # the recent outlook files are published in Excel only
            continue
        lang = r.get("language") or []
        lang = lang if isinstance(lang, list) else [lang]
        name = r.get("name") if isinstance(r.get("name"), str) else json.dumps(r.get("name"))
        years = [int(y) for y in re.findall(r"(?<!\d)20\d\d(?!\d)", name)]          # the years in the file's name, not in its address
        if "NOC 2016" in name or "NOC2016" in name:
            continue
        rows.append((("en" in lang) or not lang, max(years) if years else 0, r.get("last_modified") or r.get("created") or "", url, name))
    if not rows:
        for r in res[:40]:
            print("  file:", r.get("format"), r.get("language"), (r.get("url") or "")[:140], json.dumps(r.get("name"))[:80])
        raise SystemExit(f"No CSV in dataset {dataset_id}")
    rows.sort(reverse=True)
    for r in rows[:6]:
        print(f"  candidate: english={r[0]} year={r[1]} {r[4][:70]}")
    return rows[0][3], rows[0][4]


def read_table(raw):
    if raw[:2] == b"PK":                                           # an Excel file: the first sheet with a NOC column
        try:
            import openpyxl
        except ImportError:
            raise SystemExit("This file is in Excel: pip install openpyxl")
        wb = openpyxl.load_workbook(io.BytesIO(raw), read_only=True, data_only=True)
        for ws in wb.worksheets:
            it = ws.iter_rows(values_only=True)
            for head in it:                                         # skip title rows above the header
                cells = [str(c).strip() if c is not None else "" for c in head]
                if any(re.search(r"noc", c, re.I) for c in cells):
                    return [dict(zip(cells, ["" if v is None else str(v) for v in row])) for row in it]
        raise SystemExit("No sheet with a NOC column in the Excel file")
    for enc in ("utf-8-sig", "utf-16", "cp1252", "latin-1"):
        try:
            text = raw.decode(enc)
            if "\x00" in text:
                continue
            break
        except UnicodeDecodeError:
            continue
    sample = text[:5000]
    delim = max([",", "\t", ";", "|"], key=lambda d: sample.splitlines()[0].count(d) if sample else 0)
    return list(csv.DictReader(io.StringIO(text, newline=""), delimiter=delim))


def col(rows, *patterns, values=None):
    """the first column whose name matches a pattern (and, if given, whose values match `values` in most rows)"""
    if not rows:
        return None
    names = list(rows[0].keys())
    for p in patterns:
        for n in names:
            if n and re.search(p, n, re.I):
                if values is None:
                    return n
                vals = [str(r.get(n) or "") for r in rows[:300]]
                if sum(bool(re.search(values, v)) for v in vals) >= 0.6 * len(vals):
                    return n
    return None


def noc_of(v):
    m = re.search(r"(?<!\d)(\d{5})(?!\d)", str(v or ""))
    return m.group(1) if m else None


def num(v):
    try:
        return float(str(v).replace("$", "").replace(",", "").replace(" ", "").strip())
    except ValueError:
        return None


def prov_of(row, pcol, rcol):
    for c in (pcol, rcol):
        if c:
            v = str(row.get(c) or "").strip().upper()
            if v in PROV:
                return PROV[v]
    return None


def wages(rows):
    c = {"noc": col(rows, r"noc", values=r"\d{5}"), "low": col(rows, r"low|minim"), "median": col(rows, r"median|médian"),
         "high": col(rows, r"high|maxim"), "annual": col(rows, r"annual|annuel"), "prov": col(rows, r"^prov|province"),
         "region": col(rows, r"er_?name", r"region name", r"nom.*r[ée]gion", r"economic region$", r"^er$", r"region")}
    if not (c["noc"] and c["median"]):
        raise SystemExit(f"Wages: could not find the NOC and median columns in {list(rows[0].keys()) if rows else []}")
    exact = defaultdict(dict)                  # rows that are a whole province or Canada
    regional = defaultdict(lambda: defaultdict(list))
    for r in rows:
        n, med = noc_of(r.get(c["noc"])), num(r.get(c["median"]))
        if not n or med is None:
            continue
        per = "year" if str(r.get(c["annual"]) or "").strip() in ("1", "Y", "Yes", "Oui", "True", "TRUE") or med > 1000 else "hour"
        item = {"low": num(r.get(c["low"])) if c["low"] else None, "median": med, "high": num(r.get(c["high"])) if c["high"] else None, "per": per}
        whole = prov_of(r, None, c["region"]) if c["region"] else None
        p = prov_of(r, c["prov"], None)
        if whole:
            exact[n][whole] = item
        elif p:
            regional[n][p].append(item)
    out = {}
    for n in set(exact) | set(regional):
        w = dict(exact.get(n, {}))
        for p, items in regional.get(n, {}).items():
            if p not in w:                     # no province-wide row: the middle of its regions' medians
                w[p] = {"median": round(statistics.median(i["median"] for i in items), 2), "per": items[0]["per"], "fromRegions": len(items)}
        out[n] = w
    return out, c


def outlook_word(v):
    s = str(v or "").strip()
    if not s:
        return None
    f = re.sub(r"[^a-z ]", "", s.lower().replace("é", "e").replace("è", "e"))
    if f in FR:
        return FR[f]
    for o in OUTLOOKS:
        if s.lower() == o.lower():
            return o
    m = re.match(r"^\s*([1-5])\b", s)          # some years give the outlook as a number of stars
    if m:
        return {5: "Very good", 4: "Good", 3: "Moderate", 2: "Limited", 1: "Very limited"}[int(m.group(1))]
    return None


def outlooks(rows):
    c = {"noc": col(rows, r"noc", values=r"\d{5}"), "outlook": col(rows, r"^outlook$|outlook|perspective"), "prov": col(rows, r"^prov|province"),
         "region": col(rows, r"economic region name", r"region name", r"er_?name", r"nom.*r[ée]gion", r"region")}
    if not (c["noc"] and c["outlook"]):
        raise SystemExit(f"Outlooks: could not find the NOC and outlook columns in {list(rows[0].keys()) if rows else []}")
    exact = defaultdict(dict)
    regions = defaultdict(lambda: defaultdict(Counter))
    for r in rows:
        n, o = noc_of(r.get(c["noc"])), outlook_word(r.get(c["outlook"]))
        if not n or not o:
            continue
        whole = prov_of(r, None, c["region"]) if c["region"] else None
        p = prov_of(r, c["prov"], None) or whole
        if whole:
            exact[n][whole] = o
        if p and not whole:
            regions[n][p][o] += 1
    out = {}
    for n in set(exact) | set(regions):
        e = dict(exact.get(n, {}))
        reg = {p: dict(cnt) for p, cnt in regions.get(n, {}).items()}
        for p, cnt in regions.get(n, {}).items():
            if p not in e:                     # the most common outlook among its regions, the better one on a tie
                e[p] = sorted(cnt.items(), key=lambda kv: (-kv[1], OUTLOOKS.index(kv[0])))[0][0]
        out[n] = {"outlook": e, "outlookRegions": reg}
    return out, c


def build(wage_rows, outlook_rows, meta):
    w, wc = wages(wage_rows)
    o, oc = outlooks(outlook_rows)
    nocs = {}
    for n in sorted(set(w) | set(o)):
        nocs[n] = {}
        if n in w:
            nocs[n]["wage"] = w[n]
        if n in o:
            nocs[n].update(o[n])
    meta = {**meta, "columns": {"wages": wc, "outlooks": oc}, "licence": "Contains information licensed under the Open Government Licence - Canada.",
            "counts": {"wages": len(w), "outlooks": len(o), "nocs": len(nocs)}}
    return {"meta": meta, "nocs": nocs}


def main():
    a = sys.argv[1:]
    opt = lambda k: a[a.index(k) + 1] if k in a else None
    out = opt("--out") or os.path.join(ROOT, "docs", "noc", "market.json")
    if opt("--wages") and opt("--outlook"):
        wr, orr = (read_table(open(opt(k), "rb").read()) for k in ("--wages", "--outlook"))
        meta = {"wagesFile": os.path.basename(opt("--wages")), "outlookFile": os.path.basename(opt("--outlook"))}
    else:
        wu, wn = newest_csv(WAGES_ID, r"^wages$|job bank.*wage|wages.*(occupation|noc)|^wages\b", "Job Bank wages")
        ou, on = newest_csv(OUTLOOK_ID, r"outlook", "3-year employment outlooks")
        print(f"Wages: {wn}\n  {wu}\nOutlooks: {on}\n  {ou}")
        wr, orr = read_table(fetch(wu)), read_table(fetch(ou))
        meta = {"wagesDataset": WAGES_ID, "wagesFile": wu, "outlookDataset": OUTLOOK_ID, "outlookFile": ou}
    m = build(wr, orr, meta)
    with open(out, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(m, ensure_ascii=False, separators=(",", ":")))
    print(f"Columns used: {json.dumps(m['meta']['columns'], ensure_ascii=False)}")
    print(f"Wages for {m['meta']['counts']['wages']} occupations, outlooks for {m['meta']['counts']['outlooks']}: {out}")
    if m["meta"]["counts"]["wages"] < 100 or m["meta"]["counts"]["outlooks"] < 100:
        raise SystemExit("Fewer than 100 occupations: check the columns above.")


if __name__ == "__main__":
    main()
