import { createHash } from 'node:crypto'
import { z } from 'zod'
import { catalogMetadataSchema } from '../src/catalog/contract.ts'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const revision = z.string().regex(/^[a-f0-9]{40}$/)
const text = z.string().min(1)
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const positive = count.refine((value) => value > 0)
const safeArtifactPath = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)

export const buildSchema = z.strictObject({
  schemaVersion: z.literal(1),
  pipeline: z.strictObject({ sourceCommit: revision, sourceTreeSha256: digest, dirty: z.boolean() }),
  runtime: z.strictObject({ python: text, platform: text, libraries: z.record(text, text) }),
  dependencyLockSha256: digest,
  encoderArtifacts: z.array(z.strictObject({ path: safeArtifactPath, sha256: digest, bytes: positive })).min(1),
  processorConfig: z.strictObject({
    id: text,
    revision,
    value: z.record(z.string(), z.unknown()),
    serialized: text,
    sha256: digest,
    serialization: z.literal('json-sort-keys-compact-utf8-no-newline'),
  }),
  configuration: z.strictObject({
    encoder: z.record(z.string(), z.unknown()),
    preprocessing: z.record(z.string(), z.unknown()),
    windowing: z.record(z.string(), z.unknown()),
    aggregation: z.record(z.string(), z.unknown()),
  }),
  configurationSha256: digest,
  sourceMetadata: z.strictObject({ archiveSha256: digest, archiveSha1: z.string().regex(/^[a-f0-9]{40}$/), datasetVersion: text }),
  inclusionPolicy: z.strictObject({ version: text, exclusionCounts: z.record(text, count) }),
  rows: z.array(z.strictObject({
    id: text,
    audioSha256: digest,
    configurationSha256: digest,
    cacheKeySha256: digest,
    vectorSha256: digest,
    norm: z.number().positive(),
    extractionPipeline: z.strictObject({ sourceCommit: revision, sourceTreeSha256: digest, dirty: z.boolean() }),
    dependencyLockSha256: digest,
  })).min(1),
  measured: z.strictObject({ trackCount: positive, dimension: positive, artistCount: positive }),
  validation: z.strictObject({ finite: z.literal(true), nonzero: z.literal(true), normalized: z.literal(true), rowAligned: z.literal(true) }),
})

export type ArtifactBundle = {
  manifest: Uint8Array
  tracks: Uint8Array
  embeddings: Uint8Array
  attribution: Uint8Array
  build: Uint8Array
}

export const sha256 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex')

