# Song Neighbors

## Product decision

A user searches the prepared catalog, selects one to five songs that fit their current mood, and obtains up to twenty ranked recommendations. Results show title and artist. Users can add positive or negative feedback for this session and reset the refinement. The service does not need to play music or connect a music account.

## Initial public release

- Public GitHub repository; working slug `song-neighbors`.
- GitHub Pages website with responsive, keyboard-accessible UI.
- Genuine pretrained audio embeddings for all searchable song records.
- Real catalog coverage shown honestly; no claim that every commercial recording is available.
- Plain title/artist results and locally generated decorative graphics. Album artwork is deferred unless separately cleared.
- Feedback stays in memory for the session. Avoid persistent user accounts or analytics for v1.

## Architecture

1. Offline Python pipeline obtains permitted audio, decodes and preprocesses it, runs a pinned music encoder, validates vectors, and exports a versioned catalog.
2. React/TypeScript/Vite frontend loads that static catalog and performs exact similarity search in a browser Web Worker.
3. A pure TypeScript engine combines candidates around each selected seed, reranks for current-session feedback, removes exact/known recording duplicates, and returns up to twenty results with stable tie-breaking.
4. GitHub Actions verifies and builds the static website. In Phase 4, the exact verified build artifact is deployed to GitHub Pages.

Phase 1 started with `laion/larger_clap_music`, rejected its initialization-state checkpoint, and verified a pinned trained `laion/larger_clap_general` replacement. The model remains replaceable through the catalog contract; comparative musical-quality evaluation is later work. The frontend needs no model weights and no Python runtime.

## Catalog contract

Use `public/catalog/<catalog-version>/manifest.json`, `tracks.json`, and `embeddings.f32`, plus attribution/data notices. A small current-catalog pointer selects the active version.

- Manifest: schema version, catalog version, encoder ID/revision, preprocessing configuration, window aggregation, embedding dimension, count, normalization, float format/byte order, ordered-ID hash, metadata hash, and vector hash.
- Metadata: unique stable ID, exact vector row, title, artist, optional album, source identifiers/provenance, source page, license statement/URL, attribution, clip coverage, and any verified recording-group identifier.
- Vectors: row-major little-endian float32, finite and normalized within a recorded tolerance. File byte count is `track_count * dimension * 4`.

Keep detailed reproducibility configuration and public-safe source audio hashes in the build manifest. Exclude local absolute paths and private records. Do not assign the same recording group merely because two titles look similar.

## Phase 1 implementation status

Catalog `fma-small-clap-general-20261104` contains **500 distinct real recordings**, **169 artist
display names** (170 source artist IDs), all eight FMA-small source genre labels, and measured
**512-dimensional** embeddings. The ready pointer and all five version artifacts pass the lightweight
validator. A real 40-track CPU smoke, deliberate interruption/resume, full compatible-cache reuse,
and five-seed/twenty-result case after exclusions are verified.

The initial `laion/larger_clap_music` revision was tested and rejected after its checkpoint showed
initialization-state weights. The accepted trained replacement is `laion/larger_clap_general` at
`ada0c23a36c4e8582805bb38fec3905903f18b41`, with its same-revision audio processor. Rejected vectors
are excluded. Exact CC0/CC BY recording grants and retained notices establish the derived-data
publication basis; metadata, model and software notices remain separate.

See [Phase 1 evidence](docs/phases/phase-1.md) for measured coverage, model audit, hashes, commands
and limits. Phase 2 implements and verifies the pure ranking engine, browser loader, session helpers and worker client. See [Phase 2 evidence](docs/phases/phase-2.md).
The catalog coverage floor is an engineering scope choice, not evidence of listener preference.

## Phase 3 interface status

The complete responsive selection-to-recommendation interface is implemented and verified
against the actual browser worker and unchanged real catalog. Users search titles/artists,
disambiguate recordings, choose 1–5 seeds, request up to 20 neighbors, refine with positive
or negative preferences, and reset while preserving their seeds. Editing seeds clears results
and feedback; stale replies cannot repaint an old request. State lives only in memory.

