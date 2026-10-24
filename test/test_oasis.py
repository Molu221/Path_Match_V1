"""Offline test of the OaSIS builder and matcher, using small made-up CSV files.
The files below are SYNTHETIC test data written to a temporary folder. They are not OaSIS data.
Run: python3 -m unittest test.test_oasis   (from the repository root)
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "python"))
sys.path.insert(0, str(ROOT / "scripts"))
import oasis  # noqa: E402
import build_oasis_dictionary as build  # noqa: E402

CODES = ["21321.00", "22302.00", "13201.00", "21301.00"]


def csv_text(header, rows):
    return "\n".join([",".join(f'"{c}"' for c in header)] + [",".join(f'"{c}"' for c in r) for r in rows]) + "\n"


def write_fixtures(d):
    en = {
        "lead_statement": csv_text(["OaSIS code", "OaSIS label", "Lead statement"], [
            [CODES[0], "Industrial and manufacturing engineers", "Plan lean manufacturing and quality control."],
            [CODES[1], "Industrial engineering technologists", "Support continuous improvement and process mapping."],
            [CODES[2], "Logistics coordinators", "Coordinate inventory control and shipping."],
            [CODES[3], "Mechanical engineers", "Design machines and equipment."]]),
        "example_titles": csv_text(["OaSIS code", "Example title"], [
            [CODES[0], "industrial engineer"], [CODES[0], "manufacturing engineer"],
            [CODES[1], "industrial engineering technologist"], [CODES[2], "logistics coordinator"],
            [CODES[3], "mechanical engineer"]]),
        "main_duties": csv_text(["OaSIS code", "Main duties"], [
            [CODES[0], "Analyse root cause analysis results; lean manufacturing; quality control; six sigma projects"],
            [CODES[1], "Lean manufacturing, quality control and process mapping support"],
            [CODES[2], "Inventory control; shipping schedules; quality control of receiving"],
            [CODES[3], "Design equipment using AutoCAD"]]),
        "employment_requirements": csv_text(["OaSIS code", "Requirements"], [[c, "A bachelor's degree"] for c in CODES]),
        "additional_information": csv_text(["OaSIS code", "Info"], [[c, "Experience helps"] for c in CODES]),
        "workplaces_employers": csv_text(["OaSIS code", "Employers"], [[c, "Manufacturing firms"] for c in CODES]),
        # wide layout: one column per skill
        "skills": csv_text(["OaSIS code", "Critical thinking", "Active listening", "Problem solving"],
                           [[CODES[0], 5, 3, 5], [CODES[1], 4, 2, 4], [CODES[2], 3, 4, 3], [CODES[3], 4, 1, 5]]),
        "abilities": csv_text(["OaSIS code", "Deductive reasoning", "Oral comprehension", "Number facility"],
                              [[c, 3, 3, 3] for c in CODES]),
        "knowledge": csv_text(["OaSIS code", "Engineering and technology", "Production and processing"],
                              [[CODES[0], 5, 4], [CODES[1], 4, 4], [CODES[2], 1, 3], [CODES[3], 5, 2]]),
        "personal_attributes": csv_text(["OaSIS code", "Initiative", "Dependability", "Attention to detail"],
                                        [[c, 3, 3, 3] for c in CODES]),
        # long layout: one row per occupation and activity
        "work_activities": csv_text(["OaSIS code", "Work activity", "Level"],
                                    [[c, a, v] for c in CODES for a, v in (("Analyzing data", 4), ("Scheduling work", 2), ("Documenting information", 3))]),
        "work_context": csv_text(["OaSIS code", "Spend time standing", "Exposed to noise"],
                                 [[c, 3, 3] for c in CODES]),
    }
    fr = {
        "lead_statement": csv_text(["Code SIPEC", "Libelle SIPEC", "Enonce principal"], [
            [CODES[0], "Ingenieurs industriels et de la fabrication", "Planifier la fabrication au plus juste."],
            [CODES[1], "Technologues en genie industriel", "Amelioration continue."],
            [CODES[2], "Coordonnateurs de la logistique", "Controle des stocks."],
            [CODES[3], "Ingenieurs mecaniciens", "Concevoir des machines."]]),
        "example_titles": csv_text(["Code SIPEC", "Appellation"], [
            [CODES[0], "ingénieur industriel"], [CODES[0], "ingénieur de fabrication"],
            [CODES[1], "technologue en génie industriel"], [CODES[2], "coordonnateur de la logistique"],
            [CODES[3], "ingénieur mécanicien"]]),
        "main_duties": csv_text(["Code SIPEC", "Fonctions principales"], [
            [CODES[0], "Analyser les causes profondes; fabrication au plus juste; contrôle de la qualité; projets six sigma"],
            [CODES[1], "Fabrication au plus juste, contrôle de la qualité et cartographie des processus"],
            [CODES[2], "Contrôle des stocks; contrôle de la qualité à la réception"],
            [CODES[3], "Concevoir de l'équipement avec AutoCAD"]]),
        "employment_requirements": csv_text(["Code SIPEC", "Exigences"], [[c, "Un baccalauréat"] for c in CODES]),
        "additional_information": csv_text(["Code SIPEC", "Info"], [[c, "L'expérience aide"] for c in CODES]),
        "workplaces_employers": csv_text(["Code SIPEC", "Employeurs"], [[c, "Entreprises de fabrication"] for c in CODES]),
        "skills": csv_text(["Code SIPEC", "Pensée critique", "Écoute active", "Résolution de problèmes"],
                           [[CODES[0], 5, 3, 5], [CODES[1], 4, 2, 4], [CODES[2], 3, 4, 3], [CODES[3], 4, 1, 5]]),
        "abilities": csv_text(["Code SIPEC", "Raisonnement déductif", "Compréhension orale", "Facilité avec les nombres"],
                              [[c, 3, 3, 3] for c in CODES]),
        "knowledge": csv_text(["Code SIPEC", "Génie et technologie", "Production et transformation"],
                              [[CODES[0], 5, 4], [CODES[1], 4, 4], [CODES[2], 1, 3], [CODES[3], 5, 2]]),
        "personal_attributes": csv_text(["Code SIPEC", "Initiative", "Fiabilité", "Souci du détail"],
                                        [[c, 3, 3, 3] for c in CODES]),
        "work_activities": csv_text(["Code SIPEC", "Activité de travail", "Niveau"],
                                    [[c, a, v] for c in CODES for a, v in (("Analyse de données", 4), ("Planification du travail", 2), ("Documentation de l'information", 3))]),
        "work_context": csv_text(["Code SIPEC", "Rester debout", "Exposition au bruit"], [[c, 3, 3] for c in CODES]),
    }
    for key, text in en.items():
        (d / f"{key}_en.csv").write_text(text, encoding="utf-8")
    for key, text in fr.items():
        (d / f"{key}_fr.csv").write_text(text, encoding="utf-8")


class OasisTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        tmp = pathlib.Path(cls.tmp.name)
        write_fixtures(tmp)
        cls.out = tmp / "oasis_data.json"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "build_oasis_dictionary.py"),
                            "--local-dir", str(tmp), "--out", str(cls.out), "--vocab", str(tmp / "vocab.csv")],
                           capture_output=True, text=True)
        cls.log = r.stdout + r.stderr
        assert r.returncode == 0, cls.log
        cls.data = json.loads(cls.out.read_text(encoding="utf-8"))
        cls.vocab = (tmp / "vocab.csv").read_text(encoding="utf-8")

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_builds_all_occupations(self):
        self.assertEqual(self.data["meta"]["occupations"], len(CODES))

    def test_titles_english_and_french(self):
        t = self.data["titles"]
        self.assertIn("industrial engineer", t)
        self.assertIn("ingenieur industriel", t)          # accents removed
        self.assertEqual(t["industrial engineer"], [CODES[0]])

    def test_labels(self):
        self.assertEqual(self.data["occupations"][CODES[0]]["label"], "Industrial and manufacturing engineers")

    def test_descriptors_paired_wide_and_long(self):
        pairs = {(d["en"], d["fr"]) for d in self.data["descriptors"]}
        self.assertIn(("Problem solving", "Résolution de problèmes"), pairs)
        self.assertIn(("Analyzing data", "Analyse de données"), pairs)

    def test_knowledge_descriptors_read(self):
        pairs = {(d["en"], d["fr"]) for d in self.data["descriptors"]}
        self.assertIn(("Engineering and technology", "Génie et technologie"), pairs)

    def test_missing_optional_files_do_not_stop_the_build(self):
        # the fixtures have no "labels" file; the 2025 release lists it as optional
        self.assertIn("labels_en: not downloaded, skipped", self.log)
        self.assertIn("labels", build.DATASETS["2025"]["optional"])

    def test_release_tables_are_well_formed(self):
        for version, ds in build.DATASETS.items():
            self.assertTrue(ds["optional"] <= set(ds["resources"]), version)
            ids = []
            for key, (kind, en, fr) in ds["resources"].items():
                self.assertIn(kind, ("text", "rating"), key)
                for rel in (en, fr):
                    rid, mid, name = rel.split("/")
                    self.assertEqual((len(rid), mid), (36, "download"), rel)
                    self.assertTrue(name.endswith(".csv"), rel)
                    ids.append(rid)
            self.assertEqual(len(ids), len(set(ids)), f"{version}: a resource id is used twice")
        for key in ("lead_statement", "example_titles", "skills", "knowledge"):
            self.assertIn(key, build.DATASETS["2025"]["resources"])

    def test_skill_occupations_from_text(self):
        occ = self.data["skill_occupations"]
        self.assertEqual(set(occ["Quality control"]), set(CODES[:3]) | set())  # CODES[3] has none
        self.assertIn(CODES[0], occ["Lean Manufacturing"])

    def test_vocab_has_both_languages(self):
        self.assertIn(",en,", self.vocab)
        self.assertIn(",fr,", self.vocab)

    def test_french_alias_added_to_curated_skill(self):
        import keyword_extractor as kx
        merged, source = oasis.merge_skills(kx.SKILLS, self.data)
        self.assertIn("resolution de problemes", merged["Problem solving"])
        self.assertEqual(source["Problem solving"], "curated")

    def test_french_skill_text_is_matched(self):
        import keyword_extractor as kx
        merged, _ = oasis.merge_skills(kx.SKILLS, self.data)
        pats = kx.build_patterns(merged)
        self.assertTrue(pats["Problem solving"].search(oasis.fold("Forte résolution de problèmes")))

    def test_occupation_alignment(self):
        job = "We need an industrial engineer for this role."
        cv = "Previously worked as an ingénieur industriel."
        a = oasis.occupation_alignment(job, cv, self.data)
        self.assertEqual([x["code"] for x in a], [CODES[0]])

    def test_inferred_related_is_not_a_match(self):
        r = oasis.inferred_related(["Lean Manufacturing"], ["Quality control"], self.data)
        self.assertTrue(all(x[0] == "Lean Manufacturing" and x[1] == "Quality control" for x in r))


class DownloadTest(unittest.TestCase):
    """The downloader against a tiny local web server (no internet needed)."""

    @classmethod
    def setUpClass(cls):
        import http.server
        import threading

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                if self.path.startswith("/good.csv"):
                    body, ctype, code = b'"OaSIS code","x"\n"21321.00","a"\n', "text/csv", 200
                elif self.path.startswith("/page.csv"):
                    body, ctype, code = b"<html>maintenance</html>", "text/html", 200
                elif self.path.startswith("/api"):
                    body = json.dumps({"result": {"resources": [{"id": "r1", "url": "http://x/y.csv"}]}}).encode()
                    ctype, code = "application/json", 200
                else:
                    body, ctype, code = b"bad gateway", "text/plain", 502
                self.send_response(code)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, *a):
                pass

        cls.server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        cls.base = f"http://127.0.0.1:{cls.server.server_port}"
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.tmp = tempfile.TemporaryDirectory()
        build.time.sleep = lambda s: None            # do not wait between tries in tests

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.tmp.cleanup()

    def test_falls_back_to_second_address(self):
        dest = pathlib.Path(self.tmp.name) / "a.csv"
        build.download([self.base + "/missing.csv", self.base + "/good.csv"], dest, tries=3)
        self.assertIn("21321.00", dest.read_text())

    def test_web_page_is_not_saved_as_csv(self):
        dest = pathlib.Path(self.tmp.name) / "b.csv"
        with self.assertRaises(RuntimeError):
            build.download(self.base + "/page.csv", dest, tries=2)
        self.assertFalse(dest.exists())

    def test_existing_file_is_kept(self):
        dest = pathlib.Path(self.tmp.name) / "c.csv"
        dest.write_text("kept")
        self.assertIn("cached", build.download(self.base + "/missing.csv", dest, tries=1))

    def test_portal_listing(self):
        old = build.API
        build.API = self.base + "/api?id="
        try:
            self.assertEqual(build.api_urls("whatever"), {"r1": "http://x/y.csv"})
        finally:
            build.API = old

    def test_portal_listing_failure_is_not_fatal(self):
        old = build.API
        build.API = self.base + "/nothing?id="
        try:
            self.assertEqual(build.api_urls("whatever"), {})
        finally:
            build.API = old


class FoldTest(unittest.TestCase):
    def test_fold(self):
        self.assertEqual(oasis.fold("Qualité – Éducation"), "qualite - education")
        self.assertEqual(oasis.norm_title("Ingénieur(e) industriel"), "ingenieur e industriel")


if __name__ == "__main__":
    unittest.main()
