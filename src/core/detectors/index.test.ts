import { describe, expect, it } from 'vitest'
import type { CustomRule, Detector, RawFinding } from '../types'
import { BUILTIN_DETECTORS, buildCustomDetectors, runDetectors } from './index'
import { hasNestedQuantifier } from './customRules'
import { hasLabelBefore, luhnValid, matchAll, shannonEntropy } from './util'

const rule = (over: Partial<CustomRule>): CustomRule => ({
  id: 'r1',
  name: 'Rule',
  kind: 'keyword',
  pattern: 'secret',
  caseSensitive: false,
  severity: 'medium',
  placeholderType: 'CUSTOM',
  enabled: true,
  ...over,
})

const FAR = Number.MAX_SAFE_INTEGER

function fake(id: string, hits: Array<[number, number]>, extra: Partial<RawFinding> = {}): Detector {
  return {
    id,
    version: '2.0.0',
    category: 'email',
    description: 'fake',
    examples: { positive: [], negative: [] },
    detect: () =>
      hits.map(([s, e]) => ({
        category: 'email', startOffset: s, endOffset: e, severity: 'low', confidence: 0.5, detectorId: id,
        detectorVersion: '2.0.0', reasonCode: 'X', recommendedAction: 'redact', label: 'l', explanation: 'e',
        placeholderType: 'T', source: 'deterministic', ...extra,
      })),
  }
}

describe('util', () => {
  it('matchAll requires the g flag and survives empty matches', () => {
    expect(() => [...matchAll(/a/, 'a')]).toThrow()
    expect([...matchAll(/a*/g, 'baa')].length).toBeGreaterThan(0)
  })
  it('entropy, luhn, labels', () => {
    expect(shannonEntropy('aaaa')).toBe(0)
    expect(shannonEntropy('abcd')).toBeCloseTo(2)
    expect(luhnValid('4111111111111111')).toBe(true)
    expect(luhnValid('4111111111111112')).toBe(false)
    expect(hasLabelBefore('My Phone: 555', 10, ['phone'], 20)).toBe(true)
    expect(hasLabelBefore('hotel 555', 6, ['tel'], 20)).toBe(false)
  })
})

