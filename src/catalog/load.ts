import { z } from 'zod'
import {
  catalogManifestSchema,
  catalogMetadataSchema,
  catalogPointerSchema,
  type CatalogManifest,
  type CatalogTrack,
} from './contract.ts'

export type LoadedCatalog = {
  manifest: CatalogManifest
  tracks: CatalogTrack[]
  dimension: number
  /** Float32 export rows validated first, then normalized once in double precision. */
  vectors: Float64Array
}

export type CatalogData = {
  manifest: Uint8Array
  tracks: Uint8Array
  embeddings: Uint8Array
  build: Uint8Array
}

export class CatalogLoadError extends Error {
  readonly code: 'not-ready' | 'invalid-catalog' | 'network'

  constructor(code: CatalogLoadError['code'], message: string) {
    super(message)
    this.name = 'CatalogLoadError'
    this.code = code
  }
}

// Phase 1's audited trained model + exact preprocessing/runtime/aggregation identity.
// A new compatible catalog may add recordings, but a new analysis configuration
// must be explicitly reviewed before extending this supported set.
export const SUPPORTED_CONFIGURATION_SHA256 = 'df676ec4a59e37f6abff6084a2a5ea1d9f175a9c953e8864afe531f5bddfe2eb'

const digest = z.string().regex(/^[a-f0-9]{64}$/)
const buildIdentitySchema = z.object({
  schemaVersion: z.literal(1),
  configuration: z.record(z.string(), z.unknown()),
  configurationSha256: digest,
  dependencyLockSha256: digest,
  rows: z.array(z.object({
    id: z.string(),
    audioSha256: digest,
    configurationSha256: digest,
    dependencyLockSha256: digest,
    vectorSha256: digest,
    norm: z.number().positive(),
  })),
})

function requireThat(condition: boolean, message: string): asserts condition {
  if (!condition) throw new CatalogLoadError('invalid-catalog', message)
}

function json(bytes: Uint8Array): unknown {
  requireThat(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), 'UTF-8 BOM is not permitted')
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  }
  const encoded = JSON.stringify(value)
  requireThat(encoded !== undefined, 'Non-JSON configuration')
  return encoded
}

export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  // A copy also makes views with nonzero byte offsets and SharedArrayBuffer safe.
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
}

async function sha256Text(value: string): Promise<string> {
  return sha256Bytes(new TextEncoder().encode(value))
}

function invalid(error: unknown): CatalogLoadError {
  return error instanceof CatalogLoadError
    ? error
    : new CatalogLoadError('invalid-catalog', error instanceof Error ? error.message : 'Invalid catalog')
}

