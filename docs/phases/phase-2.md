# Phase 2 — browser recommendation engine

November 4, 2026 (America/Los_Angeles). Implementation and local verification complete;
public integration is tracked by [PR #2](https://github.com/Arhaan2/song-neighbors/pull/2).
The tested implementation revision is `d20dba8f946f244d50310610967ea3eb6d0a9b79` (the
browser checks ran against its final precommit code state). Evidence/docs follow in a
separate commit. Implementation CI [41914409830](https://github.com/Arhaan2/song-neighbors/actions/runs/41914409830) passed. The PR records the final head, CI and merge revision without circular hashes.
**No Phase 3 interface or Phase 4 deployment/tag was started.**

## Preflight and ownership

Inspected the actual independent repository `~/Desktop/song-neighbors`, its clean `main`,
origin `https://github.com/Arhaan2/song-neighbors.git`, refreshed `origin/main` and Phase 1
handoff. Both main references were `f2ed1079d23edaf73b23bf731eee56818f223e21`. GitHub confirmed
PUBLIC visibility and unprotected main. Neither visibility nor protection settings changed.
The supplied build pack and unrelated changes were preserved.

Created `codex/phase-2-engine` as a linked worktree of that actual repository in a writable
temporary directory. Two implementation workers owned disjoint ranking/session and loader
files. The coordinator owned protocol/client/runtime, configuration, oracle integration,
browser verification, docs and Git. A separate agent reviewed code and behavior independently.
Agent review is not a human GitHub approval.

## Real data gate and identity

The real-data gate remains satisfied by the unchanged Phase 1 catalog:

- Catalog: `fma-small-clap-general-20261104`, 500 distinct source recordings, 169 artist
  display names / 170 source artist IDs, eight source genre labels, measured dimension 512.
- Encoder: trained `laion/larger_clap_general`, immutable revision
  `ada0c23a36c4e8582805bb38fec3905903f18b41`. The rejected initialized music checkpoint remains excluded.
- Manifest SHA-256: `b57bda0fb968b5feb49bb4ad7f33ea61ff67647483f496b519edea85b576ae11`.
- Vector SHA-256: `0b29eefec5e6f708f1be7bc2d25d5b3e4970b4f036e698c7ce8d775389aa9054`;
  1,024,000 bytes, little-endian float32, row-major.
- Supported analysis configuration digest:
  `df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb`.

The loader checks pointer/manifest/file/ordered-ID/per-row vector hashes, exact row alignment,
source associations, approved analysis configuration and per-row build configuration, shape,
finite/nonzero/unit vectors, then normalizes valid float32 rows in float64. It fetches pointer,
manifest, metadata, vectors and build identity once per successful worker initialization.
Full provenance/publication/attribution validation remains the offline build gate. The loader
does not reinterpret licensing or claim to audit new sources. No source audio or model inference
was needed or regenerated in Phase 2; no synthetic fixture enters `public/`.

## Algorithm and state contract

See [the engine API and exact formulas](../../src/recommend/README.md). Exact cosine uses
normalized dot products with roundoff clamp to [-1, 1]. The single-seed `nearestNeighbors`
baseline omits feedback and diversity. General queries take the closest 60 eligible rows
around **each selected seed and positive example**, union IDs and rerank. The depth doubles
up to the full catalog when needed to fill the requested number of distinct eligible groups.

Defaults are explicit and configurable: seed score = 0.65 × closest selected-seed cosine +
0.35 × average selected-seed cosine; with positives, use 0.80 × seed score + 0.20 × maximum
positive cosine; subtract 0.10 × max(0, maximum negative cosine). Greedy result assembly
subtracts 0.05 × max(0, maximum cosine to already selected results). These are initial
heuristics, not optimized or validated preference parameters. Candidate-limited reranking
is not a globally optimal blended/diversity ranking guarantee.

Stable ID order resolves all ties. Seeds, positives, negatives and their transitive verified
recording components are excluded. Components join exact audio hashes and verified group IDs;
one result per component survives. Title/artist equality does not establish a duplicate.
The current real catalog has 500 unique audio hashes and no explicit recording-group fields;
transitive grouping is therefore tested with clearly isolated mathematical fixtures.

Session feedback is separate from the 1–5 selector. Positive feedback is idempotent, and
opposing feedback for the same recording component is removed. Selected seeds cannot be
converted into feedback; they remain the anchor. Changing selected chips clears refinement;
reset clears feedback while preserving current chip IDs/order and restoring their seed-only
ranking. Empty selection gives no recommendations. Invalid IDs/conflicting direct queries
fail explicitly. Request identity contains complete seeds, positives, negatives, limit and
configuration. Display history is never silently excluded. Results can be fewer than 20.

Closest selected seed, exact seed similarities, feedback similarities and diversity penalty
are returned as explanation data. No enjoyment percentages or inferred mood descriptions
are generated. Session state has no persistent storage or analytics.

## Worker and review repairs

The worker owns vectors and all loading/validation/scoring. Its protocol has `load`, `loaded`,
`query`, `result`, and correlated `error` messages. Concurrent loads share one promise, queries
can await that load, failed loads can retry, and changing a successfully loaded catalog requires
a new worker. Main-thread helpers use metadata only; vectors are not sent in replies. The
initial normalized loader buffer can be collected after the engine takes its owned copy.

Every query has a monotonically increasing request ID and full query key. New queries reject
superseded promises; stale results/errors cannot resolve current work. The client checks again
after promise continuation. Worker crashes/message decoding errors reject pending work and
require client recreation; invalid input/load errors are explicit and recoverable as documented.

Independent review found and repaired two integration problems: session actions originally
required an engine with vectors (now a metadata-only context), and an old success/error could
settle before a new query but run its promise continuation afterward (now both become explicit
cancellation). Regression tests cover both event schedules. A malformed-row test briefly
hit shape validation first after its fixture grew; its fixture was repaired to isolate row
identity. Final independent review found no remaining actionable implementation defects.

## Exact verification and results

From the linked phase worktree:

```sh
npm ci --cache /private/tmp/song-neighbors-npm-cache
npm run lint
npm run typecheck
npm test
npm run validate:catalog -- --require-ready
npm run build
```

All passed. **55 TypeScript tests in seven files** cover hand-calculated ordering and ties,
multiseed neighborhood union, positive-neighborhood discovery, positive self-exclusion,
negative penalties, transitive duplicates, pool expansion, fewer-than-20 output, zero/NaN/Inf
vectors, shape/manifest/hash/ID/config mismatches, empty/invalid inputs, feedback conflicts,
seed edits, reset, load retry/coalescing, request identity, worker failures and stale replies.

`tools/catalog/reference_scores.py` uses NumPy 2.3.4 only to normalize fixed vectors and
compute inner products and the two-seed blend; it is not a second production engine. Ran:

```sh
# Existing Phase 1 Python 3.12 environment; no new inference or downloads.
~/Desktop/song-neighbors/tools/catalog/.venv/bin/python tools/catalog/reference_scores.py > tests/fixtures/numpy-scores.json
~/Desktop/song-neighbors/tools/catalog/.venv/bin/ruff check tools/catalog
~/Desktop/song-neighbors/tools/catalog/.venv/bin/ruff format --check tools/catalog
~/Desktop/song-neighbors/tools/catalog/.venv/bin/python -m unittest discover -s tools/catalog/tests -v
```

**16 Python tests and Ruff pass.** NumPy regeneration exactly matches the checked fixture.
TypeScript agrees with nine synthetic score values and four fixed real pair scores within
absolute tolerance **1e-12**, with catalog version and vector hash bound by the test.
For example `045099 → 045100`: NumPy 0.964205199149891, browser 0.9642051991498909;
`003832 → 006855`: NumPy 0.9156093335148492, browser 0.915609333514849.

Production build emits the unchanged status screen, standalone engine entry and module worker.
The build's Vite manifest maps `src/recommend/browser.ts` to its hashed module URL.
[Official Vite worker guidance](https://vite.dev/guide/features.html#web-workers) and
[base-path guidance](https://vite.dev/guide/build.html#public-base-path) informed the constructor
and static asset URLs. No API server or browser model inference is present.

Ran the saved browser verifier with the installed design skill's zero-dependency Chromium
CDP helper (a local verification dependency, not a production dependency):

```sh
npm run preview -- --host 127.0.0.1 --port 4174 --strictPort
node scripts/verify-engine-browser.mjs ~/.codex/skills/design-taste-frontend/scripts/lib/cdp.mjs http://127.0.0.1:4174/song-neighbors/ docs/phases/phase-2-browser.json
```

Port 4173 was already owned by an existing preview. The first attempted module import reached
that older build and failed; it was preserved and this phase used 4174. The sandbox initially
blocked registry DNS and local binding; authorized scoped commands succeeded. Neither is
recorded as a product defect. No hidden no-op `test:e2e` was added; this script exercises the
implemented engine directly before the full Phase 3 interface exists.

[Browser evidence](phase-2-browser.json): Chrome **156.0.8078.80**, desktop **1440×900** and
mobile viewport **390×844**, both under `/song-neighbors/`, no uncaught page errors. Each checks
real module-worker loading, row mapping, metadata-only session helpers, coalesced load,
determinism, positive idempotence/exclusion, negative exclusion, reset, seed edits,
latest-request-wins, worker query errors, empty selection and five-seed/twenty-result behavior.
Measured local loads were approximately 66.6 ms and 43.8 ms; observed queries ranged from
0–13.8 ms and 0.1–13.1 ms, including the empty query. These are one-machine observations,
not device-wide performance guarantees.

Seed-sensitive real results at both viewports:

| Selected seed | First three returned records |
| --- | --- |
| `fma:045099` (Spell — Rolemusic) | `045100` Leafless Quince Tree — Rolemusic; `071506` Cloudy — Subway Sonicbeat; `071508` Burn Down the Monostery — egr |
| `fma:003832` | `006855` This Old Love — Lior; `006856` Autumn Flow — Lior; `006854` Lost in Your — Lior |

Five seeds `003832,003950,004037,004070,004071`, positive `068551`, negative `113511`
(all `fma:` IDs) leave **493** eligible recordings, retrieve **195** candidate rows and return
**20** distinct results. Exact result IDs are in the browser evidence. These cases establish
selection sensitivity and engineering behavior, not human musical preference.

## Phase 3 handoff and limits

Import `createRecommendationClient` and session helpers from `src/recommend/browser.ts`.
Load once, create the metadata-only session context, hold chip/feedback state in memory,
query on every change (including empty selection), ignore only `SupersededRequestError`,
show current load/query errors and dispose on unmount. Add the actual search/selector/results,
accessible loading/refinement/reset states and honest small-pool messaging in Phase 3.

Both required design skills were read and their agency/reset/state guidance applied. No
layout, styling, animation or controls changed, so no new visual direction or redesign
inspection was introduced. The public-facing screen still shows catalog availability/credits;
this is a functioning browser engine verified directly, not a complete public discovery UI.

Listening/preference evaluation remains **unmeasured**. The catalog represents short permitted
FMA excerpts, not whole songs or universal commercial coverage. Weights and modest diversity
need later evaluation. Exact scan is appropriate for 500 rows; larger-catalog performance is
unproven. No exhaustive musical-duplicate recognition is claimed. Phase 3 and release remain
separate tasks. Stop after reviewed public integration of Phase 2.
