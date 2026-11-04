import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { catalogPointerSchema, type CatalogManifest, type CatalogTrack } from '../src/catalog/contract.ts'
import { loadCatalog, sha256Bytes, validateCatalogData, type CatalogData } from '../src/catalog/load.ts'

const realRoot = new URL('../public/catalog/', import.meta.url)
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value))
const hashJson = (value: unknown) => sha256Bytes(encode(value))

async function realData() {
  const pointer = catalogPointerSchema.parse(JSON.parse(await readFile(new URL('current.json', realRoot), 'utf8')))
  if (pointer.status !== 'ready') throw new Error('Real catalog gate is not ready')
  const root = new URL(`${pointer.catalogVersion}/`, realRoot)
  const [manifest, tracks, embeddings, build] = await Promise.all(
    ['manifest.json', 'tracks.json', 'embeddings.f32', 'build.json'].map((name) => readFile(new URL(name, root))),
  )
  return { data: { manifest: manifest!, tracks: tracks!, embeddings: embeddings!, build: build! }, pointer }
}

type FixtureBuild = {
  schemaVersion: number
  configuration: Record<string, unknown>
  configurationSha256: string
  dependencyLockSha256: string
  rows: { id: string; audioSha256: string; configurationSha256: string; dependencyLockSha256: string; vectorSha256: string; norm: number }[]
}

// Synthetic integrity fixtures only. Reuse the approved analysis configuration to
// exercise its compatibility gate; these vectors are not music/model inference.
async function fixture(options: {
  vectors?: number[][]
  manifest?: (manifest: CatalogManifest) => void
  tracks?: (tracks: CatalogTrack[]) => void
  build?: (build: FixtureBuild) => void
} = {}) {
  const real = await realData()
  const manifest = JSON.parse(new TextDecoder().decode(real.data.manifest)) as CatalogManifest
  const originalBuild = JSON.parse(new TextDecoder().decode(real.data.build)) as FixtureBuild
  const tracks = (JSON.parse(new TextDecoder().decode(real.data.tracks)) as CatalogTrack[]).slice(0, 3).map((track, row) => ({
    ...track,
    id: `test:${row}`,
    title: `Synthetic loader fixture ${row}`,
    artist: 'Not a real recording',
    provenance: { ...track.provenance, publicationBasis: 'Test data only; never publish this as a music catalog.' },
  }))
  const rows = options.vectors ?? [[1, 0], [0.6, 0.8], [-1, 0]]
  const embeddings = new Uint8Array(rows.flat().length * 4)
  const view = new DataView(embeddings.buffer)
  rows.flat().forEach((value, index) => view.setFloat32(index * 4, value, true))
  manifest.catalogVersion = 'synthetic-loader-test'
  manifest.trackCount = tracks.length
  manifest.dimension = 2
  options.tracks?.(tracks)
  const build: FixtureBuild = {
    schemaVersion: 1,
    configuration: originalBuild.configuration,
    configurationSha256: originalBuild.configurationSha256,
    dependencyLockSha256: originalBuild.dependencyLockSha256,
    rows: await Promise.all(tracks.map(async (track, index) => {
      const bytes = embeddings.subarray(index * 8, (index + 1) * 8)
      const norm = Math.hypot(view.getFloat32(index * 8, true), view.getFloat32(index * 8 + 4, true))
      return {
        id: track.id,
        audioSha256: track.provenance.audioSha256,
        configurationSha256: originalBuild.configurationSha256,
        dependencyLockSha256: originalBuild.dependencyLockSha256,
        vectorSha256: await sha256Bytes(bytes),
        norm: Number.isFinite(norm) && norm > 0 ? norm : 1,
      }
    })),
  }
  options.build?.(build)
  const data = { manifest: new Uint8Array(), tracks: encode(tracks), embeddings, build: encode(build) }
  manifest.orderedIdsSha256 = await sha256Bytes(new TextEncoder().encode(`${tracks.map((track) => track.id).join('\n')}\n`))
  for (const key of ['tracks', 'embeddings', 'build'] as const) {
    manifest.files[key].bytes = data[key].byteLength
    manifest.files[key].sha256 = await sha256Bytes(data[key])
  }
  options.manifest?.(manifest)
  data.manifest = encode(manifest)
  const pointer = { schemaVersion: 1, status: 'ready', catalogVersion: manifest.catalogVersion, manifestSha256: await hashJson(manifest) }
  return { data, pointer }
}

