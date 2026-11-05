"""Selection/run proof generation uses isolated fixtures, never performs inference."""

import copy
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import catalog
import processing_evidence


class ProcessingEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.selection = {
            "schemaVersion": 1,
            "sources": [],
            "metadata": {},
            "policy": {},
            "records": [
                {"id": "fma:000001", "title": "Isolated fixture one"},
                {"id": "fma:000002", "title": "Isolated fixture two"},
            ],
        }
        catalog.write_json(self.root / "original.json", self.selection)
        catalog.write_json(self.root / "effective.json", self.selection)
        self.candidate = {
            "records": [{"id": record["id"]} for record in self.selection["records"]],
            "materializedSelectionSha256": catalog.file_sha(self.root / "original.json"),
        }
        catalog.write_json(self.root / "candidate.json", self.candidate)
        catalog.write_json(self.root / "manifest.json", {"catalogVersion": "isolated-fixture"})
        self.run = {
            "selectionSha256": catalog.file_sha(self.root / "effective.json"),
            "status": "complete",
            "cacheHits": 2,
            "inferred": 0,
            "failures": [],
            "rows": [{"id": record["id"]} for record in self.selection["records"]],
        }
        self.write_run()

    def write_run(self):
        catalog.write_json(self.root / "run.json", self.run)

    def prepare(self, **kwargs):
        return processing_evidence.prepare_evidence(
            self.root / "candidate.json",
            self.root / "original.json",
            self.root / "effective.json",
            self.root / "run.json",
            self.root,
            **kwargs,
        )

    def test_binds_exact_run_bytes_and_refuses_changed_original_or_effective_metadata(self):
        evidence = self.prepare()
        self.assertEqual(evidence["finalRun"]["sha256"], catalog.file_sha(self.root / "run.json"))
        self.assertEqual(
            evidence["finalRun"]["serialized"].encode(), (self.root / "run.json").read_bytes()
        )
        altered = copy.deepcopy(self.selection)
        altered["records"][0]["title"] = "Not the approved metadata"
        catalog.write_json(self.root / "effective.json", altered)
        with self.assertRaisesRegex(ValueError, "changed approved metadata"):
            self.prepare()
        catalog.write_json(self.root / "original.json", altered)
        with self.assertRaisesRegex(ValueError, "does not match the approved"):
            self.prepare()

    def test_missing_records_require_evidenced_exclusions_and_cannot_be_storage_shortfalls(self):
        effective = {**self.selection, "records": self.selection["records"][:1]}
        catalog.write_json(self.root / "effective.json", effective)
        with self.assertRaisesRegex(ValueError, "Every omitted candidate"):
            self.prepare()
        exclusions = [
            {
                "id": "fma:000002",
                "kind": "processing-failure",
                "stage": "source-audio",
                "category": "missing-audio",
                "runSha256": "a" * 64,
            }
        ]
        catalog.write_json(self.root / "exclusions.json", exclusions)
        with self.assertRaisesRegex(ValueError, "remain blockers"):
            self.prepare(exclusions_path=self.root / "exclusions.json")

    def test_final_run_must_be_complete_and_exactly_cover_effective_selection(self):
        self.run["rows"].pop()
        self.run["cacheHits"] = 1
        self.write_run()
        with self.assertRaisesRegex(ValueError, "missing effective IDs"):
            self.prepare()
        self.run["rows"].append({"id": "fma:000002"})
        self.run["cacheHits"] = 2
        self.run["status"] = "interrupted"
        self.write_run()
        with self.assertRaisesRegex(ValueError, "incomplete"):
            self.prepare()

    def test_selection_order_duplicates_and_serialization_cannot_hide_drift(self):
        altered = copy.deepcopy(self.selection)
        altered["records"].reverse()
        catalog.write_json(self.root / "effective.json", altered)
        with self.assertRaisesRegex(ValueError, "stable ID order"):
            self.prepare()
        altered["records"] = [self.selection["records"][0]] * 2
        catalog.write_json(self.root / "effective.json", altered)
        with self.assertRaisesRegex(ValueError, "Duplicate effective ID"):
            self.prepare()
        (self.root / "effective.json").write_bytes(catalog.canonical(self.selection))
        with self.assertRaisesRegex(ValueError, "canonical JSON plus final LF"):
            self.prepare()


if __name__ == "__main__":
    unittest.main()
