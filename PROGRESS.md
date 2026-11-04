# Song Neighbors Progress

## Current state — November 4, 2026

Phase 4 source is integrated and verified. **PUBLICATION PENDING:** GitHub Pages accepted
the tested artifact, but two deployment attempts timed out. Final signed-out desktop and
mobile Chromium checks received HTTP 404. No verified live site, tag or GitHub Release.
The repository remains PUBLIC. Human listening and preference remain **unmeasured**.

| Phase | Implementation | Verification | Publication |
| --- | --- | --- | --- |
| 0 Foundation | Complete | Passed | Public main |
| 1 Real catalog | Complete | Real inference, provenance, 500-track export passed | Public main via PR #1 |
| 2 Recommendation engine | Complete | Mathematics, worker and session gates passed | Public main via PR #2 |
| 3 Complete interface | Complete | Required Chromium desktop/mobile flows passed | Public main via PR #3; merge `2e23ff3` |
| 4 Public release | Release workflow, metadata, notices, evaluation and docs complete | Local 16/16 Chromium, artifact audit and independent review passed; live pending | Public main via PR #4; Pages publication and immutable tag pending |

Catalog `fma-small-clap-general-20261104`: **500 real recordings, 169 artist display names /
170 source artist IDs, eight source genres, 512 dimensions**. Encoder:
`laion/larger_clap_general` at `ada0c23a36c4e8582805bb38fec3905903f18b41`.
The catalog includes musical, experimental and field-recording excerpts; analysis covers
29.9766–30 seconds per recording. No audio or weights ship in the website.

Five real seed sets pass baseline comparisons, exclusions, unique results, feedback and exact
reset. Pure cosine agrees with an independent full-row calculation; that is functional evidence,
not musical satisfaction. [Listening worksheet](docs/LISTENING_WORKSHEET.md) keeps “sounds similar”
and “want to hear it now” separate and blank.

[PR #4](https://github.com/Arhaan2/song-neighbors/pull/4) merged reviewed
`f257b652f905293b3c9ea47a7ca3cf756fd345c6` as `f8c6260985bbb4de1a041e42e2b1959522aa88b6`.
[Main workflow](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385) passed
web/Python checks, then uploaded artifact `13368122615` (16 files, 3,271,857 bytes unpacked).
The [Phase 4 report](docs/phases/phase-4.md) records the separate deployment and live results.
[Browser evidence](docs/phases/phase-4-browser.json) includes measured local timings. Both
local and CI production flows passed; a live 404 cannot stand in for a verified public flow.
The uploaded `build-info.json` identifies the tested merge, **not a live deployment**. When
Pages can process deployments, retry only job `126909018013` from run `41923813385` and
verify the real public identity and interaction flow before tagging. The Phase 4 report gives
artifact retention and exact commands. Later evidence-only commits do not redeploy the site.

## Phase boundary

Stopped at the Phase 4 public-hosting blocker. No new product mode,
playback, account integration or catalog acquisition is included.
