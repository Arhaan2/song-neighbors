import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { catalogMetadataSchema, catalogPointerSchema, catalogTracksSchema } from '../../src/catalog/contract.ts'
import { validateCatalogData } from '../../src/catalog/load.ts'
import { createRecommendationEngine } from '../../src/recommend/engine.ts'
import { historicalCatalogVersion, validateCatalogRelease } from '../../scripts/catalog-release-evidence.ts'

const artifactRoot = process.env.RELEASE_ARTIFACT_DIR ?? 'dist'
const expectedBuild = JSON.parse(readFileSync(join(artifactRoot, 'build-info.json'), 'utf8'))
const pointer = catalogPointerSchema.parse(JSON.parse(readFileSync(join(artifactRoot, 'catalog/current.json'), 'utf8')))
if (pointer.status !== 'ready') throw new Error('Release browser verification requires a ready catalog')
const read = (name: string) => readFileSync(join(artifactRoot, 'catalog', pointer.catalogVersion, name))
const bundle = {
  manifest: read('manifest.json'), tracks: read('tracks.json'), embeddings: read('embeddings.f32'),
  build: read('build.json'), attribution: read('ATTRIBUTION.md'),
}
const { manifest, tracks } = catalogMetadataSchema.parse({ manifest: JSON.parse(bundle.manifest.toString('utf8')), tracks: JSON.parse(bundle.tracks.toString('utf8')) })
const releaseEvidence = validateCatalogRelease(bundle)
const engine = validateCatalogData(bundle, pointer).then(createRecommendationEngine)
// This baseline is intentionally historical: it identifies genuine additions, not the active fixtures.
const historicalIds = new Set(catalogTracksSchema.parse(JSON.parse(readFileSync(`public/catalog/${historicalCatalogVersion}/tracks.json`, 'utf8'))).map(track => track.id))
const addition = tracks.find(track => !historicalIds.has(track.id))
if (releaseEvidence.kind === 'expanded' && !addition) throw new Error('Expanded release must exercise a genuinely new recording')
const seeds = [addition?.id ?? 'fma:045099', 'fma:003832', 'fma:003950', 'fma:004037', 'fma:004070']

