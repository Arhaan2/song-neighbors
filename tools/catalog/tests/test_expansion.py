"""Metadata fixtures test cumulative membership, rights and deterministic expansion."""

import copy
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import expansion
import source
from catalog import canonical


def item(tid, artist, genre="Rock", album="1", flags=None):
    return {
        "id": f"fma:{tid:06d}",
        "artistId": str(artist),
        "primaryGenre": genre,
        "albumId": album,
        "contentFlags": flags or [],
    }


def original(tid="12", artist="7", album="10"):
    return {
        "license_url": "http://creativecommons.org/licenses/by/3.0/",
        "license_title": "Attribution",
        "track_url": f"http://freemusicarchive.org/music/Fixture/{tid}/",
        "track_title": "Fixture track",
        "artist_name": "Fixture artist",
        "artist_id": artist,
        "album_id": album,
        "album_url": "http://freemusicarchive.org/music/Fixture/Album/",
        "album_title": "Fixture album",
        "track_copyright_c": "Exact copyright notice",
    }


class ExpansionTests(unittest.TestCase):
    def test_cumulative_membership_is_overlapping_and_ids_are_stable(self):
        tracks = {
            str(i): {("set", "subset"): subset} for i, subset in enumerate(expansion.SUBSETS, 1)
        }
        self.assertEqual(set(expansion.members_for(tracks, "small")), {"1"})
        self.assertEqual(set(expansion.members_for(tracks, "medium")), {"1", "2"})
        self.assertEqual(set(expansion.members_for(tracks, "large")), {"1", "2", "3"})
        records = [source.record_for("1", t, original())[0] for t in tracks.values()]
        self.assertEqual({r["id"] for r in records}, {"fma:000001"})
        self.assertEqual({r["audioPath"] for r in records}, {"000/000001.mp3"})
        with self.assertRaisesRegex(ValueError, "Unknown source"):
            expansion.members_for({"1": {("set", "subset"): "full"}}, "large")

    def test_deterministic_global_artist_cap_and_published_grandfathering(self):
        rows = [item(1, 1), item(2, 1, "Folk"), item(3, 1), item(4, 2), item(5, 3), item(6, 3)]
        published = {"fma:000001", "fma:000002"}
        chosen = expansion.select_candidates(rows, published, 6, 1)
        self.assertEqual(
            [r["id"] for r in chosen], ["fma:000001", "fma:000002", "fma:000004", "fma:000005"]
        )
        self.assertEqual(chosen, expansion.select_candidates(list(reversed(rows)), published, 6, 1))
        with self.assertRaisesRegex(ValueError, "Target cannot drop"):
            expansion.select_candidates(rows, published, 1, 50)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            expansion.select_candidates(rows + [rows[0]], published, 6, 50)
        with self.assertRaisesRegex(ValueError, "no longer eligible"):
            expansion.select_candidates(rows[1:], published, 6, 50)

    def test_source_content_flags_preserve_music_and_published_rows(self):
        self.assertEqual(
            expansion.content_flags(["Ambient", "Instrumental", "Experimental"], "1"), []
        )
        uncertain = expansion.content_flags(["Field Recordings"], "1")
        nonmusical = expansion.content_flags(["Spoken"], "1")
        rows = [
            item(1, 1, flags=nonmusical),
            item(2, 2, flags=nonmusical),
            item(3, 3, flags=uncertain),
        ]
        self.assertEqual(
            [r["id"] for r in expansion.select_candidates(rows, {"fma:000001"}, 3, 50)],
            ["fma:000001", "fma:000003"],
        )
        self.assertIn(
            "likely_nonmusical_source_crowd_collection", expansion.content_flags([], "12256")
        )

    def test_exact_raw_evidence_and_applicable_credits_are_preserved(self):
        raw = original()
        raw["track_information"] = "Credit <a href='https://example.test/credit'>Contributor</a>"
        track = {("set", "subset"): "large", ("track", "genres_all"): "[12]"}
        albums = {
            "10": {
                "album_id": "10",
                "album_information": "credits Alice: piano",
                "album_producer": "Producer",
            }
        }
        artists = {"7": {"artist_bio": "Public bio", "artist_id": "7"}}
        evidence = expansion.evidence_for("12", track, raw, albums, artists)
        self.assertEqual(evidence["track"]["track_information"], raw["track_information"])
        self.assertEqual(evidence["track"]["license_url"], raw["license_url"])
        self.assertEqual(evidence["album"]["album_information"], "credits Alice: piano")
        self.assertNotIn("artist_contact", evidence["artist"])
        record, _ = source.record_for("12", track, raw)
        with patch.dict("expansion.CREDIT_EXCERPTS", {"10": ["credits Alice: piano"]}):
            expansion.public_credit(record, raw, albums["10"], artists["7"])
        attribution = record["provenance"]["recordingLicense"]["attribution"]
        for text in [
            "Exact copyright notice",
            "https://example.test/credit",
            "Alice: piano",
            "Producer",
        ]:
            self.assertIn(text, attribution)
        changed = copy.deepcopy(evidence)
        changed["track"]["license_url"] = "https://creativecommons.org/licenses/by/4.0/"
        self.assertNotEqual(expansion.sha(canonical(evidence)), expansion.sha(canonical(changed)))

    def test_additional_ambiguities_fail_closed_and_small_policy_unchanged(self):
        self.assertEqual(
            expansion.extra_exclusion("12", original(album="18571")),
            "album_license_version_conflict",
        )
        self.assertEqual(
            expansion.extra_exclusion("12", original(artist="22407")),
            "artist_notice_audio_derivatives_restricted",
        )
        self.assertEqual(
            expansion.extra_exclusion("121221", original(album="18400")),
            "underlying_composition_nc",
        )
        self.assertIsNone(expansion.extra_exclusion("123663", original(album="18400")))
        self.assertIsNone(expansion.extra_exclusion("74370", original(album="13141")))
        self.assertEqual(source.record_for("12", {}, original())[1], "eligible")
        bad = {**original(), "license_url": "https://creativecommons.org/licenses/by-nc/3.0/"}
        self.assertEqual(source.record_for("12", {}, bad)[1], "excluded_nc_nd_sa")
        self.assertEqual(source.record_for("12", {}, original(album="6467"))[1], "album_notice_nc")

    def test_reviewed_credits_retain_contributors_without_contact_blocks(self):
        raw = original(album="18108")
        excerpts = expansion.CREDIT_EXCERPTS["18108"]
        record, _ = source.record_for("12", {}, raw)
        album = {
            "album_information": " ".join(excerpts)
            + " Contact info: private@example.test 555-123-4567"
        }
        expansion.public_credit(record, raw, album, {})
        attribution = record["provenance"]["recordingLicense"]["attribution"]
        self.assertIn("Emma and Madeline Prodoehl", attribution)
        self.assertIn("Gabe Wollenburg", attribution)
        self.assertNotIn("Contact info", attribution)
        self.assertNotIn("private@example.test", attribution)
        self.assertNotIn("555-123-4567", attribution)
        expansion.public_credit(record, raw, album, {})
        self.assertEqual(record["provenance"]["recordingLicense"]["attribution"], attribution)
        with self.assertRaisesRegex(RuntimeError, "does not match"):
            expansion.public_credit(record, raw, {"album_information": "Changed source"}, {})

    def test_explicit_published_holds_do_not_silently_drop_other_recordings(self):
        published = {"fma:006675", "fma:000012"}
        reason = "unresolved_underlying_sample_or_text_grant"
        retained, holds = expansion.retained_published(
            published, {"fma:000012"}, {"fma:006675": reason}
        )
        self.assertEqual(retained, {"fma:000012"})
        self.assertEqual(holds, {"fma:006675": reason})
        with self.assertRaisesRegex(ValueError, "unexpectedly"):
            expansion.retained_published(
                published, set(), {"fma:006675": reason, "fma:000012": reason}
            )
        self.assertEqual(
            expansion.extra_exclusion("61011", original()),
            "unresolved_underlying_composition_grant",
        )
        self.assertEqual(
            expansion.extra_exclusion("12", original(album="16384")),
            "album_license_version_conflict",
        )
        waiver = {
            **original(artist="19164"),
            "license_url": "http://creativecommons.org/publicdomain/zero/1.0/",
        }
        self.assertEqual(
            expansion.extra_exclusion("12", waiver), "artist_record_license_family_conflict"
        )
        self.assertIsNone(
            expansion.extra_exclusion(
                "12", {**waiver, "license_url": "http://creativecommons.org/licenses/by/4.0/"}
            )
        )

    def test_genre_fallback_is_explicit_and_missing_metadata_remains_missing(self):
        genres = {
            "1": {"title": "Rock", "top_level": "1"},
            "2": {"title": "Jazz", "top_level": "2"},
        }
        ids, names, primary = expansion.genre_data({("track", "genres_all"): "[2, 1]"}, genres)
        self.assertEqual((ids, names, primary), (["1", "2"], ["Jazz", "Rock"], "Jazz"))
        self.assertEqual(expansion.genre_data({}, genres), ([], [], "Unknown"))
        with self.assertRaisesRegex(ValueError, "Invalid or unknown"):
            expansion.genre_data({("track", "genres_all"): "[99]"}, genres)

    def test_published_artifacts_are_hash_verified_before_identity_reuse(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "test").mkdir()
            data = canonical([{"id": "fma:000012"}]) + b"\n"
            (root / "test/tracks.json").write_bytes(data)
            manifest = {
                "trackCount": 1,
                "files": {
                    "tracks": {"path": "tracks.json", "sha256": hashlib.sha256(data).hexdigest()}
                },
            }
            raw = canonical(manifest) + b"\n"
            (root / "test/manifest.json").write_bytes(raw)
            (root / "current.json").write_text(
                json.dumps(
                    {
                        "status": "ready",
                        "catalogVersion": "test",
                        "manifestSha256": hashlib.sha256(raw).hexdigest(),
                    }
                )
            )
            self.assertEqual(expansion.active_catalog(root)[1], [{"id": "fma:000012"}])
            (root / "test/tracks.json").write_text("[]")
            with self.assertRaisesRegex(ValueError, "metadata hash mismatch"):
                expansion.active_catalog(root)

    def test_full_audit_preserves_ids_and_augments_future_baseline_credits(self):
        tracks = {
            str(i): {("set", "subset"): name, ("artist", "id"): str(i)}
            for i, name in enumerate(expansion.SUBSETS, 1)
        }
        originals = {str(i): original(str(i), str(i), str(10 + i)) for i in range(1, 4)}
        old, _ = source.record_for("1", tracks["1"], originals["1"])
        old.pop("audioPath")
        source_info = {"metadataLicense": {"statement": "Fixture"}, "termsUrls": []}
        albums = {"11": {"album_producer": "Additional Producer"}}
        active = {"sources": [source_info]}
        with (
            patch("expansion.source.read_members", return_value=(tracks, originals)),
            patch("expansion.read_auxiliary", return_value=(albums, {}, {})),
            patch("expansion.active_catalog", return_value=(active, [old], {"trackCount": 1})),
            patch("expansion.EXPECTED_COUNTS", {"small": 1, "medium": 2, "large": 3}),
            patch("expansion.source.digest", return_value="a" * 64),
        ):
            manifest, report, selection, _ = expansion.audit(
                Path("fixture.zip"), Path("fixture"), target=3
            )
        self.assertEqual(
            [r["provenance"]["datasetId"] for r in selection["records"]],
            ["fma-small", "fma-medium", "fma-large"],
        )
        self.assertEqual(manifest["selectedTotal"], 3)
        self.assertEqual(
            [
                report["cumulativeSubsets"][s]["metadataRecordsConsidered"]
                for s in expansion.SUBSETS
            ],
            [1, 2, 3],
        )
        current = selection["records"][0]
        self.assertEqual(current["id"], old["id"])
        self.assertEqual(
            current["provenance"]["recordingLicense"]["url"],
            old["provenance"]["recordingLicense"]["url"],
        )
        self.assertTrue(
            current["provenance"]["recordingLicense"]["attribution"].startswith(
                old["provenance"]["recordingLicense"]["attribution"]
            )
        )
        self.assertIn(
            "Additional Producer", current["provenance"]["recordingLicense"]["attribution"]
        )
        self.assertNotIn(
            "Additional Producer", old["provenance"]["recordingLicense"]["attribution"]
        )

    def test_materialize_mismatch_writes_no_outputs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.json"
            manifest.write_text(
                json.dumps(
                    {
                        "sourceSubset": "large",
                        "selectionPolicy": {"targetTotal": 5000, "sourceArtistCap": 50},
                    }
                )
            )
            args = [
                "expansion.py",
                "materialize",
                "--metadata-archive",
                "fixture.zip",
                "--manifest",
                str(manifest),
                "--selection",
                str(root / "selection.json"),
                "--evidence",
                str(root / "evidence.json"),
            ]
            with (
                patch.object(sys, "argv", args),
                patch("expansion.audit", return_value=({}, {}, {}, {})),
            ):
                with self.assertRaisesRegex(ValueError, "no longer reproduces"):
                    expansion.main()
            self.assertFalse((root / "selection.json").exists())
            self.assertFalse((root / "evidence.json").exists())


if __name__ == "__main__":
    unittest.main()
