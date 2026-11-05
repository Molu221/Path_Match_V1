"""Python NOC library helpers (the same results as docs/noc/noc_library.js). Run: python -m unittest test.test_noc_library"""
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "noc_library"))
import noc_library as nl  # noqa: E402

LIB = nl.load(os.path.join(ROOT, "docs", "noc", "noc_library.lite.json"))


class NocForTitle(unittest.TestCase):
    def test_titles(self):
        cases = {"supermarket butcher": ("63201", "exact title"), "driver, truck": ("73300", "closest title"),
                 "cook's helper": (None, "exact title"), "transportation coordinator": ("13201", None),
                 "intern": (None, "none"), "": (None, "none")}
        for title, (noc, how) in cases.items():
            r = nl.noc_for_title(LIB, title)
            if noc:
                self.assertEqual(r["noc"], noc, title)
            if how:
                self.assertEqual(r["how"], how, title)


class Fit(unittest.TestCase):
    NURSE = ("Amina Example, RN\nRegistered Nurse\nRegistered Nurse, Hôpital Général, Jan 2025 - Present\n"
             "Medical-surgical unit: patient assessment, medication administration, IV therapy, wound care.\n"
             "B.Sc.N. Nursing, Université de Montréal, 2020 - 2024")
    STUDENT = "M.Eng. Industrial Engineering, Concordia University (in progress). Operations intern: Lean 5S, kaizen, simulation in Arena, SPC, FMEA."

    def test_title_shared_by_sub_profiles(self):
        fits = nl.find_occupations(LIB, self.NURSE)
        self.assertEqual(fits[0]["code"][:5], "31301")
        self.assertEqual(fits[0]["fit"], "clear")
        r = nl.compare(LIB, self.NURSE, "31301.01", fits=fits)
        self.assertFalse(any(i["part"] == "duties" and i["label"] == "Missing" for i in r["items"]))

    def test_field_of_study_is_partial(self):
        fits = nl.find_occupations(LIB, self.STUDENT)
        ie = next(f for f in fits if f["code"].startswith("21321"))
        self.assertEqual(ie["fit"], "partial")
        self.assertFalse(ie["clear_fit"])
        r = nl.compare(LIB, self.STUDENT, ie["code"], fits=fits)
        self.assertTrue(any(i["part"] == "skills" and i["label"] == "Guess" and "degree or titles" in i["why"] for i in r["items"]))


if __name__ == "__main__":
    unittest.main()
