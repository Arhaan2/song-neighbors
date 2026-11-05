# Phase 5B — acquire, analyze and publish the reviewed expansion

Phase 5B release preparation is implemented; expanded audio acquisition remains pending storage.
The 64 GB card inspected during execution had 58.20 GiB free, below the 93.42 GiB archive size;
no large download or new-audio inference was started. See [execution evidence](phases/phase-5b.md).
The commands below resume the authorized work. Run from the verified
Song Neighbors repository root, on a new short `codex/` branch after fetching main. Preserve existing release tags/history and the active catalog until the reviewed replacement is ready. The candidate manifest is metadata
eligibility, not a claim that its recordings decode, infer, or survive exact-audio deduplication.

## Prerequisites and storage

Use Node 24, Python 3.12, uv, curl and the unchanged locked inference environment. The active
manifest is the compatibility authority: `laion/larger_clap_general` revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`, configuration SHA-256
`df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb`. Never reuse the rejected
music-checkpoint outputs. Preserve the dependency lock and all preprocessing/window/aggregation
rules. If the preflight reports a mismatch, restore that environment before proceeding.

FMA-large requires **100,306,112,191 bytes (93.42 GiB)** for the ZIP. Budget roughly 5 GiB for
selected excerpts and at least 2 GB reserve, plus model/runtime/cache/export space. A single
volume with **110 GiB free** is a practical conservative planning allowance, not a measured
selected-file size. The Phase 5A volume had only about 33 GiB free. Smallest storage resolution:
put the archive on an existing external volume with at least **100 GiB free**, keeping at least
**8 GiB free locally** for selected audio and outputs; or free at least 110 GiB on one volume.
No volume purchase, deletion or audio download was performed in Phase 5A.

Set `ARCHIVE_CACHE` to a private local directory on the chosen volume. Do not place it in tracked
source or `public/`. The commands require this explicit path, rather than silently filling a disk.
The existing `.cache/catalog` retains verified metadata, model and compatible embedding caches.
Missing model/cache material must be restored from the existing permitted source; preflight does
not download or infer. All 500 baseline cache entries were reusable in Phase 5A; only the policy-cleared baseline IDs
in the future selection may be carried into its next publication.

```sh
set -eu
: "${ARCHIVE_CACHE:?Set ARCHIVE_CACHE to the selected archive directory with sufficient space}"
mkdir -p "$ARCHIVE_CACHE"
df -h "$ARCHIVE_CACHE" .
uv sync --project tools/catalog --locked --extra inference
uv run --project tools/catalog --locked --extra inference python tools/catalog/preflight.py \
  --audio-root .cache/catalog/fma_small
```

## Reproduce the selection before any larger download

Materialization verifies the metadata archive and active manifest, recomputes the entire audit
and selection, compares the committed candidate manifest exactly, and refuses drift. Detailed
source strings and excluded-record evidence stay in ignored local storage. The public manifest
binds the metadata digest, reviewed policy, every selected recording's evidence and the full
materialized selection hash. New candidate IDs never collide with existing IDs. Seven currently published recordings are
held from the future selection for unresolved underlying-source grants: `fma:006674`,
`fma:006675`, `fma:006677`, `fma:006679`, `fma:006680`, `fma:006684`, `fma:061011`. Inspect
`publishedIdsNeedingReview` in the audit. The live catalog was not edited in Phase 5A; Phase 5B
must omit these from the new publication unless exact applicable evidence resolves the holds.
This is a source-policy uncertainty, not a finding of infringement.

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/expansion.py materialize \
  --metadata-archive .cache/catalog/fma_metadata.zip \
  --manifest docs/catalog/phase-5a-selection.json \
  --selection .cache/catalog/phase-5a-selection.json \
  --additions-selection .cache/catalog/phase-5b-additions.json \
  --evidence .cache/catalog/phase-5a-source-evidence.json
uv run --project tools/catalog --locked --extra inference python tools/catalog/delivery.py \
  --selection .cache/catalog/phase-5a-selection.json
```

Inspect the audit's source content flags. Existing field-recording/sound-effect excerpts remain
preserved. New explicitly Spoken/Sound Effects/crowd-collection/radio-conversation candidates are deferred; uncertain
Field Recordings remain flagged for bounded listening inspection. Ambient, instrumental and
experimental music are not excluded by those labels. Do not fill failures with unreviewed tracks
or relax the artist cap merely to claim 5,000 songs.

