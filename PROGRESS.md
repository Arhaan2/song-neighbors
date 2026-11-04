# Song Neighbors Progress

## Current state — November 4, 2026

Phase 3 implementation, local verification and independent review are complete. Public
integration and final CI/merge identifiers are tracked by
[PR #3](https://github.com/Arhaan2/song-neighbors/pull/3). The repository remains PUBLIC.
No Pages deployment or release tag is part of this phase.

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Local/browser/review/CI passed | Public main; Pages disabled |
| 1 Real catalog | Complete | Real inference/resume/reuse, 500-track export, coverage and review passed | Public main via PR #1 |
| 2 Recommendation engine | Complete | 55 TS tests, 16 Python tests, NumPy score agreement and real production-worker desktop/mobile smoke | Public main via PR #2, merge `228736a` |
| 3 Complete interface | Complete: search, selection, real ranking, refinement/reset, responsive/accessibility/error states | 71 TS tests, lint/typecheck, ready-catalog validation, build, 12 Chromium cases and independent review passed | Public branch and PR #3; PR records final CI/integration history |
| 4 Public release | Not started | Not run | Not deployed |

Catalog `fma-small-clap-general-20261104` is unchanged: **500 distinct real recordings,
169 artist display names / 170 source artist IDs, eight source genres, 512 dimensions**.
Accepted trained encoder: `laion/larger_clap_general` revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`. Rejected initialization-state music-model vectors
remain excluded. The data gate is satisfied; human listening/preference remains **unmeasured**.

The interface uses the actual validated worker, with no metadata-ranking fallback. Seed edits
clear refinement/results; Recommend explicitly calculates current input. Positive/negative
feedback reranks automatically, stays separate from the five seed slots and excludes those
recordings. Reset restores the exact seed-only ordering. Generation guards prevent old success
or error replies from reappearing after edits; retry creates a fresh worker and retains preferences.

Production Chromium checks at 1440×900 and 390×844 cover search/disambiguation, 1–5 seeds,
removal, recommendation IDs matching the worker, refinement/reset, unsupported search,
keyboard, rapid input, delayed replies, refresh, load/unavailable/query errors and recovery.
Populated 320px/768px checks have no horizontal overflow. The only reviewer-reproduced defect,
offscreen keyboard selection when reopening search, was repaired and independently reverified.
Short/zero result presentation uses labeled test-only reply shaping; the existing engine's
small-pool behavior is verified with isolated unit fixtures. No fixture enters production.

See [Phase 3 evidence](docs/phases/phase-3.md), [browser results](docs/phases/phase-3-browser.json),
and [engine API](src/recommend/README.md). Full source, model and inference evidence remains
in the [Phase 1 report](docs/phases/phase-1.md). No catalog artifacts, raw audio, model weights,
private data or provider integrations were added or changed in Phase 3.

## Phase boundary

Stop after reviewed Phase 3 integration. Phase 4 remains a separate request: human evaluation,
release checks and GitHub Pages publication. No deployment, release tag or extra product mode
has been started. Mobile viewport emulation is verified; physical devices and optional engines
were not tested and do not block this phase.
