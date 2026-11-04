import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { arch, cpus, platform, release } from 'node:os'
import { gzipSync } from 'node:zlib'
import { catalogPointerSchema } from '../src/catalog/contract.ts'
import { validateCatalogData } from '../src/catalog/load.ts'
import { createRecommendationEngine, type RecommendationResult, type SessionState } from '../src/recommend/engine.ts'
import { addNegative, addPositive, createSession, editSeeds, resetRefinement } from '../src/recommend/session.ts'
import { validateArtifactBundle } from './catalog-validation.ts'

// This executable evaluates committed real vectors; it neither runs inference nor rates music.
const catalogRoot = new URL('../public/catalog/', import.meta.url)
const pointerBytes = readFileSync(new URL('current.json', catalogRoot))
const pointer = catalogPointerSchema.parse(JSON.parse(pointerBytes.toString('utf8')))
assert.equal(pointer.status, 'ready', 'Release evaluation requires a real, ready catalog')
if (pointer.status !== 'ready') throw new Error('Catalog unavailable')
const directory = new URL(`${pointer.catalogVersion}/`, catalogRoot)
const read = (name: string) => readFileSync(new URL(name, directory))
const bundle = {
  manifest: read('manifest.json'), tracks: read('tracks.json'),
  embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json'),
}
const validation = validateArtifactBundle(bundle, pointer)
const validationStart = performance.now()
const catalog = await validateCatalogData(bundle, pointer)
const catalogValidationMs = performance.now() - validationStart
const initializationStart = performance.now()
const engine = createRecommendationEngine(catalog)
const engineInitializationMs = performance.now() - initializationStart
const { tracks, dimension, vectors, manifest } = catalog
const byId = new Map(tracks.map((track) => [track.id, track]))
const identity = (id: string) => {
  const track = byId.get(id)
  assert.ok(track, `Missing release evaluation recording ${id}`)
  return { id, title: track.title, artist: track.artist }
}
const ids = (result: RecommendationResult) => result.recommendations.map((item) => item.id)
const rounded = (value: number) => Number(value.toFixed(3))
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

function verifyResults(result: RecommendationResult, state: SessionState) {
  const excluded = new Set([...state.seedIds, ...state.positiveIds, ...state.negativeIds].map(engine.recordingKey))
  const resultGroups = result.recommendations.map((item) => engine.recordingKey(item.id))
  assert.equal(result.recommendations.length, Math.min(20, result.eligibleCount))
  assert.equal(new Set(resultGroups).size, resultGroups.length, 'No duplicate recording components in results')
  assert.ok(resultGroups.every((group) => !excluded.has(group)), 'Seeds and both feedback directions are excluded')
  assert.ok(result.recommendations.every((item) => byId.has(item.id) && Number.isFinite(item.score)))
}

// Independent all-row cosine scan: no retrieval, blending, feedback or diversity code is reused.
function cosineBaseline(seedId: string) {
  const seed = byId.get(seedId)!
  const vector = (row: number) => vectors.subarray(row * dimension, (row + 1) * dimension)
  const seedVector = vector(seed.row)
  const seedNorm = Math.hypot(...seedVector)
  const candidates = tracks.filter((track) => engine.recordingKey(track.id) !== engine.recordingKey(seedId)).map((track) => {
    const candidate = vector(track.row)
    const dot = candidate.reduce((sum, value, index) => sum + value * seedVector[index]!, 0)
    return { id: track.id, score: dot / (seedNorm * Math.hypot(...candidate)) }
  }).sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const used = new Set<string>()
  return candidates.filter((item) => {
    const key = engine.recordingKey(item.id)
    if (used.has(key)) return false
    used.add(key)
    return true
  }).slice(0, 20)
}

