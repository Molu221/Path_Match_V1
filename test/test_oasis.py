"""Offline test of the OaSIS builder and matcher, using small made-up CSV files.
The files below are SYNTHETIC test data written to a temporary folder. They are not OaSIS data.
Run: python3 -m unittest test.test_oasis   (from the repository root)
"""
import json
import pathlib
import shutil
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


class RealLayoutTest(unittest.TestCase):
    """Made-up files that copy the LAYOUTS seen in the real OaSIS 2025 download log:
    a comma in some files and a semicolon in others, French header 'Etiquette', a junk first row in
    main_duties_fr, a numeric 'Concordance number' and a 'Job title type' column in the title files,
    skill names such as 'Oral Communication: Active Listening', and one file that failed to download."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        d = pathlib.Path(cls.tmp.name)
        codes = ["21321.00", "22302.00", "13201.00", "21301.00"]

        def w(name, text):
            (d / f"{name}.csv").write_text(text, encoding="utf-8-sig")      # the real files start with a BOM

        w("lead_statement_en", "OaSIS profile code,Lead statement\n" + "".join(
            f'{c},"Plan work, improve quality and lead teams."\n' for c in codes))
        # lead_statement_fr: not written, as if the download failed
        w("labels_en", "OaSIS profile code;Label\n21321.00;Industrial engineers\n22302.00;Industrial technologists\n"
                       "13201.00;Logistics coordinators\n21301.00;Mechanical engineers\n")
        w("labels_fr", "Code de profil professionnel SIPeC,Étiquette\n21321.00,Ingénieurs industriels\n"
                       "22302.00,Technologues industriels\n13201.00,Coordonnateurs de la logistique\n"
                       "21301.00,Ingénieurs mécaniciens\n")
        w("example_titles_en", "OaSIS profile code,Concordance number,Job title type,Job title text\n"
                               "21321.00,1,Illustrative example,industrial engineer\n"
                               "21321.00,2,Illustrative example,quality engineer (QE)\n"
                               "22302.00,1,Illustrative example,industrial technologist\n"
                               "13201.00,1,Illustrative example,logistics coordinator\n"
                               "21301.00,1,Illustrative example,mechanical engineer\n")
        w("example_titles_fr", "Code de profil SIPeC,Numéro de concordance,Type d'appellation d'emploi,Appellation d'emploi\n"
                               "21321.00,1,Exemple illustratif,ingénieur industriel/ingénieure industrielle\n"
                               "22302.00,1,Exemple illustratif,technologue industriel/technologue industrielle\n"
                               "13201.00,1,Exemple illustratif,coordonnateur/coordonnatrice de la logistique\n"
                               "21301.00,1,Exemple illustratif,ingénieur mécanicien/ingénieure mécanicienne\n")
        w("main_duties_en", "OaSIS profile code;Main duties\n21321.00;Analyse root cause, lean manufacturing and quality control\n"
                            "22302.00;Support lean manufacturing\n13201.00;Inventory control, shipping\n"
                            "21301.00;Design equipment with AutoCAD\n")
        w("main_duties_fr", "Column1;Column2\nCode de profil professionnel SIPeC.00;Fonctions principales\n"
                            "21321.00;analyser les causes, fabrication au plus juste et contrôle de la qualité\n"
                            "22302.00;soutenir la fabrication au plus juste\n13201.00;contrôle des stocks, expédition\n"
                            "21301.00;concevoir de l'équipement avec AutoCAD\n")
        w("employment_requirements_en", "OaSIS profile code,Employment requirement\n" + "".join(
            f'{c},"A bachelor\'s degree, or equivalent, is required."\n' for c in codes))
        w("employment_requirements_fr", "Code de profil professionnel SIPeC,Exigences d'emploi\n" + "".join(
            f'{c},"Un baccalauréat, ou l\'équivalent, est exigé."\n' for c in codes))
        w("workplaces_employers_en", "OaSIS profile code,Workplace/employer name,Profile name\n" + "".join(
            f"{c},Manufacturing firms,Some profile\n" for c in codes))
        w("workplaces_employers_fr", "Code de profil professionnel SIPeC,Lieux de travail/employeurs,Nom du profil professionnel SIPeC\n" + "".join(
            f"{c},Entreprises de fabrication,Un profil\n" for c in codes))
        w("additional_information_en", "OaSIS profile code,Additional information (EN)\n21321.00,There is mobility.\n")
        w("additional_information_fr", "Code de profile professionnel SIPeC,Renseignements supplémentaires\n21321.00,Il existe une mobilité.\n")

        def wide(en_head, fr_head, rows, label_en, label_fr, code_en="Code OaSIS", code_fr="Code SIPeC"):
            w_en = ";".join([code_en, label_en] + en_head) + "\n" + "".join(
                ";".join([c, "x"] + [str(v) for v in r]) + "\n" for c, r in zip(codes, rows))
            w_fr = ";".join([code_fr, label_fr] + fr_head) + "\n" + "".join(
                ";".join([c, "x"] + [str(v) for v in r]) + "\n" for c, r in zip(codes, rows))
            return w_en, w_fr

        sk = [[4, 3, 5], [3, 2, 4], [2, 4, 3], [4, 1, 5]]
        w("skills_en", wide(["Oral Communication: Active Listening", "Digital Literacy", "Decision Making"],
                            ["Communication verbale : écoute active", "Littératie numérique", "Prise de décisions"],
                            sk, "OaSIS 2021 Labels", "Étiquette SiPEC - Final")[0])
        w("skills_fr", wide(["Oral Communication: Active Listening", "Digital Literacy", "Decision Making"],
                            ["Communication verbale : écoute active", "Littératie numérique", "Prise de décisions"],
                            sk, "OaSIS 2021 Labels", "Étiquette SiPEC - Final")[1])
        ab = [[5, 4, 4], [5, 3, 4], [4, 4, 3], [5, 5, 2]]
        a_en, a_fr = wide(["Categorization Flexibility", "Deductive Reasoning", "Information Ordering"],
                          ["Souplesse dans la catégorisation", "Raisonnement déductif", "Ordonner de l’information"],
                          ab, "OaSIS 2021 Labels", "Étiquette SIPeC - Final")
        w("abilities_en", a_en)
        w("abilities_fr", a_fr)
        kn = [[5, 4, 4], [4, 4, 3], [1, 3, 5], [5, 2, 1]]
        k_en, k_fr = wide(["Engineering and Technology", "Production and Processing", "Accounting"],
                          ["Génie et technologie", "Production et transformation", "Comptabilité"],
                          kn, "OaSIS 2021 Labels", "Étiquette SIPeC - Final")
        w("knowledge_en", k_en)
        w("knowledge_fr", k_fr)
        pa = [[4, 5, 5], [4, 4, 5], [3, 5, 4], [5, 5, 4]]
        p_en, p_fr = wide([" Active Learning", " Adaptability", "Attention to Detail"],
                          ["Apprentissage actif", "Adaptabilité", "Souci du détail"], pa,
                          "OaSIS Label - Final", "Étiquette SIPeC - Final", "OaSIS Code - Final", "Code SIPeC - Final")
        w("personal_attributes_en", p_en)
        w("personal_attributes_fr", p_fr)
        wa = [[4, 5, 4], [5, 4, 4], [3, 4, 5], [4, 4, 4]]
        wa_en, wa_fr = wide(["Getting Information", "Analyzing Data or Information", "Scheduling Work and Activities"],
                            ["Obtention d’information", "Analyse de données ou d’information", "Planification du travail et des activités"],
                            wa, "OaSIS Label - Final", "Étiquette SIPeC - Final", "Code OaSIS", "Code SIPeC - Final")
        w("work_activities_en", wa_en)
        w("work_activities_fr", wa_fr)
        wc = [[1, 5, 3], [2, 5, 4], [0, 4, 5], [1, 5, 5]]
        c_en, c_fr = wide(["Automation (Degree of Automation)", "Competition (Degree of Competition)", "Exposed to Noise (Frequency)"],
                          ["Automatisation (Degré d’automatisation)", "Concurrence (Degré de compétition)", "Exposition au bruit (Fréquence)"],
                          wc, "OaSIS Label - Final", "Étiquette SIPeC - Final", "OaSIS Code - Final", "Code SIPeC - Final")
        w("work_context_en", c_en)
        w("work_context_fr", c_fr)

        cls.out = d / "o.json"
        r = subprocess.run([sys.executable, str(ROOT / "scripts" / "build_oasis_dictionary.py"), "--local-dir", str(d),
                            "--out", str(cls.out), "--vocab", str(d / "v.csv")], capture_output=True, text=True)
        cls.log = r.stdout + r.stderr
        assert r.returncode == 0, cls.log
        cls.data = json.loads(cls.out.read_text(encoding="utf-8"))
        cls.codes = codes

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_builds_without_the_failed_file(self):
        self.assertEqual(self.data["meta"]["occupations"], 4, self.log)     # the junk first row is not an occupation
        self.assertIn("lead_statement_fr: not downloaded, skipped", self.log)
        self.assertNotIn("SKIPPED", self.log)          # main_duties_fr has "Column1;Column2" above its real header

    def test_delimiters(self):
        self.assertEqual(build.delimiter_of('a,b;c\n1,2;3'), ",")
        self.assertEqual(build.delimiter_of('a;b;c,d\n'), ";")
        self.assertEqual(build.delimiter_of('"Identifying Objects, Actions";"B, C";D\n'), ";")
        self.assertEqual(build.delimiter_of("only one column\n"), ",")

    def test_labels_english_and_french(self):
        occ = self.data["occupations"]["21321.00"]
        self.assertEqual(occ.get("label"), "Industrial engineers")
        self.assertEqual(occ.get("label_fr"), "Ingénieurs industriels")

    def test_titles_use_the_title_column_and_both_genders(self):
        t = self.data["titles"]
        self.assertIn("industrial engineer", t)
        self.assertIn("quality engineer", t)                       # without "(QE)"
        self.assertIn("ingenieur industriel", t)
        self.assertIn("ingenieure industrielle", t)                # other side of the slash
        self.assertFalse([x for x in t if "illustrative" in x or "illustratif" in x], "title type column leaked in")

    def test_descriptors_from_every_rating_file(self):
        files = {d["file"] for d in self.data["descriptors"]}
        self.assertEqual(files, {"skills", "abilities", "knowledge", "personal_attributes", "work_activities", "work_context"})
        pairs = {(d["en"], d["fr"]) for d in self.data["descriptors"]}
        self.assertIn(("Attention to Detail", "Souci du détail"), pairs)    # leading spaces in other headers are removed

    def test_colon_names_and_work_context(self):
        import keyword_extractor as kx
        merged, source = oasis.merge_skills(kx.SKILLS, self.data)
        pats = kx.build_patterns(merged)
        name = "Oral Communication: Active Listening"
        self.assertIn(name, merged)
        self.assertTrue(pats[name].search("strong active listening skills"))
        self.assertTrue(pats[name].search(oasis.fold("une bonne écoute active")))
        self.assertFalse([k for k in merged if "Degree of" in k], "working conditions must not become skills")

    def test_very_common_skills_are_not_inferred(self):
        data = {"meta": {"occupations": 10},
                "skill_occupations": {"A": list("abcdefgh"), "B": list("abcdefgh"), "C": list("abc"), "D": list("abd")}}
        self.assertEqual(oasis.inferred_related(["A"], ["B"], data), [])             # 8 of 10 occupations: too common
        self.assertEqual(len(oasis.inferred_related(["C"], ["D"], data)), 1)        # 3 and 3, share 2: kept


@unittest.skipUnless(shutil.which("node") and (ROOT / "python" / "oasis_data.json").exists(),
                     "needs node and the built OaSIS data")
class MatcherParityTest(unittest.TestCase):
    """The website's matcher (docs/matcher.js) must give the same answers as the Python extractor."""

    def test_same_answers_on_the_sample_posts(self):
        import keyword_extractor as kx
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_site_dictionary as site
        with tempfile.TemporaryDirectory() as tmp:
            dict_path = pathlib.Path(tmp) / "skills.json"
            dict_path.write_text(json.dumps(site.build(), ensure_ascii=False), encoding="utf-8")
            cv_path = ROOT / "cv" / "sample_cv.txt"
            posts = sorted((ROOT / "posts").glob("*.txt"))
            r = subprocess.run(["node", str(ROOT / "test" / "matcher_harness.cjs"), str(dict_path), str(cv_path)]
                               + [str(p) for p in posts], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            js = json.loads(r.stdout)
        cv_text = cv_path.read_text(encoding="utf-8")
        cv_kw = kx.extract_cv_keywords(cv_text)
        self.assertEqual(set(js["cv"]), set(cv_kw))
        for post in posts:
            text = post.read_text(encoding="utf-8")
            job_kw = kx.extract_job_keywords(text)
            matched, missing, extra, related = kx.compare(job_kw, cv_kw)
            rep = kx.oasis_report_data(text, cv_text, matched, missing, cv_kw, related, job_kw)
            got = js["posts"][post.name]
            self.assertEqual(set(got["job"]), set(job_kw), post.name)
            self.assertEqual(sorted(got["matched"]), sorted(matched), post.name)
            self.assertEqual(sorted(got["missing"]), sorted(missing), post.name)
            self.assertEqual(sorted(map(tuple, got["relatedCurated"])), sorted(related), post.name)
            self.assertEqual(sorted(map(tuple, got["inferred"])), sorted((a, b) for a, b, _, _ in rep["inferred_related"]), post.name)
            self.assertAlmostEqual(got["coveragePct"], round(100 * len(matched) / len(job_kw), 1), places=1)
            self.assertAlmostEqual(got["coverageWithRelatedPct"], rep["coverage_with_related_pct"], places=1)

    def test_french_and_accents(self):
        import keyword_extractor as kx
        sys.path.insert(0, str(ROOT / "scripts"))
        import build_site_dictionary as site
        with tempfile.TemporaryDirectory() as tmp:
            dict_path = pathlib.Path(tmp) / "skills.json"
            dict_path.write_text(json.dumps(site.build(), ensure_ascii=False), encoding="utf-8")
            text = pathlib.Path(tmp) / "t.txt"
            text.write_text("Excellente écoute active, résolution de problèmes et Gestion du temps.\nTechnical writing, writing reports.\n", encoding="utf-8")
            r = subprocess.run(["node", str(ROOT / "test" / "matcher_harness.cjs"), str(dict_path), str(text), str(text)],
                               capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, r.stderr)
            got = json.loads(r.stdout)["cv"]
        want = kx.find_skills_in_line("Excellente écoute active, résolution de problèmes et Gestion du temps.") \
            + kx.find_skills_in_line("Technical writing, writing reports.")
        self.assertEqual(set(got), set(want))
        self.assertIn("Problem solving", got)
        self.assertIn("Time Management", got)


class OverlapTest(unittest.TestCase):
    """'Writing' (from OaSIS) must not be counted again inside 'technical writing' (curated)."""

    def setUp(self):
        import keyword_extractor as kx
        self.kx = kx
        skills = {"Technical writing": ["technical writing"], "Writing": ["writing"], "Teamwork": ["teamwork"]}
        self.patch = (kx.PATTERNS, kx.SKILL_SOURCE)
        kx.PATTERNS = kx.build_patterns(skills)
        kx.SKILL_SOURCE = {"Technical writing": "curated", "Writing": "OaSIS skills", "Teamwork": "curated"}

    def tearDown(self):
        self.kx.PATTERNS, self.kx.SKILL_SOURCE = self.patch

    def test_oasis_skill_inside_a_longer_skill_is_dropped(self):
        self.assertEqual(self.kx.find_skills_in_line("Strong technical writing and teamwork"),
                         ["Technical writing", "Teamwork"])

    def test_oasis_skill_on_its_own_is_kept(self):
        self.assertEqual(self.kx.find_skills_in_line("Report writing; technical writing"),
                         ["Technical writing", "Writing"])

    def test_curated_skills_are_never_dropped(self):
        self.kx.SKILL_SOURCE["Writing"] = "curated"
        self.assertEqual(self.kx.find_skills_in_line("technical writing"), ["Technical writing", "Writing"])


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
