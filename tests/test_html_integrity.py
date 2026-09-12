"""Offline smoke checks for the portfolio's HTML references (not browser tests)."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []

    def handle_starttag(self, tag, attrs):
        self.elements.append((tag, dict(attrs), self.getpos()[0]))


class HTMLIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        page = PageParser()
        page.feed((ROOT / "index.html").read_text(encoding="utf-8"))
        page.close()
        cls.elements = page.elements
        cls.ids = {
            attrs["id"]: (tag, attrs, line)
            for tag, attrs, line in cls.elements
            if "id" in attrs
        }

    def test_ids_are_unique_and_nonempty(self):
        ids = [attrs["id"] for _, attrs, _ in self.elements if "id" in attrs]
        self.assertTrue(ids, "No IDs found in index.html")
        for element_id in ids:
            with self.subTest(id=element_id):
                self.assertTrue(element_id and element_id.strip(), "Empty HTML ID")
        duplicates = [key for key, count in Counter(ids).items() if count > 1]
        self.assertEqual(duplicates, [], "Duplicate IDs make references ambiguous")

    def test_fragment_links_have_targets(self):
        links = [
            (attrs["href"], line)
            for tag, attrs, line in self.elements
            if tag in ("a", "area") and (attrs.get("href") or "").startswith("#")
        ]
        self.assertTrue(links, "No same-page navigation links found")
        for href, line in links:
            with self.subTest(line=line, href=href):
                target = unquote(href[1:])
                # Empty fragments and #top can navigate to the document top.
                if target and target.lower() != "top":
                    self.assertIn(target, self.ids, "Missing navigation target")

    def test_local_stylesheets_and_scripts_exist(self):
        assets = []
        for tag, attrs, line in self.elements:
            if tag == "script" and "src" in attrs:
                assets.append((attrs["src"], line))
            elif tag == "link" and "stylesheet" in (attrs.get("rel") or "").split():
                assets.append((attrs.get("href"), line))
        self.assertTrue(assets, "No script or stylesheet references found")
        local_count = 0
        for source, line in assets:
            with self.subTest(line=line, asset=source):
                self.assertTrue(source, "Empty script or stylesheet URL")
                url = urlsplit(source)
                if url.scheme or url.netloc:
                    continue  # External resources are not fetched by offline tests.
                self.assertTrue(url.path, "Local asset URL has no file path")
                asset = (ROOT / unquote(url.path)).resolve()
                self.assertIn(ROOT, asset.parents, "Local asset must be inside the repository")
                self.assertTrue(asset.is_file(), "Referenced local asset is missing")
                local_count += 1
        self.assertGreater(local_count, 0, "No local script or stylesheet checked")

    def test_labels_and_aria_references_have_targets(self):
        references = []
        for tag, attrs, line in self.elements:
            names = ["aria-controls", "aria-labelledby", "aria-describedby"]
            if tag == "label":
                names.append("for")
            for name in names:
                if name in attrs:
                    references.append((name, attrs[name], line))
        self.assertTrue(references, "No label or ARIA references found")
        for name, value, line in references:
            with self.subTest(line=line, attribute=name, value=value):
                targets = (value or "").split()
                self.assertTrue(targets, "Empty ID reference")
                for target in targets:
                    self.assertIn(target, self.ids, "Missing label or ARIA target")

    def test_project_expanders_match_their_initial_detail_state(self):
        buttons = [
            (attrs, line)
            for tag, attrs, line in self.elements
            if tag == "button"
            and "project-card__expand" in (attrs.get("class") or "").split()
        ]
        self.assertTrue(buttons, "No project expanders found")
        for attrs, line in buttons:
            target = attrs.get("data-expand")
            with self.subTest(line=line, target=target):
                # script.js resolves data-expand with getElementById on click.
                self.assertIn(target, self.ids, "Missing project detail target")
                _, details, _ = self.ids[target]
                expanded = attrs.get("aria-expanded")
                self.assertIn(expanded, ("true", "false"), "Missing initial expanded state")
                self.assertEqual(
                    "hidden" not in details,
                    expanded == "true",
                    "Project detail visibility disagrees with aria-expanded",
                )


if __name__ == "__main__":
    unittest.main()
