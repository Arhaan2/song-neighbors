import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import type { Plugin } from 'vite'

/** Build identity is taken from the checked-out source, never a release label. */
export function releaseBuild(catalog: { catalogVersion: string; manifestSha256: string }): Plugin {
  return {
    name: 'release-identity-and-notices',
    apply: 'build',
    generateBundle() {
      const sourceSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
      const sourceDirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim().length > 0
      if (process.env.CI && (sourceDirty || (process.env.GITHUB_SHA && process.env.GITHUB_SHA !== sourceSha))) {
        throw new Error('Release builds require a clean checkout of the workflow source SHA')
      }
      this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({
        schemaVersion: 1, sourceSha, sourceDirty, catalogVersion: catalog.catalogVersion,
        catalogManifestSha256: catalog.manifestSha256, basePath: '/song-neighbors/',
      }, null, 2) + '\n' })
      for (const [fileName, sourcePath] of [['LICENSE.txt', 'LICENSE'], ['THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_NOTICES.md']]) {
        this.emitFile({ type: 'asset', fileName, source: readFileSync(sourcePath!, 'utf8') })
      }
      const licenses = ['react', 'react-dom', 'scheduler', 'zod'].map(name =>
        `## ${name}\n\n${readFileSync(`node_modules/${name}/LICENSE`, 'utf8')}`,
      ).join('\n\n')
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_LICENSES.txt', source: licenses })
    },
  }
}
