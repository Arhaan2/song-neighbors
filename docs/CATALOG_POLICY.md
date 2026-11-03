# Catalog Source and Publication Policy

## Purpose

Every searchable title must correspond to genuine compatible audio analysis. Establish the source and publication basis for metadata and embeddings before exporting them. Excluding raw audio from Git is good packaging but does not, by itself, settle rights to derived artifacts.

## Primary source to investigate

Use the official FMA project as the initial reproducible source candidate: <https://github.com/mdeff/fma>.

The repository lists an FMA-small archive of 8,000 thirty-second clips, approximately 7.2 GiB, and a metadata archive of approximately 342 MiB. Its metadata is CC BY 4.0; recordings retain individual artist-selected licenses. These facts do not establish how many records meet this project's allowlist. Count them during Phase 1.

Download metadata first. Use the current official links and checksum instructions. The plan has not verified successful archive transfer on the user's machine. Inspect disk space and avoid full/medium/large archives. A straightforward one-time small-archive download into an ignored cache is sufficient; remote ZIP range machinery is not a v1 requirement.

Official archive links published by the project:

- <https://os.unil.cloud.switch.ch/fma/fma_metadata.zip>
- <https://os.unil.cloud.switch.ch/fma/fma_small.zip>

## Inclusion policy

For the initial simple policy, include only records with an explicit documented CC0 or CC BY license compatible with the intended use and required attribution. Preserve exact versions/jurisdictions. Keep the original source statement and canonical license URL. A vague label such as Attribution is not permission to invent a particular license version.

Exclude missing, ambiguous, or unmapped licenses. Exclude NC, ND, and SA records from this initial allowlist rather than silently accepting obligations the project has not implemented. This is a deliberately narrow project choice, not a statement that those licenses can never be used.

Keep an inclusion manifest and an exclusion report with reasons. Use authoritative source records and honor any additional applicable source terms. If a record's publication basis cannot be established, exclude that record and continue with eligible material. Do not ask the user to approve each ordinary record or reinterpret ambiguity as permission.

Use the same policy for any alternate source. A source returning a public URL or advertising free access is not enough. If the primary route is unavailable, investigate one concrete permitted alternative and report what was actually verified; do not claim untested endpoints are available.

## Required provenance

Record stable catalog/source IDs, source dataset/version, source page, title, artist, exact license statement/URL, attribution, source audio hash, actual analyzed clip coverage, model ID/revision, preprocessing/aggregation configuration, and vector row. Catalog-level metadata records schemas, dimensions, counts, ordered-ID mapping, dtype/byte order, norms, and file hashes.

Only public-safe fields enter the deployment. Omit local paths, private collections, secrets, downloaded weights, raw recordings, and third-party artwork without its own basis. Make attribution accessible in the UI and repository. State that the audio was transformed into numerical representations and whether only excerpts were analyzed.

## Compatibility and reproducibility

All catalog vectors must use the same encoder and preprocessing configuration unless a later explicit multi-index design is implemented. Cache identity includes source audio hash, immutable model revision, processor configuration, window policy, and aggregation version.

Reject nonfinite or zero vectors. Normalize as specified. Store stable row order, derive dimensions from actual output, and validate counts and hashes before publishing. A changed checkpoint or window policy creates a new catalog version rather than silently mixing representations.

## Honest coverage

Prove real extraction on 30–50 tracks, then expand toward approximately 500 as source diversity and resources allow. Record actual track/artist counts and the range of sounds represented. The scoped public-beta floor is 100 distinct eligible recordings across at least 10 artists, plus a demonstrated five-seed/twenty-result flow after exclusions. This is an engineering threshold, not a quality guarantee. Below it, report a technical prototype with beta coverage pending and continue independent work. Neither floor nor target is a quota to fill with fabricated records.

Mainstream song coverage is not established by this dataset choice. The UI must distinguish an unsupported title from an indexed song. Do not substitute artist names, genre tags, language-model guesses, or random vectors while labeling the result acoustic similarity.
