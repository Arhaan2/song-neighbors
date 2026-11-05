import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { catalogMetadataSchema } from '../src/catalog/contract.ts'
import { buildSchema, canonicalJson, publicSafe, sha256, validateArtifactBundle, type ArtifactBundle } from './catalog-validation.ts'

export const historicalCatalogVersion = 'fma-small-clap-general-20261104'
export const historicalManifestSha256 = 'b57bda0fb968b5feb49bb4ad7f33ea61ff67647483f496b519edea85b576ae11'
export const compatibleConfigurationSha256 = 'df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb'
export const approvedCandidateSha256 = '89aa9fe44bfd6c90c3a1fe16dcc536d30066e17b28de8cc9ec45eea15224358f'
export const heldRecordingIds = ['fma:006674', 'fma:006675', 'fma:006677', 'fma:006679', 'fma:006680', 'fma:006684', 'fma:061011'] as const
const digest = z.string().regex(/^[a-f0-9]{64}$/)
const id = z.string().regex(/^fma:\d{6}$/)
const count = z.number().int().nonnegative()
const token = z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
const serializedRunSchema = z.strictObject({ sha256: digest, serialized: z.string().min(1) })
const candidateSchema = z.object({
  schemaVersion: z.literal(1), kind: z.literal('metadata-candidate-selection-not-analyzed-catalog'),
  activeCatalog: z.object({ catalogVersion: z.literal(historicalCatalogVersion), manifestSha256: z.literal(historicalManifestSha256), tracksSha256: digest, trackCount: count }),
  materializedSelectionSha256: digest, metadata: buildSchema.shape.sourceMetadata,
  sourcePolicy: buildSchema.shape.inclusionPolicy, selectedTotal: count,
  selectionPolicy: z.object({ heldPublishedIds: z.array(id), sourceArtistCap: count }),
  records: z.array(z.object({ id, artistId: z.string().min(1), evidenceSha256: digest })),
})
const recordSchema = z.record(z.string(), z.unknown())
const exclusionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ id, kind: z.literal('processing-failure'), runSha256: digest, stage: token, category: token, record: recordSchema }),
  z.strictObject({ id, kind: z.literal('duplicate-audio'), runSha256: digest, duplicateOf: id, audioSha256: digest, record: recordSchema }),
])
export const releaseEvidenceSchema = z.strictObject({
  schemaVersion: z.literal(1), kind: z.literal('song-neighbors-expanded-release-evidence'),
  candidateManifestSha256: digest, catalogManifestSha256: digest, effectiveSelectionSha256: digest,
  finalRun: serializedRunSchema, attempts: z.array(serializedRunSchema), exclusions: z.array(exclusionSchema),
})
const runSchema = z.object({
  schemaVersion: z.literal(1), selectionSha256: digest, configurationSha256: digest,
  configuration: buildSchema.shape.configuration, processorConfig: buildSchema.shape.processorConfig,
  encoderArtifacts: buildSchema.shape.encoderArtifacts, runtime: buildSchema.shape.runtime,
  pipeline: buildSchema.shape.pipeline, dependencyLockSha256: digest,
  rows: z.array(z.object({ id, audioSha256: digest, cacheKeySha256: digest })),
  failures: z.array(z.object({ id, stage: token.optional(), category: token.optional(), reason: token.optional(), audioSha256: digest.optional(), cacheKeySha256: digest.optional() })),
  cacheHits: count, inferred: count,
}).passthrough()
const decode = (bytes: Uint8Array) => JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
const equal = (a: unknown, b: unknown, message: string) => assert.equal(canonicalJson(a), canonicalJson(b), message)
const ordered = (ids: string[]) => [...ids].sort()
function unique(ids: string[], label: string) {
  assert.equal(new Set(ids).size, ids.length, `Duplicate ${label} ID`)
}
function readRun(value: z.infer<typeof serializedRunSchema>) {
  assert.equal(sha256(value.serialized), value.sha256, 'Run bytes/hash mismatch')
  const raw = JSON.parse(value.serialized)
  publicSafe(raw)
  const run = runSchema.parse(raw)
  unique(run.rows.map((row) => row.id), 'run row')
  unique(run.failures.map((row) => row.id), 'run failure')
  assert.ok(run.failures.every((failure) => !run.rows.some((row) => row.id === failure.id)), 'Run ID both succeeded and failed')
  assert.equal(run.cacheHits + run.inferred, run.rows.length, 'Run success accounting mismatch')
  return run
}

