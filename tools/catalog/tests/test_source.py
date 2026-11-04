"""Isolated source-policy fixtures; no audio or production embeddings."""

import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

from source import canonical_license, diverse_selection, public_page, read_members, record_for


class SourcePolicyTests(unittest.TestCase):
    def test_requires_an_exact_allowlisted_license_url(self):
        self.assertEqual(
            canonical_license("http://creativecommons.org/licenses/by/3.0/"),
            "https://creativecommons.org/licenses/by/3.0/",
        )
        self.assertEqual(
            canonical_license("https://creativecommons.org/publicdomain/zero/1.0/"),
            "https://creativecommons.org/publicdomain/zero/1.0/",
        )
        for value in (
            "Attribution",
            "",
            "CC BY",
            "https://creativecommons.org/licenses/by/3.0/us/",
            "https://creativecommons.org.evil.test/licenses/by/4.0/",
            "https://creativecommons.org/licenses/by-nc/4.0/",
            "https://creativecommons.org/licenses/by-sa/3.0/",
            "https://creativecommons.org/licenses/by-nd/2.0/",
            "https://creativecommons.org/licenses/by/4.0/?permission=yes",
        ):
            with self.subTest(value=value):
                self.assertIsNone(canonical_license(value))

    def test_preserves_raw_title_exact_url_and_copyright_notices(self):
        original = {
            "license_url": "http://creativecommons.org/licenses/by/3.0/",
            "license_title": "Attribution",
            "track_url": "http://freemusicarchive.org/music/Fixture/Test/",
            "track_title": "Fixture only",
            "artist_name": "Test Artist",
            "track_copyright_c": "Copyright Test Artist",
            "track_copyright_p": "Test recording notice",
        }
        record, reason = record_for("12", {}, original)
        self.assertEqual(reason, "eligible")
        self.assertEqual(record["id"], "fma:000012")
        self.assertEqual(record["audioPath"], "000/000012.mp3")
        license = record["provenance"]["recordingLicense"]
        self.assertEqual(license["statement"], "Attribution")
        self.assertEqual(license["url"], "https://creativecommons.org/licenses/by/3.0/")
        self.assertIn("Copyright Test Artist", license["attribution"])
        self.assertIn("Test recording notice", license["attribution"])
        self.assertIn(original["license_url"], record["provenance"]["publicationBasis"])
        self.assertEqual(
            record_for("12", {}, {**original, "license_url": ""})[1], "unmapped_or_missing_license"
        )
        self.assertEqual(record_for("12", {}, None)[1], "missing_raw_record")
        for title in (
            "Attribution-NonCommercial",
            "Attribution 4.0 International",
            "All rights reserved",
        ):
            self.assertEqual(
                record_for("12", {}, {**original, "license_title": title})[1],
                "conflicting_license_evidence",
            )
        self.assertIsNone(public_page("https://user:pass@freemusicarchive.org/music/test"))

    def test_conflicting_notices_and_composite_licenses_fail_closed(self):
        from source import notice_conflict, notice_fields

        self.assertEqual(notice_fields({"track_copyright_c": "null"}), {})
        self.assertEqual(
            notice_conflict(
                {"track_information": "Creative Commons nc-sa-3.0"},
                "https://creativecommons.org/licenses/by/4.0/",
            ),
            "conflicting_restricted_notice",
        )
        self.assertEqual(
            notice_conflict(
                {
                    "track_information": "Credit underlying work http://creativecommons.org/licenses/by/3.0/"
                },
                "https://creativecommons.org/licenses/by/4.0/",
            ),
            "ambiguous_composite_license",
        )
        notice = "Music by Fixture Creator <a href='https://example.org/credit'>source</a>"
        self.assertIn(
            "https://example.org/credit",
            notice_fields({"track_information": notice})["track_information"],
        )

    def test_reviewed_album_artist_ambiguity_and_additional_credits(self):
        original = {
            "license_url": "http://creativecommons.org/licenses/by/4.0/",
            "license_title": "Attribution",
            "track_url": "http://freemusicarchive.org/music/Test/Track/",
            "track_title": "Fixture",
            "artist_name": "Artist",
            "album_id": "6467",
        }
        self.assertEqual(record_for("12", {}, original)[1], "album_notice_nc")
        self.assertEqual(
            record_for("12", {}, {**original, "album_id": "", "artist_id": "21128"})[1],
            "artist_notice_noncommercial",
        )
        credited = {**original, "album_id": "13303"}
        self.assertIn(
            "Producer: Tricky Diesel",
            record_for("12", {}, credited)[0]["provenance"]["recordingLicense"]["attribution"],
        )
        self.assertEqual(
            record_for("12", {}, {**original, "album_id": "21088"})[1],
            "missing_required_album_credit",
        )

    def test_joins_real_csv_header_shapes_by_id_not_position(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "fixture.zip"
            with zipfile.ZipFile(path, "w") as z:
                z.writestr(
                    "fma_metadata/tracks.csv",
                    ",set,artist,track\n,subset,id,genre_top\ntrack_id,,,\n12,small,7,Rock\n13,large,8,Folk\n",
                )
                z.writestr(
                    "fma_metadata/raw_tracks.csv",
                    ",license_url,track_title\n13,http://example.org,Second\n12,http://creativecommons.org/licenses/by/3.0/,First\n",
                )
            with patch("source.verify_archive"):
                tracks, raw = read_members(path)
            self.assertEqual(tracks["12"][("set", "subset")], "small")
            self.assertEqual(raw["12"]["track_title"], "First")
            self.assertEqual(len(tracks), 2)

    def test_selection_is_deterministic_and_spreads_artists_and_genres(self):
        candidates = [
            ({"id": "fma:000001"}, "a", "Rock"),
            ({"id": "fma:000002"}, "a", "Rock"),
            ({"id": "fma:000003"}, "b", "Rock"),
            ({"id": "fma:000004"}, "c", "Folk"),
        ]
        chosen = diverse_selection(candidates, 3)
        self.assertEqual([r["id"] for r in chosen], ["fma:000004", "fma:000001", "fma:000003"])
        self.assertEqual(chosen, diverse_selection(list(reversed(candidates)), 3))


if __name__ == "__main__":
    unittest.main()
