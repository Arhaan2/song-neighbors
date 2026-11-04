import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { CatalogTrack } from '../../src/catalog/contract.ts'
import type { WorkerRequest, WorkerResponse } from '../../src/recommend/protocol.ts'

const tracks = JSON.parse(readFileSync('public/catalog/fma-small-clap-general-20261104/tracks.json', 'utf8')) as CatalogTrack[]
const byId = new Map(tracks.map(track => [track.id, track]))
const seeds = ['fma:045099', 'fma:003832', 'fma:003950', 'fma:004037', 'fma:004070']

type Harness = {
  delayMs: number
  failNext: boolean
  shortNext: number | null
  requests: WorkerRequest[]
  replies: WorkerResponse[]
  workers: Worker[]
}
declare global { interface Window { __workerTest: Harness } }

// Test-only transport observation/fault injection. Normal flows always use the actual
// bundled worker and committed vectors. No fixture mode is added to the application.
async function observeWorker(page: Page) {
  await page.addInitScript(() => {
    const state: Harness = { delayMs: 0, failNext: false, shortNext: null, requests: [], replies: [], workers: [] }
    window.__workerTest = state
    const NativeWorker = window.Worker
    window.Worker = class extends NativeWorker {
      wrappers = new Map<EventListenerOrEventListenerObject, EventListener>()
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options)
        state.workers.push(this)
      }
      override postMessage(message: WorkerRequest) {
        state.requests.push(structuredClone(message))
        super.postMessage(message)
      }
      override addEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) {
        if (!listener) return
        if (type !== 'message') return super.addEventListener(type, listener, options)
        const wrapped: EventListener = (event) => {
          let data = (event as MessageEvent<WorkerResponse>).data
          state.replies.push(structuredClone(data))
          if (data.type === 'result' && state.failNext) {
            state.failNext = false
            data = { type: 'error', operation: 'query', requestId: data.requestId, queryKey: data.queryKey, code: 'test-transport', message: 'Injected retryable transport failure' }
          } else if (data.type === 'result' && state.shortNext !== null) {
            // Isolated presentation fixture: real returned songs, reduced eligible count.
            const size = state.shortNext
            state.shortNext = null
            data = { ...data, result: { ...data.result, recommendations: data.result.recommendations.slice(0, size), eligibleCount: size } }
          }
          const response = new MessageEvent('message', { data })
          const deliver = () => typeof listener === 'function' ? listener.call(this, response) : listener.handleEvent(response)
          if (data.type === 'result' || data.type === 'error') setTimeout(deliver, state.delayMs)
          else deliver()
        }
        this.wrappers.set(listener, wrapped)
        super.addEventListener(type, wrapped, options)
      }
      override removeEventListener(type: string, listener: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) {
        if (listener) super.removeEventListener(type, this.wrappers.get(listener) ?? listener, options)
      }
    }
  })
}

async function ready(page: Page) {
  await page.goto('./')
  await expect(page.getByRole('combobox', { name: 'Search songs or artists' })).toBeEnabled()
}
async function add(page: Page, id: string) {
  const track = byId.get(id)!
  await page.getByRole('combobox').fill(`${track.title} ${track.artist}`)
  await page.locator(`[role="option"][data-track-id="${id}"]`).click()
  await expect(page.locator(`[data-testid="seed-chip"][data-track-id="${id}"]`)).toBeVisible()
}
async function resultIds(page: Page) {
  return page.getByTestId('recommendation-card').evaluateAll(elements => elements.map(el => el.getAttribute('data-track-id')))
}
async function recommend(page: Page) {
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
}
async function capture(page: Page, name: string) {
  const useful = ['desktop-first-visit', 'desktop-refined', 'mobile-refined', 'mobile-load-error']
  if (process.env.CAPTURE_EVIDENCE === '1' && useful.includes(name)) await page.screenshot({ path: `docs/phases/assets/phase-3-${name}.png` })
}

