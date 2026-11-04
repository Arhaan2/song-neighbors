"""Isolated mathematical fixtures only: never exported to public/ or presented as inference."""

import argparse
import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import catalog


def fixture_entry(audio_sha="a" * 64, config_sha="b" * 64):
    vector = [0.6, 0.8]
    data = catalog.vector_bytes(vector)
    return {
        "schemaVersion": 1,
        "pipeline": {"sourceCommit": "c" * 40, "sourceTreeSha256": "d" * 64, "dirty": True},
        "dependencyLockSha256": "e" * 64,
        "audioSha256": audio_sha,
        "configurationSha256": config_sha,
        "cacheKeySha256": catalog.cache_key(audio_sha, config_sha),
        "vector": vector,
        "dimension": 2,
        "vectorSha256": catalog.sha(data),
        "coverage": {
            "sourceDurationSeconds": 12,
            "analyzedWindows": [
                {"startSeconds": 0, "endSeconds": 10},
                {"startSeconds": 10, "endSeconds": 12},
            ],
            "describes": "available-audio-excerpt",
        },
    }


def record(identifier, path):
    return {
        "id": identifier,
        "title": "Test-only fixture",
        "artist": "Test-only fixture",
        "audioPath": path,
        "provenance": {
            "datasetId": "test",
            "datasetVersion": "fixture",
            "sourceRecordId": identifier,
            "sourcePage": "https://example.org/test-only",
            "publicationBasis": "Isolated test fixture, no actual recording or rights claim.",
            "recordingLicense": {
                "statement": "CC BY 4.0 fixture",
                "url": "https://creativecommons.org/licenses/by/4.0/",
                "attribution": "Test-only fixture",
            },
        },
    }


class CacheTests(unittest.TestCase):
    def test_source_or_configuration_change_invalidates_cache(self):
        entry = fixture_entry()
        catalog.validate_entry(entry, "a" * 64, "b" * 64)
        with self.assertRaises(ValueError):
            catalog.validate_entry(entry, "c" * 64, "b" * 64)
        with self.assertRaises(ValueError):
            catalog.validate_entry(entry, "a" * 64, "c" * 64)
        self.assertNotEqual(
            catalog.cache_key("a" * 64, "b" * 64), catalog.cache_key("a" * 64, "c" * 64)
        )

    def test_corrupt_or_incompatible_cache_never_reused(self):
        mutations = [
            lambda e: e.update(vector=[0, 0]),
            lambda e: e.update(vector=[float("nan"), 1]),
            lambda e: e.update(dimension=3),
            lambda e: e.update(vectorSha256="0" * 64),
            lambda e: e["coverage"]["analyzedWindows"][1].update(endSeconds=20),
        ]
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                entry = fixture_entry()
                mutate(entry)
                with self.assertRaises((ValueError, OverflowError)):
                    catalog.validate_entry(entry, "a" * 64, "b" * 64)
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "entry.json"
            path.write_text('{"partial":')
            self.assertIsNone(catalog.load_cache(path, "a" * 64, "b" * 64))

    def test_pinned_model_artifacts_reject_altered_weights(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            catalog.write_json(
                root / "download-identity.json",
                {
                    "id": catalog.MODEL_ID,
                    "revision": catalog.MODEL_REVISION,
                },
            )
            for name in catalog.MODEL_ARTIFACT_HASHES:
                (root / name).write_bytes(b"altered model fixture")
            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                catalog.model_artifacts(root)

    def test_little_endian_and_normalization(self):
        self.assertEqual(catalog.vector_bytes([1.0, 0.0]), b"\x00\x00\x80?\x00\x00\x00\x00")
        self.assertEqual(catalog.unit([3, 4]), [0.6, 0.8])
        for value in [[], [0, 0], [float("inf"), 1]]:
            with self.assertRaises(ValueError):
                catalog.unit(value)

    def test_canonical_digest_agrees_on_integral_numbers(self):
        self.assertEqual(catalog.canonical({"z": 10.0, "a": "é"}), '{"a":"é","z":10}'.encode())

    def test_atomic_file_replacement_and_path_safety(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            path = root / "entry.json"
            catalog.write_json(path, {"old": True})
            with patch("catalog.os.replace", side_effect=OSError("simulated interruption")):
                with self.assertRaises(OSError):
                    catalog.write_json(path, {"new": True})
            self.assertEqual(catalog.read_json(path), {"old": True})
            self.assertFalse(list(root.glob("*.tmp")))
            for name in ["../secret", "/private/audio.wav"]:
                with self.assertRaises(ValueError):
                    catalog.safe_audio_path(root, name)

    def test_policy_rejects_nc_sa_nd_and_missing_evidence(self):
        valid = record("test:one", "one.wav")
        catalog.eligible_record(valid)
        for url in [
            "https://creativecommons.org/licenses/by-nc/4.0/",
            "https://creativecommons.org/licenses/by-sa/4.0/",
            "https://creativecommons.org/licenses/by-nd/4.0/",
            "Attribution",
        ]:
            invalid = copy.deepcopy(valid)
            invalid["provenance"]["recordingLicense"]["url"] = url
            with self.assertRaises(ValueError):
                catalog.eligible_record(invalid)

    def test_resume_skips_compatible_cache_and_retries_failure(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "one.wav").write_bytes(b"isolated test fixture, not audio")
            selection = root / "selection.json"
            catalog.write_json(
                selection,
                {"records": [record("test:one", "one.wav"), record("test:two", "two.wav")]},
            )
            args = argparse.Namespace(
                selection=selection, cache=root, audio_root=root, limit=None, run="test", threads=1
            )
            fake = unittest.mock.MagicMock()
            fake.extract.return_value = ([0.6, 0.8], fixture_entry()["coverage"])
            with (
                patch("catalog.model_artifacts", return_value=[]),
                patch("catalog.load_configuration", return_value=({"test": True}, {})),
                patch("catalog.get_versions", return_value={}),
                patch("catalog.Encoder", return_value=fake) as encoder,
            ):
                self.assertEqual(catalog.extract(args), 1)
                first = catalog.read_json(root / "runs/test.json")
                self.assertEqual((first["inferred"], len(first["failures"])), (1, 1))
                (root / "two.wav").write_bytes(b"different isolated test fixture")
                self.assertEqual(catalog.extract(args), 0)
                second = catalog.read_json(root / "runs/test.json")
                self.assertEqual((second["cacheHits"], second["inferred"]), (1, 1))
                self.assertEqual(catalog.extract(args), 0)
                third = catalog.read_json(root / "runs/test.json")
                self.assertEqual((third["cacheHits"], third["inferred"]), (2, 0))
                self.assertEqual(encoder.call_count, 2)
                self.assertEqual(fake.extract.call_count, 2)
                # Mutated source bytes must trigger fresh extraction, never stale reuse.
                (root / "one.wav").write_bytes(b"changed fixture")
                self.assertEqual(catalog.extract(args), 0)
                self.assertEqual(fake.extract.call_count, 3)
                self.assertNotIn(str(root), json.dumps(third))


if __name__ == "__main__":
    unittest.main()
