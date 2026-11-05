import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { catalogPointerSchema } from './src/catalog/contract.ts'
import { validateArtifactBundle } from './scripts/catalog-validation.ts'
import { releaseBuild } from './scripts/release-build.ts'
import { catalogAssets } from './scripts/catalog-assets.ts'

// Validate committed public data at build time; runtime loading remains fail-closed.
const catalogRoot = new URL('./public/catalog/', import.meta.url)
const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(new URL('current.json', catalogRoot), 'utf8')))
if (pointer.status === 'ready') {
  const directory = new URL(`${pointer.catalogVersion}/`, catalogRoot)
  const read = (name: string) => readFileSync(new URL(name, directory))
  validateArtifactBundle({
    manifest: read('manifest.json'), tracks: read('tracks.json'),
    embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json'),
  }, { catalogVersion: pointer.catalogVersion, manifestSha256: pointer.manifestSha256 })
}

export default defineConfig({
  base: '/song-neighbors/',
  plugins: [react(), catalogAssets(), ...(pointer.status === 'ready' ? [releaseBuild(pointer)] : [])],
  // Pages upload excludes hidden paths, so keep the verified manifest publishable.
  build: { manifest: 'asset-manifest.json', copyPublicDir: false },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
