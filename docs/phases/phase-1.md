# Phase 1 — real audio catalog

Date: November 4, 2026 (America/Los_Angeles). **Phase 1 real catalog verified: 500 recordings, 169 artist names, 512 dimensions.** No Phase 2 work or Pages deployment is included.

## Repository and independent review

Worked in the actual independent repository at `~/Desktop/song-neighbors`, preserving the supplied build pack and unrelated ancestor repository. Initial `main` and refreshed `origin/main` both pointed to `6ab1564d011ed1bff0886c81d3e017c6ae753d6b`; the working tree was clean. Verified `Arhaan2/song-neighbors` is public and `main` was unprotected. Created `codex/phase-1-catalog` and [PR #1](https://github.com/Arhaan2/song-neighbors/pull/1). No visibility or protection settings changed.

Two workers owned disjoint Python pipeline and TypeScript validator files. A third agent reviewed implementation and actual source records independently. Review found and repaired weight-artifact verification, extraction-time code provenance, full dependency-lock cache identity, unsupported runtime configuration acceptance, and actual contradictory recording notices. Agent review is not a human GitHub approval.

Implementation commits include `2036784` (pipeline/source/validator), `70b84cb` (capacity diagnostic), `17c5b46` (runtime checks), `4156846` (measured status), `c727102` (completed-transfer resume), and `69af20e` (reject initialized music checkpoint; pin trained replacement). Accepted inference records clean source commit `69af20ef2fe9f1f4e03746c06078159901a0399b`; artifact/docs publication follows it. [PR #1](https://github.com/Arhaan2/song-neighbors/pull/1) carries the authoritative final merge SHA and CI checks, avoiding circular hashes. Earlier [resume-fix CI 41902631332](https://github.com/Arhaan2/song-neighbors/actions/runs/41902631332) passed; final artifact CI runs on the PR head. No protection was bypassed.

## Source, eligibility and publication basis

Upstream: [mdeff/fma](https://github.com/mdeff/fma), inspected source revision `607364e7d8263f890d23c838802f29637600611f`, dataset `2017-05-09-rc1`. Downloaded metadata first into ignored `.cache/catalog`, with 44 GiB initially free. No larger/full audio dataset was requested.

The metadata ZIP is 358,412,441 bytes. Its published SHA-1 `f0df49ffe5f2a6008d7dc83c6915b31835dfe733` matched; measured SHA-256 is `d9527a5297a65da31c5676484d5047c3e2b8a8060ce72a46e26158be736bf265`. A resumed transfer ended with curl error 18 at 210,487,360 bytes; resuming again completed the checksum-verified file. This was a transfer failure, not a license or model failure.

Official small-archive HEAD returned HTTP 200 and Content-Length **7,679,594,875** bytes. Published SHA-1: `ade154f733639d52e35e32f5593efe5be76c6d70`. Slow official transfer was resumed from the [ModelScope mirror](https://modelscope.cn/datasets/pengzhendong/fma/tree/021e02950d090f46c16f82cd4e3d28ae667dbede), used only as byte transport. Its blanket repository license is not a recording license. The complete archive matched that original SHA-1 and measured SHA-256 `f923bbef327820456d50965c3c320c3c7b6dab8456449429fd78f7ec96a5d02c`. The CLI verified and adopted the complete `.part` without network, then extracted only the selected 500 files. The official-issue `fma.mine.toys` mirror failed TLS hostname validation; it was not bypassed. Inspected Hugging Face alternatives were repacks/different sizes; no extra audio was downloaded.

The verified metadata has **106,574** records: subset labels 8,000 `small`, 17,000 `medium`, 81,574 `large`. Selection uses exactly the 8,000 `small` IDs. Joining `tracks.csv` to `raw_tracks.csv` restores exact `license_url`, source URLs and copyright notices discarded by the processed table. For example, vague title `Attribution` has an explicit per-record BY 4.0 URL; the version comes from that source field, never a guess.

The URL allowlist initially matched 842 records. Notice review removed 49 more, leaving **793 eligible recordings across 170 source artist IDs**. The deterministic 500-record selection covers all 170 IDs and **169 distinct artist display names**: The Zombie Dandies has two source artist IDs. All selected files succeeded; actual source genre counts are Electronic 71, Experimental 71, Folk 71, Hip-Hop 70, Instrumental 70, International 51, Pop 26, Rock 70. These are source genre labels, not inferred acoustic quality.

[The complete source audit](phase-1-source-audit.json) lists eligible/selected IDs, license fields, counts and all 7,207 per-record exclusion reasons. Exclusions include 6,972 NC/ND/SA records, 186 missing/unmapped license URLs, three conflicting restricted notices, one ambiguous underlying-work license, and scoped album/artist terms. [Policy details](../CATALOG_POLICY.md) record each reviewed album/artist exclusion and retained credit requirement. Per-track notices, album links, producer credit, and artist-requested attribution wording are retained; literal `null` fields are omitted.

The public derived catalog relies on the exact per-record CC0/CC BY grants permitting transformation and sharing, with applicable credits and change notices retained. It does not rely on absent raw audio as permission. FMA's research-intent statement is retained. Metadata selection/normalization is separately CC BY 4.0; the model is Apache-2.0; original software is MIT. [Third-party notices](../../THIRD_PARTY_NOTICES.md) and each export's attribution distinguish them. No artist messages were sent.

## Model, preprocessing and cache identity

The task started with `laion/larger_clap_music` revision `a0b4534a14f58e20944452dff00a22a06ce629d1`, checkpoint SHA-256 `5c289311f4a030d768af7ffbfdecd01b008aa64824211899a4e59f4f9d154fd1`. Real forward passes and even full structural validation initially succeeded, but median pairwise cosine was 0.96268. A deeper raw-checkpoint audit found all 253 bias tensors zero, all 134 normalization parameter tensors at defaults, both BN running-stat buffers at defaults, and a zero BN update counter. No audio scaling or processor mismatch explained it. This initialization-state fingerprint failed the pretrained-weight gate. All initial vectors/exports were withdrawn to ignored cache before public artifact commits; they are excluded from the final catalog. The validator now explicitly rejects the old model and checkpoint, even if hashes are coherently rewritten.

[The independent model audit](phase-1-model-audit.json) preserves exact old/new measurements. Upstream [model discussion #2](https://huggingface.co/laion/larger_clap_music/discussions/2) and [MTEB #5069](https://github.com/embeddings-benchmark/mteb/issues/5069) also report zero-shot/text problems; those reports alone do not prove audio failure. The local checkpoint evidence drove rejection. This was a correctness repair within Phase 1, not an encoder-quality benchmark or Phase 2 work.

Accepted encoder: [laion/larger_clap_general](https://huggingface.co/laion/larger_clap_general/tree/ada0c23a36c4e8582805bb38fec3905903f18b41), revision **`ada0c23a36c4e8582805bb38fec3905903f18b41`**, with `ClapFeatureExtractor` from that same revision. Its 776,444,665-byte checkpoint SHA-256 is `314eb00cce6ad68d25237b8446b659ccdb136ed4672c1bca470f142f72455026`; config SHA-256 is `6268f76a067e3104bf9001e97d7dcc0fcfb16f3086cfb478ee72d95900d7fc1d`. Processor file SHA-256 is `9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753`; canonical processor digest is `c15057851b990e02fffdae8a7e89f730f0cddc77cbf893254bfcc29f81c116ba`.

Independent inspection found learned replacement parameters: none of the 253 bias tensors all-zero, no normalization parameters at initialization, BN update counter **85,173**. The replacement real smoke independently measured **512 dimensions**. A first setup attempt safely refused missing `download-identity.json`; running canonical `download-model` completed provenance, then inference passed. No incompatible old vectors were reused.

Locked Python 3.12 inference dependencies: Torch 2.8.0, Transformers 4.57.1, NumPy 2.3.4, SoundFile 0.13.1, soxr 1.0.0, librosa 0.11.0, huggingface-hub 0.36.0, with transitive versions in `uv.lock`. The inference extra is optional and absent from ordinary CI.

SoundFile/libsndfile decodes float32; channels are averaged in float64 then cast to float32; soxr HQ resamples to 48 kHz without loudness/peak normalization. Windows begin at 0, 10 and 20 seconds when those starts exist, covering at most the first 30 seconds of the delivered excerpt. Partial windows are right zero-padded; recorded actual coverage excludes padding. Exact ten-second processor inputs avoid random cropping. L2-normalize each window, average equally, then L2-normalize and serialize little-endian float32. Original full-song offsets are not asserted: FMA's source clipping used a midpoint/stream-copy process, while this catalog measures the delivered excerpt.

Cache identity binds source audio SHA-256 to the complete encoder/processor/preprocessing/window/aggregation configuration, runtime versions, implementation version and full dependency-lock digest. Atomic entries retain original extraction commit/source digest/dirty status and are revalidated before reuse. Per-file failures are recorded and retried. Changed source/configuration or corrupt caches are not reused. Export stages immutable artifacts, invokes the independent lightweight validator, then publishes the version and optionally activates its pointer.

## Reproduction and verification

Exact acquisition/inference/export commands are in [tools/catalog/README.md](../../tools/catalog/README.md). The implemented workflow is:

```sh
uv run --project tools/catalog --locked python tools/catalog/source.py download metadata --cache .cache/catalog
uv run --project tools/catalog --locked python tools/catalog/source.py inspect --metadata-archive .cache/catalog/fma_metadata.zip --limit 500 --selection .cache/catalog/selection-500.json --report docs/phases/phase-1-source-audit.json
uv run --project tools/catalog --locked python tools/catalog/source.py download small --cache .cache/catalog
uv run --project tools/catalog --locked python tools/catalog/source.py extract --audio-archive .cache/catalog/fma_small.zip --selection .cache/catalog/selection-500.json --output .cache/catalog/fma_small
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py download-model
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small --run smoke-general-40 --limit 40
uv run --project tools/catalog --locked --extra inference python tools/catalog/catalog.py extract --selection .cache/catalog/selection-500.json --audio-root .cache/catalog/fma_small --run catalog-general-500
uv run --project tools/catalog --locked python tools/catalog/catalog.py export --selection .cache/catalog/selection-500.json --run catalog-general-500 --version fma-small-clap-general-20261104 --activate
npm run validate:catalog -- --require-ready
uv run --project tools/catalog --locked python tools/catalog/coverage.py --catalog public/catalog/fma-small-clap-general-20261104 --output docs/phases/phase-1-coverage.json
```

All workflow commands above ran successfully for the accepted model. The 40-record smoke was deliberately interrupted with SIGINT after 32 completed recordings (exit 130); the identical command resumed with **32 cache hits + 8 inferred**, zero failures. A separate `--run smoke-general-40-reuse --limit 40` pass reported **40 hits + 0 inferred**. The isolated smoke export validated 40 tracks / 36 artist names / 512 dimensions before expansion. Full extraction then reported **500 rows, 40 hits, 460 inferred, zero failures**. Atomic caches and checkpoint reports survived the interruption. The source download also demonstrated completed-partial adoption after checksum verification.

A genuine sample is `fma:045099`, **Spell — Rolemusic**: decoded excerpt duration 30.0027083333 s; actual analyzed intervals 0–10, 10–20 and 20–30 s; 512-dimensional normalized output. Its final float32 vector SHA-256 is `f8f9fab0dd11634d14fb27bca22ecf03471075217d213277f1a6de08c5935e8c`. [Machine-readable inference evidence](phase-1-inference.json) includes sample values, source/configuration hashes, run counts, norms and all artifact hashes. The independent reviewer re-inferred a sample with the accepted pinned CPU model and checked the exported bytes.

Final targeted gates: **16 Python tests**, **15 TypeScript tests**; Ruff check/format; `npm ci`, lint, typecheck, tests, `validate:catalog -- --require-ready`, and production build. Synthetic vectors are isolated test fixtures only. The inherited project has no `test:e2e` script; no no-op script was added. The implemented status/disclosure/attribution behavior was checked directly in built Chromium instead.

The lightweight validator checks file bytes/hashes, sorted unique IDs/rows, measured shape, little-endian floats, finite/nonzero/normalized vectors, exact runtime/configuration compatibility, per-row provenance/cache/vector identity, actual window coverage, required notices, and public-file safety. It rejects duplicate source-audio hashes. The offline five-seed/twenty-result diagnostic validates its input first, excludes seeds plus positive/negative cases and known duplicates, and uses simple mean cosine only to demonstrate catalog capacity. It is not the Phase 2 production engine or a musical-quality evaluation.

## Actual export and coverage

The sole public version is **`fma-small-clap-general-20261104`**, with 500 distinct source audio hashes and 500 distinct vectors, 169 artist display names (170 source IDs), and measured dimension 512. Recording grants: **356 CC BY 4.0, 125 CC BY 3.0, 19 CC0 1.0**. Exact URLs and supplied notices remain per record. The ready pointer hashes manifest `b57bda0fb968b5feb49bb4ad7f33ea61ff67647483f496b519edea85b576ae11`.

`embeddings.f32` is exactly **1,024,000 bytes** (500 × 512 × 4), little-endian row-major float32. Its SHA-256 is `0b29eefec5e6f708f1be7bc2d25d5b3e4970b4f036e698c7ce8d775389aa9054`. Measured norms range approximately 0.9999999943–1.0000000051. The manifest binds exact tracks/build/attribution/vector file hashes; stable recording IDs and sorted rows align. All public rows were independently traced to the reviewed selection, actual source audio and compatible cache. Public/built artifacts contain no raw audio, weights, caches, private tracks or local absolute paths.

[The reproducible capacity case](phase-1-coverage.json) chooses five distinct-artist seeds, excludes those seeds plus positive/negative example tracks and known duplicate identities, leaves **493** eligible candidates, and returns **20 distinct results**. It passes the scoped 100-recording/10-artist floor. This is an offline engineering diagnostic using actual embeddings; it is not the Phase 2 ranking engine, a public acoustic demo, or proof of musical quality. Final catalog pairwise cosine median is **0.36210**; those scores are not preference probabilities.

## Built status and remaining limits

The build validates the pointer/catalog and injects only measured count/version status into the existing screen. It reports 500 analyzed songs, 169 artists, and a real credits link, while explicitly keeping search/recommendations in development. Both required design skills were applied to this small status update, retaining the established True-black flat direction, seed 1484283753, system font and native disclosure. No browser catalog loader/ranking implementation was added.

Production inspection under `/song-neighbors/` at 1440, 768 and 390 px: 0 design failures; one existing `unused-canvas` heuristic warning, explained by equal 170 px desktop margins. All final fold/page images were viewed. Direct Chromium checks cover keyboard disclosure, 320 px expanded/collapsed views without horizontal overflow, and an empty warning/error console. The attribution URL returns HTTP 200 and its bytes match the manifest. [Desktop evidence](assets/phase-1-desktop.jpg) and [mobile evidence](assets/phase-1-mobile.jpg) show the limited implemented state.

Human listening/preference evaluation remains unmeasured. This catalog represents supplied short excerpts, not whole compositions or universal commercial-song coverage. Exact duplicate bytes are excluded; no unsupported claim of exhaustive musical duplicate detection is made. Source genre variety is metadata coverage, not an acoustic-quality finding. Cross-platform numerical tolerances still apply even with pinned dependencies; the same-machine sample is independently reproducible.

Implementation and real-catalog verification are complete; public integration is recorded by PR #1 and its checks. No Pages deployment, release tag, streaming integration, or Phase 2 work is included. Stop at this boundary.
