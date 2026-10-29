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


if __name__ == "__main__":
    unittest.main()
