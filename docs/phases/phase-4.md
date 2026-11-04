# Phase 4 — public beta release

November 4, 2026 (America/Los_Angeles). **Phase 4 complete. The public v0.1.0 release passed live verification.**
Reviewed release code `f257b652f905293b3c9ea47a7ca3cf756fd345c6` was integrated as
`f8c6260985bbb4de1a041e42e2b1959522aa88b6`. Their Git trees match. The public
`build-info.json` identifies the integrated SHA and catalog `fma-small-clap-general-20261104`.
Evidence-only commit `341d8d0` recorded the initial failures. The successful workflow
used delivery SHA `73d393a735e95570d52c2e1241417b295c45947a` to publish the original
artifact bytes. [Live site](https://arhaan2.github.io/song-neighbors/) · [Build identity](https://arhaan2.github.io/song-neighbors/build-info.json) · [Release v0.1.0](https://github.com/Arhaan2/song-neighbors/releases/tag/v0.1.0)

## Preflight and ownership

Read actual repository AGENTS, PROJECT, PROGRESS, Phase 3 report, catalog policy and Phase 4
prompt. Actual root is `~/Desktop/song-neighbors`, origin
`https://github.com/Arhaan2/song-neighbors.git`. Clean main and refreshed origin/main both
pointed to `2e23ff3efadae99ff26050363cf429e95b9bc82f`. The build pack and other worktrees were
preserved. Work uses an isolated linked phase worktree on branch
`codex/phase-4-release`. GitHub confirmed PUBLIC visibility and admin access; no protections
were bypassed. Initial sandboxed CLI auth failure resolved with scoped network permission.

Two implementation workers owned disjoint release docs and real-catalog evaluation files.
An independent reviewer inspected engine/session code, release workflow and artifact licensing,
and ran 26 focused tests. Coordinator owns integration, configuration, browsers and publication.
Agent review is not a human GitHub approval.

## Release implementation and review

The workflow follows [GitHub's current official custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
It validates source and committed catalog, builds once, tests the production output, audits it,
then uploads that same `dist/`. Deploy requires both web and lightweight Python checks, explicit
`pages: write` / `id-token: write`, and `github-pages`. PRs cannot configure, upload or deploy.
The environment allows main only. Evidence-only changes to `PROGRESS.md` / `docs/phases/**`
do not trigger push deployment. No ordinary CI downloads audio, model weights or runs inference.

Build metadata records actual checkout SHA, clean/dirty state, catalog version/hash and base path.
CI refuses a dirty checkout or mismatched workflow SHA. Site base is `/song-neighbors/`.
Original MIT, full React/ReactDOM/scheduler/Zod MIT texts and third-party notices ship separately
from per-record/model/FMA attribution. README, setup, catalog extension, limitations, demo,
release notes and blank listening worksheet were finalized before the release build.

Reviewer identified that Pages upload excludes hidden `.vite/manifest.json`; Vite now emits
`asset-manifest.json` so every tested artifact file is publishable. Worksheet wording was corrected
to distinguish the diversity-adjusted one-seed product ranking from pure cosine. Copied notice
links now resolve publicly. The artifact allowlist rejects unexpected media, weights, private
files, symlinks, local paths and recognized secret patterns, and revalidates all catalog hashes.

## Real data and behavior

[Machine-readable real-data observations](phase-4-data.json) cover five distinct seed sets:
Spell; Lior/Neil Halstead; two genuinely distinct On Axis recordings; five artists; field recordings.
Each returns 20 real unique results; seed/feedback exclusions, repeated input/seed idempotence,
opposite feedback replacement, seed edits clearing feedback and exact reset pass.
Pure-cosine first-seed baseline agrees with an independent all-row scan to below 1e-12.
Shared top-20 counts with product queries are 20, 14, 10, 1 and 16 respectively; these are not
listening scores. No duplicate recording component exists in this export; real uniqueness and
same-title distinction are observed, while synthetic unit fixtures verify alias/hash transitivity.

Catalog `fma-small-clap-general-20261104`: 500 recordings, 169 artist display names, 170 source
artist IDs (ID-matched source audit), eight source genres, 512 dimensions. Model
`laion/larger_clap_general` revision `ada0c23a36c4e8582805bb38fec3905903f18b41`.
Manifest SHA-256 `b57bda0fb968b5feb49bb4ad7f33ea61ff67647483f496b519edea85b576ae11`;
vector SHA-256 `0b29eefec5e6f708f1be7bc2d25d5b3e4970b4f036e698c7ce8d775389aa9054`.
1,500 windows cover 29.97658–30 seconds per supplied excerpt; 14,993.35 seconds total.
Runtime catalog payload is 2,222,958 raw bytes; with optional attribution, 2,801,153 bytes.
Local Node repeated ranking medians were 3.590–20.129 ms across cases. Full environment and
uncompressed/local-gzip file sizes are in the JSON; these are observations, not performance promises.

## Checks and publication

Local lint/typecheck, 71 TypeScript tests, five-set evaluator, ready-catalog validation,
production build and artifact audit pass. Python Ruff lint/format and all 16 lightweight tests
pass after using a writable cache and scoped network permission. No real inference was rerun.
The first new browser run passed the 12 existing cases but exposed a genuine lost click:
search blur removed an in-flow panel before pointerup, moving the About disclosure away.
A held-pointer regression failed on both viewports against old code. The first repair passed
mouse/keyboard checks but a full run exposed a touch compatibility-event race (15/16 passed).
The browser network assertion also incorrectly rejected normal HTTP 304 cache responses and
was corrected to reject HTTP errors instead. These failures are recorded, not treated as passes.
The final fix waits for the target-resolved click (or cancellation) without a timer and keeps
keyboard blur immediate. Independent review rechecked both matching and empty searches with
held input at both viewports, plus 12/12 mixed keyboard/touch tap sequences. All 16 production
Chromium cases passed on the repaired build in 17.2 s, no skipped, flaky or unexpected cases.
The release journey ran in fresh anonymous contexts, compared all 16 artifact files byte-for-byte,
and verified worker/catalog requests, five selections, feedback, exact reset and refresh.
Local Chrome 156.0.8078.80, 1440×900 and 390×844 mobile viewport, Apple M4 Pro / Node 24.18.0.
Source design lint and rendered inspection at 1440/768/390 reported 0 failures and 0 warnings;
independent visual review of six screenshots found no layout regression. No redesign was needed.

Commands used for the final local gates (using a free preview port):

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run validate:catalog -- --require-ready
npm run test:release
npm run build
npm run audit:release
PREVIEW_PORT=4178 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

Python checks from `tools/catalog`: `uv run --locked ruff check .`, `uv run --locked ruff
format --check .`, `uv run --locked python -m unittest discover -s tests -v`. PR and main CI repeated the gates on clean Linux checkouts. See [browser and file evidence](phase-4-browser.json).

## Public integration and hosting

[PR #4](https://github.com/Arhaan2/song-neighbors/pull/4) integrated the reviewed head after
[PR workflow 41923580521](https://github.com/Arhaan2/song-neighbors/actions/runs/41923580521)
passed; PR configure/upload/deploy were skipped. The integrated [main workflow 41923813385](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385)
passed web (including 16/16 Chromium cases in 24.7 s) and Python checks. It uploaded
`github-pages` artifact **13368122615**, SHA-256 of the archive
`4a244a04ef90a530bc71060de3e470e507bd45880a695a20edcfd37b83c2d97b`, 1,241,526 bytes
compressed / 3,271,857 bytes across 16 unpacked files. The downloaded artifact's 15 non-identity
files are byte-identical to the clean local candidate. Only `build-info.json` differs, correctly
identifying the merge commit. Artifact metadata is not proof the public URL works.

The repository and Pages site configuration remain public, HTTPS enforced, `build_type: workflow`;
the `github-pages` environment allows main. [First deploy job](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385/job/126903498137)
created the Pages deployment at 22:17:52 UTC. GitHub reported `deployment_queued` then
`updating_pages` until the job timed out, cancelling deployment at 22:27:52 UTC. The service
reported `deployment_cancelled`; no artifact/permission failure was returned. A [deploy-only retry](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385/job/126909018013)
reused the same artifact ID and digest (environment deployment `7559586372`, following
`7559377173`). Pages accepted it at 22:28:41 UTC but returned an empty status while polling;
at 22:38:39 UTC the second job also timed out and cancelled. Workflow attempt 2 finished
**cancelled**, not successful. The official [Pages deployment limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) is ten minutes.
Neither job reported an invalid artifact or missing permission.

Anonymous Chromium probes on the [actual Pages URL](https://arhaan2.github.io/song-neighbors/)
during the retry and again after the terminal cancellation returned GitHub's **HTTP 404** on
both viewports. The `build-info.json` request for those attempts also returned 404. The app and catalog were unavailable during those probes, so tagging was deferred.

The [third deploy-only attempt](https://github.com/Arhaan2/song-neighbors/actions/runs/41923813385/job/126917884910)
created environment deployment `7559912724`. At 22:46:25 UTC Pages accepted the same
artifact and again identified the deployment as `f8c6260985bbb4de1a041e42e2b1959522aa88b6`.
Its first poll at 22:46:31 UTC returned `deployment_cancelled`. This immediate result
motivated one attempt with a fresh delivery ID. The cause of the earlier stall is unknown.

The retained original `artifact.tar` has SHA-256
`7e5919b8ce212548440ec3fa1247e099e7cee3ac8f782ef5199faa8584341e05`. Two fresh
loopback Chromium journeys passed against those bytes, one per required viewport.
Each exercised the product flow and matched all 16 file hashes.

[PR #5](https://github.com/Arhaan2/song-neighbors/pull/5) added a manual workflow to
restore the tested payload. Head `932054e3784087bd6c7ad9f2c6246b2fc27411e1` passed
[PR CI](https://github.com/Arhaan2/song-neighbors/actions/runs/41929186559) and was
integrated as `73d393a735e95570d52c2e1241417b295c45947a`. Its [main CI](https://github.com/Arhaan2/song-neighbors/actions/runs/41929429274)
passed and skipped normal Pages deployment.

The [recovery workflow](https://github.com/Arhaan2/song-neighbors/actions/runs/41929584485)
succeeded. Its [restore job](https://github.com/Arhaan2/song-neighbors/actions/runs/41929584485/job/126922779841)
verified source ancestry, allowed only workflow/evidence changes, and checked the tar digest,
clean embedded SHA, catalog version, manifest hash and base path. It uploaded the same
`artifact.tar` in Actions artifact `13370193066`. Its outer ZIP has SHA-256
`28874cf2cd0380692c9812f78b1134f89c91fb65484e4c69d61f54a0465d03cd`.
Independent downloads and a byte comparison confirmed that both inner tars match exactly.
The [deploy job](https://github.com/Arhaan2/song-neighbors/actions/runs/41929584485/job/126922871782)
published those bytes in environment deployment `7560099844`. Its delivery SHA was
`73d393a735e95570d52c2e1241417b295c45947a`. The deployed application identifies its
original source `f8c6260985bbb4de1a041e42e2b1959522aa88b6`.

The clean local candidate at `f257b652f905293b3c9ea47a7ca3cf756fd345c6` also passed the two
focused anonymous release journeys with `sourceDirty: false`; each compared all 16 file hashes.
Navigation to enabled search was **233 ms desktop / 146 ms mobile**. Click to 20 rendered
cards was **67/58 ms desktop** and **64/59 ms mobile** for one/five seeds respectively.
[Desktop](assets/phase-4-local-desktop.png) and [mobile](assets/phase-4-local-mobile.png)
screenshots show the locally verified release candidate, not the public Pages URL.
These single unthrottled localhost measurements include Playwright actionability, assertion
polling and rendering; they are not public network timings or guarantees.

## Live browser verification

Two fresh anonymous Chromium 156 contexts exercised the actual HTTPS Pages URL.
The desktop (1440×900) and mobile (390×844) journeys both passed in 9.8 seconds total.
They loaded the real worker and catalog, searched and selected one through five seeds,
rendered 20 recommendations, applied both feedback directions, reset to the exact
seed-only ordering and refreshed to an empty session. Both checked attribution and
matched all 16 deployed file hashes to the recovered artifact. Each had zero failed
requests and zero page errors. The public `build-info.json` reported `sourceDirty: false`,
source `f8c6260985bbb4de1a041e42e2b1959522aa88b6` and catalog `fma-small-clap-general-20261104`.
[Desktop screenshot](assets/phase-4-live-desktop.png) · [Mobile screenshot](assets/phase-4-live-mobile.png) · [Browser evidence, `recovery.live`](phase-4-browser.json)

| Observed public Pages flow | Desktop | Mobile viewport |
| --- | ---: | ---: |
| Navigation to usable search | 2,184 ms | 283 ms |
| Recommend click to 20 rendered cards, one seed | 82 ms | 61 ms |
| Recommend click to 20 rendered cards, five seeds | 59 ms | 57 ms |

These are single observations from the tested browser, network and catalog. The click
measurements include worker execution, browser rendering and test-side waiting.

The focused check used the extracted artifact as its reference.

```sh
RELEASE_ARTIFACT_DIR="$artifact_directory" \
RELEASE_BASE_URL=https://arhaan2.github.io/song-neighbors/ \
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e -- tests/e2e/release.spec.ts
```

## Release

After both public journeys passed, GitHub Release `v0.1.0` was published at 22:59:27 UTC.
The remote annotated tag object `0bfc227487bee8fcb5e66c8cc601c0061d0d61c7` peels to
`f8c6260985bbb4de1a041e42e2b1959522aa88b6`, the source in live `build-info.json`.
The final evidence update records this outcome separately from the delivery and tagged
application revisions. [Release v0.1.0](https://github.com/Arhaan2/song-neighbors/releases/tag/v0.1.0) · [Source release notes](../RELEASE_NOTES.md)

## Human listening and limitations

**Zero human ratings; sounds-similar and want-to-hear-now are both unmeasured.**
The [worksheet](../LISTENING_WORKSHEET.md) is blank. This is an honest prepared-catalog beta,
including field recordings, not universal commercial coverage. Excerpts do not represent whole
songs. Ranking weights, larger-catalog performance, exhaustive duplicate recognition, physical
phones, optional browser engines and assistive-technology sessions remain unproven.