Materialization assumes the historical baseline is still active. After local activation, preserve
and reuse the already hash-verified original selections; do not regenerate a different plan from
the new pointer. To reproduce later from scratch, supply `--catalog-root` with a private copy of
the historical catalog and its original pointer, whose exact manifest digest is in the candidate.

## Acquire and extract additions

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/source.py download large \
  --cache "$ARCHIVE_CACHE"
uv run --project tools/catalog --locked --extra inference python tools/catalog/source.py extract \
  --subset large --audio-archive "$ARCHIVE_CACHE/fma_large.zip" \
  --selection .cache/catalog/phase-5b-additions.json --output .cache/catalog/fma_small
```

Despite its historical directory name, `fma_small` is the unified selected-audio root here.
Extract **additions only** so the verified baseline MP3s and embeddings are reused; identical bytes
across overlapping audio archives have not been established. The source command verifies upstream
SHA-1 `497109f4dd721066b5ce5e5f250ec604dc78939e`, reports SHA-256, preflights selected ZIP members
and actual uncompressed sizes, and checks free space before writing. Each file is atomic, and a
rerun reuses only matching member hashes. Curl resumes `.part` files; checksum failure is fatal.
Retain a failed archive for diagnosis instead of treating it as verified or switching license policy.

## Real smoke, then full compatible extraction

The 40-record smoke comes from **additions**. It cannot consist solely of baseline cache hits.
On its first execution, interrupt with Ctrl-C after at least one but fewer than 40 completed rows:

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/phase-5b-additions.json --audio-root .cache/catalog/fma_small \
  --run phase5b-smoke --limit 40
```

Save the interrupted checkpoint before resuming the identical command. If resuming an already
verified addition smoke, preserve its prior evidence and reuse genuine caches without recomputation.
Do not overwrite a saved interruption with a completed run.

```sh
cp -n .cache/catalog/runs/phase5b-smoke.json .cache/catalog/runs/phase5b-smoke-interrupted.json
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/phase-5b-additions.json --audio-root .cache/catalog/fma_small \
  --run phase5b-smoke --limit 40
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py export \
  --selection .cache/catalog/phase-5b-additions.json --run phase5b-smoke \
  --version phase5b-smoke --output .cache/catalog/phase5b-smoke-export
```

The smoke version is immutable; inspect an existing verified export instead of overwriting it.
Inspect the completed run and saved interruption: only addition IDs, zero final failures, 40
successful rows, compatible cache hits for the interrupted successes, measured 512 dimensions,
positive decoded coverage, finite/nonzero/unit vectors and more than one vector hash. The export's
validator checks structure, hashes, dimensions and norms; compare vector hashes and coverage in its
build/tracks files as the remaining real-output checks. Record any actual listening separately from
source metadata flags. Stop on unexplained errors.

Save timing evidence before another run overwrites its checkpoint. Estimate remaining duration from
actual newly inferred rows and elapsed seconds, separating cache-hit work and model startup. Do not
estimate inference throughput from a baseline-only cache check. Once this smoke passes:

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/phase-5a-selection.json --audio-root .cache/catalog/fma_small \
  --run phase5b-expansion
```

Expect cache hits for the 493 cleared baseline IDs plus successful smoke entries, not guaranteed
success for every addition. The report records successful rows, cache hits, inferred rows, failures,
status and elapsed time, and returns nonzero on failure. Record stages separately. Preserve each
failed run under a new name before retrying; valid entries remain resumable.

Exact duplicate audio hashes block export. Review their IDs/provenance and any actual processing
failures, preserve the original candidate manifest, and create an explicit effective selection if
needed. It must retain original metadata/policy and stable sorted IDs. Use the same effective
selection for final extraction and export; compatible entries still reuse. Keep every exclusion's
saved original-selection processing evidence for the receipt described below. Never fill a failure
with an unreviewed recording or claim 4,925 successes from metadata alone.

## Implemented publication preparation and remaining measurements

The release evaluator now checks the active catalog against either the hash-pinned historical
500-record release or independent Phase 5B candidate/processing evidence. It reconstructs the
approved selection, verifies the exact successful IDs and source metadata, and checks documented
failure/duplicate exclusions. A count alone cannot authorize a catalog. Active fixtures follow the
pointer; historical NumPy cases remain pinned separately. Ranking and session behavior are unchanged.

Production builds stage only the active version and generate its count/artist/model notice.
Historical catalogs remain in the repository, while unexpected assets and symlinks are rejected.
The strict deployed-artifact allowlist remains in force. A new release must omit the seven held IDs;
the historical exception is bound to the exact original manifest hash.

Before the final expanded build, update README/PROJECT/PROGRESS coverage, windows, artists and
phase evidence from the successful export and release evaluation; keep historical estimates labeled.
Still required with a real expanded export: measure browser cold load, validation/initialization,
worker-to-main metadata transfer, reliable memory where available, main-thread responsiveness and
five-seed/refined queries on desktop and a mobile viewport. Phase 5A sizes remain estimates.
Optimize only measured bottlenecks; preserve the worker architecture and all integrity checks.

Choose a new unused version (the date below is a name, not proof of execution). First export
without activation, inspect it, then update the pointer explicitly; an existing version cannot be
re-exported with `--activate` because the exporter correctly rejects overwrites.

```sh
export CATALOG_VERSION=fma-large-clap-general-20261105
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py export \
  --selection .cache/catalog/phase-5a-selection.json --run phase5b-expansion \
  --version "$CATALOG_VERSION"
