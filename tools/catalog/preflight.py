"""Verify active embedding compatibility and reusable caches without audio inference."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import catalog


def verify(cache: Path, audio_root: Path, catalog_root: Path) -> dict:
    pointer = catalog.read_json(catalog_root / "current.json")
    if pointer["status"] != "ready":
        raise ValueError("A ready baseline catalog is required")
    version_root = catalog_root / pointer["catalogVersion"]
    manifest_path = version_root / "manifest.json"
    if catalog.file_sha(manifest_path) != pointer["manifestSha256"]:
        raise ValueError("Active manifest hash mismatch")
    manifest = catalog.read_json(manifest_path)
    for name in ("tracks", "build", "embeddings", "attribution"):
        file = manifest["files"][name]
        path = version_root / file["path"]
        if path.stat().st_size != file["bytes"] or catalog.file_sha(path) != file["sha256"]:
            raise ValueError(f"Active artifact identity mismatch: {name}")
    catalog.model_artifacts(cache / "model")
    config, _ = catalog.load_configuration(cache / "model")
    expected = {
        key: manifest[key] for key in ("encoder", "preprocessing", "windowing", "aggregation")
    }
    if config != expected:
        raise ValueError(
            "Runtime/configuration differs from active manifest; do not mix embeddings"
        )
    config_sha = catalog.sha(catalog.canonical(config))
    tracks = catalog.read_json(version_root / manifest["files"]["tracks"]["path"])
    build = catalog.read_json(version_root / manifest["files"]["build"]["path"])
    if len(tracks) != manifest["trackCount"] or len(build["rows"]) != len(tracks):
        raise ValueError("Baseline row count mismatch")
    vector_data = (version_root / manifest["files"]["embeddings"]["path"]).read_bytes()
    reusable, failures = 0, []
    for track, row in zip(tracks, build["rows"], strict=True):
        try:
            tid = f"{int(track['provenance']['sourceRecordId']):06d}"
            if track["id"] != f"fma:{tid}" or row["id"] != track["id"]:
                raise ValueError("Baseline identity mismatch")
            audio = catalog.safe_audio_path(audio_root, f"{tid[:3]}/{tid}.mp3")
            audio_sha = catalog.file_sha(audio)
            if audio_sha != track["provenance"]["audioSha256"] or audio_sha != row["audioSha256"]:
                raise ValueError("Baseline audio differs")
            key = catalog.cache_key(audio_sha, config_sha)
            entry = catalog.load_cache(
                cache / "embeddings" / (key + ".json"), audio_sha, config_sha
            )
            if entry is None:
                raise ValueError("Compatible embedding cache missing or invalid")
            start = track["row"] * manifest["dimension"] * 4
            if (
                catalog.vector_bytes(entry["vector"])
                != vector_data[start : start + manifest["dimension"] * 4]
            ):
                raise ValueError("Cached vector differs from published vector")
            reusable += 1
        except (OSError, ValueError, KeyError, TypeError) as error:
            failures.append({"id": track["id"], "reason": type(error).__name__})
            print(f"{track['id']}: {error}", file=sys.stderr)
    return {
        "catalogVersion": pointer["catalogVersion"],
        "configurationSha256": config_sha,
        "baselineRecords": len(tracks),
        "compatibleCacheHits": reusable,
        "failures": failures,
        "inferencePerformed": False,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, default=catalog.DEFAULT_CACHE)
    parser.add_argument("--audio-root", type=Path, required=True)
    parser.add_argument("--catalog-root", type=Path, default=catalog.ROOT / "public/catalog")
    args = parser.parse_args()
    result = verify(args.cache, args.audio_root, args.catalog_root)
    print(json.dumps(result, indent=2))
    return 1 if result["failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
