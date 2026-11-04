# Song Neighbors

Find songs that fit the moment through audio similarity. The planned flow is to search an analyzed catalog, choose 1–5 songs, receive up to 20 neighbors, and refine the current session with **More like this** and **Not this mood**.

**Phase 1 catalog complete: 500 real recordings across 169 artist names, with 512-dimensional audio embeddings.** Search and recommendation controls remain later-phase work. No website has been deployed. V1 lists titles and artists without streaming accounts or playback. See the [Phase 1 evidence](docs/phases/phase-1.md), including the rejected initial music checkpoint and verified trained replacement.

## Run locally

Use Node **24.18.0** (`.nvmrc`) and npm 11.16.0. From the project root:

```sh
npm ci
npm run dev
```

Open the URL Vite prints, including `/song-neighbors/`. To inspect a production build:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Open `http://127.0.0.1:4173/song-neighbors/`. Vite's base is set to the actual repository slug; future catalog fetches must use `import.meta.env.BASE_URL`, and workers must use Vite's module URL convention. There is no Pages deployment workflow in this phase.

## Verify

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run validate:catalog -- --require-ready
npm run build
```

Vitest exercises contract and validator failure cases using isolated synthetic fixtures, kept outside `public/`. The lightweight validator independently checks the committed real catalog. Neither unit tests nor coverage counts prove musical quality or human preference. Oxlint checks React/TypeScript code and hooks; strict TypeScript checks the application, tests, and build configuration.

The offline Python pipeline is separate:

```sh
cd tools/catalog
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
uv run --locked python -m unittest discover -s tests -v
```

See [the Python project](tools/catalog/README.md). Its Python 3.12 environment and lockfile are isolated under `tools/catalog`; no global packages, model weights, inference packages, or source audio are installed by these commands. The optional `inference` extra pins the compatible CPU environment; acquisition, real extraction, resume and export commands are documented there.

GitHub Actions runs these lightweight checks on pushes and pull requests to `main`. CI does not download music or weights, run inference, or deploy.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/catalog/` | Catalog contract and future browser loading/search |
| `src/recommend/` | Future pure ranking logic and worker |
| `src/components/` | Accessible UI components |
| `tests/` | Contract and artifact-validator invariant tests |
| `tools/catalog/` | Source audit, resumable CPU inference, export and capacity diagnostic |
| `public/catalog/` | Ready pointer and validated immutable real catalog |
| `docs/phases/` | Verification evidence and phase handoffs |

[PROJECT.md](PROJECT.md) describes the product and architecture. [PROGRESS.md](PROGRESS.md) separates implementation, verification, publication, and listening evaluation. The imported [implementation plan](docs/IMPLEMENTATION_PLAN.md) and [phase prompts](prompts/) preserve the complete sequence:

0. Foundation — scaffold, contract, docs, CI.
1. Permitted real catalog, pinned inference, reproducible export.
2. Exact ranking, session feedback, and Web Worker.
3. Complete responsive search/selection/results UI.
4. Verification, evaluation, and GitHub Pages release.

## Catalog and rights

The [catalog contract](docs/CATALOG_CONTRACT.md) defines stable recording IDs, exact row mapping, hashes, normalization, provenance, and immutable model/preprocessing identity. The measured dimension is 512. All published rows have real compatible embeddings from `laion/larger_clap_general` revision `ada0c23a36c4e8582805bb38fec3905903f18b41`. The initially requested music checkpoint was rejected after its weights failed the training-state audit; its vectors are excluded.

Follow [the catalog policy](docs/CATALOG_POLICY.md) before acquiring or exporting data. Catalog `fma-small-clap-general-20261104` contains 500 distinct source-audio hashes across eight source genre labels. Its exact CC BY/CC0 provenance and attribution accompany every row. The 100-recording/10-artist engineering floor and five-seed/twenty-result diagnostic pass; listening quality remains unmeasured. Source audio, downloaded weights, private manifests, credentials, caches, and build output are ignored and must stay out of both Git and public assets.

Original application code is [MIT licensed](LICENSE). Recordings, metadata, models, derived data, and dependencies retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md). No raw music, model weights or artwork ship with the static catalog.
