"""Measure the active export and estimate candidate delivery without inventing vectors."""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path

import catalog


def measure(root: Path, selection: dict) -> dict:
    pointer = catalog.read_json(root / "current.json")
    directory = root / pointer["catalogVersion"]
    manifest = catalog.read_json(directory / "manifest.json")
    tracks = catalog.read_json(directory / "tracks.json")
    names = ["manifest.json", "tracks.json", "embeddings.f32", "build.json", "ATTRIBUTION.md"]
    files = {name: (directory / name).read_bytes() for name in names}
    files["current.json"] = (root / "current.json").read_bytes()
    count, dimension = len(selection["records"]), manifest["dimension"]
    keys = ("id", "title", "artist", "album", "recordingGroupId", "provenance")

    def public_metadata(record):
        result = {key: record[key] for key in keys if key in record}
        result["provenance"] = {k: v for k, v in result["provenance"].items() if k != "audioSha256"}
        return result

    # Exact candidate metadata text, plus measured per-row coverage/hash/row syntax overhead.
    old_metadata = len(catalog.canonical([public_metadata(track) for track in tracks])) + 1
    new_metadata = (
        len(catalog.canonical([public_metadata(track) for track in selection["records"]])) + 1
    )
    tracks_estimate = round(
        new_metadata + (len(files["tracks.json"]) - old_metadata) * count / len(tracks)
    )
    estimates = {
        "tracks.json": tracks_estimate,
        "embeddings.f32": count * dimension * 4,
        "build.json": round(len(files["build.json"]) * count / len(tracks)),
        "manifest.json": len(files["manifest.json"]),
        "current.json": len(files["current.json"]),
    }
    attribution = files["ATTRIBUTION.md"].decode().split("## Recordings")[0] + "## Recordings\n"
    for record in selection["records"]:
        provenance = record["provenance"]
        grant = provenance["recordingLicense"]
        attribution += (
            f"\n### {record['id']}\n\n{grant['attribution']}\n\n"
            f"Source: {provenance['sourcePage']}\n\n"
            f"License: [{grant['statement']}]({grant['url']})\n\n"
            f"{provenance['publicationBasis']}\n"
        )
    estimates["ATTRIBUTION.md"] = len(attribution.encode())
    return {
        "schemaVersion": 1,
        "baseline": {
            "catalogVersion": pointer["catalogVersion"],
            "trackCount": len(tracks),
            "files": {
                k: {"bytes": len(v), "localGzipBytes": len(gzip.compress(v, mtime=0))}
                for k, v in files.items()
            },
            "runtimeRawBytes": sum(len(v) for k, v in files.items() if k != "ATTRIBUTION.md"),
        },
        "candidateEstimate": {
            "trackCount": count,
            "dimension": dimension,
            "filesBytes": estimates,
            "runtimeRawBytes": sum(v for k, v in estimates.items() if k != "ATTRIBUTION.md"),
            "versionAndPointerBytes": sum(estimates.values()),
            "workerFloat64VectorBytes": count * dimension * 8,
            "initializationTwoFloat64ArraysBytes": count * dimension * 16,
            "method": (
                "Candidate metadata text measured; coverage/audio-hash/row overhead and build "
                "scale from active export; manifest/pointer held constant; attribution uses "
                "candidate notices with baseline metadata header. Vector size is exact conditional "
                "on count and unchanged dimension. No vectors or future coverage are generated."
            ),
            "limits": (
                "Estimates exclude JS object/string/map overhead, transient JSON parsing/hash "
                "copies, browser/worker runtime and future notice corrections. gzip measures local "
                "compression only, not server transfer encoding. Candidate stages have not passed "
                "audio checks."
            ),
        },
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--catalog-root", type=Path, default=catalog.ROOT / "public/catalog")
    parser.add_argument("--selection", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result = measure(args.catalog_root, catalog.read_json(args.selection))
    if args.output:
        catalog.write_json(args.output, result)
    else:
        print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
