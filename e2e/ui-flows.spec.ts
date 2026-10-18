import { expect, test, type Page } from '@playwright/test'
import {
  SAMPLE_SECRETS,
  loadApp,
  openTab,
  promptBox,
  redact,
  scanPrompt,
  setRecording,
} from './ui-helpers.ts'

declare global {
  interface Window {
    __cspViolations?: string[]
  }
}

interface FlowObservations {
  foreign: string[]
  consoleErrors: string[]
  violations: string[]
  stored: Record<string, string>
}

/** Drives scan, redact, copy, restore, history and policy while recording what the page does on the wire and in the console. */
async function observeFullFlow(page: Page, baseURL: string | undefined): Promise<FlowObservations> {
  const origin = new URL(baseURL ?? '').origin
  const foreign: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.startsWith('data:') || url.startsWith('blob:') || url.startsWith('about:')) return
    if (new URL(url).origin !== origin) foreign.push(url)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('pageerror', (error) => consoleErrors.push(error.message))
  await page.addInitScript(() => {
    window.__cspViolations = []
    document.addEventListener('securitypolicyviolation', (event) => {
      const tag = event.target instanceof Element ? event.target.tagName : 'DOCUMENT'
      window.__cspViolations?.push(`${tag} ${event.violatedDirective} ${event.blockedURI}`)
    })
  })

  await loadApp(page)
  await setRecording(page, true)
  await openTab(page, 'Scan')
  const panel = await scanPrompt(page)
  await redact(page)
  await panel.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(panel.getByRole('status').filter({ hasText: /Copied|blocked copying/ })).toBeVisible()
  await panel.getByRole('textbox', { name: 'AI reply' }).fill('Thanks, contacting [EMAIL_1].')
  await panel.getByRole('button', { name: 'Restore reply' }).click()
  await expect(panel.locator('.restore-output')).toBeVisible()
  await openTab(page, 'History')
  await openTab(page, 'Policy')

  const violations = (await page.evaluate(() => window.__cspViolations)) ?? []
  const stored = await page.evaluate(() => Object.fromEntries(Object.entries(window.localStorage)))
  return { foreign, consoleErrors, violations, stored }
}

test('4a. privacy: no cross-origin requests, no console errors, only promptvault.* storage without secrets', async ({
  page,
  baseURL,
  browserName,
}) => {
  const { foreign, consoleErrors, stored } = await observeFullFlow(page, baseURL)
  expect(foreign).toEqual([])
  // WebKit logs its own <select> quirk (see 4b) as this console error. 4b still fails on any other violation.
  const known = browserName === 'webkit' ? /^Refused to apply a stylesheet because its hash/ : null
  expect(consoleErrors.filter((message) => !known?.test(message))).toEqual([])

  const keys = Object.keys(stored)
  expect(keys.length).toBeGreaterThan(0)
  for (const key of keys) expect(key).toMatch(/^promptvault./)
  const dump = JSON.stringify(stored)
  for (const secret of SAMPLE_SECRETS) expect(dump).not.toContain(secret)
  expect(dump).not.toContain('debugging our signup service')
  expect(dump).not.toContain('postgres')
})

test('4b. privacy: the real CSP reports no violations during a full flow', async ({ page, baseURL, browserName }) => {
  // App styles never use the style attribute (dynamic values go through src/ui/components/styleRef.ts).
  // WebKit quirk: the engine itself applies an inline style inside every native <select> it creates and reports it
  // as style-src-attr, even for a bare document.createElement('select') with no app code involved. Only those are
  // excused, and only on WebKit; any other violation in any browser fails this test.
  const { violations } = await observeFullFlow(page, baseURL)
  const excused = browserName === 'webkit' ? (v: string) => v.startsWith('SELECT style-src-attr') : () => false
  expect(violations.filter((v) => !excused(v))).toEqual([])
})

