"""Preflight must fail closed without invoking the model."""

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import catalog
import preflight


class PreflightTests(unittest.TestCase):
    def test_verified_cache_and_config_drift_or_missing_cache(self):
        original = catalog.ROOT / "public/catalog/fma-small-clap-general-20261104"
        manifest = catalog.read_json(original / "manifest.json")
        config = {k: manifest[k] for k in ("encoder", "preprocessing", "windowing", "aggregation")}
        config_sha = catalog.sha(catalog.canonical(config))
        track = catalog.read_json(original / "tracks.json")[0]
        row = catalog.read_json(original / "build.json")["rows"][0]
        data = (original / "embeddings.f32").read_bytes()[: manifest["dimension"] * 4]
        vector, _ = catalog.decode_vector(data, manifest["dimension"])
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            version = root / manifest["catalogVersion"]
            version.mkdir()
            audio = root / "003/003832.mp3"
            audio.parent.mkdir()
            audio.write_bytes(b"test-only source identity, never decoded")
            audio_sha = catalog.file_sha(audio)
            track["provenance"]["audioSha256"] = audio_sha
            row["audioSha256"] = audio_sha
            entry = {
                "schemaVersion": 1,
                "pipeline": row["extractionPipeline"],
                "dependencyLockSha256": row["dependencyLockSha256"],
                "audioSha256": audio_sha,
                "configurationSha256": config_sha,
                "cacheKeySha256": catalog.cache_key(audio_sha, config_sha),
                "vector": vector,
                "dimension": manifest["dimension"],
                "vectorSha256": catalog.sha(data),
                "coverage": track["coverage"],
            }
            entry_path = root / "embeddings" / (entry["cacheKeySha256"] + ".json")
            catalog.write_json(entry_path, entry)
            catalog.write_json(version / "tracks.json", [track])
            catalog.write_json(version / "build.json", {"rows": [row]})
            (version / "embeddings.f32").write_bytes(data)
            (version / "ATTRIBUTION.md").write_text("Test-only preflight artifact")
            manifest["trackCount"] = 1
            for artifact in manifest["files"].values():
                path = version / artifact["path"]
                artifact.update(bytes=path.stat().st_size, sha256=catalog.file_sha(path))
            catalog.write_json(version / "manifest.json", manifest)
            catalog.write_json(
                root / "current.json",
                {
                    "status": "ready",
                    "catalogVersion": manifest["catalogVersion"],
                    "manifestSha256": catalog.file_sha(version / "manifest.json"),
                },
            )
            with (
                patch("catalog.model_artifacts", return_value=[]),
                patch("catalog.load_configuration", return_value=(config, {})),
                patch("catalog.Encoder", side_effect=AssertionError("Inference forbidden")),
            ):
                result = preflight.verify(root, root, root)
                self.assertEqual(result["compatibleCacheHits"], 1)
                self.assertFalse(result["inferencePerformed"])
                entry_path.unlink()
                result = preflight.verify(root, root, root)
                self.assertEqual(result["compatibleCacheHits"], 0)
                self.assertEqual(len(result["failures"]), 1)
            changed = copy.deepcopy(config)
            changed["windowing"]["durationSeconds"] = 5
            with (
                patch("catalog.model_artifacts", return_value=[]),
                patch("catalog.load_configuration", return_value=(changed, {})),
            ):
                with self.assertRaisesRegex(ValueError, "differs from active"):
                    preflight.verify(root, root, root)
            (version / "embeddings.f32").write_bytes(b"corrupt")
            with self.assertRaisesRegex(ValueError, "artifact identity mismatch"):
                preflight.verify(root, root, root)
        self.assertNotIn("/Users/", json.dumps(result))


if __name__ == "__main__":
    unittest.main()
