# Song Neighbors Repository Instructions

## Goal and scope

Build a public, standalone song-recommendation website. Users search the analyzed catalog, select one to five songs, and receive up to twenty audio-similar recommendations. Optional positive and negative feedback applies to the current session. Keep the repository public.

Use offline Python to generate real audio embeddings and export a static catalog. Use React, TypeScript, Vite, and browser-side ranking for the website. Keep the ranking logic independent of React. GitHub Pages is the release destination. No playback, streaming-account integration, user accounts, hosted inference API, or paid service is required by v1.

## Start every phase

Read this file, `PROJECT.md`, `PROGRESS.md`, the relevant plan/prompt, and the most recent report in `docs/phases/`. Inspect the actual repository root, origin, branch, latest main, and working tree before editing. Preserve unrelated work. Never assume an existing same-name directory or repository belongs to this project.

Execute the requested phase; do not return only another plan. Work autonomously within it and stop at the phase boundary. The phase prompts authorize the project's public repository creation, ordinary commits/pushes/integration, and GitHub Pages publication in Phase 4. Respect actual authentication, access controls, repository protections, and billing boundaries. Do not request routine approval again for those authorized actions.

## Coordination

When parallel work helps, use at most two implementation workers plus one independent reviewer, alongside the coordinator. Assign nonoverlapping files and clear deliverables; use isolated worktrees where concurrent edits require them. The coordinator owns shared configuration, integration, commits, pushes, merges, and deployment. If subagents are unavailable, complete a separate review pass and describe the limitation honestly.

## Git and publication

Bootstrap `main` in Phase 0. For later phases, use a short phase branch and coherent commits. Prefer a PR when access is available, satisfy existing required checks, and integrate the reviewed changes into `main`. Do not introduce an external approving-review requirement that a solo owner cannot satisfy. An agent review is not a human GitHub approval.

Verify the integrated code. Never force-push, delete unrelated work, rewrite existing releases, bypass protections, or convert this project to private. If authentication is missing, finish independent local work and retain commits. Distinguish local integration from remote publication. Use a final `v0.1.0` tag only after the public release is verified, targeting the exact live-verified source commit; preserve an existing tag and choose a later version rather than moving it. Finalize source/release docs before building, and record any later evidence-only commit separately without moving that tag or redeploying unchanged shipped assets.

## Data integrity

Use real embeddings for deployed song records. Synthetic vectors are isolated mathematical test fixtures only. Missing data or unavailable models must produce an honest status, not fabricated recommendations or a metadata-based substitution presented as audio analysis.

Search only the compatible analyzed catalog. Record model revision, preprocessing, window aggregation, stable recording IDs, vector row order, dimensions, hashes, source provenance, and publication basis. Do not infer an embedding dimension from memory. Reject corrupt, nonfinite, zero, misaligned, or mixed-configuration vectors.

Keep raw audio, model downloads, caches, local absolute paths, secrets, private music manifests, and personal session data out of Git and the deployed bundle. The software license does not relicense recordings, metadata, model weights, or third-party artifacts. Read `docs/CATALOG_POLICY.md` when available.

## Verification

Prefer behavior and invariant tests for concrete risks. Avoid test-count targets, arbitrary coverage targets, duplicate tests, and large browser matrices. Run focused checks during implementation, then the applicable final gates. Repair reproduced defects and rerun the affected checks.

Expected web commands once implemented: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run validate:catalog`, `npm run build`, and `npm run test:e2e`. Phase 0 establishes only meaningful commands; later phases add catalog and browser commands when their functionality exists. Document actual Python pipeline commands in the README. Do not add scripts that silently succeed without performing their named check.

Production-browser verification uses the built site under its real project base path, normally a local preview on `127.0.0.1:4173`. Chromium desktop plus a mobile viewport is the required initial matrix. Optional browser engines or physical devices do not become unplanned blockers.

Never recompute the full audio catalog on ordinary frontend CI. Validate committed export integrity instead. A real inference smoke is required when introducing or changing the embedding pipeline, not for every CSS edit.

## Evidence and blocker handling

Maintain `PROGRESS.md` and one concise `docs/phases/phase-N.md` report. Record exact commands, outcomes, data/model identity, useful screenshots where relevant, and limitations. Do not overwrite evidence merely to hide an earlier failure; record the repair and the final state.

Avoid circular hashes: a report records the tested code revision or precommit code state. The final response records the resulting integration commit and remote URLs. Deployed `build-info.json` records the build's actual source SHA and catalog version. A file cannot contain its own final commit SHA; do not create endless documentation/rebuild loops.

Separate status into implementation, verification, publication, and human preference evaluation. An unavailable optional tool is not a reproduced product bug. Missing remote access must not halt independent local work. Missing real audio data prevents claiming a functioning public audio recommender, while independent engine/UI work may continue with clearly labeled fixtures.

Finish each phase with what works, exact checks/results, actual commit/PR/CI/deployment identifiers, catalog coverage, limitations, and the next phase or smallest unblock action. Stop after that phase.

## UI design guidance

For UI/UX work, read and apply both installed `apple-design` and `design-taste-frontend` skills when available. Use the former for interaction, motion, usability, and accessibility, and the latter for visual direction and composition. Explicit user requirements and the established product design take precedence. Phase 0 remains an honest unavailable-catalog screen; do not add sample recommendations to satisfy a design template.