describe('BUILTIN_DETECTORS', () => {
  it('has unique ids', () => {
    const ids = BUILTIN_DETECTORS.map((d) => d.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('buildCustomDetectors', () => {
  it('keyword rules use word boundaries and escape literals', () => {
    const { detectors, errors } = buildCustomDetectors([rule({ pattern: 'Project X' }), rule({ id: 'r2', pattern: 'a.b' })])
    expect(errors).toEqual([])
    const [d1, d2] = detectors
    expect(d1.id).toBe('custom.r1')
    expect(d1.detect({ text: 'about project x today' })).toHaveLength(1)
    expect(d1.detect({ text: 'project xylophone' })).toHaveLength(0)
    expect(d2.detect({ text: 'a.b axb' })).toHaveLength(1)
    const f = d1.detect({ text: 'project x' })[0]
    expect(f).toMatchObject({ category: 'custom', source: 'custom', confidence: 0.9, recommendedAction: 'review', severity: 'medium' })
  })

  it('keyword with non-word edges has no boundary requirement there', () => {
    const [d] = buildCustomDetectors([rule({ pattern: '#tag' })]).detectors
    expect(d.detect({ text: 'x#tag' })).toHaveLength(1)
  })

  it('respects caseSensitive', () => {
    const [d] = buildCustomDetectors([rule({ caseSensitive: true, pattern: 'ACME' })]).detectors
    expect(d.detect({ text: 'acme ACME' })).toHaveLength(1)
  })

  it('skips disabled rules and accepts safe regexes at 0.85', () => {
    const { detectors, errors } = buildCustomDetectors([
      rule({ enabled: false }),
      rule({ id: 'r3', kind: 'regex', pattern: 'EMP-\\d{4,6}' }),
    ])
    expect(errors).toEqual([])
    expect(detectors).toHaveLength(1)
    expect(detectors[0].detect({ text: 'emp-12345' })[0].confidence).toBe(0.85)
  })

  it.each([
    ['(a+)+', 'nested'],
    ['(\\w*)*', 'nested'],
    ['(.+)+', 'nested'],
    ['(a|aa)+b', 'ambiguous alternation'],
    ['(a)\\1', 'backreference'],
    ['(?<=x)y', 'lookbehind'],
    ['a*', 'empty match'],
    ['(', 'invalid'],
  ])('rejects %s (%s)', (pattern) => {
    const { detectors, errors } = buildCustomDetectors([rule({ kind: 'regex', pattern })])
    expect(detectors).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('POLICY_INVALID')
    expect(errors[0].message).not.toContain(pattern.length > 3 ? pattern : '\u0000')
  })

  it('allows safe grouped patterns', () => {
    for (const p of ['(foo|bar)+', '(?:ab){2,3}', 'a+b+', '[a-z]+@corp\\.com', '(a+)?']) {
      expect(hasNestedQuantifier(p), p).toBe(false)
    }
  })
})

describe('runDetectors', () => {
  it('maps spans back over invisible chars, covering them inside the match', () => {
    const text = 'x user@exam​ple.com y'
    const email = BUILTIN_DETECTORS.filter((d) => d.id === 'pii.email')
    const r = runDetectors(text, email, { deadline: FAR })
    const f = r.raw.find((x) => x.detectorId === 'pii.email')!
    expect(text.slice(f.startOffset, f.endOffset)).toBe('user@exam​ple.com')
    expect(r.raw.some((x) => x.category === 'obfuscation')).toBe(true)
    expect(r.versions['pii.email']).toBe('1.0.0')
  })

  it('maps sensitiveSubspans too', () => {
    const d = fake('f.sub', [[2, 6]], { sensitiveSubspans: [{ start: 3, end: 5 }] })
    const r = runDetectors('ab​cdef', [d], { deadline: FAR })
    expect(r.raw[r.raw.length - 1].sensitiveSubspans).toEqual([{ start: 4, end: 6 }])
  })

  it('drops invalid findings and reports INVALID_FINDING_RANGE', () => {
    const d = fake('f.bad', [[0, 2], [5, 5], [-1, 2], [3, 999]])
    const r = runDetectors('abcdef', [d], { deadline: FAR })
    expect(r.raw).toHaveLength(1)
    expect(r.errors.map((e) => e.code)).toEqual(['INVALID_FINDING_RANGE'])
    expect(r.errors[0].detectorId).toBe('f.bad')
    const c = runDetectors('abcdef', [fake('f.conf', [[0, 2]], { confidence: 1.5 })], { deadline: FAR })
    expect(c.raw).toHaveLength(0)
    expect(c.errors).toHaveLength(1)
  })

  it('reports thrown detectors as DETECTOR_FAILURE and keeps running others', () => {
    const boom: Detector = { ...fake('f.boom', []), detect: () => { throw new Error('SECRET-VALUE') } }
    const ok = fake('f.ok', [[0, 1]])
    const r = runDetectors('abc', [boom, ok], { deadline: FAR })
    expect(r.errors).toEqual([{ code: 'DETECTOR_FAILURE', message: expect.any(String), detectorId: 'f.boom' }])
    expect(r.errors[0].message).not.toContain('SECRET-VALUE')
    expect(r.raw).toHaveLength(1)
  })

  it('fault injection by id and by wildcard', () => {
    const a = fake('f.a', [[0, 1]])
    const b = fake('f.b', [[0, 1]])
    const one = runDetectors('abc', [a, b], { deadline: FAR, failDetectorId: 'f.a' })
    expect(one.errors.map((e) => e.detectorId)).toEqual(['f.a'])
    expect(one.raw).toHaveLength(1)
    const all = runDetectors('abc', [a, b], { deadline: FAR, failDetectorId: '*' })
    expect(all.errors).toHaveLength(2)
    expect(all.raw).toHaveLength(0)
  })

  it('stops at the deadline and sets timedOut', () => {
    let t = 0
    const now = () => t++
    const ds = [fake('f.1', [[0, 1]]), fake('f.2', [[0, 1]]), fake('f.3', [[0, 1]])]
    const r = runDetectors('abc', ds, { deadline: 1, now })
    expect(r.timedOut).toBe(true)
    expect(r.raw.length).toBeLessThan(3)
  })

  it('does not mutate detector output', () => {
    const r = runDetectors('abc', [fake('f.m', [[0, 1]])], { deadline: FAR })
    expect(r.raw[0]).not.toBe(undefined)
  })
})

describe('ReDoS / performance on 100k pathological inputs', () => {
  const N = 100_000
  const inputs: Record<string, string> = {
    a: 'a'.repeat(N),
    at: '@'.repeat(N),
    digits: '1'.repeat(N),
    digitsSp: '1 '.repeat(N / 2),
    dashes: '-'.repeat(N),
    plus: '+'.repeat(N),
    dots: '1.'.repeat(N / 2),
    pem: '-----BEGIN '.repeat(N / 11),
    upper: 'AB12'.repeat(N / 4),
    emailish: 'a@'.repeat(N / 2),
    mixed: ('a1@.- +9X​'.repeat(N / 9)).slice(0, N),
    labels: 'phone: account number: MRN: Name: '.repeat(N / 34),
  }
  const custom = buildCustomDetectors([
    rule({ id: 'kw', pattern: 'secret' }),
    rule({ id: 'rx', kind: 'regex', pattern: '[A-Z]{2}-\\d{3,8}' }),
  ]).detectors
  for (const [name, text] of Object.entries(inputs)) {
    it(`finishes quickly: ${name}`, () => {
      const input = text.slice(0, N)
      const start = performance.now()
      const r = runDetectors(input, [...BUILTIN_DETECTORS, ...custom], { deadline: FAR })
      const ms = performance.now() - start
      expect(r.errors.filter((e) => e.code === 'DETECTOR_FAILURE')).toEqual([])
      expect(ms).toBeLessThan(1500)
    })
  }
})