test('public release: anonymous real product flow and exact artifact identity', async ({ page, context }, info) => {
  test.setTimeout(60_000) // Public HTTP checks include every released artifact file.
  const errors: string[] = [], failed: string[] = [], urls: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  context.on('requestfailed', request => failed.push(`${request.url()}: ${request.failure()?.errorText}`))
  // A browser refresh can legitimately revalidate cached assets with HTTP 304.
  context.on('response', response => { urls.push(response.url()); if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`) })
  expect(await context.cookies()).toEqual([])
  const start = performance.now()
  await page.goto('./')
  await expect(page.getByRole('combobox')).toBeEnabled()
  const navigationToReadyMs = performance.now() - start
  const byId = new Map(tracks.map(track => [track.id, track]))
  const ids = () => page.getByTestId('recommendation-card').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-track-id')!))
  const rankTimes: number[] = []
  for (const [index, id] of seeds.entries()) {
    const track = byId.get(id)!
    await page.getByRole('combobox').fill(`${track.title} ${track.artist}`)
    await page.locator(`[role="option"][data-track-id="${id}"]`).click()
    await expect(page.getByTestId('seed-chip')).toHaveCount(index + 1)
    if (index === 0 || index === 4) {
      const rankStart = performance.now()
      await page.getByRole('button', { name: 'Recommend', exact: true }).click()
      await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
      rankTimes.push(performance.now() - rankStart)
      expect(await ids()).toEqual((await engine).query({ seedIds: seeds.slice(0, index + 1) }).recommendations.map(row => row.id))
    }
  }
  await page.getByRole('combobox').fill('')
  const baseline = await ids()
  expect(new Set(baseline).size).toBe(20)
  const adaptive = page.getByTestId('discovery-composition')
  await expect(adaptive).toHaveAttribute('data-stage', 'blend')
  await page.getByRole('button', { name: 'Plain list', exact: true }).click()
  await expect(adaptive).toHaveCount(0)
  expect(await ids()).toEqual(baseline)
  await page.getByRole('button', { name: 'Adaptive', exact: true }).click()
  await expect(adaptive).toHaveAttribute('data-stage', 'blend')
  expect(await ids()).toEqual(baseline)
  expect(baseline.some(id => seeds.includes(id))).toBe(false)
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /More like this/ }).click()
  await expect(page.getByTestId('feedback-positive')).toBeVisible()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  expect(await ids()).not.toContain(baseline[0])
  const rejected = (await ids())[0]!
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /Not this mood/ }).click()
  await expect(page.getByTestId('feedback-negative')).toBeVisible()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  expect(await ids()).not.toContain(rejected)
  await page.getByRole('heading', { name: 'Your recommendations', exact: true }).scrollIntoViewIfNeeded()
  await info.attach('refined-product', { body: await page.screenshot(), contentType: 'image/png' })
  await page.getByRole('button', { name: 'Reset refinement', exact: true }).click()
  await expect.poll(ids).toEqual(baseline)
  await expect(page.getByTestId('seed-chip')).toHaveCount(5)
  await page.reload()
  await expect(page.getByRole('combobox')).toBeEnabled()
  await expect(page.getByTestId('seed-chip')).toHaveCount(0)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await page.getByRole('combobox').fill('zzzz-unavailable-song-zzzz')
  await expect(page.getByText('No songs found here')).toBeVisible()
  await page.getByText('About Song Neighbors & the catalog', { exact: true }).click()
  const credits = page.getByRole('link', { name: /Catalog credits, recording licenses/ })
  expect((await context.request.get((await credits.getAttribute('href'))!)).ok()).toBe(true)
  const buildResponse = await context.request.get('build-info.json')
  expect(buildResponse.ok()).toBe(true)
  const liveBuild = await buildResponse.json()
  expect(liveBuild).toEqual(expectedBuild)
  if (process.env.RELEASE_BASE_URL) expect(liveBuild.sourceDirty).toBe(false)
  const artifactFiles: string[] = []
  function collect(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) collect(path)
      else artifactFiles.push(relative(artifactRoot, path))
    }
  }
  collect(artifactRoot)
  const shippedVersions = new Set(artifactFiles.flatMap(file => file.startsWith('catalog/') && file.split('/').length > 2 ? [file.split('/')[1]] : []))
  expect([...shippedVersions]).toEqual([pointer.catalogVersion])
  // Preview servers may send the SPA shell with HTTP 200 for missing files. Require
  // that obsolete catalog URLs return only a missing response or that exact shell.
  for (const entry of readdirSync('public/catalog', { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === pointer.catalogVersion) continue
    for (const name of ['manifest.json', 'tracks.json', 'embeddings.f32', 'build.json', 'ATTRIBUTION.md']) {
      const response = await context.request.get(`catalog/${entry.name}/${name}`)
      if (response.ok()) expect(await response.body()).toEqual(readFileSync(join(artifactRoot, 'index.html')))
      else expect(response.status()).toBe(404)
    }
  }
  for (const file of artifactFiles) {
    const response = await context.request.get(file)
    expect(response.ok(), file).toBe(true)
    const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
    expect(hash(await response.body()), file).toBe(hash(readFileSync(join(artifactRoot, file))))
  }
  expect(urls.some(url => /worker.*\.js$/.test(url))).toBe(true)
  for (const file of ['current.json', 'manifest.json', 'tracks.json', 'embeddings.f32', 'build.json']) expect(urls.some(url => url.endsWith(file)), file).toBe(true)
  expect(urls.every(url => url.startsWith(info.project.use.baseURL!))).toBe(true)
  expect(errors).toEqual([])
  expect(failed).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await info.attach('release-evidence', { body: JSON.stringify({
    url: info.project.use.baseURL, viewport: info.project.use.viewport, browser: page.context().browser()?.version(),
    identity: liveBuild, navigationToReadyMs, clickTo20VisibleMs: rankTimes,
    timingNote: 'Single unthrottled run; wall time includes Playwright actions/assertion polling, worker validation, network and rendering. Not a universal latency promise.',
    catalogVersion: manifest.catalogVersion, trackCount: manifest.trackCount, releaseEvidence,
    expandedSeedVerified: releaseEvidence.kind === 'expanded', newRecordingSeed: addition?.id ?? null,
    seeds, baseline, positive: baseline[0], rejected, comparedArtifactFiles: artifactFiles.length,
    anonymousContext: true, resetExact: true, refreshCleared: true, errors, failed, requestedUrls: [...new Set(urls)],
  }, null, 2), contentType: 'application/json' })
})
