import assert from 'node:assert/strict'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { catalogMetadataSchema, catalogPointerSchema } from '../src/catalog/contract.ts'
import { validateArtifactBundle } from './catalog-validation.ts'
import { validateCatalogRelease } from './catalog-release-evidence.ts'

const artifactNames = ['manifest.json', 'tracks.json', 'embeddings.f32', 'build.json', 'ATTRIBUTION.md']
const safeVersion = /^[a-z0-9][a-z0-9_-]*$/

function regular(path: string, directory = false) {
  const stat = lstatSync(path)
  assert(!stat.isSymbolicLink() && (directory ? stat.isDirectory() : stat.isFile()), `Expected a regular ${directory ? 'directory' : 'file'}: ${path}`)
}

/** The only public-source files a production build is permitted to emit. */
export function activeCatalogAssets(publicRoot: string): Map<string, Uint8Array> {
  regular(publicRoot, true)
  assert.deepEqual(readdirSync(publicRoot).sort(), ['catalog'], 'Unexpected public root entry; declare assets explicitly instead of copying public/')
  const root = join(publicRoot, 'catalog')
  regular(root, true)
  for (const name of readdirSync(root)) {
    if (name === 'current.json' || name === 'README.md') regular(join(root, name))
    else {
      assert(safeVersion.test(name), `Unexpected public catalog entry: ${name}`)
      regular(join(root, name), true)
    }
  }
  const pointerBytes = readFileSync(join(root, 'current.json'))
  const pointer = catalogPointerSchema.parse(JSON.parse(pointerBytes.toString('utf8')))
  const files = new Map<string, Uint8Array>([['catalog/current.json', pointerBytes]])
  if (pointer.status !== 'ready') {
    files.set('catalog/README.md', new TextEncoder().encode('# Catalog unavailable\n\nNo analyzed catalog is active. See current.json for the recorded status.\n'))
    return files
  }
  const directory = join(root, pointer.catalogVersion)
  regular(directory, true)
  assert.deepEqual(readdirSync(directory).sort(), [...artifactNames].sort(), 'Missing or unexpected active catalog artifact')
  const read = (name: string) => { const path = join(directory, name); regular(path); return readFileSync(path) }
  const bundle = {
    manifest: read('manifest.json'), tracks: read('tracks.json'), embeddings: read('embeddings.f32'),
    attribution: read('ATTRIBUTION.md'), build: read('build.json'),
  }
  validateArtifactBundle(bundle, pointer)
  validateCatalogRelease(bundle)
  const { manifest, tracks } = catalogMetadataSchema.parse({ manifest: JSON.parse(bundle.manifest.toString('utf8')), tracks: JSON.parse(bundle.tracks.toString('utf8')) })
  const count = new Set(tracks.map(track => track.artist)).size
  files.set('catalog/README.md', new TextEncoder().encode([
    '# Active catalog', '',
    `current.json selects ${manifest.catalogVersion}: ${manifest.trackCount} analyzed recordings, ${count} artist display names, ${manifest.dimension} dimensions.`, '',
    `Encoder: ${manifest.encoder.id} at ${manifest.encoder.revision}.`, '',
    `Only this active version is included in the website. [Recording credits and licenses](${manifest.catalogVersion}/ATTRIBUTION.md) retain applicable source terms. Numerical embeddings describe the supplied excerpts and recorded windows, not necessarily whole songs.`, '',
    'The application’s software license does not relicense recordings, metadata, model weights or derived catalog data. No raw audio or model weights are distributed.', '',
    'Application and bundled-software notices: [LICENSE.txt](../LICENSE.txt), [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).', '',
  ].join('\n')))
  for (const [name, bytes] of Object.entries({ 'manifest.json': bundle.manifest, 'tracks.json': bundle.tracks, 'embeddings.f32': bundle.embeddings, 'build.json': bundle.build, 'ATTRIBUTION.md': bundle.attribution })) {
    files.set(`catalog/${pointer.catalogVersion}/${name}`, bytes)
  }
  return files
}

/** Pair with build.copyPublicDir=false. Development public-file serving remains unchanged. */
export function catalogAssets(): Plugin {
  let publicRoot: string
  return {
    name: 'active-catalog-assets',
    apply: 'build',
    configResolved(config) {
      assert.equal(config.build.copyPublicDir, false, 'Active catalog staging requires build.copyPublicDir=false')
      assert(config.publicDir, 'Active catalog staging requires the repository public directory')
      publicRoot = config.publicDir
    },
    generateBundle() {
      for (const [fileName, source] of activeCatalogAssets(publicRoot)) this.emitFile({ type: 'asset', fileName, source })
    },
  }
}
