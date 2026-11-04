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
`current.json` currently has `schemaVersion: 1`, `status: "not-ready"` and an explanatory `reason`.
It has no fake version, count or dimension. A future ready pointer instead contains
`schemaVersion: 1`, `status: "ready"`, `catalogVersion`, and `manifestSha256`.
The loader derives `<catalogVersion>/manifest.json`, verifies its exact-byte SHA-256, then reads
only that manifest's artifacts. Changing any artifact requires a new immutable catalog version.
Publish the pointer only after all version files and their validation succeed.

JSON files use UTF-8 without a BOM. Unknown object keys fail schema validation; this catches
accidentally exported private fields such as `localPath`. It is not a complete privacy scanner:
Phase 1 must inspect all free-text fields and URLs for private paths, tokens and personal content.

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

Selection and aggregation policies must be reproducible specifications, not labels like "default".
For example, record the exact placement rule, overlap, treatment of silence/short clips, truncation,
padding and whether vectors are normalized before averaging. The schema permits descriptive text
because the checkpoint's actual supported policy is selected in Phase 1; a text value passing a
schema is not evidence that the policy has been implemented or is compatible with the encoder.

`build.json` is the public reproducibility record. Phase 1 must define and validate its concrete
shape when the pipeline is implemented. It must include the exact pipeline source commit;
Python/platform and decoder/library versions; dependency lock digest; encoder artifact names and
hashes; a relative `processor-config.json` representation embedded as a JSON value with its exact
UTF-8 serialization/digest convention; complete preprocessing/window/aggregation configuration;
source metadata archive version/hash; source audio hashes keyed by stable ID; inclusion-policy
version and exclusion counts/reasons; counts/dimension measured from inference; and the export
validation results. No absolute local paths, private manifests, credentials or raw audio bytes.
`processorConfigSha256` hashes the exact serialized processor configuration preserved by that
record, not a mutable remote configuration. The export validator must compare it independently.

## Track metadata and identity

`tracks.json` is one JSON array. Each record has a unique stable `id`, zero-based `row`, nonempty
`title` and `artist`, optional `album`, optional verified `recordingGroupId`, `provenance`, and
`coverage`. Stable IDs use `sourceNamespace:sourceRecordId`, for example a provider's persistent
record ID, and must not be generated from title/artist text, vector position, or a local filename.
Document the namespace's identity rules in the Phase 1 provenance report. IDs survive re-export;
rows may change between catalog versions. Sort by bytewise stable ID during export for repeatable
ordering; `tracks[i].row` must always equal `i`. Never sort tracks after writing their vectors.

`provenance` records dataset ID/version, source record ID, public HTTPS source page, source-audio
SHA-256, exact recording-license statement/URL/attribution, and publication basis for this use.
The dataset ID/version must appear in `manifest.sources`. License eligibility is decided using
`CATALOG_POLICY.md` and authoritative evidence, not by accepting an arbitrary schema-valid URL.

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

Phase 0 tests enforce pointer/schema, count/byte-length consistency, row alignment, ID uniqueness,
source membership and bounded actual coverage. Full artifact hashing, binary decoding/norm checks,
real provenance review and actual inference are **not implemented or claimed** in this phase.
Phase 1 implements and runs export validation; Phase 2 adds the defensive browser loader. Until
those gates pass, the checked-in pointer remains `not-ready` and no song can be recommended.

Dependency reference: [Zod 4](https://zod.dev/) supports strict runtime schemas and inferred types;
its official documentation requires TypeScript 5.5+ with strict mode enabled.

## Phase 1 build record and validator

`buildSchema` in `scripts/catalog-validation.ts` defines the concrete strict `build.json` shape.
It binds extraction-time pipeline commit/source digest/dirty status, Python/platform/libraries,
full dependency lock, verified model artifact hashes, canonical processor value and serialization,
complete configuration/hash, metadata archive hashes/version, inclusion-policy exclusion counts,
and measured counts/dimension. Every row records source audio/configuration/cache/vector hashes,
float32 norm, and its original extraction commit/source/lock identity. Cache reuse never relabels
old inference as a new extraction. Config and processor JSON use sorted keys, compact UTF-8,
no newline, and integral numbers serialized as integers.

`npm run validate:catalog` inspects every committed version and the current pointer using only
Node and web dependencies. It verifies exact file bytes/hashes, strict schemas, public-safe values,
allowlisted recording licenses, sorted row alignment, source membership, per-row identity, pinned
model/processor and fixed analysis policy, complete attribution, finite nonzero normalized vectors,
and duplicate source-audio hashes. It never repairs or substitutes data. `--require-ready` additionally
fails if no ready catalog exists; the ordinary command explicitly reports not-ready without claiming
a real-data pass. `--root <path> --version <version>` validates a staged export before activation.

The Python exporter stages five files, invokes this validator, atomically publishes the immutable
version, then optionally updates the pointer. A failed validation cannot activate a new catalog.
Existing version names cannot be overwritten. Required web CI validates exports; inference and
source/model downloads are excluded from CI.
