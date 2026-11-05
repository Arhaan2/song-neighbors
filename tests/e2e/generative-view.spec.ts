import { test, expect } from '@playwright/test'
import { activeTestCatalog } from '../fixtures/active-catalog.ts'

const { tracks } = activeTestCatalog()
const seeds = ['fma:045099', 'fma:003832', 'fma:003950', 'fma:004037', 'fma:004070']

test('generated views follow real results; plain view and reset preserve rank and composition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('./')
  const input = page.getByRole('combobox')
  const view = page.getByTestId('discovery-composition')
  const cards = page.getByTestId('recommendation-card')
  const ids = () => cards.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-track-id')))
  const print = () => view.locator('.composition-intro .selection-print').evaluate(node => node.innerHTML)
  await expect(view).toHaveAttribute('data-stage', 'discover')
  for (const [index, id] of seeds.entries()) {
    const track = tracks.find(row => row.id === id)!
    await input.fill(`${track.title} ${track.artist}`)
    await page.locator(`[role="option"][data-track-id="${id}"]`).click()
    await expect(view).toHaveAttribute('data-stage', 'selection')
    await expect(cards).toHaveCount(0)
    if (index === 0) {
      await page.getByRole('button', { name: 'Recommend', exact: true }).click()
      await expect(view).toHaveAttribute('data-stage', 'single')
      await expect(cards).toHaveCount(20)
    }
  }
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(view).toHaveAttribute('data-stage', 'blend')
  await expect(cards).toHaveCount(20)
  const baselineIds = await ids()
  const baselinePrint = await print()
  const lanes = page.getByTestId('neighbor-lane')
  await expect(lanes).toHaveCount(5)
  const counts = await lanes.evaluateAll(nodes => nodes.map(n => Number(n.getAttribute('data-count'))))
  expect(counts.reduce((a, b) => a + b, 0)).toBe(20)
  for (const id of seeds) {
    const track = tracks.find(row => row.id === id)!
    const actual = await cards.locator('.closest-seed strong').allTextContents()
    expect(Number(await page.locator(`[data-testid="neighbor-lane"][data-seed-id="${id}"]`).getAttribute('data-count'))).toBe(actual.filter(title => title === track.title).length)
  }
  await page.getByRole('button', { name: 'Plain list', exact: true }).click()
  await expect(view).toHaveCount(0)
  expect(await ids()).toEqual(baselineIds)
  await page.getByRole('button', { name: 'Adaptive', exact: true }).click()
  expect(await ids()).toEqual(baselineIds)
  expect(await print()).toBe(baselinePrint)
  await lanes.locator('button:enabled').first().click()
  expect(await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))).toBe('recommendation-card')
  await cards.first().getByRole('button', { name: /More like this/ }).click()
  await expect(view).toHaveAttribute('data-stage', 'refined')
  await expect(cards).toHaveCount(20)
  expect(await print()).not.toBe(baselinePrint)
  expect(await ids()).not.toContain(baselineIds[0])
  await page.getByRole('button', { name: 'Reset refinement', exact: true }).click()
  await expect.poll(ids).toEqual(baselineIds)
  expect(await print()).toBe(baselinePrint)
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  await page.setViewportSize({ width: 320, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.reload()
  await expect(view).toHaveAttribute('data-stage', 'discover')
  await expect(cards).toHaveCount(0)
})