/** Sorted keys, compact UTF-8 JSON, no trailing newline; configuration numbers are integers. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  const result = JSON.stringify(value)
  if (result === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('Non-JSON value')
  return result
}

function requireThat(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function decode(bytes: Uint8Array): string {
  requireThat(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), 'UTF-8 BOM is not permitted')
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

function publicSafe(value: unknown): void {
  if (typeof value === 'string') {
    requireThat(!/(?:\/Users\/|\/home\/|\/private\/|\/tmp\/|[A-Za-z]:\\|file:\/\/)/i.test(value), 'Local path in public artifact')
    for (const match of value.matchAll(/https?:\/\/[^\s<>"\])]+/g)) {
      const url = new URL(match[0])
      const host = url.hostname.toLowerCase()
      requireThat(!url.username && !url.password, 'Credential URL in public artifact')
      requireThat(!/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[::1\]|\[fc|\[fd|\[fe80)/.test(host) && !/^172\.(1[6-9]|2\d|3[01])\./.test(host) && !/\.(local|internal)$/.test(host), 'Private host in public artifact')
      requireThat(![...url.searchParams.keys()].some((key) => /^(token|access_token|api_key|apikey|password|secret|signature|x-amz-credential)$/i.test(key)), 'Credential query in public artifact')
    }
  } else if (Array.isArray(value)) value.forEach(publicSafe)
  else if (value && typeof value === 'object') Object.values(value).forEach(publicSafe)
}

export function recordingLicenseAllowed(license: { statement: string; url: string }): boolean {
  const match = /^https:\/\/creativecommons\.org\/(?:licenses\/(by)\/(1\.0|2\.0|2\.5|3\.0|4\.0)|publicdomain\/(zero)\/(1\.0))\/$/.exec(license.url)
  if (!match || /(?:noncommercial|non-commercial|no ?deriv|share ?alike|\b(?:nc|nd|sa)\b)/i.test(license.statement)) return false
  const version = match[2] ?? match[4]
  if (!version) return false
  const statedVersions = license.statement.match(/\b[1-4]\.[0-9]\b/g) ?? []
  if (statedVersions.some((stated) => stated !== version)) return false
  return match[1] === 'by'
    ? /(?:\battribution\b|\bcc\s*by\b)/i.test(license.statement)
    : /(?:\bcc0\b|public domain dedication|zero)/i.test(license.statement)
}

export function validateArtifactBundle(bundle: ArtifactBundle, expected?: { catalogVersion?: string; manifestSha256?: string }) {
  if (expected?.manifestSha256) requireThat(sha256(bundle.manifest) === expected.manifestSha256, 'Manifest hash mismatch')
  const { manifest, tracks } = catalogMetadataSchema.parse({ manifest: JSON.parse(decode(bundle.manifest)), tracks: JSON.parse(decode(bundle.tracks)) })
  if (expected?.catalogVersion) requireThat(manifest.catalogVersion === expected.catalogVersion, 'Catalog version mismatch')
  for (const key of ['tracks', 'embeddings', 'attribution', 'build'] as const) {
    requireThat(bundle[key].byteLength === manifest.files[key].bytes, `${key}: byte count mismatch`)
    requireThat(sha256(bundle[key]) === manifest.files[key].sha256, `${key}: hash mismatch`)
  }
  const build = buildSchema.parse(JSON.parse(decode(bundle.build)))
  const attribution = decode(bundle.attribution)
  publicSafe({ manifest, tracks, build, attribution })
  requireThat(tracks.every((track, index) => index === 0 || tracks[index - 1]!.id < track.id), 'Track IDs must be sorted bytewise')
  requireThat(sha256(`${tracks.map((track) => track.id).join('\n')}\n`) === manifest.orderedIdsSha256, 'Ordered ID hash mismatch')
  const configuration = { encoder: manifest.encoder, preprocessing: manifest.preprocessing, windowing: manifest.windowing, aggregation: manifest.aggregation }
  requireThat(canonicalJson(build.configuration) === canonicalJson(configuration), 'Manifest/build configuration mismatch')
  requireThat(sha256(canonicalJson(configuration)) === build.configurationSha256, 'Configuration hash mismatch')
  requireThat(manifest.windowing.version === 'fixed-starts-0-10-20-v1' && manifest.windowing.durationSeconds === 10 && manifest.aggregation.version === 'mean-unit-windows-v1' && manifest.aggregation.windowNormalization === 'l2', 'Unsupported analysis configuration')
  requireThat(manifest.encoder.id === 'laion/larger_clap_music' && manifest.encoder.revision === 'a0b4534a14f58e20944452dff00a22a06ce629d1', 'Unsupported encoder revision')
  requireThat(manifest.preprocessing.sampleRateHz === 48000, 'Unsupported sample rate')
  requireThat(manifest.preprocessing.implementationVersion === 'song-neighbors-clap-v1', 'Unsupported pipeline implementation')
  requireThat(manifest.preprocessing.dependencyLockSha256 === build.dependencyLockSha256, 'Dependency lock mismatch')
  requireThat(canonicalJson(manifest.preprocessing.runtimeLibraries) === canonicalJson(build.runtime.libraries), 'Runtime libraries mismatch')
  requireThat(manifest.preprocessing.amplitudePolicy === 'Decode float32; mean channels in float64 then float32; soxr HQ resample to 48000 Hz; no loudness or peak normalization; zero-pad windows; processor padding=pad and truncation=rand_trunc on exactly 480000 samples (no crop).', 'Unsupported amplitude policy')
  requireThat(manifest.windowing.selectionPolicy === 'Starts at 0, 10, and 20 seconds when start < decoded duration; analyzes at most first 30 seconds; no random crop.' && manifest.windowing.shortAudioPolicy === 'Right zero-pad each partial 10-second window to 480000 samples; coverage excludes padding.' && manifest.aggregation.method === 'Arithmetic mean of L2-normalized window embeddings, followed by L2 normalization.', 'Unsupported policy semantics')
  requireThat(build.processorConfig.id === manifest.encoder.id && build.processorConfig.revision === manifest.encoder.revision, 'Processor/model revision mismatch')
  requireThat(sha256(build.processorConfig.serialized) === build.processorConfig.sha256 && build.processorConfig.sha256 === manifest.preprocessing.processorConfigSha256, 'Processor configuration hash mismatch')
  requireThat(build.processorConfig.serialized === canonicalJson(build.processorConfig.value), 'Processor serialization is not canonical')
  requireThat(build.processorConfig.sha256 === 'c15057851b990e02fffdae8a7e89f730f0cddc77cbf893254bfcc29f81c116ba', 'Unsupported processor configuration')
  requireThat(build.processorConfig.value.sampling_rate === 48000 && build.processorConfig.value.max_length_s === 10 && build.processorConfig.value.nb_max_samples === 480000, 'Processor incompatible with fixed windows')
  requireThat(build.measured.trackCount === manifest.trackCount && build.measured.dimension === manifest.dimension && build.measured.artistCount === new Set(tracks.map((track) => track.artist)).size, 'Measured coverage mismatch')
  requireThat(build.rows.length === tracks.length, 'Build row count mismatch')
  requireThat(manifest.sources.every((source) => source.datasetVersion === build.sourceMetadata.datasetVersion), 'Metadata version mismatch')
  const expectedArtifacts: Record<string, string> = {
    'config.json': '2d7722d338bb83ea8824272b1431f088954d3425d79eb3c2d39489478516dc03',
    'preprocessor_config.json': '9739f58296aa6f9ac18008fd0150fb2649bc554985fbde86d0a4041c882ac753',
    'pytorch_model.bin': '5c289311f4a030d768af7ffbfdecd01b008aa64824211899a4e59f4f9d154fd1',
  }
  requireThat(new Set(build.encoderArtifacts.map((artifact) => artifact.path)).size === build.encoderArtifacts.length, 'Duplicate model artifact')
  requireThat(build.encoderArtifacts.length === Object.keys(expectedArtifacts).length && build.encoderArtifacts.every((artifact) => expectedArtifacts[artifact.path] === artifact.sha256), 'Unsupported model artifacts')

  requireThat(attribution.includes(manifest.encoder.license.attribution) && attribution.includes(manifest.encoder.license.url) && manifest.sources.every((source) => attribution.includes(source.metadataLicense.attribution) && attribution.includes(source.metadataLicense.url)), 'Model or metadata attribution is incomplete')
  const vectorView = new DataView(bundle.embeddings.buffer, bundle.embeddings.byteOffset, bundle.embeddings.byteLength)
  const rowBytes = manifest.dimension * 4
  const audioHashes = new Set<string>()
  let minimumNorm = Infinity
  let maximumNorm = 0
  for (const [index, track] of tracks.entries()) {
    requireThat(recordingLicenseAllowed(track.provenance.recordingLicense), `${track.id}: recording license is not explicitly allowed`)
    requireThat(attribution.includes(track.id) && attribution.includes(track.provenance.sourcePage) && attribution.includes(track.provenance.recordingLicense.url) && attribution.includes(track.provenance.recordingLicense.attribution), `${track.id}: attribution is incomplete`)
    requireThat(!audioHashes.has(track.provenance.audioSha256), `${track.id}: duplicate source audio`)
    audioHashes.add(track.provenance.audioSha256)
    const row = build.rows[index]!
    requireThat(row.id === track.id && row.audioSha256 === track.provenance.audioSha256 && row.configurationSha256 === build.configurationSha256, `${track.id}: build row provenance/configuration mismatch`)
    requireThat(row.dependencyLockSha256 === build.dependencyLockSha256, `${track.id}: extraction dependency lock mismatch`)
    requireThat(row.cacheKeySha256 === sha256(canonicalJson({ audioSha256: row.audioSha256, configurationSha256: build.configurationSha256 })), `${track.id}: cache identity mismatch`)
    requireThat(row.vectorSha256 === sha256(bundle.embeddings.subarray(index * rowBytes, (index + 1) * rowBytes)), `${track.id}: vector row hash mismatch`)
    const expectedWindows = [0, 10, 20].filter((start) => start < track.coverage.sourceDurationSeconds).map((start) => ({ startSeconds: start, endSeconds: Math.min(start + 10, track.coverage.sourceDurationSeconds) }))
    requireThat(canonicalJson(track.coverage.analyzedWindows) === canonicalJson(expectedWindows), `${track.id}: analyzed windows do not match policy`)
    let normSquared = 0
    for (let column = 0; column < manifest.dimension; column++) {
      const value = vectorView.getFloat32(index * rowBytes + column * 4, true)
      requireThat(Number.isFinite(value), `${track.id}: nonfinite vector`)
      normSquared += value * value
    }
    const norm = Math.sqrt(normSquared)
    requireThat(norm > 0 && Math.abs(norm - 1) <= manifest.vectors.normTolerance, `${track.id}: zero or nonnormalized vector`)
    requireThat(Math.abs(norm - row.norm) <= 1e-7, `${track.id}: recorded norm mismatch`)
    minimumNorm = Math.min(minimumNorm, norm)
    maximumNorm = Math.max(maximumNorm, norm)
  }
  return { status: 'valid' as const, catalogVersion: manifest.catalogVersion, trackCount: tracks.length, artistCount: build.measured.artistCount, dimension: manifest.dimension, minimumNorm, maximumNorm }
}