node scripts/validate-catalog.ts --version "$CATALOG_VERSION"
```

If exclusions required a revised effective selection, use that same selection in both full
extraction and export above. Before activation, generate a public-safe release receipt from the original selection, final
zero-failure run, and exact export. `EFFECTIVE_SELECTION` must be the selection used for both final
extraction and export; it defaults below to the complete original plan.

```sh
export EFFECTIVE_SELECTION=.cache/catalog/phase-5a-selection.json
uv run --project tools/catalog --locked --extra inference python tools/catalog/processing_evidence.py \
  --candidate docs/catalog/phase-5a-selection.json \
  --selection .cache/catalog/phase-5a-selection.json \
  --effective-selection "$EFFECTIVE_SELECTION" \
  --run .cache/catalog/runs/phase5b-expansion.json \
  --catalog "public/catalog/$CATALOG_VERSION" \
  --output "docs/catalog/releases/$CATALOG_VERSION.json"
```

For reviewed exclusions, supply `--exclusions .cache/catalog/phase-5b-exclusions.json` and one
`--attempt <saved-run.json>` per referenced earlier attempt. The exclusion file is an array:
processing failures use `{id, kind: "processing-failure", runSha256, stage, category}`; exact
duplicates use `{id, kind: "duplicate-audio", runSha256, duplicateOf, audioSha256}`. The retained
record must have the same measured audio hash; retain a cleared baseline over a new duplicate.
Automatic failure exclusions accept only actual `decode-or-inference` or
`inferred-vector-validation` failures. Missing audio, storage, model initialization and other
environment problems require repair; they do not justify dropping unattempted songs.
Save each failed/interrupted run before rerunning because its run name is a checkpoint, not an
append-only history. Preserve the original candidate manifest. Unattempted additions cannot be
excluded merely for lack of storage. Inspect receipt contents before committing; no local paths,
exception messages, audio or model weights belong in it.

After the artifact and receipt pass validation and independent review, activate its already-written manifest atomically:

```sh
uv run --project tools/catalog --locked --extra inference python - <<'PY'
import os, sys
from pathlib import Path
sys.path.insert(0, 'tools/catalog')
import catalog
version = os.environ['CATALOG_VERSION']
manifest = Path('public/catalog') / version / 'manifest.json'
catalog.write_json(Path('public/catalog/current.json'), {
    'schemaVersion': 1, 'status': 'ready', 'catalogVersion': version,
    'manifestSha256': catalog.file_sha(manifest),
})
PY
npm ci
npm run lint
npm run typecheck
npm test
npm run validate:catalog -- --require-ready
npm run test:release
uv run --project tools/catalog --locked --extra inference ruff check tools/catalog
uv run --project tools/catalog --locked --extra inference ruff format --check tools/catalog
uv run --project tools/catalog --locked --extra inference python -m unittest discover -s tools/catalog/tests -v
npm run build
PREVIEW_PORT=4173 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
npm run audit:release
```

Use installed Chromium without `PLAYWRIGHT_CHANNEL` where Chrome is unavailable. Commit only public
artifacts/code/docs, open a PR, satisfy CI, integrate reviewed changes and push main. Verify public
`build-info.json`, active pointer, artifacts and real browser journeys against the integrated build.
Preserve existing tags/releases. Report pipeline readiness, successful analyzed count, published
count and unmeasured human preference separately. Stop after Phase 5B's authorized publication.
