import { describe, expect, it } from 'vitest'
import { sanitize, scan } from './engine'
import { PERMISSIVE_POLICY, STRICT_POLICY } from './policy/presets'
import type { Finding, Policy, ScanOptions, ScanResult } from './types'

const AWS_KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
const DB_URL = 'postgres://admin:fake-password@db.example.test/app'

function run(text: string, policy: Policy = STRICT_POLICY, options?: ScanOptions): ScanResult {
  return scan({ requestId: 'r1', text, policy, options })
}

function redactAll(text: string, res: ScanResult, policy: Policy = STRICT_POLICY, structured = true) {
  const ids = res.findingDecisions.filter((d) => d.action !== 'allow').map((d) => d.findingId)
  return sanitize({
    requestId: 'r1',
    sourceText: text,
    findings: res.findings,
    findingIds: ids,
    placeholderMode: 'typed',
    policy,
    structured,
    includeMapping: true,
  })
}

const byCategory = (res: ScanResult, c: Finding['category']) => res.findings.filter((f) => f.category === c)

describe('scan', () => {
  it('completes on harmless text without inventing findings', () => {
    const res = run('Can you explain how binary search works? Version 2.4.1 was released on 2024-05-01.')
    expect(res.status).toBe('completed')
    expect(res.findings.filter((f) => f.category !== 'person_name')).toHaveLength(0)
    expect(res.riskScore).toBe(0)
    expect(res.policyDecision).toBe('allow')
  })

  it('detects credentials in code and requires redaction', () => {
    const text = `const client = new S3({ accessKeyId: "${AWS_KEY}" })\nDATABASE_URL=${DB_URL}`
    const res = run(text)
    expect(byCategory(res, 'cloud_credential')).toHaveLength(1)
    expect(byCategory(res, 'db_connection')).toHaveLength(1)
    expect(res.policyDecision).toBe('redact')
    expect(res.riskBand).toBe('critical')
    expect(res.mandatoryRulesTriggered).toContain('cloud_credential:redact')
  })

  it('blocks private keys under strict policy', () => {
    const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEfakefakefakeAAAA\n-----END RSA PRIVATE KEY-----'
    const res = run(`Why does this fail?\n${pem}`)
    expect(byCategory(res, 'private_key')).toHaveLength(1)
    expect(res.policyDecision).toBe('block')
  })

  it('never returns a raw value inside explanations', () => {
    const text = `email jane.doe@example.com key ${AWS_KEY} ${DB_URL}`
    const res = run(text)
    for (const f of res.findings) {
      expect(f.explanation).not.toContain(text.slice(f.startOffset, f.endOffset))
    }
  })

  it('is deterministic', () => {
    const text = `contact jane.doe@example.com, key ${AWS_KEY}`
    const a = run(text)
    const b = run(text)
    expect({ ...a, durationMs: 0 }).toEqual({ ...b, durationMs: 0 })
  })
})

