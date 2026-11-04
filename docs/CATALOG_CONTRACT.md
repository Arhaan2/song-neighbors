# Static catalog contract, schema 1

The executable structural schemas and inferred
TypeScript types are in `src/catalog/contract.ts`; the artifact validator is
`scripts/catalog-validation.ts`. Schema fixtures in `tests/` are not production data.
Actual catalog identity and verification are recorded in `docs/phases/phase-1.md`.

## Files and activation

A release contains exactly these required artifacts:

```text
public/catalog/current.json
public/catalog/<catalogVersion>/manifest.json
public/catalog/<catalogVersion>/tracks.json
public/catalog/<catalogVersion>/embeddings.f32
public/catalog/<catalogVersion>/ATTRIBUTION.md
public/catalog/<catalogVersion>/build.json
```

Version names match `[a-z0-9][a-z0-9_-]*`; paths cannot contain slashes or traversal. Catalog URLs
are resolved under Vite's `import.meta.env.BASE_URL`, including on a repository subpath.
An unavailable catalog uses `schemaVersion: 1`, `status: "not-ready"` and an explanatory `reason`,
without an invented version, count or dimension. A ready pointer contains `schemaVersion: 1`,
`status: "ready"`, `catalogVersion`, and `manifestSha256`. The committed pointer records the actual
activation state; this contract does not assert a particular active catalog or coverage count.
The artifact validator derives `<catalogVersion>/manifest.json`, verifies its exact-byte SHA-256,
then reads that manifest's artifacts. The Phase 2 browser loader must enforce the same boundary.
Changing any artifact requires a new immutable catalog version. The exporter publishes the pointer
only after all version files pass validation.

JSON files use UTF-8 without a BOM. Unknown object keys fail schema validation; this catches
accidentally exported private fields such as `localPath`. The artifact validator also rejects
known local-path markers, private hosts, credential URLs and sensitive query parameters. These
checks are not a complete privacy proof; public free-text fields and source notices still require
review. Raw audio, weights, caches and private input manifests are never catalog artifacts.

## Manifest

The schema requires:

| Field | Meaning |
| --- | --- |
| `schemaVersion`, `catalogVersion`, `createdAt` | Contract version, immutable export identity and UTC ISO timestamp. |
| `trackCount`, `dimension` | Positive integers derived from validated output; dimension comes from actual inference. |
| `encoder` | Exact model ID, immutable lowercase 40/64-hex commit revision, authoritative HTTPS source URL, model license statement/URL/attribution. Never a mutable branch or tag. |
| `preprocessing` | Sample rate, mono channel count, decoder and resampler names/versions, amplitude policy, exact processor-config SHA-256, implementation version, runtime libraries and full dependency-lock SHA-256. |
| `windowing` | Version, window duration, deterministic position selection and short-audio policy. |
| `aggregation` | Version, exact pooling method, per-window normalization (`none` or `l2`), final `l2` normalization. |
| `vectors` | `float32`, `little`, `row-major`, `l2`, and positive norm tolerance at most `0.001`. |
| `orderedIdsSha256` | Hash binding stable track IDs in vector-row order, as defined below. |
| `sources` | Dataset ID/version, authoritative URL, metadata license statement/URL/attribution, and applicable source terms URLs. |
| `files` | Literal paths, byte lengths and SHA-256 for `tracks.json`, `embeddings.f32`, `ATTRIBUTION.md`, and `build.json`. |

