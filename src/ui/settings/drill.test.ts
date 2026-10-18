import { describe, expect, it } from 'vitest'
import { PERMISSIVE_POLICY, STRICT_POLICY, scan, type Policy, type ScanRequest } from '../../core'
import { DRILL_SAMPLE, countErrorCodes, interpretDrill } from './drill'

const drillRequest = (policy: Policy): ScanRequest => ({
  requestId: 'drill-test',
  text: DRILL_SAMPLE,
  policy,
  options: { faultInjection: { failDetectorId: '*' } },
})

describe('interpretDrill', () => {
  it('holds when the scan failed and blocked', () => {
    const verdict = interpretDrill({ status: 'failed', policyDecision: 'block' })
    expect(verdict.held).toBe(true)
    expect(verdict.headline).toBe('Fail-closed held.')
  })

  it('holds for a partial scan that blocked', () => {
    expect(interpretDrill({ status: 'partial', policyDecision: 'block' }).held).toBe(true)
  })

  it('does not hold when an incomplete scan only warns, and says so', () => {
    const verdict = interpretDrill({ status: 'failed', policyDecision: 'warn' })
    expect(verdict.held).toBe(false)
    expect(verdict.headline).toContain('The decision is warn, not block')
  })

  it('does not hold when a scan reports completed despite the injected fault', () => {
    const verdict = interpretDrill({ status: 'completed', policyDecision: 'block' })
    expect(verdict.held).toBe(false)
    expect(verdict.headline).toBe('Fail-closed did not hold.')
  })
})

describe('countErrorCodes', () => {
  it('counts repeated codes once each, in code order', () => {
    const counts = countErrorCodes([
      { code: 'DETECTOR_FAILURE', message: 'a', detectorId: 'x' },
      { code: 'CONTEXT_ANALYZER_FAILURE', message: 'b' },
      { code: 'DETECTOR_FAILURE', message: 'c', detectorId: 'y' },
    ])
    expect(counts).toEqual([
      { code: 'CONTEXT_ANALYZER_FAILURE', count: 1 },
      { code: 'DETECTOR_FAILURE', count: 2 },
    ])
  })

  it('returns nothing for an error-free result', () => {
    expect(countErrorCodes([])).toEqual([])
  })
})

describe('failure drill against the real engine', () => {
  it.each([
    ['Strict', STRICT_POLICY],
    ['Permissive', PERMISSIVE_POLICY],
  ])('%s: every detector failing gives a failed scan that blocks and is not clean', (_name, policy) => {
    const result = scan(drillRequest(policy))
    expect(result.status).toBe('failed')
    expect(result.policyDecision).toBe('block')
    expect(result.findings).toHaveLength(0)
    expect(countErrorCodes(result.errors).map((e) => e.code)).toContain('DETECTOR_FAILURE')
    expect(interpretDrill(result).held).toBe(true)
  })

  it('reports not held when the policy sets a scan-failure decision other than block', () => {
    const lax: Policy = { ...STRICT_POLICY, onScanFailure: 'warn' }
    const result = scan(drillRequest(lax))
    expect(result.policyDecision).toBe('warn')
    expect(interpretDrill(result).held).toBe(false)
  })

  it('treats a completed scan as not held, so a drill whose fault never fires cannot pass', () => {
    const result = scan({ requestId: 'no-fault', text: DRILL_SAMPLE, policy: STRICT_POLICY })
    expect(result.status).toBe('completed')
    expect(interpretDrill(result).held).toBe(false)
  })
})
