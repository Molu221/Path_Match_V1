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
import oasis  # noqa: E402

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


class FoldTest(unittest.TestCase):
    def test_fold(self):
        self.assertEqual(oasis.fold("Qualité – Éducation"), "qualite - education")
        self.assertEqual(oasis.norm_title("Ingénieur(e) industriel"), "ingenieur e industriel")


if __name__ == "__main__":
    unittest.main()
