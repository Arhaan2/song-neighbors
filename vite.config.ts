import { readFileSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { catalogPointerSchema } from './src/catalog/contract.ts'
import { validateArtifactBundle } from './scripts/catalog-validation.ts'

// The public screen remains the Phase 1 status view until Phase 3.
const catalogRoot = new URL('./public/catalog/', import.meta.url)
const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(new URL('current.json', catalogRoot), 'utf8')))
const summary = (() => {
  if (pointer.status === 'not-ready') return { trackCount: 0, artistCount: 0, catalogVersion: null }
  const directory = new URL(`${pointer.catalogVersion}/`, catalogRoot)
  const read = (name: string) => readFileSync(new URL(name, directory))
  const result = validateArtifactBundle({
    manifest: read('manifest.json'), tracks: read('tracks.json'),
    embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json'),
  }, { catalogVersion: pointer.catalogVersion, manifestSha256: pointer.manifestSha256 })
  return { trackCount: result.trackCount, artistCount: result.artistCount, catalogVersion: result.catalogVersion }
})()

export default defineConfig({
  base: '/song-neighbors/',
  plugins: [react()],
  define: { __CATALOG_SUMMARY__: JSON.stringify(summary) },
  // Ship a callable engine entry for production-worker verification before the Phase 3 UI.
  build: {
    manifest: true,
    rolldownOptions: {
      input: { main: 'index.html', 'recommendation-engine': 'src/recommend/browser.ts' },
      preserveEntrySignatures: 'strict',
    },
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
})
