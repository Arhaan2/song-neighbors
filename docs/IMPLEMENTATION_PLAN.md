# Song Neighbors Implementation Plan

## Intended outcome

Ship a public website where someone selects one to five songs from a real analyzed catalog and receives up to twenty similar-song recommendations. The visible workflow is search, select, recommend, refine. Selected songs express the current mood. Code and documentation remain public in a dedicated GitHub repository; GitHub Pages serves the site.

This is an implementation plan, not a report of completed development. The defaults below are scoped engineering choices, not benchmark-derived guarantees.

## Architecture and boundaries

Use offline Python for audio analysis and a static browser application for use. Separate catalog generation, ranking, and UI. Cache embeddings so a recommendation request never requires downloading or analyzing raw music. A small exact vector scan is sufficient to establish v1; a vector database, hosted API, and foundation-model training are outside this release.

Recommended repository areas:

| Area | Responsibility |
| --- | --- |
| `src/catalog/` | Manifest loading, validation, row mapping, and metadata search. |
| `src/recommend/` | Pure ranking functions and worker protocol. |
| `src/components/` | Search, selected seeds, results, feedback, and status views. |
| `tools/catalog/` | Python ingestion, inference, export, and a small numerical reference. |
| `public/catalog/` | Validated public metadata, embeddings, attribution, and version pointer. |
| `tests/` | Mathematical fixtures, loader tests, and browser behavior checks. |
| `docs/phases/` | Short phase reports and next handoffs. |
| `.github/workflows/` | Verification and final Pages deployment. |

Keep source audio and downloaded model weights in ignored caches. The GitHub repository should contain the complete application and reproducible pipeline plus the lightweight public export, not multi-gigabyte source archives.

## Phase 0 Foundation

Create the project on the actual Desktop, a public GitHub repository, a minimal React/TypeScript/Vite scaffold, an isolated Python project, persistent notes, and a catalog schema. Establish meaningful scripts and a simple CI workflow. Configure the repository base path from the intended Pages slug, but do not publish an unfinished site.

Copy the templates into `AGENTS.md`, `PROJECT.md`, and `PROGRESS.md`; copy this plan and the catalog policy into `docs/` when the packet is available. Resolve package versions against the actual environment and commit lockfiles. Use npm for the frontend and uv for the isolated Python project unless a concrete compatibility issue warrants a documented alternative.

Acceptance:

- F0.1: Actual checkout/root/remote/working tree inspected; unrelated folders preserved.
- F0.2: Public GitHub visibility verified when remote access works. If access is absent, local work completes with publication pending.
- F0.3: Clean install, lint, typecheck, and production build succeed; only meaningful existing tests are required.
- F0.4: Catalog schema and missing-catalog UI state exist; no fake working recommendations.
- F0.5: Initial public commit/CI state and next handoff are reported accurately.

## Phase 1 Real catalog

Inspect the actual source metadata and license distribution before selecting music. Use the catalog policy. Confirm a small real inference path, then scale toward roughly 500 tracks. Persist successful results incrementally, record failures and excluded records, and support interruption/resume.

Pin the model revision and preprocessing. Derive the embedding dimension from real output. For available short clips, use a fixed documented window policy supported by the checkpoint. With longer permitted files, sample several positions. Aggregate consistently and record that analysis reflects available clip content rather than the whole composition.

Export a versioned manifest, track metadata, normalized little-endian float32 vectors, and attribution. Validate file hashes, counts, vector norms, ID order, dimensions, and absence of local/private information. Reuse cached vectors only when source hash, model revision, preprocessing, and aggregation match.

Acceptance:

- C1.1: Actual source acquisition and per-record inclusion basis recorded; eligible counts measured.
- C1.2: Genuine encoder inference completed on real audio with saved commands/results; synthetic fixtures excluded from production.
- C1.3: Export invariants pass and every public record has provenance and attribution.
- C1.4: A rerun reuses compatible cached results; an interrupted run resumes without duplicating or misaligning rows.
- C1.5: The public-beta catalog contains at least 100 distinct eligible recordings across at least 10 artists and supports a documented five-seed/twenty-result case after exclusions. Target 500 remains a target. The floor is an engineering scope choice; below it, report a technical prototype with beta coverage pending rather than fabricate completion.
- C1.6: Software, model, metadata, and recording licenses are distinguished. No raw archives or weights enter Git.

If real source access is unavailable, complete ingestion/schema/cache logic, report the precise missing source step, and allow independent mathematical/UI development to proceed with labeled fixtures. Do not promote those fixtures into a purported real public catalog.

## Phase 2 Recommendation engine

Implement pure TypeScript ranking and a browser worker. Start with exact cosine similarity on normalized vectors. Compute each seed's nearest neighbors and union the candidate IDs. Use a documented blend of closest and mean seed similarity, with explicit session feedback and a modest diversity adjustment. Keep a simple baseline and deterministic tie-breaking.

Choose a candidate pool large enough to provide up to twenty eligible results, expanding to the full small catalog when necessary. Retrieve around positive-feedback tracks too. Always exclude selected seeds, positive-feedback tracks, explicitly rejected tracks, and their verified same-recording groups. Do not deduplicate distinct recordings solely from title text. Keep positive feedback separate from the one-to-five selected seeds, idempotent, and resettable. Editing selected seeds clears refinement; reset clears feedback while preserving the current seed chips and restoring their seed-only ranking. Include all seed/feedback state in request identity. Avoid permanently rejecting a song because of a session-specific action.

