"""Offline smoke checks for the portfolio's HTML references (not browser tests)."""

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parents[1]
GET_ELEMENT_BY_ID = re.compile(
    r"""\bdocument\.getElementById\(\s*(['"])(?P<target>[^'"]+)\1\s*\)"""
)


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

    def test_links_do_not_use_executable_schemes(self):
        links = [
            (attrs.get("href"), line)
            for tag, attrs, line in self.elements
            if tag in ("a", "area")
        ]
        self.assertTrue(links, "No links found in index.html")
        forbidden_schemes = {"data", "javascript", "vbscript"}
        for href, line in links:
            with self.subTest(line=line, href=href):
                self.assertTrue(href and href.strip(), "Empty link destination")
                scheme = urlsplit(href.strip()).scheme.lower()
                self.assertNotIn(
                    scheme,
                    forbidden_schemes,
                    "Link uses an executable URL scheme",
                )

    def test_new_tab_links_are_isolated(self):
        links = [
            (attrs, line)
            for tag, attrs, line in self.elements
            if tag in ("a", "area")
            and (attrs.get("target") or "").lower() == "_blank"
        ]
        self.assertTrue(links, "No new-tab links found in index.html")
        for attrs, line in links:
            with self.subTest(line=line, href=attrs.get("href")):
                rel = {
                    token.lower()
                    for token in (attrs.get("rel") or "").split()
                }
                self.assertIn(
                    "noopener",
                    rel,
                    "New-tab link can access the opener window",
                )
                self.assertIn(
                    "noreferrer",
                    rel,
                    "New-tab link leaks the page URL as a referrer",
                )

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

    def test_javascript_literal_id_lookups_have_html_targets(self):
        script = (ROOT / "script.js").read_text(encoding="utf-8")
        lookups = [
            (match.group("target"), script.count("\n", 0, match.start()) + 1)
            for match in GET_ELEMENT_BY_ID.finditer(script)
        ]
        self.assertTrue(lookups, "No literal document.getElementById lookups found")
        for target, line in lookups:
            with self.subTest(line=line, target=target):
                self.assertIn(
                    target,
                    self.ids,
                    "JavaScript getElementById lookup has no HTML target",
                )

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

    def test_form_controls_have_accessible_labels(self):
        label_targets = {
            attrs["for"]
            for tag, attrs, _ in self.elements
            if tag == "label" and attrs.get("for")
        }
        controls = [
            (tag, attrs, line)
            for tag, attrs, line in self.elements
            if tag in ("input", "select", "textarea")
            and (attrs.get("type") or "").lower()
            not in ("button", "hidden", "image", "reset", "submit")
        ]
        self.assertTrue(controls, "No user-input form controls found")
        for tag, attrs, line in controls:
            with self.subTest(line=line, tag=tag, id=attrs.get("id")):
                labelled_by_element = (
                    attrs.get("id") in label_targets if attrs.get("id") else False
                )
                labelled_by_aria = bool(
                    (attrs.get("aria-label") or "").strip()
                    or (attrs.get("aria-labelledby") or "").split()
                )
                self.assertTrue(
                    labelled_by_element or labelled_by_aria,
                    "Form control has no explicit label or ARIA label",
                )

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
