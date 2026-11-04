# Recommendation engine (Phase 2)

The pure TypeScript engine operates on validated audio vectors; React is not a dependency.
The browser entry creates a module worker and transfers **metadata only** back to the main
thread. No audio, model, server inference or user persistence is involved.

## Scoring and retrieval

Each accepted float32 row is checked for finiteness, nonzero norm and the manifest's unit
norm tolerance, then normalized in float64. Exact dot products of unit vectors are cosine
similarities, clamped to [-1, 1] for roundoff. Stable IDs break every score tie bytewise.
`nearestNeighbors(seedId)` retains an exact single-seed baseline without feedback/diversity.

`query()` retrieves the 60 closest **eligible** rows around each selected seed and each
positive example, unions row IDs, then reranks. If verified duplicate groups leave fewer
than the requested distinct results, the per-anchor depth doubles up to the full catalog.
`eligibleCount` counts distinct eligible recording groups; `candidateCount` counts retrieved
rows. No padding occurs when fewer than 20 eligible groups exist.

The explicit initial heuristic defaults in `DEFAULT_RANKING_CONFIG` are:

| Setting | Default | Role |
| --- | --- | --- |
| `closestSeedWeight` | 0.65 | Closest selected seed; remainder 0.35 weights average selected seed |
| `positiveWeight` | 0.20 | With positives, blend 80% seed score + 20% maximum positive cosine |
| `negativeWeight` | 0.10 | Subtract 0.10 × max(0, maximum rejected-track cosine) |
| `diversityWeight` | 0.05 | Greedily subtract 0.05 × max(0, cosine to already chosen results) |
| `neighborsPerAnchor` | 60 | Initial candidate depth, expanded when necessary |

Without positives the full seed score is retained. Feedback weights are bounded to [0, 0.5]
to preserve a seed anchor; closest weight accepts [0, 1]. These choices are configurable
engineering heuristics, **not fitted or proven optimal parameters**. Reranking is over the
retrieved union, not a claim of a globally optimal blended/diverse top 20.

All selected, positive and negative recording components are excluded. Components combine
verified `recordingGroupId` and identical source-audio SHA-256 transitively. At most one
result per component is returned. Different recordings with the same title remain eligible.
No exhaustive cover/remaster/alternate-recording detection is claimed.

Explanations return the actual closest **selected** seed (even after feedback), cosine to
that seed, mean seed cosine, feedback similarities and applied diversity penalty. `score`
is ranking utility after adjustments, never a probability of enjoyment or a mood label.

## Phase 3 integration

```ts
import {
  createRecommendationClient, createSessionCatalog, createSession,
  addPositive, addNegative, editSeeds, resetRefinement, SupersededRequestError,
} from './recommend/browser.ts'

const client = createRecommendationClient()
const { tracks, manifest } = await client.load()
const sessionCatalog = createSessionCatalog(tracks) // metadata only; no main-thread vectors
let state = createSession(sessionCatalog, [tracks[0]!.id])
try {
  const result = await client.query(state)
  // Render title/artist via tracks[item.row]; closestSeedId is truthful explanation data.
  // If result.recommendations.length < 20, describe the smaller eligible pool honestly.
} catch (error) {
  if (!(error instanceof SupersededRequestError)) throw error // show current error/retry UI
}
// More like this: state = addPositive(sessionCatalog, state, resultId)
// Not this mood: state = addNegative(sessionCatalog, state, resultId)
// Seed edits: state = editSeeds(sessionCatalog, state, nextSelectedIds)
// Reset: state = resetRefinement(state)
// Query the resulting state each time; dispose client on unmount.
```

Session helpers preserve selected chip order. Engine/request identity canonicalizes ID sets
for deterministic computation. Positive feedback is idempotent and separate from the 1–5
seeds; opposing feedback for any alias of the same recording is removed. Seed/feedback
conflicts are rejected, and feedback requires seeds. Editing seed selection clears feedback;
reset clears only feedback and reproduces the seed-only result exactly. Display history
never becomes an implicit exclusion list. Session state is memory-only.

The wire protocol is `load {requestId,catalogRoot}` → `loaded {requestId,catalog}` and
`query {requestId,queryKey,query}` → `result {requestId,queryKey,result}`. Errors include
`requestId`, operation, code and message. Query identity includes seeds, both feedback sets,
limit and configuration. Concurrent loads share one promise; successful catalog changes
require a new worker; failed loads can retry. Queries may wait for an in-flight load.

The client rejects superseded promises with `SupersededRequestError`, ignores stale replies
and stale errors, and rechecks after promise continuation. A worker crash/message decode
failure rejects outstanding requests; recreate the client to retry. The client must be
queried for every changed selection, including empty selection, so obsolete work is cancelled.
A load failure can be retried on the same client. `dispose()` terminates the worker.

The browser constructor uses Vite's `new Worker(new URL(..., import.meta.url))` convention
and `import.meta.env.BASE_URL` for catalog fetches. Before Phase 3 imports it into the UI,
the production build emits a standalone module at the entry recorded for
`src/recommend/browser.ts` in `dist/.vite/manifest.json`. The public screen remains the
existing catalog status view; the engine is verified directly, not presented as a finished UI.

## Verification

`npm test` covers hand-computed fixture scores, exclusions/duplicate components, feedback,
empty/invalid inputs, pool expansion, session edits/reset, loader integrity and asynchronous
worker/client schedules. `tools/catalog/reference_scores.py` is a small independent NumPy
score oracle, not another recommendation engine. `tests/fixtures/numpy-scores.json` records
its results; the TS comparison requires absolute error ≤ 1e-12 and binds the real vector hash.

`scripts/browser-engine-smoke.mjs` exports `runEngineSmoke(engineModuleUrl)` for evaluation
inside a real browser on the preview origin. It imports the built entry and checks real
catalog/session/worker behavior. The Phase 2 report records Chromium execution and measured
results. Full user-interface end-to-end tests belong to Phase 3.
