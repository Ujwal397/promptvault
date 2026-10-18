import { describe, expect, it, vi } from 'vitest'
import type { EvalCase } from './corpus'
import { runEvaluation, type EvalDeps } from './runEval'
import type { Category, Finding, SanitizeResult, ScanResult } from '../types'

function finding(category: Category, start: number, end: number, extra: Partial<Finding> = {}): Finding {
  return {
    findingId: `f-${start}`,
    category,
    startOffset: start,
    endOffset: end,
    severity: 'high',
    confidence: 0.9,
    detectorId: `test.${category}`,
    detectorVersion: '1.0.0',
    reasonCode: 'TEST',
    recommendedAction: 'redact',
    label: category,
    explanation: 'test',
    placeholderType: 'X',
    source: 'deterministic',
    ...extra,
  }
}

function scanResult(findings: Finding[], decision: ScanResult['policyDecision'], status: ScanResult['status'] = 'completed'): ScanResult {
  return {
    requestId: 'r', status, findings, riskScore: 0, riskBand: 'none', policyDecision: decision, findingDecisions: [],
    reasonCodes: [], mandatoryRulesTriggered: [], detectorVersions: {}, errors: [], durationMs: 0,
    policyId: 'p', policyVersion: '1', coreVersion: '1',
  }
}

const sanitized = (text: string | null, validationPassed = true): SanitizeResult => ({
  status: 'completed', sanitizedText: text, replacements: [], residualFindingIds: [], postScan: null,
  validationPassed, residualRiskNotes: [], errors: [],
})

const mkCase = (
  id: string,
  text: string,
  expected: EvalCase['expected'],
  decision: EvalCase['expectedDecision'],
  extra: Partial<EvalCase> = {},
): EvalCase => ({ id, description: id, text, expected, expectedDecision: decision, tags: ['positive'], split: 'dev', ...extra })

function deps(scans: Record<string, ScanResult | Error>, san?: EvalDeps['sanitize']): EvalDeps {
  let tick = 0
  return {
    scan: (text) => {
      const r = scans[text]
      if (r instanceof Error) throw r
      return r
    },
    sanitize: san ?? ((text) => sanitized(text.replace(/secretvalue|a@example\.com/g, '[X]'))),
    now: () => Date.UTC(2026, 0, 2, 3, 4, 5),
    clock: () => (tick += 5),
  }
}