/** Pure release proof, independent of Python generation. Fixtures may supply isolated candidate bytes. */
export function validateExpandedRelease(bundle: ArtifactBundle, candidateBytes: Uint8Array, baselineTracksBytes: Uint8Array, evidenceBytes: Uint8Array) {
  validateArtifactBundle(bundle)
  const { manifest, tracks } = catalogMetadataSchema.parse({ manifest: decode(bundle.manifest), tracks: decode(bundle.tracks) })
  const build = buildSchema.parse(decode(bundle.build))
  assert.equal(build.configurationSha256, compatibleConfigurationSha256, 'Expanded configuration differs from the verified baseline')
  const candidate = candidateSchema.parse(decode(candidateBytes))
  const evidence = releaseEvidenceSchema.parse(decode(evidenceBytes))
  publicSafe(evidence)
  assert.notEqual(manifest.catalogVersion, historicalCatalogVersion, 'Expanded export must have a new immutable version')
  assert.equal(evidence.candidateManifestSha256, sha256(candidateBytes), 'Candidate manifest hash mismatch')
  assert.equal(evidence.catalogManifestSha256, sha256(bundle.manifest), 'Release manifest hash mismatch')
  assert.equal(sha256(baselineTracksBytes), candidate.activeCatalog.tracksSha256, 'Historical tracks hash mismatch')
  const baseline = catalogMetadataSchema.shape.tracks.parse(decode(baselineTracksBytes))
  assert.equal(baseline.length, candidate.activeCatalog.trackCount, 'Historical track count mismatch')
  const baselineById = new Map(baseline.map((track) => [track.id, track]))
  unique(candidate.records.map((record) => record.id), 'candidate')
  assert.equal(candidate.selectedTotal, candidate.records.length, 'Candidate count mismatch')
  const candidates = new Map(candidate.records.map((record) => [record.id, record]))
  const holds = new Set([...heldRecordingIds, ...candidate.selectionPolicy.heldPublishedIds])
  assert.ok(candidate.records.every((record) => !holds.has(record.id)), 'Held recording in candidate selection')
  assert.ok(tracks.every((track) => !holds.has(track.id)), 'Held recording in expanded export')
  assert.equal(build.inclusionPolicy.expandedReviewVersion, 'fma-rc1-expanded-notice-review-v1', 'Missing expanded source review')
  equal(build.inclusionPolicy, candidate.sourcePolicy, 'Source policy differs from approved selection')
  equal(build.sourceMetadata, candidate.metadata, 'Source metadata differs from approved selection')
  const artistCounts = new Map<string, number>()
  for (const track of tracks) {
    const approved = candidates.get(track.id)
    assert.ok(approved, `Unexpected exported recording: ${track.id}`)
    artistCounts.set(approved.artistId, (artistCounts.get(approved.artistId) ?? 0) + 1)
    assert.equal(track.id, `fma:${track.provenance.sourceRecordId.padStart(6, '0')}`, 'Stable source identity mismatch')
    const old = baselineById.get(track.id)
    if (old) {
      assert.equal(track.provenance.audioSha256, old.provenance.audioSha256, 'Previously published audio identity changed')
      for (const key of ['datasetId', 'datasetVersion', 'sourceRecordId', 'sourcePage'] as const) assert.equal(track.provenance[key], old.provenance[key], 'Previously published source identity changed')
    }
  }
  assert.ok([...artistCounts.values()].every((n) => n <= candidate.selectionPolicy.sourceArtistCap), 'Source artist cap exceeded')
  const exported = new Map(tracks.map((track) => [track.id, track]))
  unique(evidence.exclusions.map((exclusion) => exclusion.id), 'exclusion')
  for (const exclusion of evidence.exclusions) {
    assert.ok(candidates.has(exclusion.id) && !exported.has(exclusion.id), 'Exclusion must be an unexported approved candidate')
    assert.equal(exclusion.record.id, exclusion.id, 'Excluded metadata ID mismatch')
  }
  equal(ordered([...exported.keys(), ...evidence.exclusions.map((row) => row.id)]), ordered([...candidates.keys()]), 'Candidate partition has omissions or unexpected IDs')

  // Reconstruct the exact original selection instead of trusting self-reported counts/metadata.
  // Only baseline originals had audio hashes before inference; additions did not.
  const effectiveRecords = tracks.map(({ row: _row, coverage: _coverage, ...track }) => {
    const { audioSha256: _audio, ...provenance } = track.provenance
    const originalHash = baselineById.get(track.id)?.provenance.audioSha256
    const sourceId = track.provenance.sourceRecordId.padStart(6, '0')
    return { ...track, provenance: originalHash ? { ...provenance, audioSha256: originalHash } : provenance, audioPath: `${sourceId.slice(0, 3)}/${sourceId}.mp3` }
  })
  const selection = { schemaVersion: 1, sources: manifest.sources, metadata: build.sourceMetadata, policy: build.inclusionPolicy, records: effectiveRecords }
  const originalRecords = [...effectiveRecords, ...evidence.exclusions.map((exclusion) => exclusion.record)].sort((a, b) => String(a.id).localeCompare(String(b.id), 'en'))
  assert.equal(sha256(`${canonicalJson({ ...selection, records: originalRecords })}\n`), candidate.materializedSelectionSha256, 'Original approved metadata/provenance reconstruction mismatch')
  assert.equal(sha256(`${canonicalJson(selection)}\n`), evidence.effectiveSelectionSha256, 'Effective selection hash mismatch')

  const finalRun = readRun(evidence.finalRun)
  assert.equal(finalRun.selectionSha256, evidence.effectiveSelectionSha256, 'Final run selection mismatch')
  assert.equal(finalRun.failures.length, 0, 'Final run has unresolved failures')
  if (finalRun.status !== undefined) assert.equal(finalRun.status, 'complete', 'Final run is incomplete')
  for (const key of ['configurationSha256', 'configuration', 'processorConfig', 'encoderArtifacts', 'runtime', 'pipeline', 'dependencyLockSha256'] as const) equal(finalRun[key], build[key], `Final run/build ${key} mismatch`)
  equal(ordered(finalRun.rows.map((row) => row.id)), tracks.map((track) => track.id), 'Final run/export IDs mismatch')
  const buildRows = new Map(build.rows.map((row) => [row.id, row]))
  for (const row of finalRun.rows) {
    const built = buildRows.get(row.id)!
    assert.equal(row.audioSha256, built.audioSha256, 'Run/export audio hash mismatch')
    assert.equal(row.cacheKeySha256, built.cacheKeySha256, 'Run/export cache key mismatch')
  }
  unique(evidence.attempts.map((attempt) => attempt.sha256), 'attempt')
  const attempts = new Map(evidence.attempts.map((attempt) => [attempt.sha256, readRun(attempt)]))
  const referencedAttempts = new Set(evidence.exclusions.map((exclusion) => exclusion.runSha256))
  equal(ordered([...attempts.keys()]), ordered([...referencedAttempts]), 'Unreferenced or missing processing attempt')
  for (const exclusion of evidence.exclusions) {
    const attempt = attempts.get(exclusion.runSha256)
    assert.ok(attempt, 'Exclusion processing evidence missing')
    assert.equal(attempt.configurationSha256, build.configurationSha256, 'Exclusion configuration mismatch')
    assert.equal(attempt.selectionSha256, candidate.materializedSelectionSha256, 'Exclusion must be evidenced against the original approved selection')
    for (const key of ['configuration', 'processorConfig', 'encoderArtifacts', 'dependencyLockSha256'] as const) equal(attempt[key], build[key], `Exclusion attempt/build ${key} mismatch`)
    assert.ok([...attempt.rows, ...attempt.failures].every((row) => candidates.has(row.id)), 'Attempt contains unapproved IDs')
    if (exclusion.kind === 'processing-failure') {
      assert.ok(['decode-or-inference', 'inferred-vector-validation'].includes(exclusion.stage), 'Storage, acquisition, or environment failures remain blockers')
      const failure = attempt.failures.find((row) => row.id === exclusion.id)
      assert.ok(failure && failure.stage === exclusion.stage && failure.category === exclusion.category, 'Exclusion failure category/stage not evidenced')
      assert.ok(failure.audioSha256 && failure.cacheKeySha256, 'Processing exclusion lacks verified available-audio identity')
      assert.equal(failure.cacheKeySha256, sha256(canonicalJson({ audioSha256: failure.audioSha256, configurationSha256: build.configurationSha256 })), 'Failed processing cache identity mismatch')
      const old = baselineById.get(exclusion.id)
      if (old) assert.equal(failure.audioSha256, old.provenance.audioSha256, 'Failed baseline input audio identity changed')
      assert.ok(!attempt.rows.some((row) => row.id === exclusion.id), 'Failed exclusion also succeeded in the same attempt')
    } else {
      const row = attempt.rows.find((row) => row.id === exclusion.id)
      assert.ok(row && row.audioSha256 === exclusion.audioSha256, 'Duplicate audio hash not evidenced')
      assert.equal(row.cacheKeySha256, sha256(canonicalJson({ audioSha256: row.audioSha256, configurationSha256: build.configurationSha256 })), 'Duplicate cache identity mismatch')
      const kept = exported.get(exclusion.duplicateOf)
      assert.ok(kept && kept.provenance.audioSha256 === exclusion.audioSha256, 'Duplicate must reference retained identical audio')
      assert.ok(!baselineById.has(exclusion.id) || baselineById.has(exclusion.duplicateOf), 'Preserve baseline identity when deduplicating an addition')
    }
  }
  const retainedCount = tracks.filter((track) => baselineById.has(track.id)).length
  return { kind: 'expanded' as const, retainedCount, additionsCount: tracks.length - retainedCount, sourceArtistIds: artistCounts.size, excludedCount: evidence.exclusions.length, candidateCount: candidates.size, cacheHits: finalRun.cacheHits, inferred: finalRun.inferred, evidenceSha256: sha256(evidenceBytes) }
}

