import { expect, test } from '@playwright/test'

test('text reflows at 200% and catalog and selection links reach their destinations', async ({ page }) => {
  await page.goto('./')
  await expect(page.getByRole('combobox')).toBeEnabled()
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
  const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  for (const width of [640, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await expect.poll(fits).toBe(true)
  }
  const about = page.getByRole('link', { name: 'About the catalog' })
  await about.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#about-catalog')).toHaveAttribute('open', '')
  await expect(page.getByRole('link', { name: /Catalog credits/ })).toBeVisible()
  await expect.poll(fits).toBe(true)
  await page.getByRole('button', { name: 'Select Spell by Rolemusic' }).click()
  await page.getByRole('button', { name: 'Recommend', exact: true }).click()
  await expect(page.getByTestId('recommendation-card')).toHaveCount(20)
  await expect.poll(fits).toBe(true)
  await page.getByRole('link', { name: 'Back to your songs' }).click()
  await expect(page.getByRole('heading', { name: 'Your starting point' })).toBeFocused()
})
