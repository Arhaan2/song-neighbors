# Song Neighbors Progress

## Current state — November 4, 2026

Phase 1 implementation and real-data verification are complete in public [PR #1](https://github.com/Arhaan2/song-neighbors/pull/1). Its merge/check history records publication and the final integration revision. The repository remains public. No Pages deployment or release tag is part of this phase.

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Local/browser/review/CI passed | Public main; Pages disabled |
| 1 Real catalog | Complete: audited source, trained pinned model, resumable CLI, export, validator | Real 40-track smoke/resume/reuse, 500-track extraction, coverage case, targeted tests, web/browser checks and independent review | Public phase branch and PR #1; see PR merge record for integration |
| 2 Recommendation engine | Not started | Not run | Not published |
| 3 Complete interface | Not started | Not run | Not published |
| 4 Public release | Not started | Not run | Not deployed |

Actual catalog `fma-small-clap-general-20261104`: **500 distinct recordings, 169 artist display names / 170 source artist IDs, 8 source genre labels, 512 dimensions**. All 500 selected eligible files were analyzed with zero failures. The five-seed case excludes seven input/feedback recordings, leaves 493 candidates, and returns 20 distinct results. The scoped beta catalog floor passes; human listening/preference evaluation remains **unmeasured**.

Started with `laion/larger_clap_music`, then rejected its pinned checkpoint after an initialization-state audit. Accepted `laion/larger_clap_general` revision `ada0c23a36c4e8582805bb38fec3905903f18b41`; verified learned parameters, immutable artifact hashes, compatible processor and genuine CPU inference. No rejected-model vectors are in the public catalog.

Verified FMA-small metadata yields 793 eligible recordings under exact CC0/CC BY URL and notice review; 7,207 exclusions are documented. The original published audio checksum matched the complete small archive. Per-record grants, source links, credit and transformation notices support the public derived catalog. Raw audio, weights, caches, private tracks and local absolute paths are excluded.

The [Phase 1 report](docs/phases/phase-1.md) links the source audit, model audit, real inference evidence, actual export hashes and coverage case. The site only shows the validated catalog's availability and credits. No functioning public acoustic recommendation demo or musical-quality pass is claimed.

## Phase boundary

Stop after reviewed Phase 1 integration. Phase 2 remains a separate task. No browser ranking engine, full discovery flow, streaming integration or Pages release has been added.
