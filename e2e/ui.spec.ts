import { expect, test } from '@playwright/test'
import {
  SAMPLE_API_KEY,
  SAMPLE_DB_PASSWORD,
  SAMPLE_EMAIL,
  SAMPLE_SECRETS,
  activePanel,
  loadApp,
  mainNav,
  openTab,
  promptBox,
  redact,
  scanPrompt,
} from './ui-helpers.ts'

test.beforeEach(async ({ page, context, browserName }) => {
  // Only Chromium lets a test grant clipboard permissions.
  if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await loadApp(page)
})

test('1. happy path: scan, review, redact, copy and restore', async ({ page, browserName }) => {
  await expect(promptBox(page)).toHaveValue(new RegExp(SAMPLE_EMAIL.replace('.', '\\.')))
  const panel = await scanPrompt(page)

  await expect(panel.getByRole('heading', { level: 1, name: /^\d+ items? needs? your attention\.$/ })).toBeVisible()
  await expect(panel.getByRole('meter', { name: 'Risk score' })).toBeVisible()
  await expect(panel.locator('.risk-line__title')).toHaveText(/risk$/i)
  const findings = panel.getByRole('region', { name: 'Findings' }).getByRole('checkbox')
  expect(await findings.count()).toBeGreaterThanOrEqual(3)

  await redact(page)
  await expect(panel.getByRole('heading', { level: 1, name: 'Ready to send.' })).toBeVisible()

  const output = panel.getByRole('region', { name: 'Sanitized prompt' })
  const outputText = (await output.locator('.sanitized-text').textContent()) ?? ''
  for (const secret of SAMPLE_SECRETS) expect(outputText).not.toContain(secret)
  expect(outputText).toMatch(/EMAIL_\d+/)

  await panel.getByRole('button', { name: 'Copy prompt' }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Copied to the clipboard' })).toBeVisible()
  if (browserName === 'chromium') {
    const clip = await page.evaluate(() => navigator.clipboard.readText())
    expect(clip).toMatch(/\[EMAIL_\d+\]/)
    for (const secret of SAMPLE_SECRETS) expect(clip).not.toContain(secret)
  }
  // Firefox and WebKit: reading the clipboard needs a permission a test cannot grant, so only the Copied status is asserted.

  const label = (await panel.locator('.placeholder-row .redact-bar').filter({ hasText: /^EMAIL_\d+$/ }).textContent()) ?? ''
  await panel.getByRole('textbox', { name: 'AI reply' }).fill(`Please write to [${label}] about the failing login.`)
  await panel.getByRole('button', { name: 'Restore reply' }).click()
  await expect(panel.getByRole('status').filter({ hasText: 'Restored 1 placeholder.' })).toBeVisible()
  await expect(panel.locator('.restore-output')).toHaveText(`Please write to ${SAMPLE_EMAIL} about the failing login.`)
})

test('2. mandatory credential findings are locked and cannot be unticked', async ({ page }) => {
  const panel = await scanPrompt(page)
  const rows = panel.getByRole('region', { name: 'Findings' }).locator('.finding-row')
  const locked = rows.filter({ hasText: 'Always removed' })
  expect(await locked.count()).toBeGreaterThanOrEqual(2)

  for (const row of await locked.all()) {
    const box = row.getByRole('checkbox')
    await expect(box).toBeChecked()
    await expect(box).toBeDisabled()
    await row.click({ force: true })
    await expect(box).toBeChecked()
  }
})

test('3. keeping an item leaves it in the output with "kept" wording', async ({ page }) => {
  const panel = await scanPrompt(page)
  const emailRow = panel.getByRole('region', { name: 'Findings' }).locator('.finding-row').filter({ hasText: /email/i })
  const box = emailRow.getByRole('checkbox')
  await expect(box).toBeEnabled()
  await box.uncheck()
  await expect(emailRow).toContainText('Kept by you')

  await redact(page)
  await expect(panel.getByRole('heading', { level: 1, name: 'Ready to send.' })).toBeVisible()
  await expect(panel.locator('.status-line')).toContainText(/1 item kept as you chose/)
  const text = (await panel.getByRole('region', { name: 'Sanitized prompt' }).locator('.sanitized-text').textContent()) ?? ''
  expect(text).toContain(SAMPLE_EMAIL)
  expect(text).not.toContain(SAMPLE_API_KEY)
  expect(text).not.toContain(SAMPLE_DB_PASSWORD)
})

test('8. keyboard: tab nav and the Strict/Permissive switch work without a mouse', async ({ page }) => {
  await mainNav(page).getByRole('button', { name: 'Scan' }).focus()
  await page.keyboard.press('Tab')
  await expect(mainNav(page).getByRole('button', { name: 'Policy' })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(activePanel(page).getByRole('heading', { level: 1, name: 'Policy' })).toBeVisible()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(mainNav(page).getByRole('button', { name: 'Settings' })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(activePanel(page).getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
  await openTab(page, 'Scan')

  const strict = activePanel(page).getByRole('switch', { name: 'Strict mode' })
  await expect(strict).toHaveAttribute('aria-checked', 'true')
  // Reach the switch from the textarea with Tab alone.
  await promptBox(page).focus()
  for (let i = 0; i < 6 && !(await strict.evaluate((el) => el === document.activeElement)); i++) {
    await page.keyboard.press('Tab')
  }
  await expect(strict).toBeFocused()
  await page.keyboard.press('Space')
  await expect(strict).toHaveAttribute('aria-checked', 'false')
  await page.keyboard.press('Enter')
  await expect(strict).toHaveAttribute('aria-checked', 'true')
})
