import { expect, test, type Page, type Request } from '@playwright/test'

interface HarnessWindow {
  __violations: Array<{ violatedDirective: string; blockedURI: string }>
  __workerUrls: string[]
  runWorkerProbe: () => Promise<{ fetch: string; websocket: string }>
}

// Synthetic values only; token-like strings are built by concatenation.
const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
const EMAIL = 'jane.doe' + '@example-corp.test'
const DB_PASSWORD = 's3cr3t' + 'Pa55word'
const DB_URL = `postgres://app_user:${DB_PASSWORD}@db.internal.test:5432/prod`
const SECRETS = [AWS_KEY, EMAIL, DB_PASSWORD, DB_URL]

interface HarnessResult {
  decision: string
  findings: number
  sanitizedText: string | null
  validationPassed: boolean
}

const run = (page: Page, text: string): Promise<HarnessResult> =>
  page.evaluate((t) => (window as unknown as { runHarness: (s: string) => Promise<HarnessResult> }).runHarness(t), text)

async function load(page: Page) {
  await page.goto('/')
  await page.waitForFunction(() => (window as unknown as { harnessReady?: boolean }).harnessReady === true)
  // Warm the worker so its chunk is fetched during "load", before the log is cleared.
  await run(page, 'warm up')
  await page.waitForLoadState('networkidle')
}

async function logRequests(page: Page) {
  const log: Array<{ url: string; headers: string; body: string }> = []
  const record = (r: Request) =>
    log.push({ url: r.url(), headers: JSON.stringify(r.headers()), body: r.postData() ?? '' })
  page.on('request', record)
  await page.context().route('**/*', (route) => route.continue())
  return log
}

const CONTROL = '/__control__'

test('A: scanning and redaction cause no network egress', async ({ page }) => {
  const log = await logRequests(page)
  await load(page)
  log.length = 0

  // Positive control: prove the request logger actually observes page-initiated requests.
  // (fetch is blocked by connect-src 'none', so use an image load, which img-src 'self' allows.)
  await page.evaluate((u) => new Promise<void>((res) => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = u }), CONTROL)
  expect(log.map((r) => new URL(r.url).pathname)).toContain(CONTROL)

  const prompt = `Deploy with ${AWS_KEY} and mail ${EMAIL}. DB: ${DB_URL}`
  const result = await run(page, prompt)
  await page.waitForTimeout(500)

  const offending = log.filter((r) => new URL(r.url).pathname !== CONTROL || r.body !== '')
  expect(offending.map((r) => r.url)).toEqual([])
  for (const r of log) {
    for (const s of SECRETS) {
      expect(decodeURIComponent(r.url)).not.toContain(s)
      expect(r.headers).not.toContain(s)
      expect(r.body).not.toContain(s)
    }
  }
  expect(result.findings).toBeGreaterThan(0)
  expect(result.validationPassed).toBe(true)
  expect(result.sanitizedText).not.toBeNull()
  for (const s of [AWS_KEY, EMAIL, DB_PASSWORD]) expect(result.sanitizedText).not.toContain(s)
})

test('B: CSP blocks fetch, beacon and websocket (and reports violations)', async ({ page }) => {
  const log = await logRequests(page)
  const response = await page.goto('/')
  const html = (await response?.text()) ?? ''
  expect(html).toMatch(/http-equiv="Content-Security-Policy"[^>]*connect-src 'none'/)
  await page.waitForFunction(() => (window as unknown as { harnessReady?: boolean }).harnessReady === true)

  expect(await page.evaluate(() => fetch('https://example.com').then(() => 'sent', () => 'blocked'))).toBe('blocked')
  // Non-vacuous: the rejection was caused by CSP, not by the network being unavailable.
  await page.waitForFunction(() => (window as unknown as HarnessWindow).__violations.some((v) => v.violatedDirective.startsWith('connect-src')))
  const violations = await page.evaluate(() => (window as unknown as HarnessWindow).__violations)
  expect(
    violations.some((v) => v.violatedDirective.startsWith('connect-src') && v.blockedURI.includes('example.com')),
  ).toBe(true)

  const beacon = await page.evaluate(() => {
    try {
      return navigator.sendBeacon('https://example.com/b', 'x') ? 'queued' : 'blocked'
    } catch {
      return 'blocked'
    }
  })
  // sendBeacon may return true (it only queues); the CSP must still stop it before any request is made.
  expect(['blocked', 'queued']).toContain(beacon)

  const ws = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        try {
          const s = new WebSocket('wss://example.com/')
          s.onopen = () => resolve('open')
          s.onerror = () => resolve('blocked')
          s.onclose = () => resolve('blocked')
        } catch {
          resolve('blocked')
        }
      }),
  )
  expect(ws).toBe('blocked')

  await page.waitForTimeout(300)
  expect(log.filter((r) => r.url.includes('example.com'))).toEqual([])
})

test('B2: scan worker is a blob: worker; a same-built probe worker cannot reach the network', async ({ page }) => {
  await load(page) // load() runs a scan, which creates the real scan worker
  const urls = await page.evaluate(() => (window as unknown as HarnessWindow).__workerUrls)
  expect(urls.length).toBeGreaterThan(0)
  expect(urls[0]).toMatch(/^blob:/)

  const probe = await page.evaluate(() => (window as unknown as HarnessWindow).runWorkerProbe())
  expect(probe.fetch).toBe('blocked')
  expect(probe.websocket).toBe('blocked')
  for (const u of await page.evaluate(() => (window as unknown as HarnessWindow).__workerUrls)) expect(u).toMatch(/^blob:/)
})

test('C: core scan works offline', async ({ page, context }) => {
  await load(page)
  await context.setOffline(true)
  const result = await run(page, `key ${AWS_KEY}`)
  expect(result.findings).toBeGreaterThan(0)
  expect(result.validationPassed).toBe(true)
  expect(result.sanitizedText).not.toContain(AWS_KEY)
})

const ZW = '\u200B'
const CASES: Array<{ name: string; text: string; decisions: string[]; absent?: string }> = [
  { name: 'aws key', text: `use ${AWS_KEY} now`, decisions: ['block', 'redact', 'review'], absent: AWS_KEY },
  { name: 'email', text: `contact ${EMAIL}`, decisions: ['redact', 'warn', 'review', 'block'], absent: EMAIL },
  { name: 'db url', text: `conn ${DB_URL}`, decisions: ['block', 'redact', 'review'], absent: DB_PASSWORD },
  {
    name: 'zero-width obfuscated key',
    text: `key ${AWS_KEY.slice(0, 6)}${ZW}${AWS_KEY.slice(6, 12)}${ZW}${AWS_KEY.slice(12)}`,
    decisions: ['block', 'redact', 'review'],
  },
  { name: 'clean', text: 'please summarize how water flows through pipes and pumps.', decisions: ['allow'] },
]

for (const c of CASES) {
  test(`D: ${c.name} yields expected decision`, async ({ page }) => {
    await load(page)
    const result = await run(page, c.text)
    expect(c.decisions).toContain(result.decision)
    if (c.absent) expect(result.sanitizedText).not.toContain(c.absent)
    if (c.decisions[0] === 'allow') expect(result.findings).toBe(0)
    else expect(result.findings).toBeGreaterThan(0)
  })
}
