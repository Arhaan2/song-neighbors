# Offline audio catalog

The pipeline audits cumulative FMA small/medium/large metadata, acquires the selected official
audio archive, applies the narrow record-level policy,
and runs genuine CPU CLAP inference. Heavy dependencies are an **optional** `inference` extra;
ordinary web CI validates the committed export without downloading music or model weights.
Run these commands from the repository root with Python 3.12, uv, curl, and Node 24 available.
All downloaded files, models, raw excerpts, run reports, and embedding caches stay in `.cache/`.

## Acquire and inspect before inference

```sh
uv sync --project tools/catalog --locked
uv run --project tools/catalog --locked python tools/catalog/source.py download metadata --cache .cache/catalog
uv run --project tools/catalog --locked python tools/catalog/source.py inspect \
  --metadata-archive .cache/catalog/fma_metadata.zip --limit 500 \
  --selection .cache/catalog/selection-500.json --report .cache/catalog/source-report.json
```

`source.py` verifies the upstream SHA-1, hashes the exact archive with SHA-256, joins actual
small-subset IDs to raw record license URLs, preserves attribution/copyright statements, and
writes inclusion/exclusion evidence. `tracks.csv` license labels alone are insufficient to infer
license versions. Inspect the report before the larger download. The historical command below preserves the original small selection. The downloader also
supports `medium` (22.19 GiB) and `large` (93.42 GiB); these are cumulative archives, not
additional disjoint pools. No full-length dataset or remote ZIP range infrastructure is used.
Downloads resume through curl and require disk-space reserves. Phase 5A does not download either
larger audio archive; see the [Phase 5B runbook](../../docs/PHASE_5B.md).

```sh
uv run --project tools/catalog --locked python tools/catalog/source.py download small --cache .cache/catalog
uv run --project tools/catalog --locked python tools/catalog/source.py extract \
  --audio-archive .cache/catalog/fma_small.zip --selection .cache/catalog/selection-500.json \
  --output .cache/catalog/fma_small
```

Only selected eligible clips are extracted. Stable recording IDs are `fma:` followed by the
six-digit zero-padded FMA track ID. Artist/title text never determines recording identity.

## Pin and run the model

```sh
uv sync --project tools/catalog --locked --extra inference
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py download-model
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small \
  --run smoke-40 --limit 40
```

The replacement model pin is `laion/larger_clap_general` revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`. The compatible audio processor is
`ClapFeatureExtractor` from **the same immutable revision**, used with `ClapModel`.
The loader verifies SHA-256 for the exact configuration, processor file and checkpoint before
reuse. `download-model` is the only inference CLI command that fetches network artifacts.
Extraction uses `local_files_only=True`, CPU, evaluation/inference mode, deterministic Torch
algorithms and four threads by default (`--threads N`). No GPU or paid API is needed.
The model card declares Apache-2.0; no weights ship in the static catalog.

Phase 1 started with `laion/larger_clap_music` revision
`a0b4534a14f58e20944452dff00a22a06ce629d1`, then rejected that exact artifact. Its verified
checkpoint contained all 253 bias tensors at zero, all 136 normalization tensors at initialization
defaults, and a zero batch-normalization training counter; the resulting real audio forward passes
were strongly concentrated. This is evidence against accepting that checkpoint as verified trained
weights, beyond a musical-preference limitation. Outputs from the rejected artifact must not be
published as the acoustic catalog. The new model revision creates different configuration/cache
keys, so those outputs cannot be reused for the replacement.

Before accepting the replacement, verify its exact artifact hashes, inspect for trained parameter
state, run the real smoke on permitted audio, and inspect output variation. Structural validity and
unique output bytes alone do not prove pretrained inference. The Phase 1 report records the actual
replacement verification; the changed pin by itself is not a completed verification claim.

The environment locks Torch 2.8.0, Transformers 4.57.1, NumPy 2.3.4, SoundFile 0.13.1,
soxr 1.0.0, librosa 0.11.0 and huggingface-hub 0.36.0, plus exact transitive dependencies.
CPU inference is the default even where the optional Linux Torch wheel includes CUDA libraries.

SoundFile/libsndfile decodes float32; channels are averaged in float64 then converted to float32;
soxr HQ resamples to 48 kHz. There is no peak/loudness normalization. Windows start at 0, 10 and
20 seconds when that start exists, and analyze at most the first 30 seconds of the available
excerpt. Partial windows are right zero-padded to exactly 480,000 samples. The pinned processor
receives exactly ten seconds with `padding="pad"`; its `rand_trunc` setting performs no crop at
this exact length. Actual unpadded window bounds and decoded duration are saved per recording.
Each window embedding is L2 normalized; the arithmetic mean is then L2 normalized and serialized
as little-endian float32. Dimension is measured from actual returned tensors, never assigned
from the checkpoint configuration. Available excerpts do not establish whole-song coverage.

After the real smoke passes, expand using the same selection and compatible cache:

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small --run catalog-500
```

Each successful per-audio cache entry is written atomically. Cache identity is SHA-256 over the
source-audio SHA-256 and complete configuration SHA-256 (immutable encoder, processor hash,
decoder/resampler/runtime versions, full dependency-lock digest, implementation version, window
and aggregation policies).
Invalid/truncated/mismatched cache entries are recomputed; corrupt vectors never become results.
Rerun the same extraction command after interruption: valid entries are reused, missing entries
are inferred, and failed files are retried. Run reports checkpoint after each recording and return
a nonzero exit code when any file fails. Detailed local error messages stay local; public evidence
contains source IDs and error categories only. Original extraction source/lock identities remain
attached to cache entries across subsequent reuse.

