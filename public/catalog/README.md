# Public catalog exports

`current.json` selects `fma-small-clap-general-20261104`: 500 genuine audio embeddings across
169 artist names, measured at 512 dimensions. Its immutable directory contains exactly
`manifest.json`, `tracks.json`, `embeddings.f32`, `build.json`, and `ATTRIBUTION.md`.

The pinned trained model is `laion/larger_clap_general` revision
`ada0c23a36c4e8582805bb38fec3905903f18b41`. The initial music checkpoint was rejected; none of
its vectors are published. Run `npm run validate:catalog -- --require-ready` to verify all bytes,
configuration, rows and provenance without downloading audio or model weights.

See [the contract](https://github.com/Arhaan2/song-neighbors/blob/main/docs/CATALOG_CONTRACT.md), [Phase 1 evidence](https://github.com/Arhaan2/song-neighbors/blob/main/docs/phases/phase-1.md)
and [recording credits](fma-small-clap-general-20261104/ATTRIBUTION.md). Recording-derived artifacts
retain their per-record terms; the application's MIT license does not relicense them. Raw audio,
model weights, caches, local paths and private source manifests never belong here.

Application and bundled-software notices are published separately at [LICENSE.txt](../LICENSE.txt)
and [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). Those software terms do not
replace this catalog’s source-recording, metadata or model notices.
