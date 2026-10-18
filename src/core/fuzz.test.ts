import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { sanitize, scan, STRICT_POLICY } from './index'
import type { Finding, ScanResult } from './types'

const RUNS = (() => {
  const raw = typeof process !== 'undefined' ? process.env?.FUZZ_RUNS : undefined
  const n = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(n) && n > 0 ? n : 200
})()

// Synthetic secrets, assembled by concatenation.
const SECRETS = [
  'AKIA' + 'IOSFODNN7EXAMPLE',
  'ghp_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8',
  'fuzz.person' + '@example.com',
  'postgres://svc:' + 'S3cretPassw0rd' + '@db.example.test:5432/app',
  ['-----BEGIN RSA PRIVATE KEY-----', 'MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu', '-----END RSA PRIVATE KEY-----'].join('\n'),
]

const NOISE = [
  '​', '‍', '⁠', '﻿', '­', '‮', '‫', '\r\n', '\n', '\t', ' ',
  '\u{1F600}', '\u{1F9D1}‍\u{1F4BB}', '\u{1F1EE}\u{1F1F3}', 'אב', 'ال', 'é',
  'const x = { a: 1 };', 'if (a && b) { return "ok" }', '// TODO: fix', 'SELECT * FROM t;', '{"k": "v"}',
  'key=', 'password: ', 'token ', 'Bearer ', 'user@', 'http://', '-----BEGIN ',
]

const piece = fc.oneof(
  { weight: 3, arbitrary: fc.constantFrom(...NOISE) },
  { weight: 2, arbitrary: fc.string({ unit: 'binary', maxLength: 12 }) },
  { weight: 2, arbitrary: fc.string({ unit: 'grapheme', maxLength: 12 }) },
  // Secrets are delimited by a realistic separator. Tokens glued to adjacent alphanumerics are a documented
  // limitation except AWS key IDs (see the dedicated property below).
  {
    weight: 2,
    arbitrary: fc
      .tuple(fc.constantFrom(' ', '\n', '\t', '"', "'", '=', ':', ',', '(', '/'), fc.constantFrom(...SECRETS), fc.constantFrom(' ', '\n', '"', "'", ',', ')', ';'))
      .map(([l, s, r]) => l + s + r),
  },
)
const textArb = fc.array(piece, { maxLength: 14 }).map((p) => p.join(''))

const runScan = (text: string): ScanResult => scan({ requestId: 'fz', text, policy: STRICT_POLICY })

function splitsSurrogate(text: string, i: number): boolean {
  if (i <= 0 || i >= text.length) return false
  const prev = text.charCodeAt(i - 1)
  const cur = text.charCodeAt(i)
  return prev >= 0xd800 && prev <= 0xdbff && cur >= 0xdc00 && cur <= 0xdfff
}

function sanitizeAll(text: string, s: ScanResult) {
  return sanitize({
    requestId: 'fz',
    sourceText: text,
    findings: s.findings,
    findingIds: s.findings.map((f) => f.findingId),
    placeholderMode: 'typed',
    policy: STRICT_POLICY,
  })
}

const opts = { numRuns: RUNS }

describe('engine fuzz', () => {
  it('scan never throws and every finding range is valid', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const r = runScan(text)
        expect(['completed', 'partial', 'failed']).toContain(r.status)
        for (const f of r.findings) {
          expect(f.startOffset).toBeGreaterThanOrEqual(0)
          expect(f.startOffset).toBeLessThan(f.endOffset)
          expect(f.endOffset).toBeLessThanOrEqual(text.length)
          expect(splitsSurrogate(text, f.startOffset)).toBe(false)
          expect(splitsSurrogate(text, f.endOffset)).toBe(false)
          expect(f.confidence).toBeGreaterThanOrEqual(0)
          expect(f.confidence).toBeLessThanOrEqual(1)
        }
      }),
      opts,
    )
  })

  it('is deterministic', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const strip = (r: ScanResult) => ({ ...r, durationMs: 0 })
        expect(strip(runScan(text))).toEqual(strip(runScan(text)))
      }),
      opts,
    )
  })

  it('sanitize-all never silently passes with a secret still present', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const s = runScan(text)
        const out = sanitizeAll(text, s)
        if (out.status !== 'completed' || out.sanitizedText === null) return
        const injected = SECRETS.filter((v) => text.includes(v))
        const present = injected.filter((v) => out.sanitizedText!.includes(v))
        if (present.length > 0) expect(out.validationPassed).toBe(false)
      }),
      opts,
    )
  })

  it('preserves the text outside replaced spans', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const s = runScan(text)
        const out = sanitizeAll(text, s)
        if (out.status !== 'completed' || out.sanitizedText === null) return
        const spans = [...out.replacements].sort((a, b) => a.start - b.start)
        const outsideSource: string[] = []
        let cursor = 0
        for (const r of spans) {
          outsideSource.push(text.slice(cursor, r.start))
          cursor = r.end
        }
        outsideSource.push(text.slice(cursor))
        // Walk the sanitized text: each outside segment must appear in order, with placeholders between.
        let pos = 0
        spans.forEach((r, i) => {
          const seg = outsideSource[i]!
          expect(out.sanitizedText!.startsWith(seg, pos)).toBe(true)
          pos += seg.length
          expect(out.sanitizedText!.startsWith(r.placeholder, pos)).toBe(true)
          pos += r.placeholder.length
        })
        expect(out.sanitizedText!.slice(pos)).toBe(outsideSource[spans.length])
      }),
      opts,
    )
  })

  it('failed or partial scans never allow under strict', () => {
    const modes = fc.constantFrom<string | undefined>(undefined, '*', 'secret.aws-access-key', 'pii.email')
    fc.assert(
      fc.property(textArb, modes, (text, fail) => {
        const r = scan({
          requestId: 'fz', text, policy: STRICT_POLICY,
          options: fail ? { faultInjection: { failDetectorId: fail } } : undefined,
        })
        if (r.status !== 'completed') expect(r.policyDecision).not.toBe('allow')
        if (fail === '*') expect(r.status).not.toBe('completed')
      }),
      opts,
    )
  })

  it('findings reference no raw value in explanations', () => {
    fc.assert(
      fc.property(textArb, (text) => {
        const r = runScan(text)
        const all: Finding[] = r.findings
        for (const f of all) {
          for (const v of SECRETS) if (text.includes(v)) expect(f.explanation.includes(v)).toBe(false)
        }
      }),
      opts,
    )
  })
})

describe('glued AWS key IDs (fuzz regression)', () => {
  const KEY = 'AKIA' + 'IOSFODNN7EXAMPLE'
  it('are never silently allowed when glued to alphanumerics', () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z0-9]{0,8}$/), fc.stringMatching(/^[A-Za-z0-9]{0,8}$/), (l, r) => {
        const text = `${l}${KEY}${r}`
        const res = runScan(text)
        expect(res.policyDecision).not.toBe('allow')
        const ids = res.findingDecisions.filter((d) => d.action !== 'allow').map((d) => d.findingId)
        const out = sanitize({ requestId: 'fz', sourceText: text, findings: res.findings, findingIds: ids, placeholderMode: 'typed', policy: STRICT_POLICY })
        expect(out.sanitizedText?.includes(KEY) && out.validationPassed).toBe(false)
      }),
      { numRuns: 200 },
    )
  })
})
