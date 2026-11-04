# Song Neighbors Progress

## Current state — November 4, 2026

Phase 2 implementation and verification are complete. Public integration and exact final
CI/merge revision are tracked by [PR #2](https://github.com/Arhaan2/song-neighbors/pull/2).
The repository remains public. No Pages deployment or release tag is part of this phase.

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Local/browser/review/CI passed | Public main; Pages disabled |
| 1 Real catalog | Complete | Real inference/resume/reuse, 500-track export, coverage and review passed | Public main via PR #1 |
| 2 Recommendation engine | Complete: browser loader, pure ranking, session feedback, module worker/client | 55 TS tests, 16 Python tests, independent NumPy scores ≤1e-12, real production-worker desktop/mobile smoke, independent review | Public phase branch and PR #2; PR carries final CI/integration history |
| 3 Complete interface | Not started | Not run | Not published |
| 4 Public release | Not started | Not run | Not deployed |

Catalog `fma-small-clap-general-20261104` is unchanged: **500 distinct real recordings,
169 artist display names / 170 source artist IDs, eight source genres, 512 dimensions**.
Accepted trained encoder: `laion/larger_clap_general` revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`. Rejected initialization-state music-model vectors
remain excluded. The data gate is satisfied; human listening/preference remains **unmeasured**.

Phase 2 uses exact cosine, a configurable closest/mean seed blend, explicit positive/negative
feedback and modest greedy diversity. It excludes seeds, feedback and verified recording
components, expands insufficient candidate pools and never pads results. Reset preserves
selected chips and restores their seed-only ranking; seed edits clear feedback. Worker query
identity includes complete session/config state and stale success/error replies are ignored.

The real five-seed browser smoke leaves **493** eligible records, retrieves **195** candidate
rows and returns **20** distinct results. Two different real seeds produce different outputs;
repeated inputs and reset are deterministic. No preference-probability or mood claim is made.

See [Phase 2 evidence](docs/phases/phase-2.md), [browser measurements](docs/phases/phase-2-browser.json)
and [engine API/weights/handoff](src/recommend/README.md). Phase 1 source, model, license and
inference evidence remains in its [report](docs/phases/phase-1.md). No catalog artifacts,
raw audio, model weights or private data were added or changed in Phase 2.

## Phase boundary

Stop after reviewed Phase 2 integration. The public-facing screen still reports catalog
availability and credits only. Phase 3 must build the complete search/selection/results UI
using the verified worker and metadata-only session helpers. No full UI, streaming
integration, public deployment or release tag has been added.