describe('runEvaluation', () => {
  it('computes tp/fp/fn, precision, recall, f1 and span accuracy', () => {
    const t1 = 'mail a@example.com now'
    const t2 = 'nothing here'
    const cases = [
      mkCase('c1', t1, [{ category: 'email', value: 'a@example.com' }], 'redact'),
      mkCase('c2', t2, [], 'allow', { tags: ['negative'] }),
    ]
    const report = runEvaluation(cases, deps({
      [t1]: scanResult([finding('email', 5, 18), finding('phone', 0, 2)], 'redact'),
      [t2]: scanResult([finding('ip_address', 0, 3)], 'warn'),
    }))
    expect(report.totals).toMatchObject({ cases: 2, tp: 1, fp: 2, fn: 0, recall: 1 })
    expect(report.totals.precision).toBeCloseTo(1 / 3)
    expect(report.totals.f1).toBeCloseTo(0.5)
    expect(report.perCategory.email).toMatchObject({ tp: 1, fp: 0, fn: 0, support: 1, f1: 1 })
    expect(report.perCategory.phone).toMatchObject({ tp: 0, fp: 1, precision: 0, recall: null, f1: null })
    expect(report.spanAccuracy).toBe(1)
    expect(report.policyAccuracy).toBe(0.5)
    expect(report.falseBlockRate).toBe(0)
    expect(report.generatedAt).toBe('2026-01-02T03:04:05.000Z')
    expect(report.cases[0].unexpected).toEqual([{ category: 'phone', detectorId: 'test.phone' }])
  })

  it('returns null for undefined metrics and handles an empty corpus', () => {
    const report = runEvaluation([], deps({}))
    expect(report.totals).toMatchObject({ cases: 0, precision: null, recall: null, f1: null })
    expect(report.policyAccuracy).toBeNull()
    expect(report.redactionSuccess).toBeNull()
    expect(report.falseBlockRate).toBeNull()
    expect(report.latency).toEqual({ p50: null, p95: null, max: null })
    expect(report.bySplit.heldout).toEqual({ cases: 0, precision: null, recall: null, policyAccuracy: null })
  })

  it('does not call sanitize when nothing is expected and reports redactionOk null', () => {
    const sanitize = vi.fn(() => sanitized(''))
    const report = runEvaluation(
      [mkCase('n', 'hello', [], 'allow', { tags: ['negative'] })],
      deps({ hello: scanResult([], 'allow') }, sanitize),
    )
    expect(sanitize).not.toHaveBeenCalled()
    expect(report.cases[0].redactionOk).toBeNull()
    expect(report.redactionSuccess).toBeNull()
    expect(report.totals.precision).toBeNull()
  })

  it('matches one-to-one: a single wide prediction cannot satisfy two expectations', () => {
    const text = 'a@example.com b@example.com'
    const report = runEvaluation(
      [mkCase('w', text, [{ category: 'email', value: 'a@example.com' }, { category: 'email', value: 'b@example.com' }], 'redact')],
      deps({ [text]: scanResult([finding('email', 0, 27)], 'redact') }),
    )
    expect(report.cases[0]).toMatchObject({ tp: 1, fn: 1, fp: 0, spanExact: 0 })
  })

  it('prefers exact span matches and requires equal categories', () => {
    const text = 'x a@example.com y'
    const report = runEvaluation(
      [mkCase('e', text, [{ category: 'email', value: 'a@example.com' }], 'redact')],
      deps({ [text]: scanResult([finding('phone', 2, 15), finding('email', 0, 17), finding('email', 2, 15)], 'redact') }),
    )
    expect(report.cases[0]).toMatchObject({ tp: 1, fp: 2, fn: 0, spanExact: 1 })
  })

  it('resolves repeated values by occurrence', () => {
    const text = 'a@example.com and a@example.com'
    const report = runEvaluation(
      [mkCase('r', text, [{ category: 'email', value: 'a@example.com', occurrence: 2 }], 'redact')],
      deps({ [text]: scanResult([finding('email', 18, 31)], 'redact') }),
    )
    expect(report.cases[0]).toMatchObject({ tp: 1, fn: 0, spanExact: 1 })
  })

  it('excludes obfuscation from fp but counts unmatched contextual names as fp', () => {
    const text = 'hello Alice'
    const report = runEvaluation(
      [mkCase('o', text, [], 'redact', { tags: ['negative'] })],
      deps({ [text]: scanResult([finding('obfuscation', 0, 1), finding('person_name', 6, 11, { source: 'contextual' })], 'redact') }),
    )
    expect(report.cases[0]).toMatchObject({ fp: 1, tp: 0 })
    expect(report.cases[0].unexpected).toEqual([{ category: 'person_name', detectorId: 'test.person_name' }])
    expect(report.falseBlockRate).toBe(1)
  })

  it('counts a throwing scan as a failed case, never skipped', () => {
    const text = 'key secretvalue'
    const report = runEvaluation(
      [mkCase('f', text, [{ category: 'credential', value: 'secretvalue' }], 'redact')],
      deps({ [text]: new Error('boom') }),
    )
    expect(report.totals.cases).toBe(1)
    expect(report.cases[0]).toMatchObject({
      scanStatus: 'failed', actualDecision: null, decisionCorrect: false, tp: 0, fn: 1, redactionOk: false,
    })
    expect(report.perCategory.credential).toMatchObject({ fn: 1 })
  })

  it('masks missed values and never leaks them in the report', () => {
    const text = 'key secretvalue'
    const report = runEvaluation(
      [mkCase('m', text, [{ category: 'credential', value: 'secretvalue' }], 'redact')],
      deps({ [text]: scanResult([], 'allow') }),
    )
    expect(report.cases[0].missed).toEqual([{ category: 'credential', value: 'se…' }])
    expect(JSON.stringify(report)).not.toContain('secretvalue')
  })

  it('fails redaction when a value survives, validation fails, or sanitize throws', () => {
    const text = 'key secretvalue'
    const c = mkCase('s', text, [{ category: 'credential', value: 'secretvalue' }], 'redact')
    const scans = { [text]: scanResult([finding('credential', 4, 15)], 'redact') }
    expect(runEvaluation([c], deps(scans, (t) => sanitized(t))).redactionSuccess).toBe(0)
    expect(runEvaluation([c], deps(scans, () => sanitized('key [X]', false))).redactionSuccess).toBe(0)
    expect(runEvaluation([c], deps(scans, () => sanitized('key [X]'))).redactionSuccess).toBe(1)
    expect(
      runEvaluation([c], deps(scans, () => { throw new Error('x') })).redactionSuccess,
    ).toBe(0)
  })

  it('reports latency percentiles and per-split metrics', () => {
    const ids = ['a', 'b', 'c', 'd']
    const cases = ids.map((t, i) => mkCase(t, t, [], 'allow', { split: i < 3 ? 'dev' : 'heldout', tags: ['negative'] }))
    const scans = Object.fromEntries(ids.map((t) => [t, scanResult([], 'allow')]))
    const report = runEvaluation(cases, deps(scans))
    expect(report.latency).toEqual({ p50: 5, p95: 5, max: 5 })
    expect(report.bySplit.dev).toMatchObject({ cases: 3, policyAccuracy: 1 })
    expect(report.bySplit.heldout).toMatchObject({ cases: 1, policyAccuracy: 1 })
  })
})
