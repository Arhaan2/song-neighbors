import { afterEach, describe, expect, it } from 'vitest'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { activeCatalogAssets } from '../scripts/catalog-assets.ts'

const temporary: string[] = []
afterEach(() => { temporary.forEach(root => rmSync(root, { recursive: true, force: true })); temporary.length = 0 })
function source() {
  const root = mkdtempSync(join(tmpdir(), 'song-neighbors-stage-'))
  temporary.push(root)
  cpSync('public/catalog', join(root, 'catalog'), { recursive: true })
  const pointer = JSON.parse(readFileSync(join(root, 'catalog/current.json'), 'utf8')) as { catalogVersion: string }
  return { root, version: pointer.catalogVersion }
}

describe('active-only catalog staging', () => {
  it('emits only the validated active version and derives coverage notices from its actual metadata', () => {
    const { root, version } = source()
    const historical = join(root, 'catalog', 'historical-not-published')
    mkdirSync(historical)
    writeFileSync(join(historical, 'private-fixture.txt'), 'An obsolete test artifact must never ship')
    const assets = activeCatalogAssets(root)
    expect([...assets.keys()].sort()).toEqual([
      'catalog/README.md', 'catalog/current.json',
      ...['ATTRIBUTION.md', 'build.json', 'embeddings.f32', 'manifest.json', 'tracks.json'].map(name => `catalog/${version}/${name}`),
    ].sort())
    for (const name of ['ATTRIBUTION.md', 'build.json', 'embeddings.f32', 'manifest.json', 'tracks.json']) {
      expect(Buffer.from(assets.get(`catalog/${version}/${name}`)!)).toEqual(readFileSync(join(root, 'catalog', version, name)))
    }
    const manifest = JSON.parse(readFileSync(join(root, 'catalog', version, 'manifest.json'), 'utf8'))
    expect(new TextDecoder().decode(assets.get('catalog/README.md'))).toContain(`${manifest.trackCount} analyzed recordings`)
    expect([...assets.keys()].some(name => name.includes('historical-not-published'))).toBe(false)
    expect(readFileSync(join(historical, 'private-fixture.txt'), 'utf8')).toContain('must never ship')
  })
  it('rejects unlisted public source files, active extras, symlinks and corrupted active bytes', () => {
    for (const mutation of ['root-extra', 'active-extra', 'symlink', 'corrupt'] as const) {
      const { root, version } = source()
      const vector = join(root, 'catalog', version, 'embeddings.f32')
      if (mutation === 'root-extra') writeFileSync(join(root, 'unreviewed.txt'), 'no')
      if (mutation === 'active-extra') writeFileSync(join(root, 'catalog', version, 'unreviewed.txt'), 'no')
      if (mutation === 'symlink') { rmSync(vector); symlinkSync(join(root, 'catalog/current.json'), vector) }
      if (mutation === 'corrupt') writeFileSync(vector, Buffer.from([0, 0, 0, 0]))
      expect(() => activeCatalogAssets(root), mutation).toThrow()
    }
  })
})
