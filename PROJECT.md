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

Start with `laion/larger_clap_music`; verify and pin the actual model revision and compatible dependencies during implementation. The model is replaceable through the catalog contract, but comparing multiple encoders is later work. The frontend needs no model weights and no Python runtime.

## Catalog contract

Use `public/catalog/<catalog-version>/manifest.json`, `tracks.json`, and `embeddings.f32`, plus attribution/data notices. A small current-catalog pointer selects the active version.

- Manifest: schema version, catalog version, encoder ID/revision, preprocessing configuration, window aggregation, embedding dimension, count, normalization, float format/byte order, ordered-ID hash, metadata hash, and vector hash.
- Metadata: unique stable ID, exact vector row, title, artist, optional album, source identifiers/provenance, source page, license statement/URL, attribution, clip coverage, and any verified recording-group identifier.
- Vectors: row-major little-endian float32, finite and normalized within a recorded tolerance. File byte count is `track_count * dimension * 4`.

Keep detailed reproducibility configuration and public-safe source audio hashes in the build manifest. Exclude local absolute paths and private records. Do not assign the same recording group merely because two titles look similar.

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