The supported replacement is `laion/larger_clap_general` at immutable revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`, with the compatible feature extractor from that same
revision. The validator accepts only this one model/configuration family. Its weights are
776,444,665 bytes with SHA-256 `314eb00cce6ad68d25237b8446b659ccdb136ed4672c1bca470f142f72455026`;
its 643-byte `config.json` has SHA-256
`6268f76a067e3104bf9001e97d7dcc0fcfb16f3086cfb478ee72d95900d7fc1d`. The unchanged processor artifact
has SHA-256 `9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753`, and its canonical
JSON digest is `c15057851b990e02fffdae8a7e89f730f0cddc77cbf893254bfcc29f81c116ba`.

The initial `laion/larger_clap_music` revision
`a0b4534a14f58e20944452dff00a22a06ce629d1` was rejected after checkpoint inspection found all
253 bias tensors zero and all 136 normalization tensors at initialization. Its export was
withdrawn to the ignored cache. Passing byte/shape checks did not establish a usable pretrained
acoustic representation, and the validator now rejects both that revision and those checkpoint
bytes. The Phase 1 report preserves the investigation and replacement-inference evidence.
Replacement dimensions must be derived from actual inference and checked across every row;
this contract does not claim a replacement smoke result or carry forward the rejected model's
measured dimension.

Preprocessing decodes float32 audio with soundfile/libsndfile, averages channels in float64 then
converts to float32, and uses soxr HQ to resample to 48,000 Hz. It applies no loudness or peak
normalization. `fixed-starts-0-10-20-v1` selects ten-second windows starting at 0, 10 and 20 seconds
when the start is within the decoded audio, analyzing at most its first thirty seconds. Partial
windows are right-zero-padded to 480,000 samples. Processor calls use `padding=pad` and
`truncation=rand_trunc` on those exact-length arrays, so no random crop occurs. Actual coverage
excludes padding. `mean-unit-windows-v1` L2-normalizes each window embedding, takes their arithmetic
mean, then L2-normalizes that mean before float32 serialization.

The artifact validator enforces the pinned encoder/processor and model artifact hashes, exact
policy descriptions, implementation version, decoder/resampler identities, and the seven direct
runtime-library pins. Decoder and resampler versions must agree with the runtime record. The full
dependency-lock digest also participates in configuration identity, so transitive dependency
changes invalidate compatible-cache identity. Updating these choices requires an intentional
pipeline/validator change and a new catalog version; matching arbitrary descriptions alone does
not establish compatibility. The concrete `build.json` fields are defined below.

## Track metadata and identity

`tracks.json` is one JSON array. Each record has a unique stable `id`, zero-based `row`, nonempty
`title` and `artist`, optional `album`, optional verified `recordingGroupId`, `provenance`, and
`coverage`. Stable IDs use `sourceNamespace:sourceRecordId`, for example a provider's persistent
record ID, and must not be generated from title/artist text, vector position, or a local filename.
The FMA namespace uses `fma:` plus the six-digit, zero-padded numeric FMA track ID; the original
numeric ID is also retained in `sourceRecordId`. IDs survive re-export; rows may change between
catalog versions. Sort by bytewise stable ID during export for repeatable
ordering; `tracks[i].row` must always equal `i`. Never sort tracks after writing their vectors.

`provenance` records dataset ID/version, source record ID, public HTTPS source page, source-audio
SHA-256, exact recording-license statement/URL/attribution, and publication basis for this use.
The dataset ID/version must appear in `manifest.sources`. License eligibility follows
`CATALOG_POLICY.md` and authoritative per-record evidence. For FMA, `raw_tracks.csv` supplies the
explicit `license_url`; the original statement and exact versioned canonical URL are preserved.
An unchanged statement such as "Attribution" is acceptable when that source record explicitly
supplies the license URL; no version is inferred from the statement. Unknown, ambiguous, NC, ND,
SA and conflicting statement/URL records are excluded. The publication basis and attribution
retain the source grant, supplied copyright/contributor notices and excerpt-to-embedding change.
Omitting raw audio is not itself a publication basis.

`coverage` records source duration and the actual start/end seconds of every analyzed audio
window. Windows have positive duration and cannot extend beyond the source audio. Padding is
recorded in the window policy, not falsely counted as audio coverage. The `describes` value is
`available-audio-excerpt`; the UI must not claim that a short clip represents an entire composition.
Only assign `recordingGroupId` when a documented authoritative identifier or verified audio
comparison establishes that recordings are the same. Similar titles alone are insufficient.

## Vector bytes and integrity

`embeddings.f32` is a headerless row-major sequence of IEEE 754 binary32 values in **little-endian**
order. Row `i` begins at byte offset `i * dimension * 4`; its `dimension` values correspond exactly
to `tracks[i]`. Byte length must equal `trackCount * dimension * 4` without integer overflow.
Readers must decode explicitly little-endian (e.g. `DataView.getFloat32(offset, true)`); they must
not assume the browser CPU's native byte order.

All values must be finite, each vector nonzero, and each L2 norm must satisfy
`abs(norm - 1) <= normTolerance` after float32 serialization. Normalize the final aggregated vector
before encoding; validate it again after decoding. Reject missing rows, truncated/extra bytes,
NaN/Infinity, zero vectors, dimension mismatch, mixed encoder/preprocessing/aggregation identity,
wrong hashes and incompatible schema versions. Do not fix corrupt data by silently normalizing,
reordering, filling zeros or falling back to another version.

SHA-256 values are 64 lowercase hexadecimal characters. File hashes cover the exact delivered
bytes, not reserialized JSON or decoded float values. `orderedIdsSha256` hashes UTF-8 bytes of
`tracks.map(track => track.id).join("\n") + "\n"`: one stable ID per line, in row order, including
one final LF. IDs cannot contain line breaks. The manifest's own digest is stored in the pointer,
so it does not contain a circular self-hash. These hashes bind compatible files and detect damage;
they do not establish source rights or authenticity of an untrusted publication.

## Attribution and Phase 1 gates

`ATTRIBUTION.md` must identify each recording and creator, link the source and exact license,
preserve required notices, state that numerical embeddings were derived from available excerpts,
and distinguish metadata, recording, model and software terms. The application MIT license does
not relicense any of these third-party materials. Model redistribution terms must be checked even
though the website ships no weights. Refer to the root third-party/data notices as well.

Phase 1 implements structural and complete artifact validation, real offline inference, compatible
cache reuse, and staged export. Isolated synthetic mathematical fixtures exercise corruption and
compatibility failures only; they are not production tracks or inference evidence. The Phase 1
report records actual extraction, rights review, catalog coverage and validation results.
Phase 2's defensive browser loader and recommendation engine remain future work. A validated
catalog does not by itself establish a functioning public recommendation interface or listening
quality.

Dependency reference: [Zod 4](https://zod.dev/) supports strict runtime schemas and inferred types;
its official documentation requires TypeScript 5.5+ with strict mode enabled.

## Phase 1 build record and validator

`buildSchema` in `scripts/catalog-validation.ts` defines the concrete strict `build.json` shape:

| Field | Binding |
| --- | --- |
| `schemaVersion` | Build record schema 1. |
| `pipeline` | Extraction-run `sourceCommit`, digest of the pipeline source tree, and `dirty` flag. A dirty extraction is disclosed rather than attributed solely to its base commit. |
| `runtime` | Python version, public platform description and direct library versions. |
| `dependencyLockSha256` | Exact extraction-time dependency-lock digest; must match preprocessing and every row. |
| `encoderArtifacts` | Relative artifact filenames, byte counts and SHA-256 values for `config.json`, `preprocessor_config.json` and `pytorch_model.bin`; no weights are embedded. |
| `processorConfig` | Immutable processor ID/revision, parsed JSON `value`, exact canonical `serialized` string, its `sha256`, and the serialization convention. |
| `configuration`, `configurationSha256` | Exact encoder, preprocessing, windowing and aggregation objects matching the manifest, plus their canonical JSON digest. |
| `sourceMetadata` | Source metadata archive SHA-256, published SHA-1 and dataset version. |
| `inclusionPolicy` | Policy version and exclusion counts keyed by reason. |
| `rows` | Stable ID, source-audio/configuration/cache-key/vector SHA-256 values, decoded float32 norm, original `extractionPipeline` identity and dependency-lock digest for each row. |
| `measured` | Inference-derived track count, dimension and artist-display-name count. |
| `validation` | Export assertions for finite, nonzero, normalized and aligned rows; the independent Node validator verifies the actual bytes rather than trusting these flags. |

Cache reuse retains each row's original extraction identity instead of relabeling old inference
as a new extraction. The pipeline-source digest hashes a canonical map of relative Python source,
project configuration and lockfile names to their exact file hashes. Configuration and processor
JSON use sorted keys, compact UTF-8, no final newline, and integral numbers serialized as integers.
The processor-config digest hashes its preserved serialization, and the validator checks both
that serialization against the embedded value and the resulting digest against the pinned
processor. Cache keys hash canonical `{audioSha256, configurationSha256}` objects; row-vector
hashes cover their exact serialized little-endian float32 bytes. Source metadata SHA-1 records the
published download check, while SHA-256 binds the acquired archive in the reproducibility record.
No local absolute paths, credentials, private manifests, raw audio or model weights belong here.

`npm run validate:catalog` inspects every version directory under `public/catalog` and the
current pointer using only Node and web dependencies. Version directories contain exactly the
five listed artifacts; unexpected files, unsafe names and symlinks are rejected. It verifies exact file bytes/hashes, strict schemas, public-safe values,
allowlisted recording licenses, sorted row alignment, source membership, per-row identity, pinned
model/processor and fixed analysis policy, complete attribution, finite nonzero normalized vectors,
and duplicate source-audio hashes. It never repairs or substitutes data.
`npm run validate:catalog -- --require-ready` additionally fails if no ready catalog exists;
the ordinary command explicitly reports not-ready without claiming a real-data pass.
`node scripts/validate-catalog.ts --root <path> --version <version>` validates a staged export
before activation. Staged-version validation and `--require-ready` cannot be combined.

The Python exporter stages five files, invokes this validator, atomically publishes the immutable
version, then optionally updates the pointer. A failed validation cannot activate a new catalog.
Existing version names cannot be overwritten. Required web CI validates exports; inference and
source/model downloads are excluded from CI.
