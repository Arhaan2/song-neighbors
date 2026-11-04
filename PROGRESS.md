# Song Neighbors Progress

## Current state — November 4, 2026

**Phase 4 complete.** Song Neighbors v0.1.0 is published on GitHub Pages. Signed-out Chromium desktop and mobile
journeys passed against the public site and matched all 16 files to the tested artifact.
Live `build-info.json` identifies source `f8c6260985bbb4de1a041e42e2b1959522aa88b6` and
catalog `fma-small-clap-general-20261104`. The repository is PUBLIC. Human listening and
preference are **unmeasured**. [Website](https://arhaan2.github.io/song-neighbors/) · [Live build identity](https://arhaan2.github.io/song-neighbors/build-info.json) · [Release v0.1.0](https://github.com/Arhaan2/song-neighbors/releases/tag/v0.1.0)

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Passed | Public main |
| 1 Real catalog | Complete | Real inference, provenance, 500-track export passed | Public main via PR #1 |
| 2 Recommendation engine | Complete | Mathematics, worker and session gates passed | Public main via PR #2 |
| 3 Complete interface | Complete | Required Chromium desktop/mobile flows passed | Public main via PR #3; merge `2e23ff3` |
| 4 Public release | Release workflow, metadata, notices, evaluation and docs complete | Local/CI 16/16 Chromium cases and live 2/2 journeys passed | Verified public Pages site and `v0.1.0` release |

Catalog `fma-small-clap-general-20261104`: **500 real recordings, 169 artist display names /
170 source artist IDs, eight source genres, 512 dimensions**. Encoder:
`laion/larger_clap_general` at `ada0c23a36c4e8582805bb38fec3905903f18b41`.
The catalog includes musical, experimental and field-recording excerpts; analysis covers
29.9766–30 seconds per recording. No audio or weights ship in the website.

Five real seed sets pass baseline comparisons, exclusions, unique results, feedback and exact
reset. Pure cosine agrees with an independent full-row calculation; that is functional evidence,
not musical satisfaction. [Listening worksheet](docs/LISTENING_WORKSHEET.md) keeps “sounds similar”
and “want to hear it now” separate and blank.

[PR #4](https://github.com/Arhaan2/song-neighbors/pull/4) integrated the reviewed release
as `f8c6260985bbb4de1a041e42e2b1959522aa88b6`. Its [main workflow](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385)
passed web and Python checks and uploaded the production artifact. The first three Pages
attempts timed out or returned a cancelled status. Signed-out probes during those attempts
returned HTTP 404. Evidence-only commit `341d8d0` records the initial failures.

[PR #5](https://github.com/Arhaan2/song-neighbors/pull/5) integrated the workflow for
restoring the tested tar. The successful [recovery run](https://github.com/Arhaan2/song-neighbors/actions/runs/41929584485)
used delivery SHA `73d393a735e95570d52c2e1241417b295c45947a`. Independent downloads of
both artifacts yielded byte-identical tars. The live browser flows confirmed search,
selection, recommendations, positive/negative refinement, exact reset and refresh.
[Phase 4 report](docs/phases/phase-4.md) · [Browser measurements](docs/phases/phase-4-browser.json)

The annotated `v0.1.0` tag points to the verified application source
`f8c6260985bbb4de1a041e42e2b1959522aa88b6`. The GitHub Release was published at
22:59:27 UTC after both live checks passed. Final verification evidence is recorded
separately after publication. Work stops at the Phase 4 boundary.