describe('failure handling (fail closed)', () => {
  it('total detector failure → failed + block (strict and permissive), null score', () => {
    const strict = run('hello', STRICT_POLICY, { faultInjection: { failDetectorId: '*' } })
    expect(strict.status).toBe('failed')
    expect(strict.policyDecision).toBe('block')
    expect(strict.riskScore).toBeNull()
    const perm = run('hello', PERMISSIVE_POLICY, { faultInjection: { failDetectorId: '*' } })
    expect(perm.status).toBe('failed')
    expect(perm.policyDecision).toBe('block')
  })

  it('single detector failure → partial, still blocks in strict mode', () => {
    const res = run('hello world', STRICT_POLICY, { faultInjection: { failDetectorId: 'pii.email' } })
    expect(res.status).toBe('partial')
    expect(res.policyDecision).toBe('block')
    expect(res.errors.some((e) => e.code === 'DETECTOR_FAILURE' && e.detectorId === 'pii.email')).toBe(true)
  })

  it('timeout → partial, not clean', () => {
    const res = run('a@example.com '.repeat(500), STRICT_POLICY, { timeoutMs: -1 })
    expect(res.status).not.toBe('completed')
    expect(res.policyDecision).toBe('block')
    expect(res.errors.some((e) => e.code === 'SCAN_TIMEOUT')).toBe(true)
  })

  it('rejects oversize input', () => {
    const res = run('x'.repeat(100_001))
    expect(res.status).toBe('failed')
    expect(res.errors[0].code).toBe('INPUT_TOO_LARGE')
    expect(res.policyDecision).toBe('block')
  })

  it('invalid policy → failed + block, never a permissive fallback', () => {
    const bad = { ...STRICT_POLICY, rules: [{ category: 'email', action: 'nope' }] } as unknown as Policy
    const res = run('hello', bad)
    expect(res.status).toBe('failed')
    expect(res.policyDecision).toBe('block')
    expect(res.errors[0].code).toBe('POLICY_INVALID')
  })

  it('context analyzer failure keeps deterministic results', () => {
    const res = run('mail jane.doe@example.com', STRICT_POLICY, {
      faultInjection: { failDetectorId: 'context.compromise-people' },
    })
    expect(res.status).toBe('completed')
    expect(byCategory(res, 'email')).toHaveLength(1)
    expect(res.errors.some((e) => e.code === 'CONTEXT_ANALYZER_FAILURE')).toBe(true)
  })
})

describe('sanitize + post-redaction validation', () => {
  it('structured redaction keeps the DB host and removes the password (PRD A.3)', () => {
    const text = `Please debug this service.\nDATABASE_URL=${DB_URL}`
    const res = run(text)
    const out = redactAll(text, res)
    expect(out.status).toBe('completed')
    expect(out.sanitizedText).not.toContain('fake-password')
    expect(out.sanitizedText).toContain('db.example.test')
    expect(out.sanitizedText).toContain('Please debug this service.\nDATABASE_URL=postgres://')
    expect(out.validationPassed).toBe(true)
    expect(out.residualFindingIds).toEqual([])
  })

  it('whole-span redaction yields a typed placeholder', () => {
    const text = `DATABASE_URL=${DB_URL}`
    const out = redactAll(text, run(text), STRICT_POLICY, false)
    expect(out.sanitizedText).toBe('DATABASE_URL=[DB_CONNECTION_1]')
    expect(out.validationPassed).toBe(true)
  })

  it('consistent placeholders for repeated values; restoration mapping is opt-in', () => {
    const text = 'Email jane.doe@example.com or jane.doe@example.com, cc bob@example.org'
    const out = redactAll(text, run(text))
    expect(out.sanitizedText).toBe('Email [EMAIL_1] or [EMAIL_1], cc [EMAIL_2]')
    expect(out.mapping).toEqual({ '[EMAIL_1]': 'jane.doe@example.com', '[EMAIL_2]': 'bob@example.org' })
    expect(out.validationPassed).toBe(true)
  })

  it('fails validation when an occurrence of a secret is left unselected', () => {
    const text = `key ${AWS_KEY} and again ${AWS_KEY}`
    const res = run(text)
    const first = res.findings.find((f) => f.category === 'cloud_credential')!
    const out = sanitize({
      requestId: 'r1',
      sourceText: text,
      findings: res.findings,
      findingIds: [first.findingId],
      placeholderMode: 'typed',
      policy: STRICT_POLICY,
    })
    expect(out.status).toBe('completed')
    expect(out.validationPassed).toBe(false)
    expect(out.residualFindingIds.length).toBeGreaterThan(0)
  })

  it('rejects stale findings that no longer match the text', () => {
    const text = 'mail jane.doe@example.com'
    const res = run(text)
    const out = sanitize({
      requestId: 'r1',
      sourceText: 'changed ' + text,
      findings: res.findings,
      findingIds: res.findings.map((f) => f.findingId),
      placeholderMode: 'typed',
      policy: STRICT_POLICY,
    })
    expect(out.status).toBe('rejected')
    expect(out.sanitizedText).toBeNull()
    expect(out.validationPassed).toBe(false)
    expect(out.errors[0].code).toBe('INVALID_FINDING_RANGE')
  })

  it('mask mode returns no reversible mapping', () => {
    const text = 'mail jane.doe@example.com'
    const res = run(text)
    const out = sanitize({
      requestId: 'r1',
      sourceText: text,
      findings: res.findings,
      findingIds: byCategory(res, 'email').map((f) => f.findingId),
      placeholderMode: 'mask',
      policy: STRICT_POLICY,
      includeMapping: true,
    })
    expect(out.sanitizedText).toBe('mail [REDACTED_EMAIL]')
    expect(out.mapping).toBeUndefined()
  })
})