test('real catalog journey: selection, ranking, feedback, reset, edits and refresh', async ({ page }, info) => {
  await observeWorker(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const requests: string[] = []
  page.on('request', request => requests.push(request.url()))
  await ready(page)
  await expect(page.getByRole('button', { name: 'Recommend', exact: true })).toBeDisabled()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await capture(page, `${info.project.name}-first-visit`)
  await page.getByRole('button', { name: 'Select Spell by Rolemusic', exact: true }).click()
  await expect(page.getByTestId('seed-chip')).toHaveCount(1)
  await page.getByTestId('seed-chip').getByRole('button').click()
  await page.getByRole('combobox').fill('On Axis')
  await expect(page.getByRole('option')).toHaveCount(2)
  await expect(page.getByRole('option').first()).toContainText('Wilderness')
  await expect(page.getByRole('option').last()).toContainText('Pipe Choir')
  for (const id of seeds) await add(page, id)
  await expect(page.getByTestId('seed-chip')).toHaveCount(5)
  await page.getByRole('combobox').fill('Leafless Quince Tree')
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-disabled', 'true')
  await page.getByRole('option').first().click({ force: true })
  await expect(page.getByTestId('seed-chip')).toHaveCount(5)
  await page.getByRole('combobox').fill('')
  await recommend(page)
  const baseline = await resultIds(page)
  expect(baseline).toHaveLength(new Set(baseline).size)
  expect(baseline.every(id => id && !seeds.includes(id))).toBe(true)
  const lastReply = await page.evaluate(() => window.__workerTest.replies.filter(reply => reply.type === 'result').at(-1))
  expect(lastReply?.type === 'result' && lastReply.result.recommendations.map(item => item.id)).toEqual(baseline)
  for (const id of baseline) {
    const card = page.locator(`[data-testid="recommendation-card"][data-track-id="${id}"]`)
    await expect(card).toContainText(byId.get(id!)!.title)
    await expect(card).toContainText(byId.get(id!)!.artist)
  }
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /More like this/ }).click()
  await expect(page.locator(`[data-testid="recommendation-card"][data-track-id="${baseline[0]}"]`)).toHaveCount(0)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  await expect(page.getByTestId('feedback-positive')).toContainText(byId.get(baseline[0]!)!.title)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  const rejected = (await resultIds(page))[0]!
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /Not this mood/ }).click()
  await expect(page.getByTestId('feedback-negative')).toContainText(byId.get(rejected)!.title)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  expect(await resultIds(page)).not.toContain(rejected)
  await expect(page.getByTestId('seed-chip')).toHaveCount(5)
  await page.getByRole('heading', { name: /neighbors|recommendations/i }).last().scrollIntoViewIfNeeded()
  await capture(page, `${info.project.name}-refined`)
  await page.getByRole('button', { name: /Reset refinement/i }).click()
  await expect.poll(() => resultIds(page)).toEqual(baseline)
  await expect(page.getByTestId('seed-chip')).toHaveCount(5)
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /More like this/ }).click()
  await expect(page.getByTestId('feedback-positive')).toBeVisible()
  await page.getByTestId('seed-chip').first().getByRole('button').click()
  await expect(page.getByTestId('seed-chip')).toHaveCount(4)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await expect(page.getByTestId('feedback-positive')).toHaveCount(0)
  await recommend(page)
  expect(await resultIds(page)).not.toEqual(baseline)
  await page.reload()
  await expect(page.getByTestId('seed-chip')).toHaveCount(0)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await page.getByText('About Song Neighbors & the catalog', { exact: true }).click()
  const attribution = page.getByRole('link', { name: /Catalog credits, recording licenses/i })
  expect(await attribution.getAttribute('href')).toMatch(/^\/song-neighbors\/catalog\/.+\/ATTRIBUTION.md$/)
  const response = await page.request.get((await attribution.getAttribute('href'))!)
  expect(response.ok()).toBe(true)
  expect(requests.filter(url => /^http/.test(url)).every(url => url.startsWith(info.project.use.baseURL!))).toBe(true)
  expect(errors).toEqual([])
  await info.attach('real-result-ids', { body: JSON.stringify({ seeds, baseline, rejected, browser: info.project.name }), contentType: 'application/json' })
})

