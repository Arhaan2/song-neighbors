# Song Neighbors initial public beta

Song Neighbors lets you choose 1–5 indexed songs, receive up to 20 real audio-based recommendations, and refine the current session with positive or negative feedback. Reset restores the selected seeds' original ordering; refreshing clears the in-memory session. There is no playback, account integration, hosted inference or analytics.

## Catalog

- `fma-small-clap-general-20261104`: 500 distinct recordings, 169 artist display names / 170 source artist IDs, eight FMA-small source genre labels, 512 dimensions.
- Encoder: `laion/larger_clap_general`, revision `ada0c23a36c4e8582805bb38fec3905903f18b41`, using its same-revision processor. Rejected initialization-state music-checkpoint outputs are excluded.
- Audio analysis covers up to 30 seconds of each supplied excerpt, with actual unpadded coverage recorded per track. It does not establish whole-song representation.
- Metadata, exact recording terms and source/model credit accompany the immutable catalog. No raw audio, weights, private manifests or third-party artwork belong in the published artifact.

## Verification and identity

Release evidence covers several real seed sets, single- versus multiple-seed behavior, exclusions, duplicates, refinement/reset, catalog integrity, production-browser behavior and artifact inspection. The [Phase 4 report](phases/phase-4.md) records actual results, environment-specific timing/payload observations, review and CI/deployment identifiers, including any pending gate.

The public [build-info.json](https://arhaan2.github.io/song-neighbors/build-info.json) is the authoritative deployed source/catalog identity. The release tag must target that exact source commit only after signed-out public Chromium desktop/mobile verification. Existing tags are immutable; use the next suitable version if `v0.1.0` already exists. A later evidence-only documentation commit is recorded separately and does not change the release tag or deployed revision.

## Known limits

This is a prepared independent catalog with limited commercial-song coverage; it also includes experimental and field-recording excerpts. Audio embeddings and heuristic ranking can miss personal taste, mood, lyrics and broader musical context. Duplicate handling covers exact source audio and declared recording groups, not every cover or alternate version. Source URLs retain historical provenance and may become unavailable. State is intentionally lost on refresh. Performance observations are specific to the tested catalog and environments; optional engines and physical devices are not a blanket compatibility claim.

**Human listening/preference: unmeasured.** Functional tests, numerical agreement and catalog counts do not establish musical satisfaction. The [listening worksheet](LISTENING_WORKSHEET.md) records “sounds similar” and “want to hear it now” separately.

Original application code remains [MIT licensed](../LICENSE). That license does not relicense source recordings, metadata, models, derived catalog artifacts or dependencies; see [third-party notices](../THIRD_PARTY_NOTICES.md) and [per-record attribution](../public/catalog/fma-small-clap-general-20261104/ATTRIBUTION.md).

[Website](https://arhaan2.github.io/song-neighbors/) · [Public repository](https://github.com/Arhaan2/song-neighbors) · [Demo script](DEMO.md)
