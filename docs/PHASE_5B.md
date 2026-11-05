# Phase 5B — acquire, analyze and publish the reviewed expansion

These commands are the **next phase**, not actions performed in Phase 5A. Run from the verified
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

The 40-record smoke below comes from **additions**, ensuring it cannot consist solely of baseline
cache hits. Review decoding failures, real output dimension/norms/variation, actual coverage and
source content. Stop on unexplained errors. A deliberate interruption and rerun must reuse valid
entries; retry the same command, not a newly generated selection.

```sh
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/phase-5b-additions.json --audio-root .cache/catalog/fma_small \
  --run phase5b-smoke --limit 40
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py export \
  --selection .cache/catalog/phase-5b-additions.json --run phase5b-smoke \
  --version phase5b-smoke --output .cache/catalog/phase5b-smoke-export
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/phase-5a-selection.json --audio-root .cache/catalog/fma_small \
  --run phase5b-expansion
```

Expect cache hits for all policy-cleared baseline IDs in the selection plus successful smoke hits; do not promise every new recording succeeds.
The run report records actual successes, cache hits and failures and returns nonzero on failures.
Record successful decoding/inference counts separately. Exact duplicate audio hashes block export;
review their IDs and provenance, make a new explicitly documented effective selection if needed,
and rerun extraction using its new hash (compatible entries still reuse). Preserve original
candidate manifest and report failure/deduplication shortfalls; do not claim the target was attained
before the successful export exists. Compute time must be estimated from the actual new smoke on
the selected host; Phase 5A performed no new inference timing experiment.

## Publication preparation that must happen in Phase 5B

Before activation, make these focused existing-gate updates and review them independently:

1. Replace `scripts/evaluate-release.ts`'s hardcoded Phase 1 audit/500-ID comparison with evidence
   for the actual successfully exported catalog. Keep old-catalog fixtures explicitly historical;
   update active-catalog assertions in `tests/catalog-load.test.ts` and active browser fixture
   readers. Preserve ranking weights, session behavior, all original recording identities and
   original regression cases. Do not assert that adding candidates preserves all top-20 results.
2. `scripts/audit-release.ts` currently permits artifacts from only the active version, while Vite
   copies historical versions too. Preserve the old catalog/release in repository history and stage **only the new active version**
   for the website, so the newly reviewed publication does not also redistribute held records in
   an old catalog directory. Keep the strict artifact allowlist. Do not delete or rewrite release
   tags/history. Never broadly allow arbitrary public files.
3. Measure the actual expanded browser cold load, validation, metadata clone to the main thread,
   peak memory and five-seed/refined queries on desktop and mobile. Keep the worker architecture.
   Sequential per-row WebCrypto calls, transient Float64 duplication, and full metadata cloning
   warrant measurement. Optimize only demonstrated bottlenecks; do not weaken integrity checks.
4. Update public catalog coverage/notices and project evidence to actual successful counts. Export
   an immutable version, inspect failures and exact duplicate checks, and run all gates before
   switching the pointer. No audio, models, local evidence, caches or credentials may enter Git.

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
extraction and export above. After the new artifact passes validation and the preparatory changes
are reviewed, activate its already-written manifest atomically:

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
