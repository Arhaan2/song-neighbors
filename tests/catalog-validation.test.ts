import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canonicalJson, recordingLicenseAllowed, sha256, validateArtifactBundle } from '../scripts/catalog-validation.ts'
import type { ArtifactBundle } from '../scripts/catalog-validation.ts'

// Isolated synthetic mathematical fixtures. Never copied to public/ or counted as inference.
const encode = (value: unknown) => new TextEncoder().encode(`${JSON.stringify(value)}\n`)
const parse = (value: Uint8Array) => JSON.parse(new TextDecoder().decode(value))
const license = { statement: 'Attribution', url: 'https://creativecommons.org/licenses/by/4.0/', attribution: 'Synthetic test attribution only' }
const runtimeLibraries = { torch: '2.8.0', transformers: '4.57.1', numpy: '2.3.4', soundfile: '0.13.1', soxr: '1.0.0', librosa: '0.11.0', 'huggingface-hub': '0.36.0' }
const modelLicense = { statement: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0', attribution: 'Fixture model' }
function fixture(): ArtifactBundle {
  const processor = {
  "chunk_length_s": 10,
  "feature_extractor_type": "ClapFeatureExtractor",
  "feature_size": 64,
  "fft_window_size": 1024,
  "frequency_max": 14000,
  "frequency_min": 50,
  "hop_length": 480,
  "max_length_s": 10,
  "n_fft": 1024,
  "nb_frequency_bins": 513,
  "nb_max_frames": 1000,
  "nb_max_samples": 480000,
  "padding": "repeatpad",
  "padding_side": "right",
  "padding_value": 0.0,
  "processor_class": "ClapProcessor",
  "return_attention_mask": false,
  "sampling_rate": 48000,
  "top_db": null,
  "truncation": "rand_trunc"
}

  const processorSerialized = canonicalJson(processor)
  const configuration = {
    encoder: { id: 'laion/larger_clap_general', revision: 'ada0c23a36c4e8582805bb38fec3905903f18b41', sourceUrl: 'https://example.org/model', license: modelLicense },
    preprocessing: { sampleRateHz: 48000, channels: 1, decoder: { name: 'soundfile/libsndfile', version: '0.13.1/1.2.2' }, resampler: { name: 'soxr-HQ', version: '1.0.0' }, implementationVersion: 'song-neighbors-clap-v1', dependencyLockSha256: 'e'.repeat(64), runtimeLibraries, amplitudePolicy: 'Decode float32; mean channels in float64 then float32; soxr HQ resample to 48000 Hz; no loudness or peak normalization; zero-pad windows; processor padding=pad and truncation=rand_trunc on exactly 480000 samples (no crop).', processorConfigSha256: sha256(processorSerialized) },
    windowing: { version: 'fixed-starts-0-10-20-v1', durationSeconds: 10, selectionPolicy: 'Starts at 0, 10, and 20 seconds when start < decoded duration; analyzes at most first 30 seconds; no random crop.', shortAudioPolicy: 'Right zero-pad each partial 10-second window to 480000 samples; coverage excludes padding.' },
    aggregation: { version: 'mean-unit-windows-v1', method: 'Arithmetic mean of L2-normalized window embeddings, followed by L2 normalization.', windowNormalization: 'l2', finalNormalization: 'l2' },
  }
  const configurationSha256 = sha256(canonicalJson(configuration))
  const tracks = [0, 1].map((row) => ({
    id: `fixture:${row}`, row, title: `Isolated mathematical fixture ${row}`, artist: `Fixture artist ${row}`,
    provenance: { datasetId: 'fixture', datasetVersion: 'test-v1', sourceRecordId: `${row}`, sourcePage: `https://example.org/fixture/${row}`, audioSha256: sha256(`synthetic fixture ${row}`), recordingLicense: license, publicationBasis: 'Test only; no real audio or publication permission claimed.' },
    coverage: { sourceDurationSeconds: 10, analyzedWindows: [{ startSeconds: 0, endSeconds: 10 }], describes: 'available-audio-excerpt' },
  }))
  const embeddings = new Uint8Array(16)
  const view = new DataView(embeddings.buffer)
  view.setFloat32(0, 1, true)
  view.setFloat32(12, 1, true)
  const build = {
    schemaVersion: 1,
    pipeline: { sourceCommit: 'c'.repeat(40), sourceTreeSha256: 'd'.repeat(64), dirty: false },
    runtime: { python: '3.12', platform: 'test', libraries: runtimeLibraries }, dependencyLockSha256: 'e'.repeat(64),
    encoderArtifacts: [
      { path: 'config.json', sha256: '6268f76a067e3104bf9001e97d7dcc0fcfb16f3086cfb478ee72d95900d7fc1d', bytes: 643 },
      { path: 'preprocessor_config.json', sha256: '9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753', bytes: 541 },
      { path: 'pytorch_model.bin', sha256: '314eb00cce6ad68d25237b8446b659ccdb136ed4672c1bca470f142f72455026', bytes: 776444665 },
    ],
    processorConfig: { id: configuration.encoder.id, revision: configuration.encoder.revision, value: processor, serialized: processorSerialized, sha256: sha256(processorSerialized), serialization: 'json-sort-keys-compact-utf8-no-newline' },
    configuration, configurationSha256,
    sourceMetadata: { archiveSha256: 'a'.repeat(64), archiveSha1: 'a'.repeat(40), datasetVersion: 'test-v1' },
    inclusionPolicy: { version: 'test-only', exclusionCounts: {} },
    rows: tracks.map((track) => ({ id: track.id, audioSha256: track.provenance.audioSha256, configurationSha256, cacheKeySha256: sha256(canonicalJson({ audioSha256: track.provenance.audioSha256, configurationSha256 })), vectorSha256: sha256(embeddings.subarray(track.row * 8, (track.row + 1) * 8)), norm: 1, extractionPipeline: { sourceCommit: 'c'.repeat(40), sourceTreeSha256: 'd'.repeat(64), dirty: false }, dependencyLockSha256: 'e'.repeat(64) })),
    measured: { trackCount: 2, dimension: 2, artistCount: 2 }, validation: { finite: true, nonzero: true, normalized: true, rowAligned: true },
  }
  const attribution = new TextEncoder().encode(`Synthetic fixtures only. Numerical embeddings from excerpts. ${modelLicense.attribution} ${modelLicense.url}\n${license.attribution} ${license.url}\n${tracks.map((track) => `${track.id} ${track.provenance.sourcePage} ${license.url} ${license.attribution}`).join('\n')}`)
  const bundle: ArtifactBundle = { manifest: new Uint8Array(), tracks: encode(tracks), embeddings, attribution, build: encode(build) }
  bundle.manifest = encode({
    schemaVersion: 1, catalogVersion: 'isolated-test', createdAt: '2026-11-04T00:00:00Z', trackCount: 2, dimension: 2, ...configuration,
    vectors: { dtype: 'float32', byteOrder: 'little', layout: 'row-major', normalization: 'l2', normTolerance: 0.0001 },
    orderedIdsSha256: sha256(`${tracks.map((track) => track.id).join('\n')}\n`),
    sources: [{ datasetId: 'fixture', datasetVersion: 'test-v1', sourceUrl: 'https://example.org/dataset', metadataLicense: license, termsUrls: ['https://example.org/terms'] }],
    files: Object.fromEntries((['tracks', 'embeddings', 'attribution', 'build'] as const).map((key) => [key, { path: { tracks: 'tracks.json', embeddings: 'embeddings.f32', attribution: 'ATTRIBUTION.md', build: 'build.json' }[key], bytes: bundle[key].byteLength, sha256: sha256(bundle[key]) }])),
  })
  return bundle
}

/** Rehash mutated fixture artifacts so semantic checks cannot hide behind a hash failure. */
function rehash(bundle: ArtifactBundle) {
  const manifest = parse(bundle.manifest)
  const build = parse(bundle.build)
  for (let row = 0; row < build.rows.length; row++) build.rows[row].vectorSha256 = sha256(bundle.embeddings.subarray(row * manifest.dimension * 4, (row + 1) * manifest.dimension * 4))
  bundle.build = encode(build)
  for (const key of ['tracks', 'embeddings', 'attribution', 'build'] as const) {
    manifest.files[key].bytes = bundle[key].byteLength
    manifest.files[key].sha256 = sha256(bundle[key])
  }
  bundle.manifest = encode(manifest)
}

function edit(bundle: ArtifactBundle, key: 'manifest' | 'tracks' | 'build', transform: (value: ReturnType<typeof parse>) => void) {
  const value = parse(bundle[key])
  transform(value)
  bundle[key] = encode(value)
  rehash(bundle)
}

describe('complete catalog artifact validation', () => {
  it('validates little-endian rows, hashes, coverage, provenance, and norms', () => {
    const bundle = fixture()
    expect(validateArtifactBundle(bundle, { catalogVersion: 'isolated-test', manifestSha256: sha256(bundle.manifest) })).toMatchObject({ status: 'valid', trackCount: 2, artistCount: 2, dimension: 2, minimumNorm: 1, maximumNorm: 1 })
    expect(() => validateArtifactBundle(bundle, { manifestSha256: '0'.repeat(64) })).toThrow('Manifest hash mismatch')
    expect(() => validateArtifactBundle(bundle, { catalogVersion: 'wrong' })).toThrow('Catalog version mismatch')
  })

  it('rejects the withdrawn music revision and its checkpoint even with coherent hashes', () => {
    for (const retainOriginalIdentity of [true, false]) {
      const bundle = fixture()
      const manifest = parse(bundle.manifest)
      const build = parse(bundle.build)
      if (retainOriginalIdentity) {
        manifest.encoder.id = 'laion/larger_clap_music'
        manifest.encoder.revision = 'a0b4534a14f58e20944452dff00a22a06ce629d1'
        manifest.encoder.sourceUrl = 'https://huggingface.co/laion/larger_clap_music/tree/a0b4534a14f58e20944452dff00a22a06ce629d1'
        build.configuration.encoder = manifest.encoder
        build.processorConfig.id = manifest.encoder.id
        build.processorConfig.revision = manifest.encoder.revision
      }
      build.encoderArtifacts.find((artifact: { path: string }) => artifact.path === 'config.json').sha256 = '2d7722d338bb83ea8824272b1431f088954d3425d79eb3c2d39489478516dc03'
      build.encoderArtifacts.find((artifact: { path: string }) => artifact.path === 'config.json').bytes = 628
      build.encoderArtifacts.find((artifact: { path: string }) => artifact.path === 'pytorch_model.bin').sha256 = '5c289311f4a030d768af7ffbfdecd01b008aa64824211899a4e59f4f9d154fd1'
      build.configurationSha256 = sha256(canonicalJson(build.configuration))
      for (const row of build.rows) {
        row.configurationSha256 = build.configurationSha256
        row.cacheKeySha256 = sha256(canonicalJson({ audioSha256: row.audioSha256, configurationSha256: build.configurationSha256 }))
      }
      bundle.manifest = encode(manifest)
      bundle.build = encode(build)
      rehash(bundle)
      expect(() => validateArtifactBundle(bundle)).toThrow(retainOriginalIdentity ? 'Unsupported encoder revision' : 'Unsupported model artifacts')
    }
  })

  it('rejects corrupt bytes, truncated rows, extra bytes, and nonfinite/zero/nonunit vectors', () => {
    const corrupt = fixture()
    corrupt.embeddings[0] = 1
    expect(() => validateArtifactBundle(corrupt)).toThrow('hash mismatch')
    for (const length of [12, 20]) {
      const bundle = fixture()
      bundle.embeddings = new Uint8Array(length)
      rehash(bundle)
      expect(() => validateArtifactBundle(bundle)).toThrow()
    }
    for (const bad of [NaN, Infinity, 0, 2]) {
      const bundle = fixture()
      new DataView(bundle.embeddings.buffer).setFloat32(0, bad, true)
      rehash(bundle)
      expect(() => validateArtifactBundle(bundle)).toThrow(/nonfinite|nonnormalized/)
    }
  })

  it('rejects missing, misaligned, duplicate, and reordered metadata even with fresh file hashes', () => {
    const mutations = [
      (rows: ReturnType<typeof parse>) => rows.pop(),
      (rows: ReturnType<typeof parse>) => { rows[1].row = 0 },
      (rows: ReturnType<typeof parse>) => { rows[1].id = rows[0].id },
      (rows: ReturnType<typeof parse>) => rows.reverse(),
      (rows: ReturnType<typeof parse>) => { delete rows[0].provenance.audioSha256 },
      (rows: ReturnType<typeof parse>) => { rows[0].provenance.sourcePage = 'https://localhost/fixture' },
      (rows: ReturnType<typeof parse>) => { rows[0].title = '/Users/private/track.mp3' },
    ]
    for (const mutation of mutations) {
      const bundle = fixture()
      edit(bundle, 'tracks', mutation)
      expect(() => validateArtifactBundle(bundle)).toThrow()
    }
  })

  it('rejects mismatched model/processor/configuration, row source hashes, row norms, and cache keys', () => {
    const mutations = [
      (build: ReturnType<typeof parse>) => { build.configuration.encoder.revision = 'd'.repeat(40) },
      (build: ReturnType<typeof parse>) => { build.processorConfig.revision = 'd'.repeat(40) },
      (build: ReturnType<typeof parse>) => { build.processorConfig.serialized += '\n' },
      (build: ReturnType<typeof parse>) => { build.rows[0].configurationSha256 = '0'.repeat(64) },
      (build: ReturnType<typeof parse>) => { build.rows[0].audioSha256 = '0'.repeat(64) },
      (build: ReturnType<typeof parse>) => { build.rows[0].cacheKeySha256 = '0'.repeat(64) },
      (build: ReturnType<typeof parse>) => { build.rows[0].norm = 0.9 },
      (build: ReturnType<typeof parse>) => { build.rows[0].dependencyLockSha256 = '0'.repeat(64) },
      (build: ReturnType<typeof parse>) => { build.dependencyLockSha256 = '0'.repeat(64) },
      (build: ReturnType<typeof parse>) => { build.rows.pop() },
    ]
    for (const mutation of mutations) {
      const bundle = fixture()
      edit(bundle, 'build', mutation)
      expect(() => validateArtifactBundle(bundle)).toThrow()
    }
  })

  it('rejects unsupported decoder/resampler/library identities even when all configuration hashes agree', () => {
    const mutations = [
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.decoder.name = 'ffmpeg' },
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.decoder.version = '0.99.0/1.2.2' },
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.decoder.version = '0.13.1/' },
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.resampler.name = 'linear' },
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.resampler.version = '9.9.9' },
      (preprocessing: ReturnType<typeof parse>) => { preprocessing.runtimeLibraries.transformers = '99.0.0' },
      (preprocessing: ReturnType<typeof parse>) => { delete preprocessing.runtimeLibraries.librosa },
    ]
    for (const mutation of mutations) {
      const bundle = fixture()
      const manifest = parse(bundle.manifest)
      const build = parse(bundle.build)
      mutation(manifest.preprocessing)
      build.configuration.preprocessing = manifest.preprocessing
      build.runtime.libraries = manifest.preprocessing.runtimeLibraries
      build.configurationSha256 = sha256(canonicalJson(build.configuration))
      for (const row of build.rows) {
        row.configurationSha256 = build.configurationSha256
        row.cacheKeySha256 = sha256(canonicalJson({ audioSha256: row.audioSha256, configurationSha256: build.configurationSha256 }))
      }
      bundle.manifest = encode(manifest)
      bundle.build = encode(build)
      rehash(bundle)
      expect(() => validateArtifactBundle(bundle)).toThrow(/Unsupported (decoder|resampler|runtime)/)
    }
  })

  it('rejects unsupported semantics, false window coverage, incomplete attribution and duplicate audio', () => {
    const configuration = fixture()
    const manifest = parse(configuration.manifest)
    const build = parse(configuration.build)
    manifest.windowing.selectionPolicy = 'Random crop'
    build.configuration.windowing.selectionPolicy = 'Random crop'
    build.configurationSha256 = sha256(canonicalJson(build.configuration))
    configuration.manifest = encode(manifest)
    configuration.build = encode(build)
    rehash(configuration)
    expect(() => validateArtifactBundle(configuration)).toThrow('Unsupported policy semantics')
    const coverage = fixture()
    edit(coverage, 'tracks', (tracks) => { tracks[0].coverage.analyzedWindows[0].endSeconds = 9 })
    expect(() => validateArtifactBundle(coverage)).toThrow('analyzed windows')
    const attribution = fixture()
    attribution.attribution = new TextEncoder().encode('Incomplete attribution')
    rehash(attribution)
    expect(() => validateArtifactBundle(attribution)).toThrow('attribution')
    const duplicates = fixture()
    edit(duplicates, 'tracks', (tracks) => { tracks[1].provenance.audioSha256 = tracks[0].provenance.audioSha256 })
    expect(() => validateArtifactBundle(duplicates)).toThrow('duplicate source audio')
  })
})

