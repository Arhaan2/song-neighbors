"""Bind an expanded export to the approved selection and actual successful processing.

No inference, audio access, or cache mutation. Detailed failed stderr remains private.
A receipt is published only after independent TypeScript validation of its exact bytes.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import tempfile
from pathlib import Path

import catalog


def indexed(records, label):
    result = {}
    for record in records:
        identifier = record["id"]
        if identifier in result:
            raise ValueError(f"Duplicate {label} ID: {identifier}")
        result[identifier] = record
    return result


def run_snapshot(path):
    serialized = Path(path).read_bytes()
    return {"sha256": catalog.sha(serialized), "serialized": serialized.decode("utf-8")}


def prepare_evidence(
    candidate_path,
    selection_path,
    effective_path,
    run_path,
    catalog_path,
    exclusions_path=None,
    attempt_paths=(),
):
    candidate = catalog.read_json(candidate_path)
    selection = catalog.read_json(selection_path)
    effective = catalog.read_json(effective_path)
    if catalog.file_sha(selection_path) != candidate["materializedSelectionSha256"]:
        raise ValueError("Original selection does not match the approved candidate manifest")
    original = indexed(selection["records"], "candidate")
    approved_ids = set(indexed(candidate["records"], "manifest"))
    if set(original) != approved_ids:
        raise ValueError("Candidate manifest and materialized selection IDs disagree")
    kept = indexed(effective["records"], "effective")
    if not kept or not set(kept) <= approved_ids:
        raise ValueError("Effective selection contains unexpected IDs or is empty")
    for identifier, record in kept.items():
        if record != original[identifier]:
            raise ValueError(f"Effective selection changed approved metadata: {identifier}")
    if {k: v for k, v in selection.items() if k != "records"} != {
        k: v for k, v in effective.items() if k != "records"
    }:
        raise ValueError("Effective selection changed source metadata or policy")
    if list(kept) != sorted(kept):
        raise ValueError("Effective selection must retain stable ID order")
    if effective_path.read_bytes() != catalog.canonical(effective) + b"\n":
        raise ValueError("Effective selection must use canonical JSON plus final LF")
    exclusions = catalog.read_json(exclusions_path) if exclusions_path else []
    exclusions_by_id = indexed(exclusions, "exclusion")
    if set(exclusions_by_id) != approved_ids - set(kept):
        raise ValueError("Every omitted candidate needs an explicit exclusion; no extras allowed")
    public_exclusions = []
    for identifier, exclusion in sorted(exclusions_by_id.items()):
        if "record" in exclusion:
            raise ValueError("Exclusion metadata is reconstructed from the original selection")
        if exclusion["kind"] == "processing-failure" and exclusion.get("stage") not in {
            "decode-or-inference",
            "inferred-vector-validation",
        }:
            raise ValueError("Storage, acquisition, or environment failures remain blockers")
        public_exclusions.append({**exclusion, "record": original[identifier]})
    run = catalog.read_json(run_path)
    if run["selectionSha256"] != catalog.file_sha(effective_path):
        raise ValueError("Final run does not bind the effective selection")
    if run.get("failures") or run.get("status", "complete") != "complete":
        raise ValueError("Final run has unresolved failures or is incomplete")
    if set(indexed(run["rows"], "run")) != set(kept):
        raise ValueError("Final run is missing effective IDs or contains unexpected IDs")
    if run["cacheHits"] + run["inferred"] != len(kept):
        raise ValueError("Final run success accounting mismatch")
    attempts = [run_snapshot(path) for path in attempt_paths]
    if len({attempt["sha256"] for attempt in attempts}) != len(attempts):
        raise ValueError("Duplicate processing attempt")
    if {attempt["sha256"] for attempt in attempts} != {
        exclusion["runSha256"] for exclusion in exclusions
    }:
        raise ValueError("Unreferenced or missing processing attempt")
    return {
        "schemaVersion": 1,
        "kind": "song-neighbors-expanded-release-evidence",
        "candidateManifestSha256": catalog.file_sha(candidate_path),
        "catalogManifestSha256": catalog.file_sha(catalog_path / "manifest.json"),
        "effectiveSelectionSha256": catalog.file_sha(effective_path),
        "finalRun": run_snapshot(run_path),
        "attempts": sorted(attempts, key=lambda item: item["sha256"]),
        "exclusions": public_exclusions,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ["candidate", "selection", "effective-selection", "run", "catalog", "output"]:
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--exclusions", type=Path)
    parser.add_argument("--attempt", type=Path, action="append", default=[])
    args = parser.parse_args()
    if args.output.exists():
        raise FileExistsError("Release evidence is immutable; choose an unused catalog version")
    evidence = prepare_evidence(
        args.candidate,
        args.selection,
        args.effective_selection,
        args.run,
        args.catalog,
        args.exclusions,
        args.attempt,
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(
        prefix=".release-evidence-", dir=args.output.parent
    ) as temporary:
        staged = Path(temporary) / "evidence.json"
        catalog.write_json(staged, evidence)
        subprocess.run(
            [
                "node",
                str(catalog.ROOT / "scripts/catalog-release-evidence.ts"),
                "--catalog",
                str(args.catalog),
                "--evidence",
                str(staged),
                "--candidate",
                str(args.candidate),
            ],
            check=True,
            cwd=catalog.ROOT,
        )
        # Same-filesystem hard link publishes the fully fsynced file atomically and exclusively.
        os.link(staged, args.output)
    print(json.dumps({"receiptSha256": catalog.file_sha(args.output), "status": "verified"}))


if __name__ == "__main__":
    main()