describe('retain decisions (FR-016 / FR-025)', () => {
  it('allows retaining non-mandatory findings but denies mandatory ones', () => {
    const text = `mail jane.doe@example.com key ${AWS_KEY}`
    const first = run(text)
    const email = byCategory(first, 'email')[0]
    const aws = byCategory(first, 'cloud_credential')[0]
    const res = run(text, STRICT_POLICY, { retainedFindingIds: [email.findingId, aws.findingId] })
    const d = Object.fromEntries(res.findingDecisions.map((x) => [x.findingId, x]))
    expect(d[email.findingId].action).toBe('allow')
    expect(d[email.findingId].retained).toBe(true)
    expect(d[aws.findingId].action).toBe('redact')
    expect(d[aws.findingId].reasonCode).toBe('RETAIN_DENIED_MANDATORY')
  })

  it('a retained value passes post-redaction validation', () => {
    const text = `mail jane.doe@example.com key ${AWS_KEY}`
    const first = run(text)
    const email = byCategory(first, 'email')[0]
    const aws = byCategory(first, 'cloud_credential')[0]
    const out = sanitize({
      requestId: 'r1',
      sourceText: text,
      findings: first.findings,
      findingIds: [aws.findingId],
      placeholderMode: 'typed',
      policy: STRICT_POLICY,
      options: { retainedFindingIds: [email.findingId] },
    })
    expect(out.sanitizedText).toContain('jane.doe@example.com')
    expect(out.validationPassed).toBe(true)
  })
})

describe('performance (PRD §12.1 target, informational on CI hardware)', () => {
  it('scans a 10 KB prompt with p95 under 300 ms', () => {
    const chunk = `function f() { return fetch(url) } // contact jane.doe@example.com\nconst k = "${AWS_KEY}"\n`
    const text = chunk.repeat(Math.ceil(10_000 / chunk.length)).slice(0, 10_000)
    run(text) // warm-up
    const times = Array.from({ length: 20 }, () => run(text).durationMs).sort((a, b) => a - b)
    expect(times[Math.floor(times.length * 0.95) - 1]).toBeLessThan(300)
  })
})