Real catalog starting points, coverage, attribution and excerpt limitations are visible.
Loading, unavailable, retryable failure, no-match, empty and insufficient-result states are
implemented. The build has one HTML entry with repository-relative assets/worker/catalog URLs.
Chromium desktop/mobile, keyboard, reduced motion, refresh and recovery checks pass.
See [Phase 3 report](docs/phases/phase-3.md) and [PR #3](https://github.com/Arhaan2/song-neighbors/pull/3)
for tested code, independent review, evidence and integration history. Phase 4 adds the release
workflow, real-data evaluation and public verification; the [Phase 4 report](docs/phases/phase-4.md)
and deployed `build-info.json` record the actual publication status and immutable identity.

## Initial ranking behavior

Retain a single-seed cosine baseline. For multiple seeds, retrieve neighbors separately and merge the candidate IDs. Rank with a small documented blend of closest-seed and mean-seed similarity, adjusted for explicit session feedback. Use a modest diversity adjustment and stable ID tie-breaking. Treat weights as testable heuristics, not proven optimal parameters.

More like this adds an idempotent positive session preference separate from the one-to-five seed selector. Retrieve around positive-feedback tracks as well as selected seeds, and exclude positive-feedback tracks and their verified recording duplicates from the next result list so they cannot recommend themselves. Not this mood excludes that track and can modestly discourage similar candidates. Prevent contradictory feedback states. Preserve the currently selected seeds as an anchor. Editing those seeds clears refinement. Reset clears positive/negative feedback while preserving the current selected chips and restores their seed-only ranking. Include the complete seed/feedback state in request identity. Do not silently exclude every previously displayed result: unchanged input should give the same output.

Return fewer than twenty when the eligible pool is smaller, with an honest message. Do not pad with duplicates, selected songs, or fabricated titles. Similarity is not a probability that the user will enjoy a song. Explanations can identify the closest selected seed; subjective claims need evidence.

## Catalog and coverage

Start by verifying a suitably licensed subset of FMA-small. Inspect metadata, count eligible tracks, and confirm accessible audio before promising a catalog size. Target about 500 diverse real tracks and prove extraction first on 30–50. The scoped public-beta floor is 100 distinct eligible recordings across at least 10 artists, plus a five-seed/twenty-result flow after exclusions. Below that, report a technical prototype and keep the beta catalog gate pending. This is an engineering sufficiency threshold, not a scientifically established quality threshold. Artist and sound diversity are part of the coverage report.

This is a prepared-catalog project. The source may not contain the user's favorite mainstream songs. Expanding commercial-song coverage is a separate data-acquisition task, not a hidden fallback to metadata similarity.

## Phases

0. Foundation: repository, docs, schema, scaffold, CI.
1. Real catalog: permitted source, real inference, cached/exported embeddings.
2. Recommendation engine: exact similarity, multiple seeds, feedback, validation, worker.
3. Interface: complete selection-to-results experience using the real catalog.
4. Release: focused evaluation, production checks, public GitHub Pages deployment, release.

Each phase has one complete prompt and ends with a report. Local technical progress may continue through independent work when publication is temporarily pending. A public recommender release requires the real-data path and required browser verification.

## Phase 5A expansion preparation

Phase 5A prepares an approximately 5,000-recording expansion without changing the active 500-song
catalog, adaptive interface, ranking or session behavior. Cumulative metadata audit covers small
(8,000), medium (25,000), and large (106,574). Expanded source-notice review finds 786 / 1,574 /
6,258 policy-eligible records respectively; the historical small inspector still reproduces 793.
All memberships contain the same 500 currently published IDs. Seven existing IDs have unresolved
underlying-source grants and are explicitly held from future publication, leaving 493 eligible
baseline IDs; the current release remains unchanged.

The deterministic candidate manifest selects **4,925 records: 493 eligible baseline + 4,432 new**,
across 756 source artist IDs / 754 display names, with a 50-per-artist cap. This is 75 below the planning
target before audio failures/deduplication, not a claim that songs have been added. FMA-large is
the smallest archive supporting that near-5,000 batch; its 93.42 GiB download needs additional
storage (plan 110 GiB free on one volume, or 100 GiB for the archive plus 8 GiB locally).

Acquisition now supports verified resumable small/medium/large archives and atomic selected-only
extraction. A no-inference preflight verified 500 compatible existing caches against published
bytes. Encoder, processor, configuration, lock and cache rules remain unchanged, including rejection
of the earlier music checkpoint. Source content flags and exact credits are retained; metadata
eligibility is separate from audio availability, decoding, inference, deduplication and publication.

[Phase 5A report](docs/phases/phase-5a.md) · [Candidate manifest](docs/catalog/phase-5a-selection.json) · [Exact Phase 5B commands](docs/PHASE_5B.md).
Phase 5B must handle the seven explicit publication holds, measure actual delivery performance,
update the original-catalog evaluation/packaging assumptions, and publish only verified successes.
No architecture redesign is required by current evidence. Human preference remains unmeasured.


## Phase 5B execution status

Independent release preparation now supports evidence-bound expanded catalogs, active-only website
staging, pointer-based active tests, and extraction checkpoint status/timing/failure categories.
The encoder, processor, dependency lock, cache compatibility, UI and ranking rules remain unchanged.
The original 4,925-candidate plan is preserved. The 500-cache preflight and exact selection
materialization passed; a separate ignored 493-record baseline check reused caches without inference.

Expanded acquisition remains pending suitable storage. The supplied 64 GB card had 58.20 GiB free,
while the archive alone needs 93.42 GiB. Plan at least 100 GiB free on an archive volume plus 8 GiB
locally. No new audio was downloaded, decoded or embedded; no expanded catalog was activated.
The active publication remains 500 recordings, including the seven existing IDs held from the next
release. This preparation does not resolve those holds or claim Phase 5B publication is complete.

[Phase 5B evidence](docs/phases/phase-5b.md) · [Resume commands](docs/PHASE_5B.md).