/** Synchronous repository gate; only the exact historical bytes bypass expanded release proof. */
export function validateCatalogRelease(bundle: ArtifactBundle) {
  validateArtifactBundle(bundle)
  const manifest = decode(bundle.manifest)
  if (manifest.catalogVersion === historicalCatalogVersion) {
    assert.equal(sha256(bundle.manifest), historicalManifestSha256, 'Historical exception requires the exact preserved baseline manifest')
    const audit = JSON.parse(readFileSync(new URL('../docs/phases/phase-1-source-audit.json', import.meta.url), 'utf8'))
    const tracks = catalogMetadataSchema.shape.tracks.parse(decode(bundle.tracks))
    equal(ordered(audit.selectedIds), tracks.map((track) => track.id), 'Historical audit IDs mismatch')
    return { kind: 'historical' as const, retainedCount: tracks.length, additionsCount: 0, sourceArtistIds: Number(audit.selectedArtistCount), excludedCount: 0, candidateCount: tracks.length }
  }
  const candidateBytes = readFileSync(new URL('../docs/catalog/phase-5a-selection.json', import.meta.url))
  assert.equal(sha256(candidateBytes), approvedCandidateSha256, 'Approved Phase 5A candidate manifest changed')
  const baselineBytes = readFileSync(new URL(`../public/catalog/${historicalCatalogVersion}/tracks.json`, import.meta.url))
  const evidenceBytes = readFileSync(new URL(`../docs/catalog/releases/${manifest.catalogVersion}.json`, import.meta.url))
  const result = validateExpandedRelease(bundle, candidateBytes, baselineBytes, evidenceBytes)
  assert.ok(result.additionsCount > 0, 'Expanded publication must include successfully analyzed additions')
  return result
}


// Used by the offline generator before its atomic receipt publication; never runs inference.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2)
  assert.equal(args.length, 6, 'Usage: node scripts/catalog-release-evidence.ts --catalog DIR --evidence FILE --candidate FILE')
  assert.deepEqual([args[0], args[2], args[4]], ['--catalog', '--evidence', '--candidate'])
  const read = (name: string) => readFileSync(join(args[1]!, name))
  const bundle = { manifest: read('manifest.json'), tracks: read('tracks.json'), embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json') }
  const candidateBytes = readFileSync(args[5]!)
  assert.equal(sha256(candidateBytes), approvedCandidateSha256, 'Approved Phase 5A candidate manifest changed')
  const baselineBytes = readFileSync(new URL(`../public/catalog/${historicalCatalogVersion}/tracks.json`, import.meta.url))
  const result = validateExpandedRelease(bundle, candidateBytes, baselineBytes, readFileSync(args[3]!))
  assert.ok(result.additionsCount > 0, 'Expanded publication must include successfully analyzed additions')
  console.log(JSON.stringify(result))
}
