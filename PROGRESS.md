# Song Neighbors Progress

## Phase 5B — November 5, 2026

Release preparation is implemented: evidence-bound candidate/effective-selection validation,
active-only catalog staging, active fixtures and checkpoint status/timing/failure evidence.
The exact 4,925-candidate selection reproduced; all 500 baseline caches passed preflight. A separate
ignored 493-record check reused those cleared caches and validated an export without activation.
No additions were downloaded, decoded, inferred or published. The live catalog remains 500.
Local source gates passed 84 web tests, 40 Python tests, lint/typecheck/Ruff, catalog validation
and real-data evaluation. Independent preparation browser checks passed all 20 desktop/mobile cases.

Expanded acquisition awaits storage: the supplied 64 GB card had 58.20 GiB free, below the 93.42 GiB
archive alone. Use an existing archive volume with at least 100 GiB free plus 8 GiB locally.
The card and unrelated files were preserved. Phase 5B publication is incomplete.

[PR #9](https://github.com/Arhaan2/song-neighbors/pull/9) merged as `7cdeff649d53383bf57b9e66888559be3ca5aa57`.
[PR CI](https://github.com/Arhaan2/song-neighbors/actions/runs/42110864164) and
[main CI/deployment](https://github.com/Arhaan2/song-neighbors/actions/runs/42112853463) passed after
retrying slow Ubuntu dependency-download timeouts. Public desktop/mobile journeys matched all
16 files to the tested artifact and verified the clean merge source. Catalog bytes and v0.1.0
are unchanged. This evidence-only update does not redeploy the site.

[Execution and review evidence](docs/phases/phase-5b.md) · [Processing status](docs/phases/phase-5b-processing.json) · [Exact resume commands](docs/PHASE_5B.md).

## Phase 5A — November 5, 2026

Expanded metadata audit and ingestion preparation are implemented. The active live catalog remains
**500 recordings; zero songs were added in this phase**. Reviewed cumulative capacity is 786 small,
1,574 medium and 6,258 large; original small-only rules still reproduce 793. Seven currently published
IDs have unresolved source-rights evidence and are held from the next publication, leaving 493
cleared existing IDs. [The report](docs/phases/phase-5a.md) lists every hold and limitation.

The committed deterministic candidate manifest targets **4,925 total: 493 existing + 4,432 additions**,
with a 50-record source-artist cap and 75-record planning shortfall. Full audio availability, decoding,
inference and deduplication of additions remain unverified. Recommend FMA-large (93.42 GiB ZIP);
Phase 5B needs more storage. Existing 500 embedding-cache entries still match the active configuration
and published bytes. Current product/UI/ranking and active public artifacts were not changed.

Local web verification passed 75 unit tests, 20 Chromium desktop/mobile cases, lint, TypeScript,
ready-catalog validation, real-catalog evaluation, production build and artifact audit. All 34 Python
tests and Ruff checks passed. Independent review reproduced the audit/selection and verified all
4,925 evidence hashes; policy/credit findings were repaired. See the Phase 5A report for detail.

[PR #8](https://github.com/Arhaan2/song-neighbors/pull/8) merged as
`4b1cd5999ab613d46e945eb06abcd130b897bc25`. [PR CI](https://github.com/Arhaan2/song-neighbors/actions/runs/42104050094)
and [main CI/deployment](https://github.com/Arhaan2/song-neighbors/actions/runs/42104313405) passed.
The live build identifies that clean merge; two signed-out public desktop/mobile release journeys
passed and matched all 16 artifact files. Public pointer/catalog bytes remain unchanged. Repository
visibility is PUBLIC and the original release tag is preserved. Phase 5A has no remaining blocker;
the next phase needs storage and actual audio-stage verification. This evidence-only update does
not redeploy unchanged assets.

[Candidate manifest](docs/catalog/phase-5a-selection.json) · [Exact Phase 5B runbook](docs/PHASE_5B.md).

## Current site — November 5, 2026

The **adaptive visual interface is live**. [PR #7](https://github.com/Arhaan2/song-neighbors/pull/7) integrated the reviewed code as `3bb26009059ee277b18817207287ab2ef8d5335d`, the exact source in [live build-info.json](https://arhaan2.github.io/song-neighbors/build-info.json). The [main workflow](https://github.com/Arhaan2/song-neighbors/actions/runs/42094331153) passed validation, built once, ran 20 production-browser cases and successfully deployed that artifact.

The interface composes selection-specific artwork, one- or multi-song context, and paths based on actual closest-seed counts. Plain list retains identical results and controls. The catalog, ranking engine, worker and session controller are unchanged. Independent review compared 80 ranking positions to the previous live site; all matched. Human listening remains unmeasured.

Local verification passed 75 unit tests, lint, TypeScript, catalog validation and artifact audit. Four subsequent public Chromium checks (desktop and mobile) passed the release and generated-view journeys. Each release journey matched all 16 public files to artifact `13445923984`; generated-view checks verified all five lane counts, view-switch rank preservation, feedback, exact artwork/list reset, text reflow and refresh. The repository remains PUBLIC. No deployment or verification blocker remains.

[Implementation and review notes](docs/DESIGN.md#adaptive-visual-interface) · [Live browser evidence](docs/phases/generative-browser.json) · [Desktop](docs/phases/assets/generative-desktop.png) · [Mobile](docs/phases/assets/generative-mobile.png)

## Record-catalog redesign — November 4, 2026

[The redesigned discovery interface is live](https://arhaan2.github.io/song-neighbors/). [PR #6](https://github.com/Arhaan2/song-neighbors/pull/6) merged as `3cd2af55a0a40da0171e16bd60f769b6c5034249`. The [main workflow](https://github.com/Arhaan2/song-neighbors/actions/runs/41936739134) passed web, catalog and Python checks, tested the production build in 18 Chromium cases, and deployed the tested Pages artifact. At that deployment, its build identity named the same source and the unchanged catalog `fma-small-clap-general-20261104`.

Separate signed-out Chromium desktop and mobile journeys each matched all 16 public files to workflow artifact `13373688657` and verified one- and five-song selection, ranking, both feedback actions, exact reset and refresh with no page or request errors. Independent before/after comparisons found identical results at all 80 ranked positions inspected. The original v0.1.0 tag remains on its historical source.

[Desktop discovery](docs/phases/assets/redesign-discovery-desktop.png) · [Mobile results](docs/phases/assets/redesign-results-mobile.png) · [Design and review notes](docs/DESIGN.md#discovery-redesign)

## Initial release — November 4, 2026

**Phase 4 complete.** Song Neighbors v0.1.0 is published on GitHub Pages. Signed-out Chromium desktop and mobile
journeys passed against the public site and matched all 16 files to the tested artifact.
At initial release, `build-info.json` identified source `f8c6260985bbb4de1a041e42e2b1959522aa88b6` and
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
