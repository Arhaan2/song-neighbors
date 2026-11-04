"""Phase 1 capacity diagnostic on a validated real export, not the Phase 2 ranking engine."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import struct
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DISCLAIMER = (
    "Phase 1 offline capacity diagnostic only: arithmetic mean of five seed cosine scores. "
    "This is not the Phase 2 production recommendation engine, a musical-quality evaluation, "
    "or a public acoustic-demo pass. The 100-recording/10-artist floor is an engineering "
    "scope choice, not proof of musical quality."
)


def recording_key(track: dict) -> tuple[str, str]:
    """Honor verified recording groups; otherwise use exact source audio identity."""
    group = track.get("recordingGroupId")
    return ("group", group) if group else ("audio", track["provenance"]["audioSha256"])


def coverage(catalog: Path) -> dict:
    catalog = catalog.resolve()
    manifest_bytes = (catalog / "manifest.json").read_bytes()
    validation = subprocess.run(
        [
            "node",
            "scripts/validate-catalog.ts",
            "--root",
            str(catalog.parent),
            "--version",
            catalog.name,
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    validated = json.loads(validation.stdout)
    if validated.get("status") != "valid":
        raise ValueError("Validator did not confirm a valid catalog")
    if (catalog / "manifest.json").read_bytes() != manifest_bytes:
        raise ValueError("Manifest changed during validation")
    manifest = json.loads(manifest_bytes)
    track_bytes = (catalog / "tracks.json").read_bytes()
    tracks = json.loads(track_bytes)
    raw = (catalog / "embeddings.f32").read_bytes()
    # Bind the exact bytes used below to the manifest just validated, including row mapping.
    for name, data in (("tracks", track_bytes), ("embeddings", raw)):
        if hashlib.sha256(data).hexdigest() != manifest["files"][name]["sha256"]:
            raise ValueError("Catalog changed after validation")
    if validated["catalogVersion"] != manifest["catalogVersion"]:
        raise ValueError("Catalog version changed after validation")
    dimension = manifest["dimension"]
    vectors = list(struct.iter_unpack(f"<{dimension}f", raw))
    if len(vectors) != len(tracks):
        raise ValueError("Vector and metadata row count mismatch")

    seeds, seed_artists, seed_recordings = [], set(), set()
    for track in tracks:
        identity = recording_key(track)
        if track["artist"] in seed_artists or identity in seed_recordings:
            continue
        seeds.append(track)
        seed_artists.add(track["artist"])
        seed_recordings.add(identity)
        if len(seeds) == 5:
            break
    if len(seeds) != 5:
        raise ValueError("Need five distinct recordings from five different artist names")

    further = []
    excluded_recordings = set(seed_recordings)
    excluded_hashes = {track["provenance"]["audioSha256"] for track in seeds}
    for track in tracks:
        if (
            recording_key(track) in excluded_recordings
            or track["provenance"]["audioSha256"] in excluded_hashes
        ):
            continue
        further.append(track)
        excluded_recordings.add(recording_key(track))
        excluded_hashes.add(track["provenance"]["audioSha256"])
        if len(further) == 2:
            break
    if len(further) != 2:
        raise ValueError("Need two additional eligible records to demonstrate explicit exclusions")

    def excluded(track):
        return (
            recording_key(track) in excluded_recordings
            or track["provenance"]["audioSha256"] in excluded_hashes
        )

    candidates = [track for track in tracks if not excluded(track)]
    mean_seed = [
        sum(vectors[seed["row"]][column] for seed in seeds) / len(seeds)
        for column in range(dimension)
    ]
    ranked = []
    for track in candidates:
        score = sum(
            value * anchor for value, anchor in zip(vectors[track["row"]], mean_seed, strict=True)
        )
        if not math.isfinite(score):
            raise ValueError("Nonfinite diagnostic score")
        ranked.append((score, track))
    ranked.sort(key=lambda pair: (-pair[0], pair[1]["id"]))
    results, result_recordings, result_hashes = [], set(), set()
    for score, track in ranked:
        identity = recording_key(track)
        audio_hash = track["provenance"]["audioSha256"]
        if identity in result_recordings or audio_hash in result_hashes:
            continue
        results.append({"id": track["id"], "score": score})
        result_recordings.add(identity)
        result_hashes.add(audio_hash)
        if len(results) == 20:
            break
    if len(results) != 20:
        raise ValueError("Fewer than twenty distinct recordings remain after exclusions")

    recordings = len({recording_key(track) for track in tracks})
    artists = len({track["artist"] for track in tracks})
    return {
        "schemaVersion": 1,
        "catalogVersion": manifest["catalogVersion"],
        "manifestSha256": hashlib.sha256(manifest_bytes).hexdigest(),
        "diagnosticDisclaimer": DISCLAIMER,
        "selectionPolicy": (
            "First five stable-ID-ordered distinct recordings with different artist display "
            "names; next two eligible recordings are explicit positive/negative exclusions. "
            "Exclude their exact audio hashes and verified recording groups. Rank remaining "
            "rows by arithmetic mean seed cosine, break ties by stable ID, and deduplicate "
            "exact audio hashes and verified recording groups."
        ),
        "counts": {
            "analyzedTracks": len(tracks),
            "distinctRecordings": recordings,
            "distinctAudioHashes": len({track["provenance"]["audioSha256"] for track in tracks}),
            "distinctArtistDisplayNames": artists,
            "dimension": dimension,
            "candidatesAfterExclusions": len(candidates),
            "distinctCandidatesAfterExclusions": len(
                {recording_key(track) for track in candidates}
            ),
            "seedCount": len(seeds),
            "furtherExplicitExclusionCount": len(further),
            "resultCount": len(results),
        },
        "publicBetaCoverageFloor": {
            "minimumDistinctRecordings": 100,
            "minimumArtists": 10,
            "fiveSeedTwentyResultCasePassed": True,
            "passed": recordings >= 100 and artists >= 10,
        },
        "seeds": [{"id": track["id"], "artist": track["artist"]} for track in seeds],
        "furtherExplicitExclusions": [
            {"id": further[0]["id"], "role": "positive-feedback-exclusion"},
            {"id": further[1]["id"], "role": "negative-feedback-exclusion"},
        ],
        "excludedIds": [track["id"] for track in tracks if excluded(track)],
        "results": results,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    report = coverage(args.catalog)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(args.output.name + f".{os.getpid()}.tmp")
    try:
        with temporary.open("w", encoding="utf-8") as stream:
            json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, args.output)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({"counts": report["counts"], "floor": report["publicBetaCoverageFloor"]}))
    return 0 if report["publicBetaCoverageFloor"]["passed"] else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        raise SystemExit(f"Catalog validation failed: {error.stderr.strip()}") from error
    except (OSError, ValueError, KeyError, struct.error) as error:
        raise SystemExit(f"Capacity diagnostic failed: {error}") from error
