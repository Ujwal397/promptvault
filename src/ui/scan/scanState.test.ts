import { describe, expect, it } from 'vitest'
import { makeFinding, makeScan } from './scanFixtures'
import { describeScan } from './scanState'

const finding = makeFinding({ findingId: 'f-0', startOffset: 0, endOffset: 5 })

describe('describeScan', () => {
  it('shows nothing when idle', () => {
    expect(describeScan({ status: 'idle' })).toBeNull()
  })

  it('shows a neutral line while scanning', () => {
    expect(describeScan({ status: 'scanning' })).toEqual({ tone: 'neutral', text: 'Scanning…' })
  })

  it('shows nothing for a completed scan, which moves on to Review', () => {
    expect(describeScan({ status: 'done', result: makeScan({ findings: [finding, finding] }) })).toBeNull()
  })

  it('summarises a partial scan with findings, risk and decision, and says it is not fully checked', () => {
    const partial = makeScan({ status: 'partial', findings: [finding], riskScore: null, riskBand: null, policyDecision: 'block' })
    const line = describeScan({ status: 'done', result: partial })
    expect(line).toEqual({
      tone: 'warning',
      text: 'Scan incomplete: 1 finding, risk not scored, decision block. Some checks did not finish, so this prompt is not fully checked.',
    })
  })

  it('uses the plural for several findings in a partial scan', () => {
    const partial = makeScan({ status: 'partial', findings: [finding, finding], riskScore: null, riskBand: null })
    expect(describeScan({ status: 'done', result: partial })?.text).toContain('2 findings,')
  })

  it('never describes a failed scan as complete', () => {
    const failed = makeScan({ status: 'failed', riskScore: null, riskBand: null, policyDecision: 'block' })
    const line = describeScan({ status: 'done', result: failed })
    expect(line?.tone).toBe('danger')
    expect(line?.text).toMatch(/^Scan failed/)
    expect(line?.text).not.toMatch(/complete/i)
  })

  it('reports a client error as not checked', () => {
    expect(describeScan({ status: 'error' })).toEqual({
      tone: 'danger',
      text: 'Scan could not run, so this prompt was not checked.',
    })
  })
})