/** Browser integrity checks; the offline validator remains the publication gate. */
export async function validateCatalogData(
  data: CatalogData,
  expected: { catalogVersion: string; manifestSha256: string },
): Promise<LoadedCatalog> {
  try {
    requireThat(await sha256Bytes(data.manifest) === expected.manifestSha256, 'Manifest hash mismatch')
    const { manifest, tracks } = catalogMetadataSchema.parse({ manifest: json(data.manifest), tracks: json(data.tracks) })
    requireThat(manifest.catalogVersion === expected.catalogVersion, 'Catalog version mismatch')
    for (const key of ['tracks', 'embeddings', 'build'] as const) {
      requireThat(data[key].byteLength === manifest.files[key].bytes, `${key}: byte count mismatch`)
      requireThat(await sha256Bytes(data[key]) === manifest.files[key].sha256, `${key}: hash mismatch`)
    }
    requireThat(tracks.every((track, index) => index === 0 || tracks[index - 1]!.id < track.id), 'Track IDs must be sorted bytewise')
    requireThat(await sha256Text(`${tracks.map((track) => track.id).join('\n')}\n`) === manifest.orderedIdsSha256, 'Ordered ID hash mismatch')

    const configuration = {
      encoder: manifest.encoder,
      preprocessing: manifest.preprocessing,
      windowing: manifest.windowing,
      aggregation: manifest.aggregation,
    }
    const configurationHash = await sha256Text(canonicalJson(configuration))
    requireThat(configurationHash === SUPPORTED_CONFIGURATION_SHA256, 'Unsupported analysis configuration (model, preprocessing or aggregation)')
    const build = buildIdentitySchema.parse(json(data.build))
    requireThat(build.configurationSha256 === configurationHash && canonicalJson(build.configuration) === canonicalJson(configuration), 'Manifest/build configuration mismatch')
    requireThat(build.dependencyLockSha256 === manifest.preprocessing.dependencyLockSha256, 'Dependency lock mismatch')
    requireThat(build.rows.length === tracks.length, 'Build row count mismatch')

    // Decode explicitly little-endian on every host, retaining the exact source row.
    const source = new DataView(data.embeddings.buffer, data.embeddings.byteOffset, data.embeddings.byteLength)
    const vectors = new Float64Array(tracks.length * manifest.dimension)
    const rowBytes = manifest.dimension * 4
    for (const track of tracks) {
      const row = build.rows[track.row]!
      requireThat(row.id === track.id && row.audioSha256 === track.provenance.audioSha256, `${track.id}: build row identity mismatch`)
      requireThat(row.configurationSha256 === configurationHash && row.dependencyLockSha256 === build.dependencyLockSha256, `${track.id}: mixed row configuration`)
      requireThat(await sha256Bytes(data.embeddings.subarray(track.row * rowBytes, (track.row + 1) * rowBytes)) === row.vectorSha256, `${track.id}: vector row hash mismatch`)
      let normSquared = 0
      const offset = track.row * manifest.dimension
      for (let column = 0; column < manifest.dimension; column++) {
        const value = source.getFloat32((offset + column) * 4, true)
        requireThat(Number.isFinite(value), `${track.id}: nonfinite vector`)
        vectors[offset + column] = value
        normSquared += value * value
      }
      const norm = Math.sqrt(normSquared)
      requireThat(norm > 0 && Math.abs(norm - 1) <= manifest.vectors.normTolerance, `${track.id}: zero or nonnormalized vector`)
      requireThat(Math.abs(norm - row.norm) <= 1e-7, `${track.id}: recorded norm mismatch`)
      for (let column = 0; column < manifest.dimension; column++) vectors[offset + column] = vectors[offset + column]! / norm
    }
    return { manifest, tracks, dimension: manifest.dimension, vectors }
  } catch (error) {
    throw invalid(error)
  }
}

/** Pass an absolute catalog directory URL built from Vite's BASE_URL. */
export async function loadCatalog(catalogRoot: string | URL, fetcher: typeof fetch = fetch): Promise<LoadedCatalog> {
  let root: URL
  try {
    root = new URL(catalogRoot)
    requireThat(['http:', 'https:'].includes(root.protocol) && !root.username && !root.password && !root.search && !root.hash, 'Expected an absolute HTTP(S) catalog directory URL without credentials, query or fragment')
    if (!root.pathname.endsWith('/')) root.pathname += '/'
  } catch (error) {
    throw invalid(error)
  }

  async function read(url: URL, mutable = false): Promise<Uint8Array> {
    try {
      const response = await fetcher(url, { cache: mutable ? 'no-cache' : 'default' })
      if (!response.ok) throw new Error(`Catalog request failed (${response.status}): ${url.pathname}`)
      return new Uint8Array(await response.arrayBuffer())
    } catch (error) {
      throw new CatalogLoadError('network', error instanceof Error ? error.message : 'Catalog request failed')
    }
  }

  try {
    const pointer = catalogPointerSchema.parse(json(await read(new URL('current.json', root), true)))
    if (pointer.status === 'not-ready') throw new CatalogLoadError('not-ready', pointer.reason)
    const versionRoot = new URL(`${pointer.catalogVersion}/`, root)
    const manifestBytes = await read(new URL('manifest.json', versionRoot))
    requireThat(await sha256Bytes(manifestBytes) === pointer.manifestSha256, 'Manifest hash mismatch')
    const manifest = catalogManifestSchema.parse(json(manifestBytes))
    requireThat(manifest.catalogVersion === pointer.catalogVersion, 'Catalog version mismatch')
    const [tracks, embeddings, build] = await Promise.all([
      read(new URL(manifest.files.tracks.path, versionRoot)),
      read(new URL(manifest.files.embeddings.path, versionRoot)),
      read(new URL(manifest.files.build.path, versionRoot)),
    ])
    return await validateCatalogData({ manifest: manifestBytes, tracks, embeddings, build }, pointer)
  } catch (error) {
    throw invalid(error)
  }
}
