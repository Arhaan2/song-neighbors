import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { canonicalJson, sha256, validateArtifactBundle, type ArtifactBundle } from '../scripts/catalog-validation.ts'
import { historicalCatalogVersion, historicalManifestSha256, validateCatalogRelease, validateExpandedRelease } from '../scripts/catalog-release-evidence.ts'

const encode = (value: unknown) => new TextEncoder().encode(`${canonicalJson(value)}\n`)
const parse = (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes))
const directory = new URL(`../public/catalog/${historicalCatalogVersion}/`, import.meta.url)
const baselineBundle = (): ArtifactBundle => {
  const read = (name: string) => readFileSync(new URL(name, directory))
  return { manifest: read('manifest.json'), tracks: read('tracks.json'), embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json') }
}
const snapshot = (run: unknown) => { const serialized = `${canonicalJson(run)}\n`; return { serialized, sha256: sha256(serialized) } }
function rehash(bundle: ArtifactBundle) {
  const manifest = parse(bundle.manifest)
  for (const key of ['tracks', 'embeddings', 'attribution', 'build'] as const) manifest.files[key] = { ...manifest.files[key], sha256: sha256(bundle[key]), bytes: bundle[key].length }
  manifest.orderedIdsSha256 = sha256(`${parse(bundle.tracks).map((track: { id: string }) => track.id).join('\n')}\n`)
  bundle.manifest = encode(manifest)
}

// Isolated release-proof fixtures, never published or claimed as new inference. Genuine old
// vector bytes are reused to test proof binding. The fixture's tiny "baseline" is deliberately
// not the approved baseline; only the pure validator accepts such test inputs.
function fixture(withFailure = false) {
  const bundle = baselineBundle()
  const manifest = parse(bundle.manifest)
  const oldTracks = parse(bundle.tracks).slice(0, withFailure ? 3 : 2)
  const tracks = oldTracks.slice(0, 2)
  const build = parse(bundle.build)
  build.rows = build.rows.slice(0, 2)
  build.measured.trackCount = 2
  build.measured.artistCount = new Set(tracks.map((track: { artist: string }) => track.artist)).size
  build.inclusionPolicy.expandedReviewVersion = 'fma-rc1-expanded-notice-review-v1'
  manifest.catalogVersion = 'isolated-release-proof-fixture'
  manifest.trackCount = 2
  bundle.embeddings = bundle.embeddings.subarray(0, 2 * manifest.dimension * 4)
  bundle.tracks = encode(tracks)
  bundle.build = encode(build)
  bundle.manifest = encode(manifest)
  rehash(bundle)
  const baseline = encode([oldTracks[0]])
  const originals = oldTracks.map((track: typeof oldTracks[number], index: number) => {
    const { row: _row, coverage: _coverage, ...record } = structuredClone(track)
    if (index > 0) delete record.provenance.audioSha256
    const padded = record.provenance.sourceRecordId.padStart(6, '0')
    return { ...record, audioPath: `${padded.slice(0, 3)}/${padded}.mp3` }
  })
  const selection = { schemaVersion: 1, sources: manifest.sources, metadata: build.sourceMetadata, policy: build.inclusionPolicy, records: originals }
  const candidate = {
    schemaVersion: 1, kind: 'metadata-candidate-selection-not-analyzed-catalog',
    activeCatalog: { catalogVersion: historicalCatalogVersion, manifestSha256: historicalManifestSha256, tracksSha256: sha256(baseline), trackCount: 1 },
    materializedSelectionSha256: sha256(encode(selection)), metadata: build.sourceMetadata, sourcePolicy: build.inclusionPolicy,
    selectionPolicy: { heldPublishedIds: [], sourceArtistCap: 50 }, selectedTotal: originals.length,
    records: originals.map((record: typeof originals[number], index: number) => ({ id: record.id, artistId: `${index}`, evidenceSha256: 'a'.repeat(64) })),
  }
  const effectiveSelectionSha256 = sha256(encode({ ...selection, records: originals.slice(0, 2) }))
  const run = {
    schemaVersion: 1, status: 'complete', selectionSha256: effectiveSelectionSha256,
    ...Object.fromEntries(['configuration', 'configurationSha256', 'processorConfig', 'encoderArtifacts', 'runtime', 'pipeline', 'dependencyLockSha256'].map((key) => [key, build[key]])),
    rows: build.rows.map(({ id, audioSha256, cacheKeySha256 }: { id: string; audioSha256: string; cacheKeySha256: string }) => ({ id, audioSha256, cacheKeySha256 })), failures: [], cacheHits: 2, inferred: 0,
  }
  const candidateBytes = encode(candidate)
  const evidence = {
    schemaVersion: 1, kind: 'song-neighbors-expanded-release-evidence', candidateManifestSha256: sha256(candidateBytes),
    catalogManifestSha256: sha256(bundle.manifest), effectiveSelectionSha256, finalRun: snapshot(run), attempts: [] as ReturnType<typeof snapshot>[], exclusions: [] as Record<string, unknown>[],
  }
  if (withFailure) {
    const audioSha256 = oldTracks[2].provenance.audioSha256
    const failure = { id: originals[2].id, stage: 'decode-or-inference', category: 'decode-or-inference', reason: 'RuntimeError', audioSha256, cacheKeySha256: sha256(canonicalJson({ audioSha256, configurationSha256: build.configurationSha256 })) }
    const attempt = snapshot({ ...run, status: 'failed', selectionSha256: candidate.materializedSelectionSha256, failures: [failure] })
    evidence.attempts = [attempt]
    evidence.exclusions = [{ id: failure.id, kind: 'processing-failure', runSha256: attempt.sha256, stage: failure.stage, category: failure.category, record: originals[2] }]
  }
  return { bundle, candidate, baseline, evidence, run, originals }
}
const verify = (f: ReturnType<typeof fixture>) => validateExpandedRelease(f.bundle, encode(f.candidate), f.baseline, encode(f.evidence))
const refresh = (f: ReturnType<typeof fixture>) => { rehash(f.bundle); f.evidence.catalogManifestSha256 = sha256(f.bundle.manifest); f.evidence.candidateManifestSha256 = sha256(encode(f.candidate)); f.evidence.finalRun = snapshot(f.run) }
function mutateAttempt(f: ReturnType<typeof fixture>, mutate: (run: ReturnType<typeof parse>) => void) {
  const run = JSON.parse(f.evidence.attempts[0]!.serialized)
  mutate(run)
  const attempt = snapshot(run)
  f.evidence.attempts = [attempt]
  f.evidence.exclusions[0]!.runSha256 = attempt.sha256
}

describe('release selection and processing evidence', () => {
  it('identifies only the exact 500-record historical baseline as the historical exception', () => {
    expect(validateCatalogRelease(baselineBundle())).toMatchObject({ kind: 'historical', retainedCount: 500, additionsCount: 0, sourceArtistIds: 170 })
    const bundle = baselineBundle()
    bundle.manifest = encode({ ...parse(bundle.manifest), createdAt: '2026-11-05T00:00:00Z' })
    expect(() => validateCatalogRelease(bundle)).toThrow('exact preserved baseline')
  })

  it('binds exact export metadata, approved/effective IDs and successful run/cache/vector evidence', () => {
    const f = fixture()
    expect(verify(f)).toMatchObject({ kind: 'expanded', retainedCount: 1, additionsCount: 1, excludedCount: 0, sourceArtistIds: 2 })
    expect(() => validateCatalogRelease(f.bundle)).toThrow() // A valid arbitrary bundle is not release permission.
    const failed = fixture(true)
    expect(verify(failed)).toMatchObject({ excludedCount: 1, candidateCount: 3 })
  })

  it('rejects omissions, unapproved rows, held IDs, and altered normalized source attribution', () => {
    const missing = fixture(true)
    missing.evidence.exclusions = []
    expect(() => verify(missing)).toThrow('partition')
    const unexpected = fixture()
    unexpected.candidate.records[1].id = 'fma:999999'
    refresh(unexpected)
    expect(() => verify(unexpected)).toThrow('Unexpected exported recording')
    const held = fixture()
    held.candidate.records[1].id = 'fma:006674'
    refresh(held)
    expect(() => verify(held)).toThrow('Held recording')
    const altered = fixture()
    const tracks = parse(altered.bundle.tracks)
    tracks[0].title = 'Unapproved title change'
    altered.bundle.tracks = encode(tracks)
    refresh(altered)
    expect(() => verify(altered)).toThrow('metadata/provenance reconstruction')
  })

  it('rejects incomplete runs and self-consistent exact-configuration drift', () => {
    const incomplete = fixture()
    incomplete.run.rows.pop()
    incomplete.run.cacheHits--
    refresh(incomplete)
    expect(() => verify(incomplete)).toThrow('Final run/export IDs mismatch')
    const f = fixture()
    const manifest = parse(f.bundle.manifest)
    const build = parse(f.bundle.build)
    manifest.preprocessing.decoder.version = '0.13.1/unapproved-libsndfile'
    build.configuration.preprocessing = manifest.preprocessing
    build.configurationSha256 = sha256(canonicalJson(build.configuration))
    for (const row of build.rows) row.cacheKeySha256 = sha256(canonicalJson({ audioSha256: row.audioSha256, configurationSha256: build.configurationSha256 }))
    for (const row of build.rows) row.configurationSha256 = build.configurationSha256
    f.bundle.manifest = encode(manifest)
    f.bundle.build = encode(build)
    refresh(f)
    expect(() => validateArtifactBundle(f.bundle)).not.toThrow()
    expect(() => verify(f)).toThrow('configuration differs from the verified baseline')
  })

  it('requires actual available-audio failure evidence and rejects recoverable infrastructure omissions', () => {
    for (const stage of ['source-audio', 'model-initialization', 'cache-write']) {
      const f = fixture(true)
      f.evidence.exclusions[0]!.stage = stage
      f.evidence.exclusions[0]!.category = stage
      mutateAttempt(f, (run) => { run.failures[0].stage = stage; run.failures[0].category = stage })
      expect(() => verify(f)).toThrow('remain blockers')
    }
    const missingHash = fixture(true)
    mutateAttempt(missingHash, (run) => { delete run.failures[0].audioSha256; delete run.failures[0].cacheKeySha256 })
    expect(() => verify(missingHash)).toThrow('available-audio identity')
    const staleConfig = fixture(true)
    mutateAttempt(staleConfig, (run) => { run.configuration.preprocessing.decoder.version = '0.13.1/changed' })
    expect(() => verify(staleConfig)).toThrow('attempt/build configuration mismatch')
    const corruptRun = fixture(true)
    corruptRun.evidence.attempts[0]!.serialized += ' '
    expect(() => verify(corruptRun)).toThrow('Run bytes/hash mismatch')
  })

  it('rejects unknown review versions, run/audio drift, and private processing evidence', () => {
    const unknownReview = fixture()
    const build = parse(unknownReview.bundle.build)
    build.inclusionPolicy.expandedReviewVersion = 'unreviewed-policy'
    unknownReview.bundle.build = encode(build)
    refresh(unknownReview)
    expect(() => verify(unknownReview)).toThrow()
    const changedAudio = fixture()
    changedAudio.run.rows[0].audioSha256 = 'f'.repeat(64)
    refresh(changedAudio)
    expect(() => verify(changedAudio)).toThrow('Run/export audio hash mismatch')
    const privateRun = fixture()
    const run = JSON.parse(privateRun.evidence.finalRun.serialized)
    run.privatePath = '/Users/private/audio.mp3'
    privateRun.evidence.finalRun = snapshot(run)
    expect(() => verify(privateRun)).toThrow('Local path in public artifact')
  })

  it('requires exact duplicate audio evidence referencing a retained recording', () => {
    const f = fixture(true)
    const kept = parse(f.bundle.build).rows[1]
    const omittedId = f.originals[2].id
    mutateAttempt(f, (run) => { run.failures = []; run.rows.push({ id: omittedId, audioSha256: kept.audioSha256, cacheKeySha256: kept.cacheKeySha256 }); run.cacheHits++ })
    f.evidence.exclusions = [{ id: omittedId, kind: 'duplicate-audio', runSha256: f.evidence.attempts[0]!.sha256, duplicateOf: kept.id, audioSha256: kept.audioSha256, record: f.originals[2] }]
    expect(verify(f)).toMatchObject({ excludedCount: 1 })
    f.evidence.exclusions[0]!.duplicateOf = f.originals[0].id
    expect(() => verify(f)).toThrow('retained identical audio')
  })
})