## Export and verify

Commit the tested pipeline before the final extraction/export when possible. Run records preserve
the actual source commit, source-file digest and dirty status at extraction time; cached rows also
preserve their original extraction identities. Export does not relabel old inference as new code.

```sh
uv run --project tools/catalog --locked python tools/catalog/catalog.py export \
  --selection .cache/catalog/selection-500.json --run catalog-500 \
  --version fma-small-clap-general-v1 --activate
npm run validate:catalog -- --require-ready
```

Export includes only successfully analyzed records, sorted by stable ID, with corresponding
vector bytes in exactly that order. Exact duplicate audio hashes are rejected. It writes a staged
version, calls the independent Node validator on its exact bytes, then atomically moves the
validated version into place. `--activate` updates the current pointer only afterward. Existing
catalog versions cannot be overwritten. A failed validator does not change the active catalog.
No synthetic fallback or empty success export exists. Five artifacts comprise each version:
`manifest.json`, `tracks.json`, `embeddings.f32`, `build.json`, and `ATTRIBUTION.md`.

`build.json` includes canonical processor JSON/value, artifact hashes, runtime/lock identity,
complete configuration, source metadata hash/version, inclusion policy and exclusion counts,
measured coverage, and per-row audio/config/cache/vector hashes, norms and original extraction
identity. Canonical JSON is sorted-key, compact UTF-8 without newline; integral floats become
integers. Ordinary JSON files add a final LF, while embedded processor/config hashing does not.
The manifest hashes exact exported bytes; the current pointer hashes the manifest, avoiding
circular hashes. Raw audio, local paths, private manifests, artwork and weights are never exported.

The catalog's validity and its beta coverage are separate checks. The beta engineering floor is
100 distinct eligible recordings across 10 artists plus a demonstrated five-seed/twenty-result
case after exclusions; passing integrity checks alone does not claim this floor or musical quality.
See `docs/phases/phase-1.md` for **actual** counts and verification evidence.

## Lightweight targeted tests

```sh
uv run --project tools/catalog --locked python -m unittest discover -s tools/catalog/tests -v
uv run --project tools/catalog --locked ruff check tools/catalog
uv run --project tools/catalog --locked ruff format --check tools/catalog
npm run validate:catalog
```

Python unit tests use explicitly isolated mathematical fixtures and mocked inference to exercise
failure recovery, cache compatibility, atomic replacement and license rejection. They do not
establish real inference. The separately recorded real smoke must do that. The Node validator
rejects unknown/incompatible configuration, missing provenance, mismatched row counts/hashes,
nonfinite/zero/non-normalized vectors and incorrect byte counts without loading Torch.

## Phase 5A expansion preparation

[Audit report](../../docs/phases/phase-5a.md) · [Candidate manifest](../../docs/catalog/phase-5a-selection.json) · [Executable Phase 5B runbook](../../docs/PHASE_5B.md)

The original `source.py inspect` behavior remains unchanged. `expansion.py` audits all three
cumulative memberships, applies the exact original URL allowlist plus documented immutable notice
review, preserves stable IDs and source provenance, records explicit holds affecting published IDs,
and selects deterministically with a global cap of 50
recordings per source artist ID. It defers likely nonmusical additions on specific source evidence.
Metadata eligibility does not establish new audio availability, decoding, inference or publication.

Reproduce the metadata work without acquiring audio or loading model weights:

```sh
uv run --project tools/catalog --locked python tools/catalog/expansion.py audit \
  --metadata-archive .cache/catalog/fma_metadata.zip \
  --manifest docs/catalog/phase-5a-selection.json --report docs/phases/phase-5a-audit.json \
  --selection .cache/catalog/phase-5a-selection.json \
  --additions-selection .cache/catalog/phase-5b-additions.json \
  --evidence .cache/catalog/phase-5a-source-evidence.json
uv run --project tools/catalog --locked python tools/catalog/delivery.py \
  --selection .cache/catalog/phase-5a-selection.json --output docs/phases/phase-5a-delivery.json
```

Use `materialize` instead of `audit` when consuming the committed candidate manifest: it recomputes
and compares that exact manifest before writing the full local selection. `--subset` defaults to
`large`, `--target-total` to 5000, and `--artist-cap` to 50. The lower cumulative subsets are reported
in every audit. Selection is bounded by actual eligible variety; no count is guaranteed. Detailed
exact metadata evidence remains ignored, reproducible from the checked archive and bound by hashes.
Currently published IDs with newly found unresolved rights are explicitly held from the future
selection; the active catalog remains unchanged. Applicable newly identified credits augment
future attribution without changing audio/cache compatibility.

`source.py extract --subset small|medium|large` verifies the explicitly chosen archive and its root,
preflights IDs/provenance/licenses/members/disk space, and writes only selected files atomically.
Reruns hash matching members before reusing local audio. The default remains `small`. Extract only
new IDs into the existing audio root to preserve baseline bytes across overlapping archives.

`preflight.py --audio-root .cache/catalog/fma_small` (with the locked inference extra installed)
checks the current manifest and all artifact hashes, pinned model files, exact runtime configuration,
source audio and cached vector bytes without instantiating the encoder or inferring anything.
A nonzero result is a Phase 5B prerequisite failure, with public-safe categories and local stderr
details. `delivery.py` measures existing formats and candidate text to estimate expanded sizes;
its output is not a catalog and generates no vectors.
