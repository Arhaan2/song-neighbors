import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'
import { catalogPointerSchema } from '../src/catalog/contract.ts'
import { validateArtifactBundle } from './catalog-validation.ts'

const root = 'dist'
const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(join(root, 'catalog/current.json'), 'utf8')))
assert.equal(pointer.status, 'ready', 'Public beta requires real catalog data')
if (pointer.status !== 'ready') throw new Error('Catalog is not ready')
const version = pointer.catalogVersion
const info = JSON.parse(readFileSync(join(root, 'build-info.json'), 'utf8'))
assert.equal(info.sourceSha, execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim())
assert.equal(info.catalogVersion, version)
assert.equal(info.catalogManifestSha256, pointer.manifestSha256)
assert.equal(info.basePath, '/song-neighbors/')
if (process.env.CI) assert.equal(info.sourceDirty, false)
const read = (name: string) => readFileSync(join(root, 'catalog', version, name))
validateArtifactBundle({ manifest: read('manifest.json'), tracks: read('tracks.json'), embeddings: read('embeddings.f32'), attribution: read('ATTRIBUTION.md'), build: read('build.json') }, pointer)
const allowed = new Set([
  'index.html', 'build-info.json', 'LICENSE.txt', 'THIRD_PARTY_NOTICES.md', 'THIRD_PARTY_LICENSES.txt',
  'asset-manifest.json', 'catalog/current.json', 'catalog/README.md',
  ...['manifest.json', 'tracks.json', 'embeddings.f32', 'ATTRIBUTION.md', 'build.json'].map(file => `catalog/${version}/${file}`),
])
const files: { path: string; bytes: number; sha256: string }[] = []
function scan(directory: string) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name), stat = lstatSync(path)
    assert(!stat.isSymbolicLink(), `Symlink in artifact: ${path}`)
    if (stat.isDirectory()) { scan(path); continue }
    const short = relative(root, path)
    assert(allowed.has(short) || /^assets\/[\w.-]+\.(js|css)$/.test(short), `Unexpected public artifact: ${short}`)
    const bytes = readFileSync(path)
    if (!short.endsWith('.f32')) {
      const text = bytes.toString('utf8')
      assert(!/(?:\/Users\/|\/home\/|\/private\/(?:tmp|var)\/|[A-Z]:\\Users\\)/.test(text), `Local path in ${short}`)
      assert(!/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16})/.test(text), `Secret pattern in ${short}`)
    }
    files.push({ path: short, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  }
}
scan(root)
for (const required of allowed) assert(files.some(file => file.path === required), `Missing artifact: ${required}`)
assert(files.some(file => /^assets\/recommend\.worker-/.test(file.path) || /^assets\/recommend_worker-/.test(file.path) || /worker.*\.js$/.test(file.path)), 'Missing worker')
for (const notice of ['LICENSE.txt', 'THIRD_PARTY_LICENSES.txt']) assert(readFileSync(join(root, notice), 'utf8').includes('Permission is hereby granted'))
console.log(JSON.stringify({ identity: info, files, totalBytes: files.reduce((sum, file) => sum + file.bytes, 0), result: 'passed' }, null, 2))