test.describe('settings drills', () => {
  test.beforeEach(async ({ page }) => {
    await loadApp(page)
  })

  test('5a. fail closed: the failure drill blocks instead of passing', async ({ page }) => {
    const panel = await openTab(page, 'Settings')
    await panel.getByRole('button', { name: 'Simulate failure' }).click()
    await expect(panel.getByText('Fail-closed held.')).toBeVisible({ timeout: 30_000 })
    const results = panel.locator('.set-item', { hasText: 'Failure drill' })
    await expect(results.locator('dd', { hasText: 'block' }).first()).toBeVisible()
    await expect(results.locator('dt', { hasText: 'Status' })).toBeVisible()
    await expect(results.locator('dd.set-mono').first()).not.toHaveText('completed')
    await expect(results).toContainText('A scan that did not complete is never a clean result')
  })

  test('5b. attack suite (regression) reports results with the honesty note', async ({ page }) => {
    const panel = await openTab(page, 'Settings')
    await panel.getByRole('group', { name: 'Corpus' }).getByRole('button', { name: 'Regression' }).click()
    await panel.getByRole('button', { name: 'Run suite' }).click()
    await expect(panel.getByRole('heading', { name: /^Regression corpus, version .+, \d+ cases?$/ })).toBeVisible({
      timeout: 120_000,
    })
    await expect(panel.getByText('synthetic and is used for tuning. It is not evidence of real-world accuracy.')).toBeVisible()
    await expect(panel.getByText('Precision', { exact: true }).first()).toBeVisible()
    await expect(panel.getByRole('table', { name: 'Precision and recall by category' })).toBeVisible()
  })
})

test('6. policy: Permissive then Custom with a keyword rule flags a matching prompt', async ({ page }) => {
  await loadApp(page)
  const policy = await openTab(page, 'Policy')
  const preset = policy.getByRole('group', { name: 'Preset' })
  await preset.getByRole('button', { name: 'Permissive' }).click()
  await expect(preset.getByRole('button', { name: 'Permissive' })).toHaveAttribute('aria-pressed', 'true')
  await preset.getByRole('button', { name: 'Custom' }).click()
  await expect(preset.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')

  await policy.getByRole('button', { name: 'Add rule' }).first().click()
  await policy.getByLabel('Rule name').fill('Codename')
  await policy.getByLabel('Keyword', { exact: true }).fill('Zephyrus')
  await policy.getByLabel('Placeholder type').fill('CODENAME')
  await policy.locator('#custom-rule-form').getByRole('button', { name: 'Add rule' }).click()
  await expect(policy.getByText('Codename', { exact: true })).toBeVisible()

  await policy.getByRole('button', { name: 'Save policy' }).click()
  await expect(policy.getByRole('button', { name: 'Save policy' })).toBeDisabled()

  const scan = await openTab(page, 'Scan')
  await expect(scan.getByText('Custom policy')).toBeVisible()
  await promptBox(page).fill('Status update: the Zephyrus rollout is on track.')
  await scan.getByRole('button', { name: 'Scan prompt' }).click()
  await expect(scan.getByRole('heading', { level: 1, name: /^1 item needs your attention\.$/ })).toBeVisible({
    timeout: 30_000,
  })
  await expect(scan.getByRole('region', { name: 'Findings' })).toContainText('Codename')
  await expect(scan.getByRole('region', { name: 'Findings' }).locator('.finding-row')).toHaveCount(1)
})

test('7. history: off by default, records one scan when on, and Clear empties it', async ({ page }) => {
  await loadApp(page)
  let history = await openTab(page, 'History')
  await expect(history.getByRole('switch', { name: 'Record activity' })).toHaveAttribute('aria-checked', 'false')
  await expect(history.getByRole('heading', { name: 'Recording is off' })).toBeVisible()

  await setRecording(page, true)
  await openTab(page, 'Scan')
  await scanPrompt(page)
  await redact(page)

  history = await openTab(page, 'History')
  const scans = history.locator('.history-stat', { hasText: 'Scans' }).first()
  await expect(scans.locator('dd').first()).toHaveText('1')
  await expect(history.getByRole('table', { name: 'Recent scans' })).toBeVisible()

  await history.getByRole('button', { name: 'Clear history' }).click()
  await history.getByRole('group', { name: 'Confirm clear history' }).getByRole('button', { name: 'Clear history' }).click()
  await expect(history.getByRole('heading', { name: 'No scans recorded yet' })).toBeVisible()
  await expect(history.getByRole('table', { name: 'Recent scans' })).toHaveCount(0)
})
