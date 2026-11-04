# Phase 4 — public beta release

November 4, 2026 (America/Los_Angeles). **Verification/publication in progress.**
Initial tested state is the Phase 4 working tree based on `2e23ff3efadae99ff26050363cf429e95b9bc82f`.
This report will record the exact tested/deployed commit after live verification; build metadata,
not this document's own commit, is authoritative. No release tag has been created yet.

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
format --check .`, `uv run --locked python -m unittest discover -s tests -v`. The final CI
also repeats the full suite on clean Linux checkouts. Public integration/deployment and live
verification are still pending at the time of this source commit.

## Human listening and limitations

**Zero human ratings; sounds-similar and want-to-hear-now are both unmeasured.**
The [worksheet](../LISTENING_WORKSHEET.md) is blank. This is an honest prepared-catalog beta,
including field recordings, not universal commercial coverage. Excerpts do not represent whole
songs. Ranking weights, larger-catalog performance, exhaustive duplicate recognition, physical
phones, optional browser engines and assistive-technology sessions remain unproven.
