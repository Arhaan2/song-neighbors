# Phase 5B — release preparation complete; expanded acquisition awaits storage

## Outcome and boundary

The approved **4,925-candidate** expansion remains unchanged: **493 cleared existing records +
4,432 additions**, with 756 source artist IDs / 754 display names and the 50-per-artist cap.
No large audio archive was downloaded; **zero additions were decoded, inferred, exported or
published**. Expanded deduplication and actual artist coverage remain unverified. The active
publication remains `fma-small-clap-general-20261104`: **500 recordings**, 170 source artist IDs /
169 display names. The seven held IDs remain in that historical publication and are prohibited in
the next expanded release. No new resolution of their source-policy uncertainty is claimed.

The supplied 64 GB card had **62,488,444,928 bytes free (58.20 GiB)**; local free space was
**33,595,289,600 bytes (31.29 GiB)** at the recorded inspection. Even their sum is below the
**100,306,112,191-byte (93.42 GiB)** archive. The verified acquisition path requires the complete
archive and checksum before selected extraction. The card was left untouched. No files were deleted,
no paid storage provisioned, and no smaller dataset substituted.

Smallest remaining prerequisite: an existing writable archive volume with **at least 100 GiB free**,
plus **8 GiB locally**, or roughly 110 GiB on one volume. Storage is an external prerequisite for
acquisition; independent release preparation and regression verification proceeded.

## Implementation

- An independent TypeScript release gate binds the approved Phase 5A manifest, reconstructed full
  original selection, exact effective selection, serialized processing attempts, successful export,
  per-row audio/cache identities, source policy, provenance and compatibility configuration.
  Missing/unexpected/held records, unexplained omissions and changed baseline audio are rejected.
  Duplicate exclusions require measured equal audio hashes and prefer retained baseline identities.
  Missing storage/audio/model environment cannot become a fabricated processing exclusion.
- Public-safe Python receipt generation prepares `docs/catalog/releases/<version>.json` only from
  actual runs and an actual export. No expanded receipt was produced in this blocked execution.
- Active catalog evaluation/fixtures follow the pointer. Historical NumPy fixtures remain explicit.
  Independent cosine, deterministic ranking, identity, one-to-five seeds, feedback, reset and stale
  response checks remain. The historical exception pins the original manifest hash exactly.
- Vite stages only the validated active catalog, generates its coverage notice and keeps the strict
  artifact allowlist. Historical directories remain in source/history without entering the next
  website. Shipped third-party notices link the actual active version.
- Extraction checkpoints record status, requested count, UTC timestamps, elapsed time and failure
  stage/category, retaining established input hashes without private exception strings. Interruptions
  checkpoint successful rows; compatible resume reuses them. The combined `decode-or-inference`
  category does not falsely distinguish failures that the encoder does not separately instrument.

Encoder/processor, lock, decoding, resampling, windowing, aggregation, normalization, cache key and
frontend ranking/UI behavior are unchanged. The rejected music checkpoint remains excluded.

## Actual bounded processing evidence

The unchanged locked runtime was synchronized. `preflight.py` verified all **500 baseline caches**
against published bytes, exact model artifacts and configuration
`df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb`.
`expansion.py materialize` reproduced the original selection hash
`f43f7385252cbb095af91429c199df58cd5fff95a5d20c3142bd725835b5ea01` and 4,432-addition selection
`7b134a7f7705a2b751e85129581289baffdfb7c4ef33bb40d98639c03ca31160`, reusing verified metadata.
The detailed evidence remains ignored locally. The candidate manifest and active pointer are
byte-identical to Phase 5A. `delivery.py` reproduced the planning assessment; it is not actual expanded performance.

An **ignored local verification selection** containing only the 493 cleared baseline recordings
reused **493 caches, inferred 0, failed 0** in 1.092 seconds after configuration/artifact preflight.
Its nonactivated local export passed independent artifact validation: **493 rows, 512 dimensions,
168 artist display names / 169 source artist IDs**, norms 0.9999999943–1.0000000051. This proves
cache/export/schema compatibility with retained expanded-policy notices. It is **not** the required
40-addition smoke, the effective expansion selection, a new listening test, or a public release.
Original inference provenance stays attached to reused rows.

No new-audio inference rate or completion-time estimate is available. Source content flags remain
as reviewed in Phase 5A; no new audio listening or human preference evaluation was performed.

## Verification and independent review

Local final source checks passed: `npm ci`, lint, TypeScript, **84 web unit tests**, ready-catalog
validation, real-catalog evaluation (500 rows / five seed sets), **40 Python tests**, Ruff lint and
format, and `git diff --check`. The production build, artifact audit and Chromium checks are also
required on the clean source commit before integration. CI/integration evidence is recorded
separately after that source is finalized. The preparation was reviewed independently; review caught missing full-configuration pinning and overly broad failure
exclusions, which were repaired with regression checks. Reviewer also confirmed the encoder,
configuration construction, cache-key/validation functions, active pointer, dependency lock and
candidate manifest were preserved.

Preintegration browser verification passed **20/20 Chromium desktop/mobile viewport cases**, including
search, one/five seeds, both feedback actions, exact reset, generated/plain views, keyboard use,
loading/error/no-match handling and responsiveness. Both release journeys matched all 16 staged files
and had no page/request failures. These tests exercised the existing **500-record** catalog.
Chrome 156.0.8078.80 on this unthrottled host measured navigation-to-ready at 135.78 ms desktop /
138.60 ms mobile viewport; one/five-seed click-to-20-results at 57.69/60.57 ms and 54.71/57.91 ms.
These are single local observations, not expanded cold-network, memory, physical-device or general
performance claims. The baseline Node evaluation measured 18.549 ms catalog validation and
2.742 ms engine initialization, with a 21.444 ms median five-seed query over ten repeats. Its runtime
catalog is 2,222,958 raw bytes. Node timings exclude network/browser rendering and are separate
from the browser observations. Actual expanded validation/initialization, memory and responsiveness remain pending.

## Exact resume

Follow [the execution runbook](../PHASE_5B.md), starting with its storage/preflight and reproducible
selection commands. Set `ARCHIVE_CACHE` to a suitable existing private directory; the supplied
64 GB card is too small. From the repository root, acquisition resumes with:

```sh
: "${ARCHIVE_CACHE:?Set a private archive directory with at least 100 GiB free}"
uv run --project tools/catalog --locked --extra inference python tools/catalog/source.py download large \
  --cache "$ARCHIVE_CACHE"
uv run --project tools/catalog --locked --extra inference python tools/catalog/source.py extract \
  --subset large --audio-archive "$ARCHIVE_CACHE/fma_large.zip" \
  --selection .cache/catalog/phase-5b-additions.json --output .cache/catalog/fma_small
```

Then execute the 40-addition real smoke with interruption/resume evidence, complete the full run,
resolve actual failures/duplicates, export an unused immutable version, generate/validate the receipt,
review and atomically activate locally. Update actual coverage, run all product/delivery gates,
integrate through reviewed CI and verify the exact expanded Pages artifact. The runbook contains the
commands and receipt/exclusion formats. Until then, Phase 5B expanded publication is incomplete.
