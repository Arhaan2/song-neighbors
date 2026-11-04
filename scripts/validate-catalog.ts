import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { catalogPointerSchema } from '../src/catalog/contract.ts'
import { validateArtifactBundle } from './catalog-validation.ts'

const args = process.argv.slice(2)
let root = resolve('public/catalog')
let version: string | undefined
let requireReady = false
for (let index = 0; index < args.length; index++) {
  const argument = args[index]
  if (argument === '--root' && args[index + 1]) root = resolve(args[++index]!)
  else if (argument === '--version' && args[index + 1]) version = args[++index]
  else if (argument === '--require-ready') requireReady = true
  else throw new Error(`Unknown or incomplete option: ${argument}`)
}
const safeVersion = /^[a-z0-9][a-z0-9_-]*$/
const files = ['manifest.json', 'tracks.json', 'embeddings.f32', 'ATTRIBUTION.md', 'build.json']
function validateVersion(name: string, manifestSha256?: string) {
  if (!safeVersion.test(name)) throw new Error('Invalid catalog version')
  const directory = join(root, name)
  if (lstatSync(directory).isSymbolicLink()) throw new Error('Catalog directory cannot be a symlink')
  const entries = readdirSync(directory).sort()
  if (JSON.stringify(entries) !== JSON.stringify([...files].sort())) throw new Error(`${name}: missing or unexpected public files`)
  for (const file of files) {
    if (!lstatSync(join(directory, file)).isFile() || lstatSync(join(directory, file)).isSymbolicLink()) throw new Error(`${name}: artifact must be a regular file`)
  }
  return validateArtifactBundle({
    manifest: readFileSync(join(directory, 'manifest.json')),
    tracks: readFileSync(join(directory, 'tracks.json')),
    embeddings: readFileSync(join(directory, 'embeddings.f32')),
    attribution: readFileSync(join(directory, 'ATTRIBUTION.md')),
    build: readFileSync(join(directory, 'build.json')),
  }, { catalogVersion: name, manifestSha256 })
}

try {
  if (version && requireReady) throw new Error('--version and --require-ready cannot be combined')
  if (version) console.log(JSON.stringify(validateVersion(version)))
  else {
    const pointerFile = lstatSync(join(root, 'current.json'))
    if (!pointerFile.isFile() || pointerFile.isSymbolicLink()) throw new Error('Current pointer must be a regular file')
    const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(join(root, 'current.json'), 'utf8')))
    const versions = readdirSync(root).filter((name) => !['README.md', 'current.json'].includes(name))
    for (const name of versions) {
      if (!lstatSync(join(root, name)).isDirectory()) throw new Error(`Unexpected public catalog artifact: ${name}`)
      const hash = pointer.status === 'ready' && name === pointer.catalogVersion ? pointer.manifestSha256 : undefined
      console.log(JSON.stringify(validateVersion(name, hash)))
    }
    if (pointer.status === 'ready' && !versions.includes(pointer.catalogVersion)) throw new Error('Active catalog version is missing')
    if (pointer.status === 'not-ready') {
      console.log(JSON.stringify({ status: 'not-ready', realCatalogValidated: false, reason: pointer.reason }))
      if (requireReady) throw new Error('A ready real catalog is required')
    }
  }
} catch (error) {
  console.error(`Catalog validation failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
