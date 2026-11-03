# Phase 0 — foundation

Date: November 3, 2026 (America/Los_Angeles). Scope: foundation only; Phase 1 has not begun.

## Location, authorization and integration

The supplied build pack was available at `~/Desktop/song-neighbors-codex-pack`. Inspection found that directory inherited an unrelated Git root at the user's home directory, on `master`, without an origin, with unrelated existing changes. None of that repository was staged, committed, reset or otherwise changed. The requested target did not exist. A separate `~/Desktop/song-neighbors/.git` was initialized on `main`, and its root was verified before work.

Imported the build pack's `AGENTS.md`, `PROJECT.md`, and `PROGRESS.md` templates, all plan/policy/source documents, and all phase/recovery prompts. Progress is now an implementation record; future plan and prompt files remain scoped instructions, not completion claims.

The connected GitHub identity and authenticated CLI both resolved to **Arhaan2**, ID 59648536. A first sandboxed CLI check misleadingly reported an invalid token; the network-enabled `gh api user` check succeeded. The intended repository returned 404 before creation. Created [Arhaan2/song-neighbors](https://github.com/Arhaan2/song-neighbors) explicitly public; independently verified `visibility: public`, `private: false`, default branch `main`, and `has_pages: false`. Origin is the matching HTTPS Git URL. No unrelated repository was reused or had its visibility changed.

Two implementation agents owned disjoint UI and catalog/Python files. The coordinator owned shared configuration, docs, verification, integration and Git. A third independent reviewer found no actionable Phase 0 code defect; a notice wording nit was corrected. Agent review is not a human GitHub approval.

## Delivered

- React/TypeScript/Vite project with local npm dependencies and committed lockfile; explicit `/song-neighbors/` asset base.
- `src/catalog`, `src/recommend`, `src/components`, `tests`, `public/catalog`, and `docs/phases` boundaries. Ranking is a documented future boundary, not a placeholder engine.
- Honest responsive unavailable-catalog screen, zero analyzed tracks, native planned-flow disclosure, skip link, visible focus, and reduced-motion support. No fabricated songs or recommendations.
- Strict structural schemas and inferred TypeScript types for the pointer, manifest, tracks, row mapping, source membership, immutable encoder identity, byte counts, hashes and provenance. [Contract details](../CATALOG_CONTRACT.md) define normalized little-endian float32 storage, exact hash conventions, preprocessing/windows/aggregation, attribution, and later export validation.
- `public/catalog/current.json` explicitly `not-ready`, without a guessed catalog dimension or encoder revision.
- Separate uv-managed Python 3.12 project and lockfile. It contains Ruff configuration, with no acquisition/inference/export source yet.
- Meaningful lint/typecheck/contract-test/build commands and read-only CI on push/PR. CI contains no audio/model downloads, inference or Pages deployment.
- Source audio/weights/cache/credentials/private-manifest/build ignore rules, MIT license for original code, and separate third-party/data notices.

Resolved local versions: Node 24.18.0, npm 11.16.0, React/React DOM 19.3.1, TypeScript 7.0.2, Vite 8.3.5, React plugin 6.2.1, Oxlint 1.91.0, Vitest 5.1.0, Zod 4.6.7, uv 0.13.5, Python 3.12.15, Ruff 0.17.3. Dependencies were selected from the current official template, documentation and package registry. Exact transitive versions are in lockfiles. See [sources](../SOURCES.md).

## Exact verification and outcomes

Tested code state: the Phase 0 scaffold before its initial commit, with final production assets `index-guxZoWfs.js` and `index-a5yl92GL.css`. The resulting Git commit is reported separately; this file does not try to embed its own SHA.

| Command / check | Actual result |
| --- | --- |
| `npm ci` | Pass; 50 packages installed, audit reported 0 vulnerabilities. npm warned about an unapproved optional macOS `fsevents` install script; no script approval was needed for the passing build/tests. |
| `npm run lint` | Pass; configured Oxlint, warnings denied. |
| `npm run typecheck` | Pass; strict app, tests and Vite configuration. |
| `npm test` | Pass; 1 file, 5 grouped structural/invariant tests. |
| `npm run build` | Pass; 18 modules; HTML 0.76 kB, CSS 3.63 kB, JS 221.92 kB (69.45 kB gzip). |
| `uv sync --locked` in `tools/catalog` | Pass; isolated environment and lockfile agree. |
| `uv run --locked python --version` | Python 3.12.15. |
| `uv run --locked ruff check .` | Pass; configuration only at this phase, not inference validation. |
| `uv run --locked ruff format --check .` | Pass; one configuration file already formatted. |
| `git check-ignore` representative audio, weights, `.venv`, cache, `.env.local`, private-manifest and `dist` paths | Expected paths ignored; the public pointer remains trackable. |
| One-off production-file audit | Pass; correct `/song-neighbors/assets/` URLs and not-ready pointer; no audio, model weights, local path markers, structural test fixtures, tracks or embeddings in `dist`. |

The first typecheck failed with TS2835 because the Node configuration expected explicit NodeNext import extensions. It was corrected to Vite-compatible ES modules/bundler resolution; the test import also has an explicit `.ts` extension. Subsequent lint, typecheck, tests and build passed. A worker initially tried ESLint despite the official template using Oxlint; that invocation failed because no ESLint config exists. The configured Oxlint command then passed; no ESLint dependency was added. A discouraged static import from `public/` was removed before the final build; the foundation screen now uses an explicit static not-ready message.

## Production browser evidence

Local production preview: `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort`, opened at `http://127.0.0.1:4173/song-neighbors/`. The built site passed Chromium inspection at 1440, 768 and 390px. Additional 320px collapsed/expanded checks found no horizontal overflow (`scrollWidth === clientWidth === 320`). Refresh preserved the UI; Tab reached the skip link, Enter focused main, the next Tab reached the native disclosure, Enter expanded it and Space collapsed it. Warning/error collection was empty. JS, CSS and `catalog/current.json` all returned HTTP 200 under the repository subpath.

The installed design skill's `lint.mjs src` passed with 0 failures and 0 warnings. Its `inspect.mjs --app http://127.0.0.1:4173/song-neighbors/ --allow font-not-dealt` passed with 0 failures and 1 `unused-canvas` warning. The warning is a centered-layout heuristic: the actual desktop margins are both 170px. The font allowance records the deliberate platform-font choice. All six final generated screenshots were viewed; the independent reviewer also inspected desktop/mobile, and the coordinator inspected mobile.

Saved evidence: [desktop](assets/phase-0-desktop.jpg), [tablet](assets/phase-0-tablet.jpg), [mobile](assets/phase-0-mobile.jpg).

The design follows True-black flat, seed 1484283753, with platform fonts instead of the dealt Inter to avoid external font loading. No redraws. [Design notes](../DESIGN.md) explain the bounded Phase 0 adaptation. No third-party pictures, music or artwork are included.

## Publication evidence

The public repository and origin are verified. Initial scaffold push and remote CI are pending in this precommit report; a subsequent evidence-only update will record the tested code commit and actual CI result. No Pages site, deployment or release tag is created in Phase 0.

## Limitations and Phase 1 handoff

There are **0 real analyzed tracks and 0 artists**. Model revision, vector dimension, source eligibility, musical quality and human listening preference are unmeasured. Structural fixtures live only under `tests/`; passing them does not validate real audio or rights. Binary decoding, file-hash verification, vector norms, source acquisition, caching and export validation remain Phase 1 work. Browser loading/ranking/worker behavior is Phase 2; the full user flow is Phase 3; Pages publication is Phase 4.

For Phase 1, inspect the eligible source metadata and publication basis under `CATALOG_POLICY.md`; choose compatible inference dependencies in the isolated uv project; pin the exact immutable checkpoint and processor configuration; prove extraction on 30–50 real permitted tracks; measure the embedding dimension; implement cache/resume, reproducibility records and validated export/attribution. Target about 500 tracks, with the documented 100-recording/10-artist beta floor; report any shortfall honestly. Do not turn the pointer ready until all actual export gates pass. Do not introduce synthetic production data or heavy extraction into ordinary web CI.