const seedSets = [
  { name: 'Spell single seed', seedIds: ['fma:045099'] },
  { name: 'Lior and Neil Halstead', seedIds: ['fma:003832', 'fma:004037'] },
  { name: 'Distinct On Axis recordings', seedIds: ['fma:115817', 'fma:129970'] },
  { name: 'Five artists', seedIds: ['fma:045099', 'fma:003832', 'fma:003950', 'fma:004037', 'fma:004070'] },
  { name: 'Field-recording excerpts', seedIds: ['fma:068551', 'fma:068579'] },
]
const cases = seedSets.map(({ name, seedIds }) => {
  seedIds.forEach(identity)
  const state = createSession(engine, seedIds)
  const firstStart = performance.now()
  const result = engine.query(state)
  const firstQueryMs = performance.now() - firstStart
  verifyResults(result, state)
  assert.deepEqual(engine.query(state), result, 'Identical input produces identical complete output')
  assert.deepEqual(engine.query({ ...state, seedIds: [...seedIds, seedIds[0]!] }), result, 'Repeated seed ID is idempotent')
  const baseline = engine.nearestNeighbors(seedIds[0]!)
  const oracle = cosineBaseline(seedIds[0]!)
  assert.deepEqual(ids(baseline), oracle.map((item) => item.id), 'Baseline agrees with independent exact scan')
  const maximumCosineError = Math.max(...oracle.map((item, index) => Math.abs(item.score - baseline.recommendations[index]!.score)))
  assert.ok(maximumCosineError < 1e-12)
  const positiveId = result.recommendations[0]!.id
  const positive = addPositive(engine, state, positiveId)
  assert.deepEqual(addPositive(engine, positive, positiveId), positive, 'Positive feedback is idempotent')
  const positiveResult = engine.query(positive)
  verifyResults(positiveResult, positive)
  const negativeId = positiveResult.recommendations[0]!.id
  const refined = addNegative(engine, positive, negativeId)
  const refinedResult = engine.query(refined)
  verifyResults(refinedResult, refined)
  assert.notDeepEqual(ids(refinedResult), ids(result), 'Feedback changes the returned list')
  const opposite = addNegative(engine, positive, positiveId)
  assert.deepEqual(opposite.positiveIds, [])
  assert.deepEqual(opposite.negativeIds, [positiveId], 'Opposite feedback replaces previous preference')
  const reset = resetRefinement(refined)
  assert.deepEqual(reset, state, 'Reset preserves the selected seed order and clears feedback')
  assert.deepEqual(engine.query(reset), result, 'Reset restores complete seed-only result')
  const replacementSeed = tracks.find((track) => !seedIds.includes(track.id))!.id
  assert.deepEqual(editSeeds(engine, refined, [replacementSeed]), createSession(engine, [replacementSeed]), 'Seed edits clear feedback')
  const timedQueries = Array.from({ length: 10 }, () => {
    const start = performance.now()
    engine.query(state)
    return performance.now() - start
  })
  return {
    name, seeds: seedIds.map(identity), eligibleCount: result.eligibleCount, candidateCount: result.candidateCount,
    baseline: { seed: identity(seedIds[0]!), independentCosineOrderMatches: true, maximumCosineError, resultIds: ids(baseline) },
    seedOnlyResultIds: ids(result), firstFive: result.recommendations.slice(0, 5).map((item) => ({ ...identity(item.id), score: item.score })),
    baselineComparison: {
      sameOrderedList: JSON.stringify(ids(baseline)) === JSON.stringify(ids(result)),
      sharedTop20Count: ids(result).filter((id) => ids(baseline).includes(id)).length,
      explanation: 'Baseline uses the first seed without diversity; product query uses all listed seeds and the default diversity heuristic.',
    },
    feedback: { positive: identity(positiveId), negative: identity(negativeId), resultIds: ids(refinedResult), eligibleCount: refinedResult.eligibleCount },
    checks: { realTwentyResults: true, seedsAndFeedbackExcluded: true, uniqueRecordingComponents: true, duplicateSeedIdempotent: true, repeatedQueryStable: true, positiveIdempotent: true, opposingFeedbackReplaced: true, seedEditClearsFeedback: true, exactReset: true },
    timingMs: { firstQuery: rounded(firstQueryMs), repeatCount: timedQueries.length, minimum: rounded(Math.min(...timedQueries)), median: rounded(median(timedQueries)), maximum: rounded(Math.max(...timedQueries)) },
  }
})