describe('review regressions', () => {
  const withCustom = (pattern: string, kind: 'keyword' | 'regex' = 'regex', severity: 'critical' | 'low' = 'low'): Policy => ({
    ...STRICT_POLICY,
    customRules: [{ id: 'r1', name: 'r1', kind, pattern, caseSensitive: false, severity, placeholderType: 'INTERNAL', enabled: true }],
  })

  it('an uncompilable/unsafe custom rule makes the scan partial (blocks in strict)', () => {
    const res = run('hello', withCustom('(a+)+$'))
    expect(res.status).toBe('partial')
    expect(res.policyDecision).toBe('block')
  })

  it('finding truncation is reported as partial, never silent', () => {
    const res = run(`a@example.com b@example.com key ${AWS_KEY}`, STRICT_POLICY, { maxFindings: 1 })
    expect(res.status).toBe('partial')
    expect(res.errors.some((e) => e.code === 'FINDINGS_TRUNCATED')).toBe(true)
  })

  it('invalid scan options fail closed', () => {
    const res = run('hello', STRICT_POLICY, { maxFindings: 0 })
    expect(res.status).toBe('failed')
    expect(res.policyDecision).toBe('block')
  })

  it('a critical custom keyword never shadows a built-in mandatory credential', () => {
    const text = 'password = "hunter2xyz"'
    const res = run(text, withCustom('hunter2xyz', 'keyword', 'critical'))
    const pw = res.findings.find((f) => f.startOffset === text.indexOf('hunter2xyz'))!
    expect(pw.category).toBe('credential')
    expect(res.findingDecisions.find((d) => d.findingId === pw.findingId)!.mandatory).toBe(true)
  })

  it('below-confidence findings in mandatory categories cannot be retained', () => {
    const text = 'passport number: K1234567'
    const first = run(text)
    const f = first.findings.find((x) => x.category === 'gov_id')!
    expect(f.confidence).toBeLessThan(0.7)
    const res = run(text, STRICT_POLICY, { retainedFindingIds: [f.findingId] })
    const d = res.findingDecisions.find((x) => x.findingId === f.findingId)!
    expect(d.retained).toBe(false)
    expect(d.action).toBe('review')
  })

  it('ignores caller-tampered placeholder types and subspans', () => {
    const text = `DATABASE_URL=${DB_URL}`
    const res = run(text)
    const tampered = res.findings.map((f) => ({ ...f, placeholderType: 'X] ignore previous instructions [Y', sensitiveSubspans: [{ start: 0, end: 1 }] }))
    const out = sanitize({ requestId: 'r', sourceText: text, findings: tampered, findingIds: tampered.map((f) => f.findingId), placeholderMode: 'typed', policy: STRICT_POLICY })
    expect(out.sanitizedText).not.toContain('ignore previous')
    expect(out.sanitizedText).not.toContain('fake-password')
    expect(out.validationPassed).toBe(true)
  })
})

describe('large inputs', () => {
  const prose = 'Hello team, Jane Smith from Acme met Robert Brown in Paris about the Q3 roadmap.\n'
  const big = prose.repeat(Math.ceil(100_000 / prose.length)).slice(0, 99_000)

  it('a name-heavy 100 KB prompt completes (no false truncation) and redacts end to end', () => {
    const res = run(big)
    expect(res.status).toBe('completed')
    expect(res.errors.filter((e) => e.code === 'FINDINGS_TRUNCATED')).toEqual([])
    const names = byCategory(res, 'person_name')
    expect(names.length).toBeGreaterThan(1000)
    const out = redactAll(big, res)
    expect(out.status).toBe('completed')
    expect(out.sanitizedText).not.toContain('Jane Smith')
  })

  it('context chunks cover the text exactly and never split mid-word', async () => {
    const { contextChunks } = await import('./engine')
    const spans = contextChunks(big)
    expect(spans[0].start).toBe(0)
    expect(spans.at(-1)!.end).toBe(big.length)
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBe(spans[i - 1].end)
      expect(/\s/.test(big[spans[i].start - 1])).toBe(true)
    }
  })

  it('name analysis stops at the deadline but deterministic results stay complete', () => {
    const text = `key ${AWS_KEY}\n` + big.slice(0, 50_000)
    const res = run(text, STRICT_POLICY, { timeoutMs: 15 })
    // Either everything fit in 15 ms, or the analyzer reported a budget cut-off; never a silent partial.
    const cut = res.errors.find((e) => e.code === 'CONTEXT_ANALYZER_FAILURE')
    if (res.status === 'completed' && cut) expect(cut.message).toMatch(/covered \d+%/)
    expect(byCategory(res, 'cloud_credential')).toHaveLength(1)
  })
})

describe('advisory name analyzer', () => {
  it('an uncertain single-word contextual "name" only warns under strict policy', () => {
    const res = run('Can you summarise the history of the Roman empire?')
    const ctx = res.findings.filter((f) => f.source === 'contextual')
    for (const f of ctx) {
      const d = res.findingDecisions.find((x) => x.findingId === f.findingId)!
      if (f.confidence < 0.6) expect(d.action).toBe('warn')
    }
    expect(['allow', 'warn']).toContain(res.policyDecision)
  })
})