test('keyboard, unsupported search, rapid input and reduced-motion responsive layout', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ready(page)
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(page.locator('main')).toBeFocused()
  const input = page.getByRole('combobox')
  await input.focus()
  // Reopening a long, previously unmounted list must scroll the active option into view.
  await input.fill('a')
  await input.press('Escape')
  await input.press('ArrowUp')
  await expect.poll(() => input.evaluate(el => {
    const option = document.getElementById(el.getAttribute('aria-activedescendant') ?? '')
    const list = option?.closest('[role="listbox"]')
    if (!option || !list) return false
    const row = option.getBoundingClientRect(), box = list.getBoundingClientRect()
    return row.top >= Math.max(box.top, 0) && row.bottom <= Math.min(box.bottom, innerHeight)
  })).toBe(true)
  await input.fill('zzzz-unavailable-song-zzzz')
  await expect(page.getByRole('option')).toHaveCount(0)
  await expect(page.getByText('No songs found here')).toBeVisible()
  await input.fill('Lior')
  await input.fill('Rolemusic')
  await input.fill('On Axis')
  await expect(page.getByRole('option')).toHaveCount(2)
  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', /.+/)
  await input.press('Escape')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(page.getByTestId('seed-chip')).toHaveCount(1)
  await expect(input).toBeFocused()
  await page.getByTestId('seed-chip').getByRole('button').focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('seed-chip')).toHaveCount(0)
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY')
  await add(page, seeds[0]!)
  await recommend(page)
  expect((await resultIds(page))[0]).toBe('fma:045100')
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 900 })
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  }
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
})

test('outside controls keep their pointer target while search loses focus', async ({ page }, info) => {
  await ready(page)
  const input = page.getByRole('combobox')
  const summary = page.locator('summary').filter({ hasText: 'About Song Neighbors & the catalog' })
  const details = page.locator('details').filter({ has: summary })
  for (const query of ['zzzz-unavailable-song-zzzz', 'On Axis']) {
    await input.fill(query)
    await expect(page.locator('.search-matches')).toBeVisible()
    await summary.scrollIntoViewIfNeeded()
    const target = await summary.boundingBox()
    expect(target).not.toBeNull()
    await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2)
    await page.mouse.down()
    // Hold beyond the next task/frame: blur must not remove the in-flow panel yet.
    await page.waitForTimeout(200)
    await expect(page.locator('.search-matches')).toBeVisible()
    const held = await summary.boundingBox()
    expect(held!.y).toBeCloseTo(target!.y, 1)
    await page.mouse.up()
    await expect(details).toHaveAttribute('open', '')
    await expect(page.locator('.search-matches')).toHaveCount(0)
    await summary.click()
    await expect(details).not.toHaveAttribute('open', '')
  }
  // Focus navigation has no held pointer and closes the panel immediately.
  await input.fill('On Axis')
  await input.press('Tab') // Clear-search button remains inside the search component.
  await page.keyboard.press('Tab')
  await expect(summary).toBeFocused()
  await expect(page.locator('.search-matches')).toHaveCount(0)
  await page.keyboard.press('Enter')
  await expect(details).toHaveAttribute('open', '')
  if (info.project.use.hasTouch) {
    await summary.tap()
    await input.fill('zzzz-unavailable-song-zzzz')
    await summary.tap()
    await expect(details).toHaveAttribute('open', '')
    await expect(page.locator('.search-matches')).toHaveCount(0)
  }
})

