import { expect, type Locator, type Page } from '@playwright/test'

// Synthetic sample values from src/ui/scan/sampleText.ts, rebuilt by concatenation (never literal token-like strings).
export const SAMPLE_API_KEY = ['sk', 'demo', '4c1e7b20a9d34f6e8b59f2a'].join('-')
export const SAMPLE_DB_PASSWORD = 'Hunter2' + '-demo'
export const SAMPLE_EMAIL = 'priya.sharma' + '@example.com'
export const SAMPLE_SECRETS = [SAMPLE_API_KEY, SAMPLE_DB_PASSWORD, SAMPLE_EMAIL] as const

export type TabName = 'Scan' | 'Policy' | 'History' | 'Settings'

/** The one tab panel that is not `hidden`. All four tabs stay mounted, so locators must be scoped to it. */
export const activePanel = (page: Page): Locator => page.locator('main > div:not([hidden])')

export const mainNav = (page: Page): Locator => page.getByRole('navigation', { name: 'Main' })

export const tabButton = (page: Page, name: TabName): Locator => mainNav(page).getByRole('button', { name })

export async function openTab(page: Page, name: TabName): Promise<Locator> {
  await tabButton(page, name).click()
  await expect(tabButton(page, name)).toHaveAttribute('aria-current', 'page')
  const panel = activePanel(page)
  // The Scan tab's heading changes with its step; the other tabs have a fixed h1.
  if (name !== 'Scan') await expect(panel.getByRole('heading', { level: 1, name })).toBeVisible()
  return panel
}

/** Loads the app fresh. Playwright gives each test a new context, so storage starts empty. */
export async function loadApp(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Check before you send.' })).toBeVisible()
}

export const promptBox = (page: Page): Locator => activePanel(page).getByRole('textbox', { name: 'Prompt text' })

/** Optionally replaces the prompt, scans it, and waits for the Review step. */
export async function scanPrompt(page: Page, text?: string): Promise<Locator> {
  const panel = activePanel(page)
  if (text !== undefined) await promptBox(page).fill(text)
  await panel.getByRole('button', { name: 'Scan prompt' }).click()
  // Step 2 heading: "N items need your attention." or "Nothing needs your attention."
  await expect(panel.getByRole('heading', { level: 1, name: /attention\.$/ })).toBeVisible({ timeout: 30_000 })
  return panel
}

/** Clicks the Redact button on the Review step and waits for the Sanitized step. */
export async function redact(page: Page): Promise<Locator> {
  const panel = activePanel(page)
  await panel.getByRole('button', { name: /^(Redact \d+ items?|Continue without redacting)$/ }).click()
  await expect(panel.getByRole('heading', { level: 1, name: /send\.$/ })).toBeVisible({ timeout: 30_000 })
  return panel
}

/** Sets the Record activity switch on the Settings tab. */
export async function setRecording(page: Page, on: boolean): Promise<void> {
  const panel = await openTab(page, 'Settings')
  const toggle = panel.getByRole('switch', { name: 'Record activity' })
  if ((await toggle.getAttribute('aria-checked')) !== String(on)) await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', String(on))
}
