"""Offline CLAP extraction. No synthetic production fallback; optional ML imports are lazy."""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import math
import os
import platform
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import time
from datetime import UTC, datetime
from pathlib import Path

# The initial music artifact was rejected after initialization-state weights were found.
# Publish only after the pinned replacement passes real inference and checkpoint verification.
MODEL_ID = "laion/larger_clap_general"
MODEL_REVISION = "ada0c23a36c4e8582805bb38fec3905903f18b41"
MODEL_WEIGHTS_SHA256 = "314eb00cce6ad68d25237b8446b659ccdb136ed4672c1bca470f142f72455026"
MODEL_ARTIFACT_HASHES = {
    "config.json": "6268f76a067e3104bf9001e97d7dcc0fcfb16f3086cfb478ee72d95900d7fc1d",
    "preprocessor_config.json": "9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753",
    "pytorch_model.bin": MODEL_WEIGHTS_SHA256,
}
SAMPLE_RATE = 48000
WINDOW_SAMPLES = 480000
ROOT = Path(__file__).resolve().parents[2]
DEFAULT_CACHE = ROOT / ".cache/catalog"
WINDOWING = {
    "version": "fixed-starts-0-10-20-v1",
    "durationSeconds": 10,
    "selectionPolicy": "Starts at 0, 10, and 20 seconds when start < decoded duration; "
    "analyzes at most first 30 seconds; no random crop.",
    "shortAudioPolicy": "Right zero-pad each partial 10-second window to 480000 samples; "
    "coverage excludes padding.",
}
AGGREGATION = {
    "version": "mean-unit-windows-v1",
    "method": "Arithmetic mean of L2-normalized window embeddings, followed by L2 normalization.",
    "windowNormalization": "l2",
    "finalNormalization": "l2",
}
ENCODER = {
    "id": MODEL_ID,
    "revision": MODEL_REVISION,
    "sourceUrl": f"https://huggingface.co/{MODEL_ID}/tree/{MODEL_REVISION}",
    "license": {
        "statement": "Apache License 2.0 (model repository declaration)",
        "url": "https://www.apache.org/licenses/LICENSE-2.0",
        "attribution": "LAION CLAP; Yusong Wu, Ke Chen, Tianyu Zhang, Yuchen Hui, "
        "Taylor Berg-Kirkpatrick, Shlomo Dubnov.",
    },
}


