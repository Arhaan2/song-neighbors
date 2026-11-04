# Third-party software and data

The root MIT license covers original Song Neighbors application code and documentation. It does not relicense third-party software, model weights, audio recordings, source metadata, artwork, or derived catalog artifacts.

The foundation is adapted from the official Vite React/TypeScript template (MIT; copyright 2019–present Evan You and Vite contributors). React and React DOM are MIT (Meta Platforms, Inc. and affiliates); Vite, its React plugin, Vitest, Zod, Oxlint, Ruff, and the DefinitelyTyped type packages retain their respective upstream licenses and notices. TypeScript is Apache-2.0. Lockfiles identify exact installed distributions; consult each distribution's bundled license before redistribution. npm and uv are development tools, not shipped site assets. The release build publishes the original application license as `LICENSE.txt` and includes the exact installed MIT license texts for its bundled React, React DOM, scheduler and Zod runtime packages in [THIRD_PARTY_LICENSES.txt](https://arhaan2.github.io/song-neighbors/THIRD_PARTY_LICENSES.txt) alongside these notices.

Upstream license sources:

- [Vite](https://github.com/vitejs/vite/blob/main/LICENSE)
- [React](https://github.com/facebook/react/blob/main/LICENSE)
- [TypeScript](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt)
- [Vitest](https://github.com/vitest-dev/vitest/blob/main/LICENSE)
- [Zod](https://github.com/colinhacks/zod/blob/main/LICENSE)
- [Oxc / Oxlint](https://github.com/oxc-project/oxc/blob/main/LICENSE)
- [Ruff](https://github.com/astral-sh/ruff/blob/main/LICENSE)
- [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/LICENSE)

The public beta ships numerical embeddings of music, experimental and field-recording excerpts, selected metadata and per-record attribution for catalog `fma-small-clap-general-20261104`. It does not distribute raw recordings, pretrained weights or third-party artwork. The original inline SVG wordmark is styled with CSS; fonts are supplied by the visitor's system. The supplied build-pack planning documents remain project notes; actual catalog and release evidence is recorded separately in `docs/phases/`.

Phase 1 records publication basis, exact license versions, attribution, source URLs and transformations under [the catalog policy](https://github.com/Arhaan2/song-neighbors/blob/main/docs/CATALOG_POLICY.md). Each version carries its own attribution and data notices; the Phase 1 report identifies the actual accepted artifacts.

## Model and offline software

The pinned encoder is [LAION larger_clap_general](https://huggingface.co/laion/larger_clap_general/tree/ada0c23a36c4e8582805bb38fec3905903f18b41),
revision `ada0c23a36c4e8582805bb38fec3905903f18b41`. Its repository declares Apache License 2.0.
Credit: Yusong Wu, Ke Chen, Tianyu Zhang, Yuchen Hui, Taylor Berg-Kirkpatrick and Shlomo Dubnov,
“Large-scale Contrastive Language-Audio Pretraining with Feature Fusion and Keyword-to-Caption
Augmentation.” The compatible audio processor comes from that same revision. Weights and processor
runtime assets remain local; neither is distributed in the website. Model licensing does not supply
rights to recordings or metadata. The initial `larger_clap_music` candidate was rejected after
a checkpoint initialization-state audit; its derived vectors are not public catalog data.

The isolated offline environment locks PyTorch, Transformers, NumPy, SoundFile/libsndfile, soxr,
librosa, huggingface-hub and their transitive dependencies. Those packages retain their bundled
upstream licenses. The inference extra is optional; ordinary web CI needs none of its weights or
audio dependencies. The complete dependency identity is in `tools/catalog/uv.lock` and each export's
build record. Original pipeline and validator code use the repository MIT license.

## Metadata and recording-derived data

[FMA rc1 metadata](https://github.com/mdeff/fma#acknowledgments-and-licenses) is CC BY 4.0:
Michaël Defferrard, Kirell Benzi, Pierre Vandergheynst and Xavier Bresson, *FMA: A Dataset for Music
Analysis*, ISMIR 2017. Song Neighbors selects and normalizes metadata and joins raw license/source
fields to the small-subset IDs. FMA states that the dataset is intended for research; that statement
is retained separately from each explicit recording grant.

Recording permissions come from the exact per-record CC0 or CC BY license and supplied source
notices in the checksum-verified metadata. Conflicts, unknown mappings and unresolved additional
terms are excluded under the [catalog policy](https://github.com/Arhaan2/song-neighbors/blob/main/docs/CATALOG_POLICY.md). The permitted excerpts are
transformed into numerical audio embeddings. The absence of raw recordings is a packaging choice,
not the publication rights basis. Each exported catalog carries its own per-record `ATTRIBUTION.md`
and exact license/provenance in `tracks.json`. These recording-derived artifacts are not relicensed
under the application's MIT license. No raw audio, artwork, weights or private music are published.

Download mirrors, when used, are byte transports only: the official FMA ZIP checksum must match.
A mirror's blanket repository license cannot replace the original recordings' per-record terms.
