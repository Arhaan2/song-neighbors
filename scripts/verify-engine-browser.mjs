import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { runEngineSmoke } from './browser-engine-smoke.mjs'

// The optional local CDP helper is supplied explicitly; no global/browser package install.
const [helperPath, preview = 'http://127.0.0.1:4173/song-neighbors/', output = '.cache/phase-2-browser.json'] = process.argv.slice(2)
if (!helperPath) throw new Error('Usage: node scripts/verify-engine-browser.mjs <cdp-helper.mjs> [preview-url] [evidence.json]')
const { Browser } = await import(pathToFileURL(resolve(helperPath)).href)
const manifest = JSON.parse(await readFile('dist/.vite/manifest.json', 'utf8'))
const engine = new URL(manifest['src/recommend/browser.ts'].file, preview).href
const browser = await Browser.launch()
try {
  const cases = []
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844, mobile: true }]) {
    const page = await browser.newPage(viewport)
    await page.goto(preview, { settleMs: 100 })
    const evidence = await page.eval(runEngineSmoke, engine)
    if (page.consoleErrors.length) throw new Error(JSON.stringify(page.consoleErrors))
    cases.push({ viewport, ...evidence, uncaughtPageErrors: page.consoleErrors })
    await page.close()
  }
  const evidence = {
    test: 'Production module worker smoke, not listener quality evaluation',
    date: new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(new Date()),
    browser: await browser.send('Browser.getVersion'), cases,
  }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(`Passed production worker smoke at both viewports; evidence: ${output}`)
} finally { await browser.close() }
