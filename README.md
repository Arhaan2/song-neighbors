# Song Neighbors

Find songs that fit the moment through audio similarity. The planned flow is to search an analyzed catalog, choose 1–5 songs, receive up to 20 neighbors, and refine the current session with **More like this** and **Not this mood**.

**Phase 0 foundation only. The catalog is not ready.** There are no analyzed songs, playable tracks, or recommendations yet. No website has been deployed. V1 will list titles and artists without streaming accounts or playback.

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
npm run build
```

Vitest exercises the catalog contract using explicitly synthetic structural fixtures, kept outside `public/`. It does not prove audio similarity or human preference. Oxlint checks React/TypeScript code and hooks; strict TypeScript checks the application, tests, and build configuration.

The offline Python foundation is separate:

```sh
cd tools/catalog
uv sync --locked
uv run --locked ruff check .
uv run --locked ruff format --check .
```

See [the Python project](tools/catalog/README.md). Its Python 3.12 environment and lockfile are isolated under `tools/catalog`; no global packages, model weights, inference packages, or source audio are installed by these commands. Model compatibility is evaluated in Phase 1 before choosing inference dependencies.

GitHub Actions runs these lightweight checks on pushes and pull requests to `main`. CI does not download music or weights, run inference, or deploy.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/catalog/` | Catalog contract and future browser loading/search |
| `src/recommend/` | Future pure ranking logic and worker |
| `src/components/` | Accessible UI components |
| `tests/` | Meaningful contract and later behavior/invariant tests |
| `tools/catalog/` | Isolated offline Python project |
| `public/catalog/` | Honest not-ready pointer; future versioned public exports |
| `docs/phases/` | Verification evidence and phase handoffs |

[PROJECT.md](PROJECT.md) describes the product and architecture. [PROGRESS.md](PROGRESS.md) separates implementation, verification, publication, and listening evaluation. The imported [implementation plan](docs/IMPLEMENTATION_PLAN.md) and [phase prompts](prompts/) preserve the complete sequence:

0. Foundation — scaffold, contract, docs, CI.
1. Permitted real catalog, pinned inference, reproducible export.
2. Exact ranking, session feedback, and Web Worker.
3. Complete responsive search/selection/results UI.
4. Verification, evaluation, and GitHub Pages release.

## Catalog and rights

The [catalog contract](docs/CATALOG_CONTRACT.md) defines stable recording IDs, exact row mapping, hashes, normalization, provenance, and immutable model/preprocessing identity. Embedding dimensions must come from actual inference; Phase 0 assigns none. All published vectors must be real compatible audio embeddings.

Follow [the catalog policy](docs/CATALOG_POLICY.md) before acquiring or exporting data. The target of about 500 tracks is a future goal, not current coverage. Source audio, downloaded weights, private manifests, credentials, caches, and build output are ignored and must stay out of both Git and public assets.

Original application code is [MIT licensed](LICENSE). Recordings, metadata, models, derived data, and dependencies retain their own terms; see [third-party notices](THIRD_PARTY_NOTICES.md). No third-party music or artwork ships in this foundation.