describe('browser catalog integrity', () => {
  it('loads actual approved rows and normalizes once without changing row identities', async () => {
    const { data, pointer } = await realData()
    const catalog = await validateCatalogData(data, pointer)
    expect(catalog.tracks).toHaveLength(500)
    expect(catalog.dimension).toBe(512)
    expect(catalog.vectors).toHaveLength(500 * 512)
    expect(catalog.tracks[0]?.id).toBe('fma:003832')
    for (const track of catalog.tracks) {
      const row = catalog.vectors.subarray(track.row * catalog.dimension, (track.row + 1) * catalog.dimension)
      expect(Math.hypot(...row)).toBeCloseTo(1, 13)
    }
  })

  it('uses little-endian Float32 values and respects nonzero byte offsets', async () => {
    const { data, pointer } = await fixture()
    const offsetBytes = new Uint8Array(data.embeddings.length + 5)
    offsetBytes.set(data.embeddings, 3)
    data.embeddings = offsetBytes.subarray(3, data.embeddings.length + 3)
    const catalog = await validateCatalogData(data, pointer)
    expect(catalog.tracks.map((track) => [track.id, track.row])).toEqual([['test:0', 0], ['test:1', 1], ['test:2', 2]])
    expect([...catalog.vectors]).toEqual([1, 0, expect.closeTo(0.6, 7), expect.closeTo(0.8, 7), -1, 0])
  })

  it.each(['tracks', 'embeddings', 'build', 'manifest'] as const)('rejects corrupted %s bytes', async (key) => {
    const { data, pointer } = await fixture()
    data[key][0] = data[key][0]! ^ 1
    await expect(validateCatalogData(data, pointer)).rejects.toMatchObject({ code: 'invalid-catalog' })
  })

  it.each([0, NaN, Infinity, 2])('rejects zero, nonfinite or nonnormalized vectors even with matching hashes (%s)', async (value) => {
    const { data, pointer } = await fixture({ vectors: [[value, 0], [0, 1], [-1, 0]] })
    await expect(validateCatalogData(data, pointer)).rejects.toThrow(/nonfinite|zero or nonnormalized/)
  })

  it('rejects byte-count, dimension, track-count and source/row identity mismatches', async () => {
    const cases = [
      await fixture({ manifest: (manifest) => { manifest.files.embeddings.bytes += 4 } }),
      await fixture({ manifest: (manifest) => { manifest.dimension = 3 } }),
      await fixture({ manifest: (manifest) => { manifest.trackCount = 4; manifest.files.embeddings.bytes = 32 } }),
      await fixture({ tracks: (tracks) => { tracks[1]!.row = 2 } }),
      await fixture({ tracks: (tracks) => { tracks[1]!.id = tracks[0]!.id } }),
      await fixture({ tracks: (tracks) => { tracks[0]!.provenance.datasetId = 'missing-source' } }),
      await fixture({ tracks: (tracks) => { tracks[0]!.id = 'test:z' } }),
      await fixture({ build: (build) => { build.rows[0]!.id = 'test:wrong' } }),
      await fixture({ build: (build) => { build.rows.pop() } }),
      await fixture({ manifest: (manifest) => { manifest.orderedIdsSha256 = 'a'.repeat(64) } }),
    ]
    for (const { data, pointer } of cases) await expect(validateCatalogData(data, pointer)).rejects.toMatchObject({ code: 'invalid-catalog' })
  })

  it('rejects rejected models, changed preprocessing and mixed row configurations with coherent outer hashes', async () => {
    const cases = [
      await fixture({ manifest: (manifest) => { manifest.encoder.id = 'laion/larger_clap_music' } }),
      await fixture({ manifest: (manifest) => { manifest.preprocessing.sampleRateHz = 16000 } }),
      await fixture({ build: (build) => { build.configurationSha256 = 'b'.repeat(64) } }),
      await fixture({ build: (build) => { build.rows[0]!.configurationSha256 = 'b'.repeat(64) } }),
      await fixture({ build: (build) => { build.rows[0]!.vectorSha256 = 'b'.repeat(64) } }),
    ]
    for (const { data, pointer } of cases) await expect(validateCatalogData(data, pointer)).rejects.toMatchObject({ code: 'invalid-catalog' })
  })
})

describe('static catalog fetching', () => {
  it('keeps all fetches under the GitHub Pages base and fetches vectors once', async () => {
    const { data, pointer } = await fixture()
    const root = 'https://example.org/song-neighbors/catalog/'
    const files = new Map<string, Uint8Array>([[`${root}current.json`, encode(pointer)]])
    const names: Record<keyof CatalogData, string> = { manifest: 'manifest.json', tracks: 'tracks.json', embeddings: 'embeddings.f32', build: 'build.json' }
    for (const key of Object.keys(names) as (keyof CatalogData)[]) files.set(`${root}${pointer.catalogVersion}/${names[key]}`, data[key])
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      const bytes = files.get(String(input))
      return bytes ? new Response(new Uint8Array(bytes)) : new Response(null, { status: 404 })
    })
    const result = await loadCatalog(root.slice(0, -1), fetcher)
    expect(result.tracks).toHaveLength(3)
    expect(fetcher).toHaveBeenCalledTimes(5)
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('embeddings.f32'))).toHaveLength(1)
    expect(fetcher.mock.calls[0]?.[1]).toEqual({ cache: 'no-cache' })
  })

  it('distinguishes not-ready, HTTP/network, and invalid JSON responses', async () => {
    const root = 'https://example.org/song-neighbors/catalog/'
    await expect(loadCatalog(root, async () => new Response(encode({ schemaVersion: 1, status: 'not-ready', reason: 'Real data unavailable' })))).rejects.toMatchObject({ code: 'not-ready', message: 'Real data unavailable' })
    await expect(loadCatalog(root, async () => new Response(null, { status: 404 }))).rejects.toMatchObject({ code: 'network' })
    await expect(loadCatalog(root, async () => { throw new Error('Disconnected') })).rejects.toMatchObject({ code: 'network', message: 'Disconnected' })
    await expect(loadCatalog(root, async () => new Response('<html>'))).rejects.toMatchObject({ code: 'invalid-catalog' })
    await expect(loadCatalog('/catalog/')).rejects.toMatchObject({ code: 'invalid-catalog' })
  })

  it('does not fetch vector assets when pointer or manifest identity fails', async () => {
    const { data, pointer } = await fixture()
    pointer.manifestSha256 = 'f'.repeat(64)
    const fetcher = vi.fn<typeof fetch>(async (input) => new Response(new Uint8Array(String(input).endsWith('current.json') ? encode(pointer) : data.manifest)))
    await expect(loadCatalog('https://example.org/song-neighbors/catalog/', fetcher)).rejects.toThrow('Manifest hash mismatch')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
