# Song Neighbors Progress

## Current state — November 4, 2026

Phase 4 release implementation and real-data evaluation are complete. Local production-browser
verification and independent review passed; public integration/deployment and signed-out live
verification are pending. **Publication/verification pending until the evidence below is finalized.**
The repository remains PUBLIC. Human listening and preference remain **unmeasured**.

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Passed | Public main |
| 1 Real catalog | Complete | Real inference, provenance, 500-track export passed | Public main via PR #1 |
| 2 Recommendation engine | Complete | Mathematics, worker and session gates passed | Public main via PR #2 |
| 3 Complete interface | Complete | Required Chromium desktop/mobile flows passed | Public main via PR #3; merge `2e23ff3` |
| 4 Public release | Release workflow, metadata, notices, evaluation and docs complete | Local 16/16 Chromium, artifact audit and independent review passed; live pending | Pages enabled; deployment and immutable tag pending |

Catalog `fma-small-clap-general-20261104`: **500 real recordings, 169 artist display names /
170 source artist IDs, eight source genres, 512 dimensions**. Encoder:
`laion/larger_clap_general` at `ada0c23a36c4e8582805bb38fec3905903f18b41`.
The catalog includes musical, experimental and field-recording excerpts; analysis covers
29.9766–30 seconds per recording. No audio or weights ship in the website.

Five real seed sets pass baseline comparisons, exclusions, unique results, feedback and exact
reset. Pure cosine agrees with an independent full-row calculation; that is functional evidence,
not musical satisfaction. [Listening worksheet](docs/LISTENING_WORKSHEET.md) keeps “sounds similar”
and “want to hear it now” separate and blank.

[Phase 4 evidence](docs/phases/phase-4.md) records exact checks, findings and publication status.
Deployed `build-info.json` is authoritative for code/catalog identity; later evidence-only commits
are recorded separately and do not move the release tag or redeploy unchanged assets.

## Phase boundary

Stop after Phase 4 verification/publication (or an exact access blocker). No new product mode,
playback, account integration or catalog acquisition is included.