test('delayed result and delayed error cannot revive an edited selection', async ({ page }) => {
  await observeWorker(page)
  await ready(page)
  await add(page, seeds[0]!)
  await page.evaluate(() => { window.__workerTest.delayMs = 700 })
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__workerTest.replies.some(reply => reply.type === 'result'))).toBe(true)
  await page.getByTestId('seed-chip').getByRole('button').click()
  await add(page, seeds[1]!)
  await page.waitForTimeout(850) // Deliberately wait past the injected reply.
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await page.evaluate(() => { window.__workerTest.failNext = true })
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect.poll(() => page.evaluate(() => window.__workerTest.failNext)).toBe(false)
  await page.getByTestId('seed-chip').getByRole('button').click()
  await page.waitForTimeout(850)
  await expect(page.getByRole('button', { name: /Retry recommendations/i })).toHaveCount(0)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await page.evaluate(() => { window.__workerTest.delayMs = 0 })
  await add(page, seeds[1]!)
  await recommend(page)
})

test('catalog loading, load failure, unavailable pointer and recovery', async ({ page, context }, info) => {
  let mode = 'loading'
  let release: (() => void) | undefined
  const gate = new Promise<void>(resolve => { release = resolve })
  await context.route('**/catalog/current.json', async route => {
    if (mode === 'loading') await gate
    if (mode === 'failure' || mode === 'loading') await route.fulfill({ status: 503, body: 'Temporarily unavailable' })
    else if (mode === 'unavailable') {
      await route.fulfill({ json: { schemaVersion: 1, status: 'not-ready', reason: 'Test-only unavailable catalog' } })
    } else await route.continue()
  })
  await page.goto('./')
  await expect(page.getByRole('heading', { name: 'Opening the catalog…' })).toBeVisible()
  mode = 'failure'
  release!()
  await expect(page.getByRole('button', { name: /Retry catalog/i })).toBeVisible()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await capture(page, `${info.project.name}-load-error`)
  mode = 'unavailable'
  await page.getByRole('button', { name: /Retry catalog/i }).click()
  await expect(page.getByText(/catalog.*not ready|catalog.*unavailable/i).first()).toBeVisible()
  mode = 'ready'
  await page.getByRole('button', { name: /Retry catalog/i }).click()
  await expect(page.getByRole('combobox')).toBeEnabled()
  await add(page, seeds[0]!)
  await recommend(page)
})

test('query error and crashed worker can retry without losing seeds or preferences', async ({ page }) => {
  await observeWorker(page)
  await ready(page)
  await add(page, seeds[0]!)
  await page.evaluate(() => { window.__workerTest.failNext = true })
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByRole('button', { name: /Retry recommendations/i })).toBeVisible()
  await page.getByRole('button', { name: /Retry recommendations/i }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  const positive = (await resultIds(page))[0]!
  await page.getByTestId('recommendation-card').first().getByRole('button', { name: /More like this/ }).click()
  await expect(page.getByTestId('feedback-positive')).toContainText(byId.get(positive)!.title)
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  await page.evaluate(() => window.__workerTest.workers.at(-1)!.dispatchEvent(new Event('error')))
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByRole('button', { name: /Retry recommendations/i })).toBeVisible()
  await page.getByRole('button', { name: /Retry recommendations/i }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  await expect(page.getByTestId('seed-chip')).toHaveCount(1)
  await expect(page.getByTestId('feedback-positive')).toContainText(byId.get(positive)!.title)
  expect(await resultIds(page)).not.toContain(positive)
})

test('isolated presentation fixtures: insufficient results and no eligible results', async ({ page }) => {
  await observeWorker(page)
  await ready(page)
  await add(page, seeds[0]!)
  await page.evaluate(() => { window.__workerTest.shortNext = 3 })
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(3)
  await expect(page.getByText(/only 3|fewer|3 .*available/i).first()).toBeVisible()
  await page.evaluate(() => { window.__workerTest.shortNext = 0 })
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(0)
  await expect(page.getByText(/No .*remain|No .*available|No .*found/i).first()).toBeVisible()
})
