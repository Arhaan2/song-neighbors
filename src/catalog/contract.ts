import { z } from 'zod'

const text = z.string().trim().min(1)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/, 'Expected lowercase SHA-256 hex')
const version = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/, 'Expected a safe catalog version slug')
const positiveInteger = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
const nonnegativeInteger = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const publicUrl = z.url().refine((value) => {
  const url = new URL(value)
  return url.protocol === 'https:' && !url.username && !url.password
}, 'Expected a public HTTPS URL without credentials')

export const catalogPointerSchema = z.discriminatedUnion('status', [
  z.strictObject({
    schemaVersion: z.literal(1),
    status: z.literal('not-ready'),
    reason: text,
  }),
  z.strictObject({
    schemaVersion: z.literal(1),
    status: z.literal('ready'),
    catalogVersion: version,
    manifestSha256: sha256,
  }),
])

const licenseSchema = z.strictObject({
  statement: text,
  url: publicUrl,
  attribution: text,
})

const softwareSchema = z.strictObject({ name: text, version: text })
const artifact = <T extends string>(path: T) => z.strictObject({
  path: z.literal(path),
  bytes: positiveInteger,
  sha256,
})

export const catalogManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  catalogVersion: version,
  createdAt: z.iso.datetime(),
  trackCount: positiveInteger,
  dimension: positiveInteger,
  encoder: z.strictObject({
    id: text,
    revision: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/, 'Pin an immutable commit, not a branch or tag'),
    sourceUrl: publicUrl,
    license: licenseSchema,
  }),
  preprocessing: z.strictObject({
    sampleRateHz: positiveInteger,
    implementationVersion: text,
    dependencyLockSha256: sha256,
    runtimeLibraries: z.record(text, text),
    channels: z.literal(1),
    decoder: softwareSchema,
    resampler: softwareSchema,
    amplitudePolicy: text,
    processorConfigSha256: sha256,
  }),
  windowing: z.strictObject({
    version: text,
    durationSeconds: z.number().positive(),
    selectionPolicy: text,
    shortAudioPolicy: text,
  }),
  aggregation: z.strictObject({
    version: text,
    method: text,
    windowNormalization: z.enum(['none', 'l2']),
    finalNormalization: z.literal('l2'),
  }),
  vectors: z.strictObject({
    dtype: z.literal('float32'),
    byteOrder: z.literal('little'),
    layout: z.literal('row-major'),
    normalization: z.literal('l2'),
    normTolerance: z.number().positive().max(0.001),
  }),
  orderedIdsSha256: sha256,
  sources: z.array(z.strictObject({
    datasetId: text,
    datasetVersion: text,
    sourceUrl: publicUrl,
    metadataLicense: licenseSchema,
    termsUrls: z.array(publicUrl).min(1),
  })).min(1),
  files: z.strictObject({
    tracks: artifact('tracks.json'),
    embeddings: artifact('embeddings.f32'),
    attribution: artifact('ATTRIBUTION.md'),
    build: artifact('build.json'),
  }),
}).superRefine((manifest, context) => {
  const expectedBytes = manifest.trackCount * manifest.dimension * 4
  if (!Number.isSafeInteger(expectedBytes) || manifest.files.embeddings.bytes !== expectedBytes) {
    context.addIssue({
      code: 'custom',
      path: ['files', 'embeddings', 'bytes'],
      message: 'Vector bytes must equal trackCount × dimension × 4 without integer overflow',
    })
  }
})

const windowSchema = z.strictObject({
  startSeconds: z.number().nonnegative(),
  endSeconds: z.number().positive(),
}).refine((window) => window.endSeconds > window.startSeconds, 'Window end must follow its start')

export const catalogTrackSchema = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9._-]*:[a-zA-Z0-9][a-zA-Z0-9._-]*$/, 'Expected a namespaced stable source ID'),
  row: nonnegativeInteger,
  title: text,
  artist: text,
  album: text.optional(),
  recordingGroupId: text.optional(),
  provenance: z.strictObject({
    datasetId: text,
    datasetVersion: text,
    sourceRecordId: text,
    sourcePage: publicUrl,
    audioSha256: sha256,
    recordingLicense: licenseSchema,
    publicationBasis: text,
  }),
  coverage: z.strictObject({
    sourceDurationSeconds: z.number().positive(),
    analyzedWindows: z.array(windowSchema).min(1),
    describes: z.literal('available-audio-excerpt'),
  }),
}).superRefine((track, context) => {
  track.coverage.analyzedWindows.forEach((window, index) => {
    if (window.endSeconds > track.coverage.sourceDurationSeconds) {
      context.addIssue({ code: 'custom', path: ['coverage', 'analyzedWindows', index], message: 'Actual audio coverage cannot exceed source duration; omit padded time' })
    }
  })
})

export const catalogTracksSchema = z.array(catalogTrackSchema).min(1).superRefine((tracks, context) => {
  const seen = new Set<string>()
  tracks.forEach((track, index) => {
    if (track.row !== index) {
      context.addIssue({ code: 'custom', path: [index, 'row'], message: 'Row must equal the zero-based array index' })
    }
    if (seen.has(track.id)) {
      context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Stable IDs must be unique' })
    }
    seen.add(track.id)
  })
})

/** Structural metadata checks only. File hashes and vector values require export validation. */
export const catalogMetadataSchema = z.strictObject({
  manifest: catalogManifestSchema,
  tracks: catalogTracksSchema,
}).superRefine(({ manifest, tracks }, context) => {
  if (manifest.trackCount !== tracks.length) {
    context.addIssue({ code: 'custom', path: ['tracks'], message: 'Track count does not match manifest' })
  }
  tracks.forEach((track, index) => {
    if (!manifest.sources.some((source) => source.datasetId === track.provenance.datasetId && source.datasetVersion === track.provenance.datasetVersion)) {
      context.addIssue({ code: 'custom', path: ['tracks', index, 'provenance'], message: 'Track source must occur in manifest sources' })
    }
  })
})

export type CatalogPointer = z.infer<typeof catalogPointerSchema>
export type CatalogManifest = z.infer<typeof catalogManifestSchema>
export type CatalogTrack = z.infer<typeof catalogTrackSchema>