describe('narrow per-record recording license allowlist', () => {
  it('accepts an explicit source license URL with an unchanged vague title, without guessing its version', () => {
    expect(recordingLicenseAllowed(license)).toBe(true)
    expect(recordingLicenseAllowed({ statement: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' })).toBe(true)
  })
  it('rejects NC/ND/SA, unspecified versions, unknown jurisdictions and conflicting statements', () => {
    for (const invalid of [
      { ...license, url: 'https://creativecommons.org/licenses/by/' },
      { ...license, url: 'https://creativecommons.org/licenses/by-nc/4.0/' },
      { ...license, url: 'https://creativecommons.org/licenses/by/3.0/us/' },
      { ...license, statement: 'Attribution-ShareAlike 4.0' },
      { ...license, statement: 'Attribution-NonCommercial 4.0' },
      { ...license, statement: 'Attribution-NoDerivatives 4.0' },
      { ...license, statement: 'Attribution 3.0 Unported' },
      { ...license, statement: 'All rights reserved' },
      { ...license, url: 'https://example.org/by/4.0/' },
    ]) expect(recordingLicenseAllowed(invalid)).toBe(false)
  })
})


describe('filesystem CLI and activation boundary', () => {
  it('distinguishes unavailable data from valid staged/active exports and rejects stray public files', () => {
    const root = mkdtempSync(join(tmpdir(), 'song-neighbors-validator-'))
    const cli = fileURLToPath(new URL('../scripts/validate-catalog.ts', import.meta.url))
    const run = (...args: string[]) => spawnSync(process.execPath, [cli, '--root', root, ...args], { encoding: 'utf8' })
    try {
      writeFileSync(join(root, 'current.json'), encode({ schemaVersion: 1, status: 'not-ready', reason: 'Isolated test only' }))
      const unavailable = run()
      expect(unavailable.status).toBe(0)
      expect(JSON.parse(unavailable.stdout)).toMatchObject({ status: 'not-ready', realCatalogValidated: false })
      expect(run('--require-ready').status).toBe(1)
      const bundle = fixture()
      const directory = join(root, 'isolated-test')
      mkdirSync(directory)
      for (const [key, filename] of Object.entries({ manifest: 'manifest.json', tracks: 'tracks.json', embeddings: 'embeddings.f32', attribution: 'ATTRIBUTION.md', build: 'build.json' })) writeFileSync(join(directory, filename), bundle[key as keyof ArtifactBundle])
      expect(run('--version', 'isolated-test').status).toBe(0)
      expect(run('--version', '../isolated-test').status).toBe(1)
      expect(run('--version', 'isolated-test', '--require-ready').status).toBe(1)
      writeFileSync(join(root, 'current.json'), encode({ schemaVersion: 1, status: 'ready', catalogVersion: 'isolated-test', manifestSha256: sha256(bundle.manifest) }))
      expect(run('--require-ready').status).toBe(0)
      writeFileSync(join(directory, 'unwanted-audio.mp3'), 'TEST ONLY')
      expect(run().status).toBe(1)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
