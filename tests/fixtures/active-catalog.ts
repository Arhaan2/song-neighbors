import { readFileSync } from 'node:fs'
import { catalogMetadataSchema, catalogPointerSchema } from '../../src/catalog/contract.ts'
import { validateCatalogData } from '../../src/catalog/load.ts'

/** Active integration/browser fixtures follow the pointer; historical oracles stay explicitly pinned. */
export function activeTestCatalog() {
  const root = new URL('../../public/catalog/', import.meta.url)
  const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(new URL('current.json', root), 'utf8')))
  if (pointer.status !== 'ready') throw new Error('Integration fixtures require a real ready catalog')
  const directory = new URL(`${pointer.catalogVersion}/`, root)
  const manifestBytes = readFileSync(new URL('manifest.json', directory))
  const tracksBytes = readFileSync(new URL('tracks.json', directory))
  const { manifest, tracks } = catalogMetadataSchema.parse({
    manifest: JSON.parse(manifestBytes.toString('utf8')),
    tracks: JSON.parse(tracksBytes.toString('utf8')),
  })
  return { pointer, manifest, tracks, directory, manifestBytes, tracksBytes }
}

export async function validatedActiveTestCatalog() {
  const { pointer, directory, manifestBytes, tracksBytes } = activeTestCatalog()
  return validateCatalogData({
    manifest: manifestBytes, tracks: tracksBytes,
    embeddings: readFileSync(new URL('embeddings.f32', directory)),
    build: readFileSync(new URL('build.json', directory)),
  }, pointer)
}
