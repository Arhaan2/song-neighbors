# Song Neighbors

Search a prepared catalog, choose **1–5 songs**, and receive up to **20 audio-based neighbors**. Refine the current session with **More like this** and **Not this mood**; **Reset refinement** restores the original ordering for your selected songs.

[Open Song Neighbors](https://arhaan2.github.io/song-neighbors/) · [Public repository](https://github.com/Arhaan2/song-neighbors) · [Release evidence](docs/phases/phase-4.md) · [Short demo](docs/DEMO.md)

This public beta uses **500 real recordings**, **169 artist display names** (170 source artist IDs), eight FMA-small source genre labels, and **512-dimensional audio embeddings**. It lists titles and artists; it has no playback, account connection, hosted inference, or analytics. All selection and feedback state stays in memory and clears on refresh. Human listening quality and preference are **unmeasured**; [the listening worksheet](docs/LISTENING_WORKSHEET.md) separates those questions.

The deployed [build-info.json](https://arhaan2.github.io/song-neighbors/build-info.json) identifies the site's source commit and catalog version. [PROGRESS.md](PROGRESS.md) and [Phase 4 evidence](docs/phases/phase-4.md) record implementation, verification and publication separately. A later evidence-only documentation commit is not necessarily the deployed revision.

## Run locally

Use Node **24.18.0** (`.nvmrc`) and npm **11.16.0**. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL Vite prints, including `/song-neighbors/`. No API keys or Python environment are needed for the website. To inspect a production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/song-neighbors/`. The Vite base matches the repository slug; catalog and attribution URLs use `import.meta.env.BASE_URL`, and workers use Vite's module URL convention. A fork with a different repository name must update the base and matching browser-test URLs before deployment.

## Verify and publish

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run validate:catalog -- --require-ready
npm run test:release
npm run build
npx playwright install chromium
npm run test:e2e
npm run audit:release
```

The browser suite tests the production output at `127.0.0.1:4173/song-neighbors/` and fails if that port is occupied. Choose a free `PREVIEW_PORT` if necessary. Use `REUSE_PREVIEW=1` only for an intentionally running preview of that exact build. An installed Chrome can be used with `PLAYWRIGHT_CHANNEL=chrome`; CI installs Playwright Chromium and its system dependencies.

Vitest covers catalog integrity, exact ranking, exclusions, duplicates, feedback/reset, worker races, and NumPy score comparisons. Mathematical fixtures stay outside `public/`. The lightweight catalog validator checks committed real export bytes, hashes, rows, dimensions, provenance and norms. These checks establish functional behavior, not musical satisfaction.

The [Actions workflow](.github/workflows/ci.yml) validates source and committed catalog data, builds once, tests that production output in Chromium, and uploads that same output for Pages. Publication is restricted to `main`; pull requests validate without publishing. The deployment job has explicit Pages/OIDC permissions and uses the `github-pages` environment. Ordinary frontend CI never downloads music or model weights and never runs catalog inference.

For a release, integrate reviewed changes, observe the completed Pages workflow, then verify the public URL signed out at desktop and mobile viewports. Compare live `build-info.json` and catalog identity to the intended workflow commit before tagging it. Preserve existing immutable tags. Changes confined to evidence documents do not need another deployment. See [release notes](docs/RELEASE_NOTES.md) for the beta scope and [Phase 4 evidence](docs/phases/phase-4.md) for the actual release result.

## Catalog and model

Active catalog: `fma-small-clap-general-20261104`. All published vectors come from **`laion/larger_clap_general`**, immutable revision **`ada0c23a36c4e8582805bb38fec3905903f18b41`**, with the same-revision audio processor. The initially investigated music checkpoint was rejected after an initialization-state audit; none of its vectors is published. [Phase 1 evidence](docs/phases/phase-1.md) records the real inference and replacement verification.

The pipeline decodes the available FMA excerpts, averages channels, resamples to 48 kHz, and analyzes up to the first 30 seconds of each supplied excerpt in ten-second windows. Partial windows are zero-padded, and recorded coverage excludes padding. It averages normalized window embeddings and normalizes the result. The current export records 1,500 windows and 29.9766–30 analyzed seconds per recording (14,993.35 seconds total). Excerpt positions do not establish whole-song coverage. [The catalog contract](docs/CATALOG_CONTRACT.md) defines stable IDs, row mapping, artifact hashes, preprocessing, normalization and provenance.

The browser's Web Worker performs exact vector similarity search. The engine exposes a pure-cosine nearest-neighbor baseline for comparison. Product ranking applies a modest diversity adjustment even with one seed; multiple seeds combine independently retrieved candidates using documented heuristics, with session-feedback adjustments. Titles, artists and genre labels do not substitute for audio similarity. [The engine documentation](src/recommend/README.md) records the algorithm and weights.

## Extend the catalog offline

The separate pipeline requires Python 3.12, uv, curl and Node 24. First read [the source/publication policy](docs/CATALOG_POLICY.md) and [the full pipeline instructions](tools/catalog/README.md). A new source needs documented per-record permission, provenance, attribution and compatible real inference; adding metadata alone does not index a song.

Lightweight Python verification does not install the optional inference stack:

```sh
uv sync --project tools/catalog --locked
uv run --project tools/catalog --locked ruff check tools/catalog
uv run --project tools/catalog --locked ruff format --check tools/catalog
uv run --project tools/catalog --locked python -m unittest discover -s tools/catalog/tests -v
```

The documented FMA acquisition path is:

```sh
uv run --project tools/catalog --locked python tools/catalog/source.py download metadata --cache .cache/catalog
uv run --project tools/catalog --locked python tools/catalog/source.py inspect \
  --metadata-archive .cache/catalog/fma_metadata.zip --limit 500 \
  --selection .cache/catalog/selection-500.json --report .cache/catalog/source-report.json
```

Review the inclusion/exclusion report before downloading the approximately 7.2 GiB small audio archive. The full instructions cover its checksum verification and selected-clip extraction. After acquisition, enable the optional inference environment and run a real smoke before expansion:

```sh
uv sync --project tools/catalog --locked --extra inference
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py download-model
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small \
  --run smoke-40 --limit 40
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract \
  --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small --run catalog-500
uv run --project tools/catalog --locked python tools/catalog/catalog.py export \
  --selection .cache/catalog/selection-500.json --run catalog-500 \
  --version fma-small-clap-general-v2 --activate
npm run validate:catalog -- --require-ready
```

The example version must be unused. Increase the selection limit and use matching new selection/run paths when expanding beyond 500. Rerunning extraction resumes valid compatible cache entries. Export rejects duplicate source-audio hashes and validates staged bytes before activating a new immutable catalog directory. A new model or preprocessing policy requires a new compatible catalog; never mix vector configurations. Recheck real seed cases, exclusions, payload and browser behavior after expansion. Keep audio, weights, caches, local paths and private source manifests in ignored local storage.

## Limitations

- The prepared independent catalog does not cover every song or commercial recording. It also includes experimental and field-recording excerpts, such as crowd and station ambience. Unsupported searches have no invented fallback.
- Embeddings represent excerpts, not complete songs. Model similarity can miss lyrics, arrangement, context, taste and current mood.
- Heuristic weights and human preference are unmeasured. A similarity score is not a probability of enjoyment; passing tests and source-genre counts do not demonstrate musical satisfaction.
- Exact source-audio duplicates and declared recording groups are handled. Exhaustive recognition of alternate encodings, live versions, covers and other musical duplicates is not established.
- Session feedback reranks locally. Seed edits clear refinement; refresh clears the entire session. There is no saved history or synchronization.
- Performance observations apply only to the environments and catalog recorded in the release evidence. Larger catalogs, physical mobile devices, optional browser engines and assistive-technology sessions have not all been tested.
- Source URLs preserve dated FMA provenance and may stop resolving after upstream site changes.

## Rights and repository map

Original application and pipeline code is [MIT licensed](LICENSE). That license does **not** relicense recordings, metadata, model weights, derived catalog data or third-party software. [Third-party notices](THIRD_PARTY_NOTICES.md) distinguish those terms. FMA metadata is credited separately under CC BY 4.0. Per-record CC0/CC BY grants and retained notices establish the recording-derived publication basis; no endorsement is implied. [Catalog attribution](public/catalog/fma-small-clap-general-20261104/ATTRIBUTION.md) accompanies the export. The built site includes `LICENSE.txt`, `THIRD_PARTY_NOTICES.md`, and `THIRD_PARTY_LICENSES.txt` with the bundled runtime dependency license texts alongside catalog attribution. No raw audio, model weights or third-party artwork ships with the site.

| Path | Responsibility |
| --- | --- |
| `src/catalog/` | Catalog contract and validated browser loading |
| `src/recommend/` | Pure ranking, session state, worker protocol and client |
| `src/components/`, `src/ui/` | Search, selection and memory-only controller |
| `tests/` | Catalog, mathematics, worker, session and production-browser verification |
| `tools/catalog/` | Source audit, resumable CPU inference and immutable export |
| `public/catalog/` | Active pointer, immutable catalog and attribution |
| `docs/phases/` | Verification evidence and phase handoffs |

[PROJECT.md](PROJECT.md) describes architecture and scope. [The implementation plan](docs/IMPLEMENTATION_PLAN.md) and [phase prompts](prompts/) preserve the original sequence. This release completes only Phase 4; broader catalog acquisition and product features remain outside it.
