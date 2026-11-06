import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'

const BASE = process.env.LOGFORENSICS_URL ?? 'http://127.0.0.1:8000'
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'

const failures = []
const ignored = [/401 \(Unauthorized\)/, /Failed to load resource.*401/]

function watch(page, label) {
  page.on('pageerror', (error) => failures.push(`${label} pageerror: ${error}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (ignored.some((pattern) => pattern.test(text))) return
    failures.push(`${label} console: ${text}`)
  })
}

async function noOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    doc: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  assert.ok(
    metrics.doc <= metrics.viewport + 1,
    `${label}: horizontal overflow (${metrics.doc} > ${metrics.viewport})`,
  )
}

async function main() {
  const browser = await chromium.launch({ executablePath: EDGE, headless: true })
  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    deviceScaleFactor: 1,
  })
  const page = await context.newPage()
  watch(page, 'desktop')

  // Public landing page
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  assert.match(await page.locator('.hero h1').innerText(), /Turn raw logs into/)
  assert.equal(await page.locator('.rule-card').count(), 5)
  assert.ok(await page.locator('a[href="/login"]').first().isVisible())
  assert.equal(
    await page.evaluate(() =>
      getComputedStyle(document.body).fontFamily.includes('Manrope'),
    ),
    true,
    'body should use Manrope',
  )
  assert.equal(
    await page.evaluate(() => {
      const el = document.querySelector('.preview-row code')
      return el ? getComputedStyle(el).fontFamily.includes('JetBrains') : false
    }),
    true,
    'mono text should use JetBrains Mono',
  )
  await noOverflow(page, 'landing')

  // Sign in through the UI
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.locator('#login-username').fill('analyst')
  await page.locator('#login-password').fill('logforensics')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/app', { timeout: 15000 })

  // A fresh database has no cases; seed the sample before asserting the UI.
  const hasCases = await page.evaluate(async () => {
    const response = await fetch('/api/cases')
    return response.ok ? (await response.json()).length > 0 : false
  })
  if (!hasCases) {
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
  await page.waitForTimeout(500)

  const caseData = await page.evaluate(async () => {
    const cases = await (await fetch('/api/cases')).json()
    return (await fetch(`/api/cases/${cases[0].id}`)).json()
  })
  assert.ok(caseData)
  const kpis = await page.locator('.kpi-value').allInnerTexts()
  assert.equal(kpis[0], '51', 'parsed events KPI')
  assert.equal(kpis[1], '13', 'detections KPI')
  assert.ok(await page.locator('.chart-svg').isVisible())
  assert.ok(
    (await page.locator('.chart-svg .bar-seg').count()) > 0,
    'overview chart should render bars',
  )
  assert.equal(await page.locator('.mini-item').count(), 5)
  assert.ok(await page.locator('.incident').first().isVisible())
  assert.ok(await page.locator('.hash').first().innerText())
  await noOverflow(page, 'overview')

  // Theme toggle should change the computed background
  const lightBg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  )
  await page.locator('.topbar button[aria-label="Switch to dark theme"]').click()
  await page.waitForTimeout(250)
  const darkBg = await page.evaluate(
    () => getComputedStyle(document.body).backgroundColor,
  )
  assert.notEqual(lightBg, darkBg, 'dark theme should change background')
  await page.locator('.topbar button[aria-label="Switch to light theme"]').click()
  await page.waitForTimeout(200)

  // Command palette
  await page.keyboard.press('Control+k')
  await page.locator('.palette-input').waitFor()
  await page.locator('.palette-input').fill('event')
  await page.locator('.palette-item').first().waitFor({ timeout: 5000 })
  assert.ok((await page.locator('.palette-item').count()) >= 1)
  await page.locator('.palette-input').press('Enter')
  await page.waitForURL('**/app/events')
  await page.locator('.pager').waitFor({ timeout: 10000 })
  await page.locator('.table tbody tr').first().waitFor()
  await noOverflow(page, 'events')

  // Event explorer: server pagination, search and inspector
  assert.equal(await page.locator('.table tbody tr').count(), 50)
  assert.match(await page.locator('.pager').innerText(), /Page 1 of 2/)
  await page.locator('.toolbar input[type="search"]').fill('Failed password')
  await page.waitForTimeout(700)
  const filteredRows = await page.locator('.table tbody tr').count()
  assert.ok(filteredRows > 0 && filteredRows < 50, 'search should narrow events')
  await page.locator('.toolbar input[type="search"]').fill('')
  await page.waitForTimeout(700)
  await page.locator('.table tbody tr').first().click()
  await page.locator('.drawer').waitFor()
  assert.ok((await page.locator('.raw-box').innerText()).length > 5)
  assert.match(await page.locator('.drawer-head').innerText(), /web|http|request|source|detail|login|session/i)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)

  // Detections: rationale, evidence and status update round-trip
  await page.goto(`${BASE}/app/alerts`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor()
  assert.equal(await page.locator('.table tbody tr').count(), 13)
  await page.locator('.table tbody tr').first().click()
  await page.locator('.drawer').waitFor()
  assert.ok((await page.locator('.reason-box').innerText()).length > 15)
  assert.ok((await page.locator('.evidence-item').count()) > 0)
  const statusSelect = page.locator('.drawer .status-select')
  const original = await statusSelect.inputValue()
  await statusSelect.selectOption('benign')
  await page.waitForTimeout(900)
  assert.equal(await statusSelect.inputValue(), 'benign')
  await statusSelect.selectOption(original)
  await page.waitForTimeout(900)
  assert.equal(await statusSelect.inputValue(), original)
  await page.keyboard.press('Escape')
  await noOverflow(page, 'alerts')

  // Timeline
  await page.goto(`${BASE}/app/timeline`, { waitUntil: 'networkidle' })
  await page.locator('.chart-svg').waitFor()
  assert.ok((await page.locator('.chart-svg .bar-seg').count()) > 0)
  assert.ok((await page.locator('.timeline-row').count()) > 0)
  assert.ok((await page.locator('.incident').count()) >= 3)
  await noOverflow(page, 'timeline')

  // Sources & integrity
  await page.goto(`${BASE}/app/sources`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor()
  assert.equal(await page.locator('.table tbody tr').count(), 3)
  assert.match(await page.locator('.card').first().innerText(), /SHA-256/i)
  assert.ok(await page.getByText('No parse errors').isVisible())
  assert.equal(await page.locator('.meta-grid .badge').count(), 5)
  await noOverflow(page, 'sources')

  // IP aggregation -> filtered events
  await page.goto(`${BASE}/app/ips`, { waitUntil: 'networkidle' })
  await page.locator('.table tbody tr').first().waitFor()
  assert.equal(await page.locator('.table tbody tr').count(), 8)
  const firstIp = await page.locator('.table tbody tr td').first().innerText()
  await page.locator('.table tbody tr').first().click()
  await page.waitForURL(/\/app\/events\?ip=/)
  await page.locator('.pager').waitFor({ timeout: 10000 })
  await page.locator('.table tbody tr').first().waitFor()
  const ipCells = await page.locator('.table tbody tr td:nth-child(4)').allInnerTexts()
  assert.ok(ipCells.every((value) => value === firstIp))
  await noOverflow(page, 'ip-filtered-events')

  // Exports
  await page.goto(`${BASE}/app/exports`, { waitUntil: 'networkidle' })
  await page.locator('.export-item').first().waitFor()
  assert.equal(await page.locator('.export-item').count(), 7)
  const zipHref = await page
    .locator('a[download="logforensics-export.zip"]')
    .first()
    .getAttribute('href')
  assert.match(zipHref, /logforensics-export\.zip$/)
  assert.ok(await page.locator('.export-item').first().locator('a').isVisible())
  await noOverflow(page, 'exports')

  // New analysis modal
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' })
  await page.locator('.rail-new .btn').click()
  await page.locator('.modal').waitFor()
  assert.match(await page.locator('.modal').innerText(), /New analysis/)
  assert.ok(await page.locator('.segmented').isVisible())
  await page.keyboard.press('Escape')

  // 404
  await page.goto(`${BASE}/missing-page`, { waitUntil: 'networkidle' })
  assert.equal(await page.locator('.notfound-code').innerText(), '404')
  await noOverflow(page, 'not-found')

  // Unauthenticated deep link should land on the login page
  const anonymous = await browser.newContext({
    viewport: { width: 1440, height: 980 },
  })
  const anonPage = await anonymous.newPage()
  watch(anonPage, 'anonymous')
  await anonPage.goto(`${BASE}/app/exports`, { waitUntil: 'networkidle' })
  await anonPage.waitForURL('**/login')
  assert.ok(await anonPage.locator('.auth-card').isVisible())
  await anonymous.close()

  // Mobile layout: no horizontal page overflow, rail stays usable
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  })
  await mobile.addCookies(await context.cookies())
  const mobilePage = await mobile.newPage()
  watch(mobilePage, 'mobile')
  for (const [route, label] of [
    ['/', 'mobile-landing'],
    ['/app', 'mobile-overview'],
    ['/app/events', 'mobile-events'],
    ['/app/alerts', 'mobile-alerts'],
    ['/app/timeline', 'mobile-timeline'],
    ['/app/sources', 'mobile-sources'],
    ['/app/ips', 'mobile-ips'],
    ['/app/exports', 'mobile-exports'],
  ]) {
    await mobilePage.goto(`${BASE}${route}`, { waitUntil: 'networkidle' })
    await mobilePage.waitForTimeout(450)
    await noOverflow(mobilePage, label)
  }
  assert.equal(
    await mobilePage.locator('.rail').evaluate((el) => getComputedStyle(el).position),
    'sticky',
  )
  await mobile.close()
  await browser.close()

  if (failures.length) {
    console.error('UI check failures:')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log('UI check passed: desktop and mobile, light and dark.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