The worker owns its vector memory after initialization, returns serializable results, and carries request IDs. If a newer request has superseded an older one, the UI must ignore the stale result. Handle worker/load errors explicitly.

Acceptance:

- R2.1: Hand-calculated vector fixtures establish cosine ordering, ties, and exclusion behavior.
- R2.2: A small independent Python/NumPy reference and TypeScript agree within a declared floating-point tolerance on fixed test cases; compare the underlying scores, not just identical copied implementation.
- R2.3: Multiple seeds, duplicate selection, missing IDs, empty input, undersized pools, positive/negative feedback, seed editing, and reset behave as specified. Positive examples cannot recommend themselves, their neighborhoods can enter the pool, and reset preserves current seed chips.
- R2.4: Corrupt, mismatched, nonfinite, and zero vectors fail clearly.
- R2.5: Latest-request-wins works; a stale worker response cannot replace current results.
- R2.6: Real-catalog smoke runs demonstrate selection-sensitive output, with no claim of verified human enjoyment.

## Phase 3 Interface

Build one polished responsive screen. The main interaction is a title/artist search, one-to-five selected chips, a Recommend action, and title/artist result cards. Show catalog coverage naturally. Include example selections drawn from the real available catalog, clear empty states, load/retry states, and a useful result when a typed song is outside the catalog.

More like this and Not this mood update session preferences. Show that refinement is active and provide reset. Editing selected seed chips clears refinement; reset clears feedback and keeps the current selected chips. Keep state in memory for v1. Use accessible labels, keyboard search/selection, visible focus, readable contrast, and reduced-motion behavior where animation exists. Use restrained original decorative styling instead of uncleared album art. Keep engineering details in an About/Catalog disclosure rather than cluttering the main flow.

No backend or provider account should be required to operate the generated production build. Avoid routes for v1 unless they add real value; a single entry page simplifies direct refresh on Pages. All asset, worker, and catalog references must respect the Vite project base.

Acceptance:

- U3.1: A new visitor can choose seeds, generate recommendations, refine, and reset.
- U3.2: Results come from the real indexed catalog and actual engine; no hardcoded recommendation lists.
- U3.3: No-results, unsupported song, catalog-load failure, and empty seed states are clear.
- U3.4: Production-build desktop and mobile-viewport flows pass in Chromium, including keyboard input and rapid selection changes.
- U3.5: Refresh and all static asset/worker/data URLs work under the repository subpath.
- U3.6: Lint, typecheck, relevant tests, catalog validation, and production build pass.

## Phase 4 Evaluation and public release

Review the real-catalog behavior on several distinct seed sets and compare the single-seed baseline with the chosen multiseed rule. Record catalog coverage, duplicate behavior, input/output examples, payload size, and observed load/ranking time on the actual test environment. Report measurements as observations, not promises about all devices.

Prepare an optional listening worksheet: two judgments, sounds similar and want to hear it now. Human listening results remain unmeasured until a person supplies them. That does not block an accurately described technical beta, and mathematical tests cannot substitute for them.

Finalize source and release documentation before the release build. Use GitHub Actions to validate, build, browser-test the production output, upload that exact artifact, and deploy it to Pages. Use the current official Pages Actions and required permissions. Ordinary PR checks validate/build without deploying. Keep audio/model processing out of web CI. `build-info.json` identifies the source commit and catalog version. Verify public visibility and signed-out access, then tag that exact live-verified source commit. Report later evidence-only documentation commits separately; they must not move the release tag or cause another deployment when shipped assets are unchanged.

Acceptance:

- P4.1: Relevant technical gates pass on the integrated revision.
- P4.2: Build output has real catalog data and public-safe attribution; no model/audio/cache/private files leak into the artifact.
- P4.3: Deployment uses the verified artifact; the live build/catalog identifiers match the intended run.
- P4.4: Signed-out desktop/mobile viewport testing on the actual Pages URL proves search, select, recommendations, refinement, reset, and refresh.
- P4.5: README, release notes, setup steps, catalog-extension instructions, and known limitations describe actual behavior.
- P4.6: Public repo URL, live URL, commit/PR/CI/deployment evidence, and a preserved `v0.1.0` release tag are reported. If publication is blocked, local readiness and the exact remote blocker are reported separately.

## Bounded recovery

Classify blockers as code defects, data/model issues, unavailable tools, access problems, or remote service failures. Reproduce the smallest failure, fix the actual cause, rerun affected verification, and resume only the authorized phase. Do not expand features, relax meaningful gates, invent completion evidence, or convert optional tools into new requirements.

Do not halt independent local work over unavailable GitHub credentials. Do not call a release verified without required live checks. Do not repeat broad test suites after documentation-only edits merely to refresh a report's own SHA.

## Later work

Only after this release: broader music coverage; section-of-song queries; comparisons between encoders; more expressive feedback controls; optional portable catalog import. Each requires its own scoped proposal. The initial project is already complete when the defined prepared-catalog recommendation flow works publicly and honestly.
