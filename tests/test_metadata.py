"""Offline checks for the portfolio's discoverability and profile metadata."""

import json
from html.parser import HTMLParser
from pathlib import Path
import unittest
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]


class MetadataParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.charsets = []
        self.hrefs = set()
        self.html_lang = None
        self.metadata = {}
        self.structured_data = []
        self.title_parts = []
        self._in_json_ld = False
        self._in_title = False
        self._json_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "html":
            self.html_lang = attributes.get("lang")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta":
            if attributes.get("charset"):
                self.charsets.append(attributes["charset"])
            key = attributes.get("name") or attributes.get("property")
            if key:
                self.metadata.setdefault(key, []).append(
                    attributes.get("content", "")
                )
        elif tag == "a" and attributes.get("href"):
            self.hrefs.add(attributes["href"])
        elif (
            tag == "script"
            and attributes.get("type", "").lower() == "application/ld+json"
        ):
            self._in_json_ld = True
            self._json_parts = []

    def handle_data(self, data):
        if self._in_title:
            self.title_parts.append(data)
        if self._in_json_ld:
            self._json_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        elif tag == "script" and self._in_json_ld:
            self.structured_data.append("".join(self._json_parts))
            self._in_json_ld = False
            self._json_parts = []

    @property
    def title(self):
        return "".join(self.title_parts).strip()


class MetadataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        parser = MetadataParser()
        parser.feed((ROOT / "index.html").read_text(encoding="utf-8"))
        parser.close()
        cls.page = parser

    def metadata_value(self, key):
        values = self.page.metadata.get(key, [])
        self.assertEqual(len(values), 1, f"Expected one {key!r} metadata value")
        value = values[0].strip()
        self.assertTrue(value, f"Metadata value {key!r} is empty")
        return value

    def person_data(self):
        self.assertTrue(self.page.structured_data, "No JSON-LD metadata found")
        documents = []
        for position, raw in enumerate(self.page.structured_data, start=1):
            try:
                documents.append(json.loads(raw))
            except json.JSONDecodeError as error:
                self.fail(f"JSON-LD block {position} is invalid: {error}")
        people = [
            document
            for document in documents
            if isinstance(document, dict) and document.get("@type") == "Person"
        ]
        self.assertEqual(len(people), 1, "Expected exactly one Person JSON-LD object")
        return people[0]

    def test_core_document_metadata_is_present(self):
        self.assertEqual(self.page.html_lang, "en")
        self.assertEqual([value.lower() for value in self.page.charsets], ["utf-8"])
        self.assertTrue(self.page.title, "Document title is empty")
        self.metadata_value("description")
        self.metadata_value("author")
        self.metadata_value("viewport")

    def test_social_metadata_is_consistent(self):
        self.assertEqual(self.metadata_value("og:type"), "website")
        self.assertEqual(self.metadata_value("og:title"), self.page.title)
        self.assertEqual(self.metadata_value("twitter:title"), self.page.title)
        self.assertEqual(
            self.metadata_value("twitter:description"),
            self.metadata_value("og:description"),
        )
        self.metadata_value("twitter:card")

    def test_json_ld_describes_one_person(self):
        person = self.person_data()
        self.assertEqual(person.get("@context"), "https://schema.org")
        self.assertEqual(person.get("name"), self.metadata_value("author"))
        self.assertTrue(person.get("jobTitle"), "Person jobTitle is empty")
        address = person.get("address")
        self.assertIsInstance(address, dict, "Person address must be an object")
        self.assertEqual(address.get("@type"), "PostalAddress")
        self.assertTrue(address.get("addressLocality"), "Address locality is empty")
        self.assertTrue(address.get("addressCountry"), "Address country is empty")

    def test_structured_contact_links_exist_in_page(self):
        person = self.person_data()
        email = person.get("email")
        self.assertTrue(
            isinstance(email, str) and email.startswith("mailto:"),
            "Person email must be a mailto URL",
        )
        self.assertIn(email, self.page.hrefs, "Structured email is not linked on page")

        same_as = person.get("sameAs")
        self.assertIsInstance(same_as, list, "Person sameAs must be a list")
        self.assertTrue(same_as, "Person sameAs is empty")
        for profile in same_as:
            with self.subTest(profile=profile):
                parsed = urlsplit(profile)
                self.assertEqual(parsed.scheme, "https")
                self.assertTrue(parsed.netloc, "Profile URL has no host")
                self.assertIn(
                    profile,
                    self.page.hrefs,
                    "Structured social profile is not linked on page",
                )


if __name__ == "__main__":
    unittest.main()
