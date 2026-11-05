# Phase 5A — expanded catalog audit and ingestion preparation

November 5, 2026. **Pipeline preparation complete; live catalog still 500 recordings.**
This phase performed metadata review, implementation and bounded checks against cached material.
No larger audio archive was downloaded, no new audio inference ran, and no new recording was
activated. Human listening/preference remains unmeasured.

## Verified identity and source capacity

The existing checkout was clean on main `559b2f2`; refreshed `origin/main` matched. Origin is
`https://github.com/Arhaan2/song-neighbors.git`, confirmed PUBLIC with push access. Work used
`codex/phase-5a`, preserving the unrelated build pack/ancestor repository and existing `v0.1.0`.
Two implementation workers owned disjoint files; an independent reviewer checked the result.
Agent review is not a human GitHub approval.

Reused metadata ZIP: **358,412,441 bytes**, upstream SHA-1
`f0df49ffe5f2a6008d7dc83c6915b31835dfe733`, measured SHA-256
`d9527a5297a65da31c5676484d5047c3e2b8a8060ce72a46e26158be736bf265`.
[Official FMA source/checksums](https://github.com/mdeff/fma#data) identify rc1, dated May 9, 2017.
The 106,574 metadata rows have disjoint smallest-subset labels 8,000 small, 17,000 medium,
81,574 large. Cumulative membership is **8,000 / 25,000 / 106,574**, never their sum.

| Cumulative source | Metadata considered | Reviewed eligible | Published now | Cleared published | Potential new IDs | Eligible artist IDs / names |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small | 8,000 | 786 | 500 | 493 | 293 | 169 / 168 |
| medium | 25,000 | 1,574 | 500 | 493 | 1,081 | 257 / 255 |
| large | 106,574 | 6,258 | 500 | 493 | 5,765 | 780 / 778 |

All three source memberships include the same 500 published IDs, never counted as new. The
unchanged historical small inspector reproduces **793 eligible / 293 unpublished / 170 source IDs
/ 169 display names**. Expanded notice review separately holds 7 currently published IDs
from the future selection; the table distinguishes actual publication from future policy clearance.
The eligible URL policy remains exact CC0 or unported CC BY 1.0/2.0/2.5/3.0/4.0, with version
and source notice conflicts excluded. Vague processed labels never supply license versions.

Broader notice review removed **125** records beyond the old large-pool rules: restricted audio
derivatives/permission request, album NC, unresolved credit-in-title request, mixed underlying
or album license versions, and explicitly described sampled/borrowed material lacking supplied
underlying grants. These are conservative project-policy holds, not findings of infringement. The reviewer caught the seven-track album `18571` BY3/BY4 conflict;
all seven were conservatively excluded. Review also repaired omitted contributor notices and
bounded public credit text to avoid copying source contact details. Applicable credits augment
future selection attribution even for existing IDs, without changing the active public files or
cache identity. Exact raw strings remain reproducible in ignored evidence; the public manifest
binds each selected record's evidence hash and the full materialized selection hash.

[Machine-readable audit](phase-5a-audit.json) contains all source exclusion IDs/reasons, review
decisions, distributions and concentration. [Candidate manifest](../catalog/phase-5a-selection.json)
is public-safe selection evidence, not an analyzed catalog. This is scoped source-policy review,
not exhaustive legal clearance or a listening assessment.

## Recommended first expansion

Recommend **up to 4,925 total recordings: 493 cleared existing IDs plus 4,432 candidates**,
from **FMA-large**, conditional on availability, decoding, inference and deduplication. It is the
smallest official archive supporting a near-5,000 batch. Medium is the smallest new archive for
a substantial smaller step (at most 1,574 eligible, 1,081 additions before content/cap/audio
losses), but cannot approach 5,000; it remains an optional alternative, not this manifest.

Selection preserves all cleared recording IDs, explicitly holds unresolved existing IDs, adds least-represented source artists first, breaks ties by
current genre representation/name/numeric artist ID, and interleaves genre/album groups before
stable recording ID within artists. The global **50-per-source-artist cap includes existing
records**. Final IDs are sorted. The plan reaches **756 source artist IDs /
754 display names**; largest artist is 50 records (~1.02%), top ten together
**10.15%**, versus 26.35% in the eligible large pool. The **75-record planning
shortfall** is intentional under content deferrals and the variety cap; no extra material is
invented and the cap is not relaxed for a round count.

There are **82 new likely nonmusical candidates deferred** based on source Spoken/Sound Effects
genres or albums `12256` (crowd sound effects) and `18833` (researcher conversations/radio episodes). Existing
published examples stay. **67 selected records have uncertain Field Recordings context**;
this is a review flag, not a rejection. Five literary references and one sound-collage
reference are also flagged uncertain; a thematic reference alone does not prove restricted reuse. Instrumental, ambient and experimental music remain
eligible. Genre evidence is descriptive metadata, not proof of acoustics or suitability.

Large-pool `genre_top` is absent for 3,968 eligible records; 224 also lack genre tags.
The selection contains 2,772 missing top-level labels and 224 tagless records. Primary selection buckets use
source `genre_top`, otherwise the alphabetically first top-level ancestor of available tags,
otherwise `Unknown`; this fallback must not be read as an authoritative single-genre assignment.
Selection primary buckets: Blues 25, Classical 309, Country 115, Easy Listening 40, Electronic 1,654, Experimental 809, Folk 314, Hip-Hop 332, Instrumental 262, International 75, Jazz 4, Old-Time / Historic 15, Pop 319, Rock 426, Soul-RnB 2, Unknown 224.
Eligible counts by every source tag and all three subset distributions are in the audit. No eligible
row is missing album title; incomplete title/artist/license/source evidence is already excluded.

Current published IDs held for the future: `fma:006674`, `fma:006675`, `fma:006677`, `fma:006679`, `fma:006680`, `fma:006684`, `fma:061011`. The live 500 are unchanged in this phase;
Phase 5B must omit these from the new publication unless exact source evidence resolves the
underlying-grant uncertainty. Their stable IDs are not recycled.

## Acquisition, resources and compatibility

Bounded official HEAD requests returned HTTP 200/Accept-Ranges; no larger response body was fetched.
Small cached ZIP integrity was rechecked; a two-record extraction reused both (1,923,981 bytes),
writing no audio. Larger archive integrity and **all new per-record audio stages remain unverified**.
Metadata eligibility, archive availability, successful decoding, inference, audio deduplication and
publication are distinct counts. The audit labels stages not assessed by its metadata-only code.

| Source | Full archive download | Estimated eligible excerpt storage* | Practical note |
| --- | ---: | ---: | --- |
| Small | 7,679,594,875 B / 7.15 GiB, cached | ~0.74 GiB | 293 eligible additions |
| Medium | 23,825,005,356 B / 22.19 GiB | ~1.48 GiB | Below the near-5,000 target |
| Large | 100,306,112,191 B / 93.42 GiB | ~5.90 GiB for all eligible; ~4.64 GiB selected | Recommended target source |

*Estimates use the actual 500 cached MP3s: 505,844,404 B total, mean 1,011,688.808 B. Exact larger
member sizes remain unverified; selected extraction measures them from the verified ZIP. Download
requires remaining archive bytes plus 2 GB reserve. Extraction checks selected final growth plus
one atomic replacement and reserve. Budget **110 GiB free on one volume**, or an external archive
volume with **100 GiB free plus 8 GiB locally** for selected data/output. Current free space was
about **33 GiB**, so storage is a Phase 5B prerequisite. No files were deleted to make room.

Downloader supports explicit small/medium/large identities, safe completed-part adoption, resume,
checksum failures and disk checks. Extraction validates every requested member before writing,
rejects duplicate/missing/path/source/license errors, replaces atomically and reuses only verified
matching bytes. Extracting **only additions** into the existing audio root avoids replacing the
original 500 with unverified overlap copies from another archive.

`catalog.py`, `uv.lock`, encoder, processor, windowing, normalization and active files are unchanged.
`preflight.py` verified all pinned model files and full configuration
`df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb`, with **500/500 cache vectors
byte-identical to publication**, no failures and no inference. Encoder remains
`laion/larger_clap_general@ada0c23a36c4e8582805bb38fec3905903f18b41`; same-revision processor,
48k mono, starts 0/10/20, zero padding, per-window L2 → mean → final L2, 512 dimensions. The earlier
music checkpoint remains rejected. Model/runtime caches stay ignored. Estimate inference time
from the new 40-addition smoke in Phase 5B, not from metadata work.

## Delivery assessment

Current browser worker fetches pointer then manifest, then tracks/vectors/build concurrently. It
checks full file hashes and sequential per-row hashes, parses complete metadata/build, converts
float32 to float64 and creates a second normalized float64 copy for the engine. The temporary
loader copy can be collected after initialization. Vectors remain in the worker; full track metadata
is structured-cloned to the main thread. Ranking remains exact scans and sorted neighborhoods.

Measured baseline payload is **2,222,958 B**, excluding optional attribution. A local Node24.18
in-memory loader observation took **38.0 ms** validation and **2.85 ms** engine initialization;
ten five-seed queries ranged **13.46–17.85 ms**. With source buffers and both catalog/engine copies
deliberately retained, array buffers rose from 2.43 MB to 6.46 MB and heap used from 11.96 MB to
14.45 MB after explicit GC. These are one-host Node observations, **not browser/mobile peak-memory
or network predictions**. Production desktop/mobile behavior passed the unchanged-catalog suite.

| Artifact | Current measured bytes | Candidate estimate bytes |
| --- | ---: | ---: |
| tracks.json | 864,444 | 8,777,146 |
| embeddings.f32 | 1,024,000 | 10,086,400 |
| build.json | 331,169 | 3,262,015 |
| ATTRIBUTION.md | 578,195 | 5,931,925 |
| Runtime total (with pointer/manifest, no attribution) | 2,222,958 | 22,128,906 |

These estimates use actual selected metadata/credit text and current format overhead; vectors are
exact conditional on successful count/dimension. [Reproducible size evidence](phase-5a-delivery.json)
records the method and measured local gzip sizes. Float64 vectors need **20,172,800 B** in the
engine; two simultaneous copies need **40,345,600 B**, excluding source float32, metadata,
strings/maps, hashing/parse copies and runtime overhead. Full metadata cloning and sequential row
hashes require expanded desktop/mobile measurements before publication, not an architecture rewrite.

No estimated single export file approaches GitHub's [50 MiB warning / 100 MiB block](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github);
the projected site is below the [1 GB Pages cap](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
Repeated immutable versions still accumulate repository bytes. Two concrete Phase 5B gates need
updating: the release evaluator's hardcoded original audit/500-ID assertion and the artifact
audit's single-version allowlist when Vite copies historical versions. Keep old release tags/history, and stage only the newly cleared active catalog for the next
website publication so held historical records are not republished alongside it. Active test fixture assumptions need corresponding
updates. The [runbook](../PHASE_5B.md) lists exact actions and commands without changing architecture.

## Verification, review and boundary

Final lightweight checks passed **34 Python tests**, Ruff lint/format and `git diff --check`.
Focused checks cover cumulative overlap, stable/deterministic IDs, global artist caps, source
license/notice enforcement, original small behavior, exact contributor credits, explicit published
holds, archive selection/resume/disk/atomic failures, and compatible-cache preflight. Earlier credit
regressions caught omitted mapping entries; the repaired complete suite passed.

Web gates passed: `npm ci`, lint, typecheck, **75 unit tests**, ready-catalog validation,
`npm run test:release`, production build, artifact audit and **20/20 Chromium desktop/mobile cases**
(`PREVIEW_PORT=4185 PLAYWRIGHT_CHANNEL=chrome npm run test:e2e`). No deployed catalog was recomputed.
Python checks used the existing locked `tools/catalog/.venv/bin/python` / `ruff`; the README
provides equivalent `uv run --locked` commands.

Independent review reproduced the committed manifest, audit and materialized selection byte for
byte, checked all 4,925 evidence hashes, 493 retained baseline identities/audio/grants, seven holds
and bounded contributor credits, and reran the 34 Python tests and Ruff checks. Historical small
eligible/selected IDs and exclusion counts match Phase 1 exactly. Reviewed P1 source-policy gaps
and P2 dropped-credit findings were repaired; no blocking code finding remains. The tested source
is the Phase 5A working tree based on `559b2f2`; final integration identity is recorded separately.


Public source contains no audio, weights, private local evidence, caches, credentials or personal
listening data. The active pointer remains `fma-small-clap-general-20261104`, manifest SHA-256
`b57bda0fb968b5feb49bb4ad7f33ea61ff67647483f496b519edea85b576ae11`. The adaptive interface,
recommendation/session code, public catalog and release tag were not edited. Source preparation
can be integrated independently of the storage prerequisite; **songs added to live catalog: zero**.

[Exact Phase 5B commands/prerequisites](../PHASE_5B.md) cover deterministic materialization,
acquisition, additions-only extraction, a real new-audio smoke, full compatible-cache run,
validation, measured delivery checks and reviewed publication. Stop here at Phase 5A.
