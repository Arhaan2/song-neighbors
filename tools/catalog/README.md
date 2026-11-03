# Offline catalog tools

This is an isolated, uv-managed Python 3.12 project. Phase 0 establishes its interpreter,
lockfile, and development tooling. **No acquisition, inference, or export pipeline exists yet.**
No encoder weights or audio dependencies are installed. Their versions must be selected with
actual checkpoint compatibility during Phase 1.

From the repository root:

```sh
uv sync --project tools/catalog --locked
uv run --project tools/catalog --locked ruff check tools/catalog
uv run --project tools/catalog --locked ruff format --check tools/catalog
```

The environment lives at `tools/catalog/.venv`. The lockfile is committed; the environment,
Python bytecode, downloaded weights and data are ignored. Ruff currently checks configuration;
Python source and behavioral tests arrive with the Phase 1 pipeline, so a successful Ruff run
is **not** evidence that inference or export works.

Python 3.12 is a conservative initial compatibility target, not proof of support by the future
encoder stack. `uv` may install its managed interpreter if 3.12 is absent. No global package
installation is required. For a project-local cache, set `UV_CACHE_DIR` to `.cache/uv` under the
repository; use `UV_PYTHON_INSTALL_DIR` under `.cache/python` if keeping managed interpreters
project-local is desired too.

## Phase 1 handoff

1. Read `docs/CATALOG_POLICY.md` and inspect permitted source metadata before choosing audio.
2. Resolve compatible inference dependencies here with `uv add`, recording official sources.
3. Pin the actual encoder's immutable revision and verify its redistribution terms separately.
4. Prove real extraction on 30–50 permitted tracks; derive dimension from the returned tensor.
5. Implement incremental cache identity from audio hash, encoder revision, processor config,
   window policy and aggregation version; reject incompatible cache entries.
6. Export and independently validate the contract in `docs/CATALOG_CONTRACT.md`, including
   hashes, finite normalized values, contiguous row mapping, provenance and attribution.
7. Run a real inference smoke and record exact commands and observations in the Phase 1 report.

Do not add audio extraction to the web CI job. No placeholder CLI claims to perform these steps.

Tooling sources: [uv project guide](https://docs.astral.sh/uv/guides/projects/) and
[Ruff's project-local installation](https://docs.astral.sh/ruff/installation/).