def canonical(value):
    """Sorted compact UTF-8; normalize integral floats for agreement with JavaScript."""

    def clean(item):
        if isinstance(item, float) and math.isfinite(item) and item.is_integer():
            return int(item)
        if isinstance(item, dict):
            return {key: clean(val) for key, val in item.items()}
        if isinstance(item, list):
            return [clean(val) for val in item]
        return item

    return json.dumps(
        clean(value), ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_sha(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def atomic_bytes(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + f".{os.getpid()}.tmp")
    try:
        with temporary.open("wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def write_json(path, value):
    atomic_bytes(path, canonical(value) + b"\n")


def unit(vector):
    values = [float(value) for value in vector]
    if not values or not all(math.isfinite(value) for value in values):
        raise ValueError("Empty or nonfinite embedding")
    norm = math.sqrt(sum(value * value for value in values))
    if not math.isfinite(norm) or norm == 0:
        raise ValueError("Zero or invalid embedding norm")
    return [value / norm for value in values]


def vector_bytes(vector):
    return struct.pack(f"<{len(vector)}f", *vector)


def decode_vector(data, dimension):
    if not isinstance(dimension, int) or dimension <= 0 or len(data) != dimension * 4:
        raise ValueError("Embedding byte count does not match dimension")
    vector = struct.unpack(f"<{dimension}f", data)
    if not all(math.isfinite(value) for value in vector):
        raise ValueError("Nonfinite embedding")
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0 or abs(norm - 1) > 0.0001:
        raise ValueError("Embedding is zero or not L2 normalized")
    return vector, norm


def cache_key(audio_sha, config_sha):
    return sha(canonical({"audioSha256": audio_sha, "configurationSha256": config_sha}))


def validate_entry(entry, audio_sha, config_sha):
    if entry.get("schemaVersion") != 1 or entry.get("audioSha256") != audio_sha:
        raise ValueError("Cache source mismatch")
    if entry.get("configurationSha256") != config_sha:
        raise ValueError("Cache configuration mismatch")
    if entry.get("cacheKeySha256") != cache_key(audio_sha, config_sha):
        raise ValueError("Cache key mismatch")
    origin = entry["pipeline"]
    if not re.fullmatch(r"[a-f0-9]{40}", origin["sourceCommit"]):
        raise ValueError("Cache extraction commit missing")
    if not re.fullmatch(r"[a-f0-9]{64}", origin["sourceTreeSha256"]):
        raise ValueError("Cache extraction source digest missing")
    if not isinstance(origin["dirty"], bool):
        raise ValueError("Cache extraction dirty status missing")
    if not re.fullmatch(r"[a-f0-9]{64}", entry["dependencyLockSha256"]):
        raise ValueError("Cache dependency lock digest missing")
    data = vector_bytes(entry["vector"])
    vector, norm = decode_vector(data, entry["dimension"])
    if sha(data) != entry["vectorSha256"]:
        raise ValueError("Cache vector hash mismatch")
    coverage = entry["coverage"]
    duration = coverage["sourceDurationSeconds"]
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid source duration")
    expected = [
        {"startSeconds": start, "endSeconds": min(start + 10, duration)}
        for start in [0, 10, 20]
        if start < duration
    ]
    if coverage != {
        "sourceDurationSeconds": duration,
        "analyzedWindows": expected,
        "describes": "available-audio-excerpt",
    }:
        raise ValueError("Cache coverage does not match fixed window policy")
    return data, vector, norm


def load_cache(path, audio_sha, config_sha):
    try:
        entry = read_json(path)
        validate_entry(entry, audio_sha, config_sha)
        return entry
    except (OSError, ValueError, KeyError, TypeError, OverflowError, struct.error):
        return None


def get_versions():
    names = ["torch", "transformers", "numpy", "soundfile", "soxr", "librosa", "huggingface-hub"]
    return {name: importlib.metadata.version(name) for name in names}


def load_configuration(model_dir):
    import soundfile
    import soxr

    processor_value = read_json(model_dir / "preprocessor_config.json")
    if processor_value["sampling_rate"] != SAMPLE_RATE:
        raise ValueError("Pinned processor sample rate changed")
    processor_serialized = canonical(processor_value)
    config = {
        "encoder": ENCODER,
        "preprocessing": {
            "sampleRateHz": SAMPLE_RATE,
            "runtimeLibraries": get_versions(),
            "dependencyLockSha256": file_sha(ROOT / "tools/catalog/uv.lock"),
            "implementationVersion": "song-neighbors-clap-v1",
            "channels": 1,
            "decoder": {
                "name": "soundfile/libsndfile",
                "version": f"{soundfile.__version__}/{soundfile.__libsndfile_version__}",
            },
            "resampler": {"name": "soxr-HQ", "version": soxr.__version__},
            "amplitudePolicy": "Decode float32; mean channels in float64 then float32; "
            "soxr HQ resample to 48000 Hz; no loudness or peak normalization; "
            "zero-pad windows; processor padding=pad and truncation=rand_trunc "
            "on exactly 480000 samples (no crop).",
            "processorConfigSha256": sha(processor_serialized),
        },
        "windowing": WINDOWING,
        "aggregation": AGGREGATION,
    }
    return config, {
        "id": MODEL_ID,
        "revision": MODEL_REVISION,
        "value": processor_value,
        "serialized": processor_serialized.decode("utf-8"),
        "sha256": sha(processor_serialized),
        "serialization": "json-sort-keys-compact-utf8-no-newline",
    }


def download_model(cache):
    from huggingface_hub import snapshot_download

    target = cache / "model"
    snapshot_download(
        MODEL_ID,
        revision=MODEL_REVISION,
        local_dir=target,
        allow_patterns=["*.json", "*.txt", "pytorch_model.bin", "README.md"],
    )
    write_json(target / "download-identity.json", {"id": MODEL_ID, "revision": MODEL_REVISION})
    return target


def model_artifacts(model_dir):
    identity = read_json(model_dir / "download-identity.json")
    if identity != {"id": MODEL_ID, "revision": MODEL_REVISION}:
        raise ValueError("Model download identity mismatch; run download-model")
    for name, expected_hash in MODEL_ARTIFACT_HASHES.items():
        if file_sha(model_dir / name) != expected_hash:
            raise ValueError(f"Pinned model artifact checksum mismatch: {name}")
    required = ["config.json", "preprocessor_config.json", "pytorch_model.bin"]
    return [
        {
            "path": name,
            "sha256": file_sha(model_dir / name),
            "bytes": (model_dir / name).stat().st_size,
        }
        for name in required
    ]


class Encoder:
    def __init__(self, model_dir, threads):
        import torch
        from transformers import ClapFeatureExtractor, ClapModel

        torch.set_num_threads(threads)
        torch.manual_seed(0)
        torch.use_deterministic_algorithms(True)
        self.torch = torch
        self.processor = ClapFeatureExtractor.from_pretrained(model_dir, local_files_only=True)
        self.model = ClapModel.from_pretrained(model_dir, local_files_only=True).eval().to("cpu")

    def extract(self, path):
        import numpy as np
        import soundfile as sf
        import soxr

        audio, rate = sf.read(path, dtype="float32", always_2d=True)
        if len(audio) == 0 or not np.isfinite(audio).all():
            raise ValueError("Audio is empty or nonfinite")
        audio = audio.mean(axis=1, dtype=np.float64).astype(np.float32)
        if rate != SAMPLE_RATE:
            audio = soxr.resample(audio, rate, SAMPLE_RATE, quality="HQ")
        duration = len(audio) / SAMPLE_RATE
        windows = []
        embeddings = []
        for start in [0, WINDOW_SAMPLES, 2 * WINDOW_SAMPLES]:
            if start >= len(audio):
                continue
            end = min(start + WINDOW_SAMPLES, len(audio))
            window = np.pad(audio[start:end], (0, WINDOW_SAMPLES - (end - start)))
            inputs = self.processor(
                window,
                sampling_rate=SAMPLE_RATE,
                padding="pad",
                truncation="rand_trunc",
                return_tensors="pt",
            )
            with self.torch.inference_mode():
                output = self.model.get_audio_features(**inputs)
            vector = output[0].detach().cpu().numpy()
            embeddings.append(unit(vector))
            windows.append({"startSeconds": start / SAMPLE_RATE, "endSeconds": end / SAMPLE_RATE})
        dimensions = {len(vector) for vector in embeddings}
        if len(dimensions) != 1:
            raise ValueError("Window embedding dimensions disagree")
        pooled = unit([sum(values) / len(embeddings) for values in zip(*embeddings, strict=True)])
        # Re-read float32 values so cache and exported bytes are exactly identical.
        data = vector_bytes(pooled)
        vector, _ = decode_vector(data, len(pooled))
        return list(vector), {
            "sourceDurationSeconds": duration,
            "analyzedWindows": windows,
            "describes": "available-audio-excerpt",
        }


def safe_audio_path(root, relative):
    relative = Path(relative)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError("Audio path must be relative and cannot traverse")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Audio path escapes audio root")
    return path


def eligible_record(record):
    """Enforce the narrow policy again at extraction/export, not just at selection."""
    provenance = record["provenance"]
    license_url = provenance["recordingLicense"]["url"]
    if not re.fullmatch(
        r"https://creativecommons\.org/(?:publicdomain/zero/1\.0|"
        r"licenses/by/(?:1\.0|2\.0|2\.5|3\.0|4\.0))/?",
        license_url,
    ):
        raise ValueError("Record is outside exact CC0/CC BY allowlist")
    for key in ["statement", "attribution"]:
        if not provenance["recordingLicense"].get(key, "").strip():
            raise ValueError("Recording license evidence missing")
    for key in ["datasetId", "datasetVersion", "sourceRecordId", "sourcePage", "publicationBasis"]:
        if not isinstance(provenance.get(key), str) or not provenance[key].strip():
            raise ValueError("Provenance missing")
    if not re.fullmatch(r"[a-z0-9][a-z0-9._-]*:[a-zA-Z0-9][a-zA-Z0-9._-]*", record["id"]):
        raise ValueError("Invalid stable recording ID")
    if not record.get("title", "").strip() or not record.get("artist", "").strip():
        raise ValueError("Track title/artist missing")


def extract(args):
    selection = read_json(args.selection)
    records = selection["records"]
    if args.limit:
        records = records[: args.limit]
    model_dir = args.cache / "model"
    artifacts = model_artifacts(model_dir)
    config, processor = load_configuration(model_dir)
    config_sha = sha(canonical(config))
    started = time.monotonic()
    run = {
        "schemaVersion": 1,
        "startedAt": datetime.now(UTC).isoformat(),
        "status": "running",
        "requestedCount": len(records),
        "elapsedSeconds": 0,
        "configuration": config,
        "configurationSha256": config_sha,
        "processorConfig": processor,
        "encoderArtifacts": artifacts,
        "runtime": {
            "python": platform.python_version(),
            "platform": platform.system() + " " + platform.machine(),
            "libraries": get_versions(),
        },
        "pipeline": pipeline_identity(),
        "dependencyLockSha256": file_sha(ROOT / "tools/catalog/uv.lock"),
        "selectionSha256": file_sha(args.selection),
        "rows": [],
        "failures": [],
        "cacheHits": 0,
        "inferred": 0,
    }
    encoder = None
    seen = set()
    report = args.cache / "runs" / (args.run + ".json")
    write_json(report, run)
    for record in records:
        identifier = record.get("id", "missing-id")
        stage = "source-policy"
        audio_sha = None
        key = None
        try:
            if identifier in seen:
                raise ValueError("Duplicate stable ID in selection")
            seen.add(identifier)
            eligible_record(record)
            stage = "source-audio"
            path = safe_audio_path(args.audio_root, record["audioPath"])
            audio_sha = file_sha(path)
            key = cache_key(audio_sha, config_sha)
            entry_path = args.cache / "embeddings" / (key + ".json")
            stage = "cache-validation"
            entry = load_cache(entry_path, audio_sha, config_sha)
            reused = entry is not None
            if entry is None:
                if encoder is None:
                    stage = "model-initialization"
                    encoder = Encoder(model_dir, args.threads)
                stage = "decode-or-inference"
                vector, coverage = encoder.extract(path)
                entry = {
                    "schemaVersion": 1,
                    "pipeline": run["pipeline"],
                    "dependencyLockSha256": run["dependencyLockSha256"],
                    "audioSha256": audio_sha,
                    "configurationSha256": config_sha,
                    "cacheKeySha256": key,
                    "vector": vector,
                    "dimension": len(vector),
                    "coverage": coverage,
                    "vectorSha256": sha(vector_bytes(vector)),
                }
                stage = "inferred-vector-validation"
                validate_entry(entry, audio_sha, config_sha)
                stage = "cache-write"
                write_json(entry_path, entry)
            run["cacheHits" if reused else "inferred"] += 1
            run["rows"].append({"id": identifier, "audioSha256": audio_sha, "cacheKeySha256": key})
            print(
                json.dumps(
                    {
                        "id": identifier,
                        "status": "cached" if reused else "inferred",
                        "dimension": entry["dimension"],
                    }
                ),
                flush=True,
            )
        except (OSError, ValueError, RuntimeError, KeyError, TypeError) as error:
            # Exception messages can include local/private paths; only type is public-safe.
            category = (
                "missing-audio"
                if stage == "source-audio" and isinstance(error, FileNotFoundError)
                else stage
            )
            failure = {
                "id": identifier,
                "stage": stage,
                "category": category,
                "reason": type(error).__name__,
            }
            if audio_sha is not None:
                failure["audioSha256"] = audio_sha
            if key is not None:
                failure["cacheKeySha256"] = key
            run["failures"].append(failure)
            print(
                json.dumps(
                    {
                        "id": identifier,
                        "status": "failed",
                        "category": category,
                        "reason": type(error).__name__,
                    }
                ),
                flush=True,
            )
            print(f"{identifier}: {error}", file=sys.stderr)
        except KeyboardInterrupt:
            run["status"] = "interrupted"
            raise
        finally:
            run["elapsedSeconds"] = round(time.monotonic() - started, 6)
            write_json(report, run)
    run["status"] = "failed" if run["failures"] else "complete"
    run["completedAt"] = datetime.now(UTC).isoformat()
    run["elapsedSeconds"] = round(time.monotonic() - started, 6)
    write_json(report, run)
    print(
        json.dumps(
            {
                "run": args.run,
                "rows": len(run["rows"]),
                "cacheHits": run["cacheHits"],
                "inferred": run["inferred"],
                "failures": len(run["failures"]),
            }
        )
    )
    return 1 if run["failures"] else 0


def pipeline_identity():
    source_files = sorted((ROOT / "tools/catalog").glob("*.py"))
    source_files += [ROOT / "tools/catalog/pyproject.toml", ROOT / "tools/catalog/uv.lock"]
    digest = sha(canonical({str(path.relative_to(ROOT)): file_sha(path) for path in source_files}))
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = bool(
        subprocess.check_output(
            ["git", "status", "--porcelain", "--", "tools/catalog"], cwd=ROOT, text=True
        ).strip()
    )
    return {"sourceCommit": commit, "sourceTreeSha256": digest, "dirty": dirty}


def export(args):
    if not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.version):
        raise ValueError("Unsafe catalog version")
    destination = args.output / args.version
    if destination.exists():
        raise ValueError("Catalog version already exists; use a new immutable version")
    selection = read_json(args.selection)
    run = read_json(args.cache / "runs" / (args.run + ".json"))
    if run["selectionSha256"] != file_sha(args.selection):
        raise ValueError("Selection differs from extraction run")
    config = run["configuration"]
    config_sha = sha(canonical(config))
    if config_sha != run["configurationSha256"]:
        raise ValueError("Run configuration digest mismatch")
    records = {row["id"]: row for row in selection["records"]}
    if len(records) != len(selection["records"]):
        raise ValueError("Duplicate selection ID")
    tracks, build_rows, all_bytes = [], [], []
    dimension = None
    for row in sorted(run["rows"], key=lambda value: value["id"].encode("utf-8")):
        record = records[row["id"]]
        eligible_record(record)
        entry = read_json(args.cache / "embeddings" / (row["cacheKeySha256"] + ".json"))
        data, _, norm = validate_entry(entry, row["audioSha256"], config_sha)
        if dimension is not None and dimension != entry["dimension"]:
            raise ValueError("Mixed embedding dimensions")
        dimension = entry["dimension"]
        track = {
            key: record[key]
            for key in ["id", "title", "artist", "album", "recordingGroupId"]
            if key in record
        }
        track.update(
            {
                "row": len(tracks),
                "provenance": {**record["provenance"], "audioSha256": row["audioSha256"]},
                "coverage": entry["coverage"],
            }
        )
        tracks.append(track)
        all_bytes.append(data)
        build_rows.append(
            {
                "id": track["id"],
                "audioSha256": row["audioSha256"],
                "configurationSha256": config_sha,
                "cacheKeySha256": row["cacheKeySha256"],
                "vectorSha256": sha(data),
                "norm": norm,
                "extractionPipeline": entry["pipeline"],
                "dependencyLockSha256": entry["dependencyLockSha256"],
            }
        )
    if not tracks:
        raise ValueError("No real analyzed tracks to export")
    if len({row["id"] for row in tracks}) != len(tracks):
        raise ValueError("Duplicate run ID")
    if len({row["provenance"]["audioSha256"] for row in tracks}) != len(tracks):
        raise ValueError("Exact duplicate audio recordings in export")
    build = {
        "schemaVersion": 1,
        "pipeline": run["pipeline"],
        "runtime": run["runtime"],
        "dependencyLockSha256": run["dependencyLockSha256"],
        "encoderArtifacts": run["encoderArtifacts"],
        "processorConfig": run["processorConfig"],
        "configuration": config,
        "configurationSha256": config_sha,
        "sourceMetadata": selection["metadata"],
        "inclusionPolicy": selection["policy"],
        "rows": build_rows,
        "measured": {
            "trackCount": len(tracks),
            "dimension": dimension,
            "artistCount": len({row["artist"] for row in tracks}),
        },
        "validation": {"finite": True, "nonzero": True, "normalized": True, "rowAligned": True},
    }
    notices = [
        "# Catalog attribution",
        "",
        "Numerical audio embeddings derived from the available "
        "excerpts and windows recorded in tracks.json. No raw audio is distributed. "
        "Recording terms below remain applicable to derived representations. "
        "The application's MIT software license does not relicense this catalog.",
        "",
        "## Model",
        "",
        f"{ENCODER['license']['attribution']} "
        f"[{MODEL_ID}]({ENCODER['sourceUrl']}), "
        f"[Apache 2.0]({ENCODER['license']['url']}). Weights are not distributed.",
        "",
        "## Metadata",
        "",
    ]
    for source in selection["sources"]:
        license_info = source["metadataLicense"]
        notices.append(
            f"{license_info['attribution']} — [{license_info['statement']}]({license_info['url']})."
        )
    notices += ["", "## Recordings", ""]
    for track in tracks:
        provenance = track["provenance"]
        license_info = provenance["recordingLicense"]
        notices += [
            f"### {track['id']}",
            "",
            f"{license_info['attribution']}",
            "",
            f"Source: {provenance['sourcePage']}",
            "",
            f"License: [{license_info['statement']}]({license_info['url']})",
            "",
            provenance["publicationBasis"],
            "",
        ]
    args.output.mkdir(parents=True, exist_ok=True)
    staging_root = Path(tempfile.mkdtemp(prefix=".catalog-stage-", dir=args.output))
    staging = staging_root / args.version
    staging.mkdir()
    try:
        write_json(staging / "tracks.json", tracks)
        write_json(staging / "build.json", build)
        atomic_bytes(staging / "embeddings.f32", b"".join(all_bytes))
        atomic_bytes(staging / "ATTRIBUTION.md", ("\n".join(notices) + "\n").encode("utf-8"))
        files = {
            key: {
                "path": name,
                "bytes": (staging / name).stat().st_size,
                "sha256": file_sha(staging / name),
            }
            for key, name in [
                ("tracks", "tracks.json"),
                ("build", "build.json"),
                ("embeddings", "embeddings.f32"),
                ("attribution", "ATTRIBUTION.md"),
            ]
        }
        manifest = {
            "schemaVersion": 1,
            "catalogVersion": args.version,
            "createdAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "trackCount": len(tracks),
            "dimension": dimension,
            **config,
            "vectors": {
                "dtype": "float32",
                "byteOrder": "little",
                "layout": "row-major",
                "normalization": "l2",
                "normTolerance": 0.0001,
            },
            "orderedIdsSha256": sha(("\n".join(row["id"] for row in tracks) + "\n").encode()),
            "sources": selection["sources"],
            "files": files,
        }
        write_json(staging / "manifest.json", manifest)
        # Node validator checks the exact staged bytes before immutable version publication.
        subprocess.run(
            [
                "node",
                "scripts/validate-catalog.ts",
                "--root",
                str(staging_root),
                "--version",
                args.version,
            ],
            cwd=ROOT,
            check=True,
        )
        os.replace(staging, destination)
        if args.activate:
            write_json(
                args.output / "current.json",
                {
                    "schemaVersion": 1,
                    "status": "ready",
                    "catalogVersion": args.version,
                    "manifestSha256": file_sha(destination / "manifest.json"),
                },
            )
    finally:
        if staging_root.exists():
            shutil.rmtree(staging_root)
    print(
        json.dumps(
            {
                "catalogVersion": args.version,
                "trackCount": len(tracks),
                "dimension": dimension,
                "artistCount": build["measured"]["artistCount"],
                "activated": args.activate,
            }
        )
    )
    return 0


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--cache", type=Path, default=DEFAULT_CACHE)
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("download-model", help="Download the pinned checkpoint once")
    extraction = commands.add_parser("extract", help="Offline resumable real audio inference")
    extraction.add_argument("--selection", type=Path, required=True)
    extraction.add_argument("--audio-root", type=Path, required=True)
    extraction.add_argument("--run", default="catalog")
    extraction.add_argument("--limit", type=int)
    extraction.add_argument("--threads", type=int, default=4)
    exporting = commands.add_parser("export", help="Validate then publish an immutable catalog")
    exporting.add_argument("--selection", type=Path, required=True)
    exporting.add_argument("--run", default="catalog")
    exporting.add_argument("--version", required=True)
    exporting.add_argument("--output", type=Path, default=ROOT / "public/catalog")
    exporting.add_argument("--activate", action="store_true")
    return result


def main(argv=None):
    args = parser().parse_args(argv)
    if hasattr(args, "run") and not re.fullmatch(r"[a-z0-9][a-z0-9_-]*", args.run):
        raise ValueError("Unsafe run identifier")
    if getattr(args, "limit", None) is not None and args.limit <= 0:
        raise ValueError("Limit must be positive")
    if getattr(args, "threads", 1) <= 0:
        raise ValueError("Threads must be positive")
    if args.command == "download-model":
        download_model(args.cache)
        print(json.dumps({"id": MODEL_ID, "revision": MODEL_REVISION}))
        return 0
    return extract(args) if args.command == "extract" else export(args)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Catalog failed: {error}", file=sys.stderr)
        raise SystemExit(1) from error
