import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  catalogManifestSchema,
  catalogMetadataSchema,
  catalogPointerSchema,
  catalogTracksSchema,
} from '../src/catalog/contract.ts'

// Structural fixtures only: these are not songs, inference output, or publishable data.
const digest = 'a'.repeat(64)
const license = {
  statement: 'Test license statement',
  url: 'https://example.org/license',
  attribution: 'Schema test fixture only',
}
const artifact = (path: string, bytes = 1) => ({ path, bytes, sha256: digest })
const manifest = () => ({
  schemaVersion: 1,
  catalogVersion: 'schema-test',
  createdAt: '2026-11-03T00:00:00Z',
  trackCount: 1,
  dimension: 2,
  encoder: { id: 'test/encoder', revision: 'b'.repeat(40), sourceUrl: 'https://example.org/model', license },
  preprocessing: {
    sampleRateHz: 48000,
    channels: 1,
    decoder: { name: 'test-decoder', version: '1' },
    resampler: { name: 'test-resampler', version: '1' },
    amplitudePolicy: 'test-only',
    processorConfigSha256: digest,
  },
  windowing: { version: 'test-v1', durationSeconds: 10, selectionPolicy: 'test-only', shortAudioPolicy: 'test-only' },
  aggregation: { version: 'test-v1', method: 'test-only', windowNormalization: 'none', finalNormalization: 'l2' },
  vectors: { dtype: 'float32', byteOrder: 'little', layout: 'row-major', normalization: 'l2', normTolerance: 0.0001 },
  orderedIdsSha256: digest,
  sources: [{ datasetId: 'test', datasetVersion: '1', sourceUrl: 'https://example.org/dataset', metadataLicense: license, termsUrls: ['https://example.org/terms'] }],
  files: {
    tracks: artifact('tracks.json'),
    embeddings: artifact('embeddings.f32', 8),
    attribution: artifact('ATTRIBUTION.md'),
    build: artifact('build.json'),
  },
})
const track = (id = 'test:fixture', row = 0) => ({
  id,
  row,
  title: 'Schema fixture',
  artist: 'Test only',
  provenance: {
    datasetId: 'test',
    datasetVersion: '1',
    sourceRecordId: id,
    sourcePage: 'https://example.org/source',
    audioSha256: digest,
    recordingLicense: license,
    publicationBasis: 'Structural test only; no real data publication basis claimed.',
  },
  coverage: { sourceDurationSeconds: 10, analyzedWindows: [{ startSeconds: 0, endSeconds: 10 }], describes: 'available-audio-excerpt' },
})

describe('catalog contract', () => {
  it('keeps the committed catalog explicitly unavailable, without guessed release fields', () => {
    const current: unknown = JSON.parse(readFileSync(new URL('../public/catalog/current.json', import.meta.url), 'utf8'))
    expect(catalogPointerSchema.parse(current)).toMatchObject({ status: 'not-ready' })
    expect(catalogPointerSchema.safeParse({ schemaVersion: 1, status: 'not-ready', reason: 'Pending', dimension: 512 }).success).toBe(false)
  })

  it('accepts a versioned pointer and rejects path traversal or unverified manifests', () => {
    const ready = { schemaVersion: 1, status: 'ready', catalogVersion: 'release-1', manifestSha256: digest }
    expect(catalogPointerSchema.safeParse(ready).success).toBe(true)
    expect(catalogPointerSchema.safeParse({ ...ready, catalogVersion: '../private' }).success).toBe(false)
    expect(catalogPointerSchema.safeParse({ ...ready, manifestSha256: '' }).success).toBe(false)
  })

  it('requires immutable encoder identity, measured shape, safe file paths and exact vector bytes', () => {
    expect(catalogManifestSchema.safeParse(manifest()).success).toBe(true)
    const invalid = [
      { ...manifest(), dimension: 0 },
      { ...manifest(), dimension: Infinity },
      { ...manifest(), dimension: 3 },
      { ...manifest(), encoder: { ...manifest().encoder, revision: 'main' } },
      { ...manifest(), files: { ...manifest().files, tracks: artifact('/private/tracks.json') } },
      { ...manifest(), vectors: { ...manifest().vectors, byteOrder: 'big' } },
      { ...manifest(), localPath: '/private/audio' },
    ]
    for (const value of invalid) expect(catalogManifestSchema.safeParse(value).success).toBe(false)
  })

  it('rejects duplicate IDs, gaps and false analyzed coverage instead of silently reordering', () => {
    expect(catalogTracksSchema.safeParse([track(), track('test:second', 1)]).success).toBe(true)
    expect(catalogTracksSchema.safeParse([track(), track('test:fixture', 1)]).success).toBe(false)
    expect(catalogTracksSchema.safeParse([track('test:second', 1), track()]).success).toBe(false)
    const badCoverage = { ...track(), coverage: { ...track().coverage, analyzedWindows: [{ startSeconds: 0, endSeconds: 11 }] } }
    expect(catalogTracksSchema.safeParse([badCoverage]).success).toBe(false)
  })

  it('requires counts and public provenance to agree across metadata', () => {
    expect(catalogMetadataSchema.safeParse({ manifest: manifest(), tracks: [track()] }).success).toBe(true)
    expect(catalogMetadataSchema.safeParse({ manifest: manifest(), tracks: [track(), track('test:second', 1)] }).success).toBe(false)
    const unknownSource = { ...track(), provenance: { ...track().provenance, datasetId: 'unlisted' } }
    expect(catalogMetadataSchema.safeParse({ manifest: manifest(), tracks: [unknownSource] }).success).toBe(false)
    const credentialUrl = { ...track(), provenance: { ...track().provenance, sourcePage: 'https://user:secret@example.org/source' } }
    expect(catalogMetadataSchema.safeParse({ manifest: manifest(), tracks: [credentialUrl] }).success).toBe(false)
  })
})