assert.notEqual(engine.recordingKey('fma:115817'), engine.recordingKey('fma:129970'), 'Same title does not imply same recording')
assert.throws(() => engine.query({ seedIds: tracks.slice(0, 6).map((track) => track.id) }), /at most five/)
assert.deepEqual(engine.query(createSession(engine)).recommendations, [])
const sourceAudit = JSON.parse(readFileSync(new URL('../docs/phases/phase-1-source-audit.json', import.meta.url), 'utf8')) as {
  selectedIds: string[]; selectedArtistCount: number; selectedGenreCounts: Record<string, number>
}
assert.deepEqual([...sourceAudit.selectedIds].sort(), tracks.map((track) => track.id), 'Source audit selected IDs match active catalog')
const coverage = tracks.map((track) => track.coverage.analyzedWindows.reduce((total, window) => total + window.endSeconds - window.startSeconds, 0))
const durations = tracks.map((track) => track.coverage.sourceDurationSeconds)
const payloadFiles = { 'current.json': pointerBytes, 'manifest.json': bundle.manifest, 'tracks.json': bundle.tracks, 'embeddings.f32': bundle.embeddings, 'build.json': bundle.build, 'ATTRIBUTION.md': bundle.attribution }
const runtimeFiles = ['current.json', 'manifest.json', 'tracks.json', 'embeddings.f32', 'build.json']
const recordingCount = new Set(tracks.map((track) => engine.recordingKey(track.id))).size
const output = {
  schemaVersion: 1,
  evaluatedAt: new Date().toISOString(),
  source: { head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), codeState: 'Working tree at execution; release build-info.json is the authoritative deployed source identity.' },
  status: 'passed',
  interpretation: 'Functional checks of genuine audio embeddings, not a listening study, preference score, or universal performance promise.',
  environment: { runtime: process.version, platform: platform(), release: release(), architecture: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, timingScope: 'Local Node process, in-memory committed catalog; no network, browser rendering, or device emulation. Browser loading/ranking observations are recorded separately.' },
  catalog: {
    version: pointer.catalogVersion, manifestSha256: pointer.manifestSha256, vectorSha256: manifest.files.embeddings.sha256,
    model: manifest.encoder.id, modelRevision: manifest.encoder.revision, dimension, tracks: tracks.length, distinctRecordingComponents: recordingCount,
    artistDisplayNames: new Set(tracks.map((track) => track.artist)).size,
    sourceArtistIds: { count: sourceAudit.selectedArtistCount, basis: 'Phase 1 source audit, whose selected IDs match all active catalog IDs; source artist IDs are not fields of tracks.json.' },
    sourceGenres: sourceAudit.selectedGenreCounts,
    clipCoverage: { describes: [...new Set(tracks.map((track) => track.coverage.describes))], sourceDurationSeconds: { minimum: Math.min(...durations), median: median(durations), maximum: Math.max(...durations) }, analyzedSeconds: { minimum: Math.min(...coverage), median: median(coverage), maximum: Math.max(...coverage), total: coverage.reduce((a, b) => a + b, 0) }, totalWindows: tracks.reduce((total, track) => total + track.coverage.analyzedWindows.length, 0), partialFinalWindows: tracks.filter((track) => track.coverage.analyzedWindows.some((window) => window.endSeconds - window.startSeconds < 10)).length },
    duplicateObservations: { identicalAudioHashes: tracks.length - new Set(tracks.map((track) => track.provenance.audioSha256)).size, repeatedRecordingComponents: tracks.length - recordingCount, sameTitleDifferentRecordings: ['fma:115817', 'fma:129970'].map(identity), limitation: 'No duplicate audio or recording components exist in this catalog. Real result uniqueness and same-title distinction are checked here; alias/hash transitivity and exclusions are covered by isolated engine unit fixtures, not fabricated real-data observations.' },
    validation,
  },
  payload: {
    files: Object.fromEntries(Object.entries(payloadFiles).map(([name, bytes]) => [name, { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength }])),
    runtimeRawBytes: Object.entries(payloadFiles).filter(([name]) => runtimeFiles.includes(name)).reduce((total, [, bytes]) => total + bytes.byteLength, 0),
    versionAndPointerRawBytes: Object.values(payloadFiles).reduce((total, bytes) => total + bytes.byteLength, 0),
    note: 'Runtime catalog excludes optional attribution document. gzip sizes are local compression observations, not assertions about Pages transfer encoding. Frontend JS/CSS and build metadata are measured by the production artifact audit.',
  },
  timingsMs: { browserCompatibleCatalogValidationInNode: rounded(catalogValidationMs), engineInitialization: rounded(engineInitializationMs) },
  cases,
  humanListening: { soundsSimilar: 'unmeasured', wantToHearNow: 'unmeasured', ratingsCollected: 0 },
  limitations: ['Prepared catalog includes experimental and field-recording excerpts as well as songs.', 'Audio similarity and heuristic ranking do not establish musical satisfaction.', 'Whole-song coverage, exhaustive duplicate recognition and performance on larger catalogs are unmeasured.'],
}
const serialized = `${JSON.stringify(output, null, 2)}\n`
const args = process.argv.slice(2)
if (args.length) {
  assert.equal(args.length, 2, 'Usage: node scripts/evaluate-release.ts [--output path]')
  assert.equal(args[0], '--output')
  writeFileSync(args[1]!, serialized)
  console.log(`Release data gates passed: ${tracks.length} recordings, ${cases.length} seed sets; evidence written.`)
} else console.log(serialized)
