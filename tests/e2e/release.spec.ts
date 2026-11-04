import { test, expect } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const artifactRoot = process.env.RELEASE_ARTIFACT_DIR ?? 'dist'
const expectedBuild = JSON.parse(readFileSync(join(artifactRoot, 'build-info.json'), 'utf8'))
const pointer = JSON.parse(readFileSync(join(artifactRoot, 'catalog/current.json'), 'utf8'))
const tracks = JSON.parse(readFileSync(join(artifactRoot, 'catalog', pointer.catalogVersion, 'tracks.json'), 'utf8')) as { id: string; title: string; artist: string }[]
const seeds = ['fma:045099', 'fma:003832', 'fma:003950', 'fma:004037', 'fma:004070']

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
      if (index === 0) expect((await ids())[0]).toBe('fma:045100')
    }
  }
  await page.getByRole('combobox').fill('')
  const baseline = await ids()
  expect(new Set(baseline).size).toBe(20)
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
    seeds, baseline, positive: baseline[0], rejected, comparedArtifactFiles: artifactFiles.length,
    anonymousContext: true, resetExact: true, refreshCleared: true, errors, failed, requestedUrls: [...new Set(urls)],
  }, null, 2), contentType: 'application/json' })
})
