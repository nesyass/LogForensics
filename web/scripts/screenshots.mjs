import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright-core'

const BASE = process.env.LOGFORENSICS_URL ?? 'http://127.0.0.1:8000'
const OUT = path.resolve('..', 'screenshots')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const pageErrors = []

const IGNORED_ERRORS = [/401 \(Unauthorized\)/, /Failed to load resource.*401/]

async function settle(page, delay = 500) {
  await page.waitForTimeout(delay)
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) })
  console.log(`saved ${name}.png`)
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: EDGE, headless: true })

  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
    colorScheme: 'light',
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (IGNORED_ERRORS.some((pattern) => pattern.test(text))) return
    pageErrors.push(text)
  })

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await settle(page)
  await shot(page, 'landing')

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await settle(page)
  await shot(page, 'login')

  await page.locator('#login-username').fill('analyst')
  await page.locator('#login-password').fill('logforensics')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/app', { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  const existing = await page.evaluate(async () => {
    const response = await fetch('/api/cases')
    return response.ok ? response.json() : []
  })
  if (!existing.length) {
    await page.evaluate(async () => {
      const response = await fetch('/api/cases/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: 'Asia/Jakarta', parser: 'auto' }),
      })
      if (!response.ok) throw new Error(await response.text())
    })
    await page.reload({ waitUntil: 'networkidle' })
  }

  await page.locator('.kpi-value').first().waitFor({ timeout: 15000 })
  await settle(page, 700)
  await shot(page, 'overview')

  await page.locator('.topbar button[aria-label="Switch to dark theme"]').click()
  await settle(page, 500)
  await shot(page, 'overview-dark')
  await page.locator('.topbar button[aria-label="Switch to light theme"]').click()
  await settle(page, 300)

  await page.goto(`${BASE}/app/events`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor({ timeout: 15000 })
  await settle(page)
  await shot(page, 'event-explorer')

  await page.locator('.table tbody tr').first().click()
  await page.locator('.drawer').waitFor({ timeout: 10000 })
  await settle(page, 600)
  await shot(page, 'event-detail')
  await page.keyboard.press('Escape')
  await settle(page, 300)

  await page.goto(`${BASE}/app/alerts`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor({ timeout: 15000 })
  await settle(page)
  await shot(page, 'alerts')

  await page.locator('.table tbody tr').first().click()
  await page.locator('.drawer').waitFor({ timeout: 10000 })
  await settle(page, 800)
  await shot(page, 'alert-detail')
  await page.keyboard.press('Escape')
  await settle(page, 300)

  await page.goto(`${BASE}/app/timeline`, { waitUntil: 'networkidle' })
  await page.locator('.chart-svg').waitFor({ timeout: 15000 })
  await settle(page, 600)
  await shot(page, 'timeline')

  await page.goto(`${BASE}/app/sources`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor({ timeout: 15000 })
  await settle(page)
  await shot(page, 'sources')

  await page.goto(`${BASE}/app/ips`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor({ timeout: 15000 })
  await settle(page)
  await shot(page, 'ip-analysis')

  await page.goto(`${BASE}/app/exports`, { waitUntil: 'networkidle' })
  await page.locator('.export-item').first().waitFor({ timeout: 15000 })
  await settle(page, 600)
  await shot(page, 'exports')

  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.locator('.rail-new .btn').click()
  await page.locator('.modal').waitFor({ timeout: 10000 })
  await settle(page, 400)
  await shot(page, 'new-analysis')
  await page.keyboard.press('Escape')
  await settle(page, 200)

  await page.goto(`${BASE}/missing-page`, { waitUntil: 'networkidle' })
  await settle(page)
  await shot(page, 'not-found')

  await browser.close()

  if (pageErrors.length) {
    console.error('Page errors:')
    for (const error of pageErrors) console.error(`- ${error}`)
    process.exitCode = 1
  } else {
    console.log('No page errors.')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
